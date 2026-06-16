/**
 * وصلني كتامية — Security Layer
 * حماية عالية المستوى ضد الهكر والتلاعب
 */

const Security = (() => {

  /* ── 1. Content Security Policy ── */
  function applyCSP() {
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://unpkg.com https://fonts.googleapis.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
      "font-src https://fonts.gstatic.com",
      "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://firestore.googleapis.com https://nominatim.openstreetmap.org https://*.tile.openstreetmap.org",
      "img-src 'self' data: https://*.tile.openstreetmap.org https://*.openstreetmap.org",
      "frame-ancestors 'none'"
    ].join('; ');
    document.head.prepend(meta);
  }

  /* ── 2. Anti DevTools ── */
  function antiDevTools() {
    // Detect opening devtools via timing
    let devOpen = false;
    const check = () => {
      const start = performance.now();
      // eslint-disable-next-line no-debugger
      debugger;
      if (performance.now() - start > 100) {
        devOpen = true;
        handleDevTools();
      }
    };
    setInterval(check, 3000);

    // Disable right-click
    document.addEventListener('contextmenu', e => e.preventDefault());

    // Disable common keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I','J','C','K'].includes(e.key)) ||
        (e.ctrlKey && e.key === 'U') ||
        (e.ctrlKey && e.key === 'S')
      ) {
        e.preventDefault();
        return false;
      }
    });
  }

  function handleDevTools() {
    // Clear sensitive data from DOM temporarily
    document.querySelectorAll('[data-sensitive]').forEach(el => {
      el.setAttribute('data-backup', el.textContent);
      el.textContent = '••••••••';
    });
  }

  /* ── 3. XSS Protection ── */
  function sanitize(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .replace(/`/g, '&#x60;')
      .slice(0, 200); // max length
  }

  /* ── 4. Input Validation ── */
  const validators = {
    phone:   v => /^01[0-2,5]{1}[0-9]{8}$/.test(v),
    name:    v => /^[\u0600-\u06FF\u0750-\u077F a-zA-Z\s]{2,50}$/.test(v),
    nid:     v => /^\d{14}$/.test(v),
    plate:   v => v.length >= 4 && v.length <= 20,
    license: v => v.length >= 4 && v.length <= 20,
    text:    v => v.length > 0 && v.length <= 200,
  };

  /* ── 5. Rate Limiting (client-side) ── */
  const attempts = {};
  function rateLimit(key, maxPerMin = 5) {
    const now = Date.now();
    if (!attempts[key]) attempts[key] = [];
    attempts[key] = attempts[key].filter(t => now - t < 60000);
    if (attempts[key].length >= maxPerMin) return false;
    attempts[key].push(now);
    return true;
  }

  /* ── 6. Session Integrity ── */
  function checkSession() {
    const uid   = localStorage.getItem('wasselni_uid');
    const role  = localStorage.getItem('wasselni_role');
    const name  = localStorage.getItem('wasselni_name');
    const phone = localStorage.getItem('wasselni_phone');

    // Check session fingerprint
    const fp = localStorage.getItem('wasselni_fp');
    const expectedFp = btoa(uid + role + navigator.userAgent.slice(0,20));

    if (uid && fp && fp !== expectedFp) {
      // Session tampered
      console.warn('[Security] Session integrity check failed');
      localStorage.clear();
      window.location.href = 'index.html';
      return false;
    }

    if (!fp && uid) {
      // Set fingerprint on first check
      localStorage.setItem('wasselni_fp', expectedFp);
    }

    return { uid, role, name, phone };
  }

  /* ── 7. Anti-Clickjacking ── */
  function antiClickjacking() {
    if (window.top !== window.self) {
      document.body.innerHTML = '<h1 style="text-align:center;margin-top:40vh;font-family:sans-serif">غير مسموح بتحميل التطبيق داخل إطار</h1>';
      window.top.location = window.self.location;
    }
  }

  /* ── 8. Disable Text Selection on sensitive areas ── */
  function lockSensitive() {
    document.querySelectorAll('[data-sensitive]').forEach(el => {
      el.style.userSelect = 'none';
      el.style.webkitUserSelect = 'none';
    });
  }

  /* ── 9. Obfuscate phone numbers in DOM ── */
  function maskPhone(phone) {
    if (!phone || phone.length < 8) return phone;
    return phone.slice(0, 4) + '****' + phone.slice(-3);
  }

  /* ── 10. Firestore write validator ── */
  function validateFirestoreWrite(data) {
    const SAFE_FIELDS = ['name','phone','role','plate','license','nid','phone2',
      'passengerId','passengerName','passengerPhone','passengerLocation',
      'captainId','captainName','captainPlate','captainLocation',
      'destName','destLocation','distKm','price','status',
      'isOnline','location','createdAt','updatedAt',
      'passengerRating','totalRatings','sumRatings','avgRating',
      'cancelledBy','acceptedAt','finishedAt','approved'];

    for (const key of Object.keys(data)) {
      if (!SAFE_FIELDS.includes(key)) {
        console.warn(`[Security] Blocked unsafe field: ${key}`);
        return false;
      }
    }

    // Check for injection in string values
    for (const val of Object.values(data)) {
      if (typeof val === 'string') {
        if (/<script|javascript:|on\w+=/i.test(val)) {
          console.warn('[Security] Injection attempt blocked');
          return false;
        }
      }
    }
    return true;
  }

  /* ── PUBLIC API ── */
  return {
    init() {
      applyCSP();
      antiClickjacking();
      antiDevTools();
      setTimeout(lockSensitive, 500);
    },
    sanitize,
    validate: validators,
    rateLimit,
    checkSession,
    maskPhone,
    validateWrite: validateFirestoreWrite,
  };
})();

// Auto-init
document.addEventListener('DOMContentLoaded', () => Security.init());
