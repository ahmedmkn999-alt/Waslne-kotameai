// passenger.js

const uid = localStorage.getItem('wasselni_uid');
const uname = localStorage.getItem('wasselni_name');
if (!uid || localStorage.getItem('wasselni_role') !== 'passenger') {
  window.location.href = 'index.html';
}

const firebaseConfig = {
  apiKey: "AIzaSyCQqqiNQkm-NPGR5XVYkJaM8Li8nqnZYA8",
  authDomain: "al-warsha.firebaseapp.com",
  projectId: "al-warsha",
  storageBucket: "al-warsha.firebasestorage.app",
  messagingSenderId: "913946656614",
  appId: "1:913946656614:web:4df914457d79b75dee2bf5"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let myLat = 30.0, myLng = 31.4, destLat = null, destLng = null, destName = '';
const map = L.map('map', { zoomControl: true }).setView([myLat, myLng], 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

function makeIcon(emoji, size=36) {
  return L.divIcon({ html: `<div style="font-size:${size}px">${emoji}</div>`, iconSize: [size, size], iconAnchor: [size/2, size/2] });
}

let myMarker = null, captainMarker = null;
function setMyMarker(lat, lng) {
  if (myMarker) myMarker.setLatLng([lat, lng]);
  else myMarker = L.marker([lat, lng], { icon: makeIcon('📍', 38) }).addTo(map);
}
function centerMap() { map.setView([myLat, myLng], 15); }

function startGPS() {
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(pos => {
      myLat = pos.coords.latitude;
      myLng = pos.coords.longitude;
      setMyMarker(myLat, myLng);
      if (currentRideId) db.collection('rides').doc(currentRideId).update({ passengerLocation: { lat: myLat, lng: myLng } });
    }, null, { enableHighAccuracy: true });
  }
}
startGPS();

function searchLocation() {
  const query = document.getElementById('search-input').value;
  if (!query) return;
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&accept-language=ar`)
    .then(res => res.json()).then(data => {
      if (data.length) {
        destLat = parseFloat(data[0].lat);
        destLng = parseFloat(data[0].lon);
        destName = data[0].display_name;
        map.setView([destLat, destLng], 16);
        if (window.destMarker) window.destMarker.remove();
        window.destMarker = L.marker([destLat, destLng], { icon: makeIcon('🎯', 40) }).addTo(map);
        showToast(`تم تحديد: ${destName.substring(0, 40)}`);
      } else showToast('لم يتم العثور على المكان');
    }).catch(() => showToast('خطأ في البحث'));
}

let currentRideId = null, waitInterval = null, rideListener = null, waitSecs = 0, myRating = 0;

function showState(id) {
  document.querySelectorAll('.panel-state').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

async function requestRide() {
  if (!destLat) { showToast('❌ حدد الوجهة أولاً'); return; }
  showState('state-waiting');
  startWaitTimer();
  try {
    const ref = await db.collection('rides').add({
      passengerId: uid, passengerName: uname,
      passengerLocation: { lat: myLat, lng: myLng },
      destLocation: { lat: destLat, lng: destLng }, destName: destName,
      status: 'pending', createdAt: new Date()
    });
    currentRideId = ref.id;
    rideListener = db.collection('rides').doc(currentRideId).onSnapshot(snap => {
      const d = snap.data();
      if (!d) return;
      if (d.status === 'accepted') onCaptainAccepted(d);
      if (d.status === 'done') onRideDone(d);
      if (d.captainLocation && captainMarker) captainMarker.setLatLng([d.captainLocation.lat, d.captainLocation.lng]);
    });
  } catch(e) { showState('state-idle'); clearInterval(waitInterval); showToast('حدث خطأ'); }
}

function onCaptainAccepted(data) {
  clearInterval(waitInterval);
  document.getElementById('cap-name').textContent = data.captainName || '—';
  document.getElementById('cap-plate').textContent = data.captainPlate || '—';
  showState('state-ac
