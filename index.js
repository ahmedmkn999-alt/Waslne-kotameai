// index.js

const firebaseConfig = {
  apiKey: "AIzaSyCQqqiNQkm-NPGR5XVYkJaM8Li8nqnZYA8",
  authDomain: "al-warsha.firebaseapp.com",
  projectId: "al-warsha",
  storageBucket: "al-warsha.firebasestorage.app",
  messagingSenderId: "913946656614",
  appId: "1:913946656614:web:9dad073c3c5664c23a92a7"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let role = null;

function goTo(stepId, dotNum) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById(stepId).classList.add('active');
  document.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('on', i < dotNum));
  document.getElementById('progress').style.width = (dotNum * 33) + '%';
}

function selectRole(r) {
  role = r;
  document.getElementById('card-pas').classList.toggle('selected', r === 'passenger');
  document.getElementById('card-cap').classList.toggle('selected', r === 'captain');
}

function afterRole() {
  if (!role) {
    document.getElementById('err-role').classList.add('show');
    return;
  }
  document.getElementById('err-role').classList.remove('show');
  goTo(role === 'captain' ? 'step-cap' : 'step-pas', 2);
}

function validPhone(p) {
  return /^01[0-2,5]{1}[0-9]{8}$/.test(p);
}

async function submitPas() {
  const name = document.getElementById('pas-name').value.trim();
  const phone = document.getElementById('pas-phone').value.trim();
  if (!name) return showErr('err-pas', 'اكتب اسمك');
  if (!validPhone(phone)) return showErr('err-pas', 'رقم التليفون مش صحيح (01xxxxxxxxx)');
  goTo('step-loading', 3);
  try {
    const snap = await db.collection('users').where('phone', '==', phone).where('role', '==', 'passenger').limit(1).get();
    let uid;
    if (!snap.empty) {
      uid = snap.docs[0].id;
    } else {
      const ref = await db.collection('users').add({
        name, phone, role: 'passenger', createdAt: new Date()
      });
      uid = ref.id;
    }
    localStorage.setItem('wasselni_uid', uid);
    localStorage.setItem('wasselni_role', 'passenger');
    localStorage.setItem('wasselni_name', name);
    localStorage.setItem('wasselni_phone', phone);
    window.location.href = 'passenger.html';
  } catch(e) {
    goTo('step-pas', 2);
    showErr('err-pas', 'مشكلة في الاتصال، حاول مرة أخرى');
  }
}

async function submitCap() {
  const name = document.getElementById('cap-name').value.trim();
  const plate = document.getElementById('cap-plate').value.trim();
  const license = document.getElementById('cap-license').value.trim();
  const nid = document.getElementById('cap-nid').value.trim();
  const phone = document.getElementById('cap-phone').value.trim();
  const phone2 = document.getElementById('cap-phone2').value.trim();
  
  if (!name) return showErr('err-cap', 'الاسم مطلوب');
  if (!plate) return showErr('err-cap', 'رقم الموتوسيكل مطلوب');
  if (!license) return showErr('err-cap', 'رقم الرخصة مطلوب');
  if (!/^\d{14}$/.test(nid)) return showErr('err-cap', 'الرقم القومي 14 رقم');
  if (!validPhone(phone)) return showErr('err-cap', 'رقم التليفون مش صحيح');
  
  goTo('step-loading', 3);
  try {
    const snap = await db.collection('users').where('phone', '==', phone).where('role', '==', 'captain').limit(1).get();
    let uid;
    if (!snap.empty) {
      uid = snap.docs[0].id;
    } else {
      const ref = await db.collection('users').add({
        name, plate, license, nid, phone, phone2,
        role: 'captain', isOnline: false, createdAt: new Date()
      });
      uid = ref.id;
    }
    localStorage.setItem('wasselni_uid', uid);
    localStorage.setItem('wasselni_role', 'captain');
    localStorage.setItem('wasselni_name', name);
    localStorage.setItem('wasselni_phone', phone);
    window.location.href = 'captain.html';
  } catch(e) {
    goTo('step-cap', 2);
    showErr('err-cap', 'مشكلة في الاتصال، حاول مرة أخرى');
  }
}

function showErr(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add('show');
}

window.addEventListener('DOMContentLoaded', () => {
  const savedUid = localStorage.getItem('wasselni_uid');
  const savedRole = localStorage.getItem('wasselni_role');
  if (savedUid && savedRole) {
    window.location.href = savedRole === 'captain' ? 'captain.html' : 'passenger.html';
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
