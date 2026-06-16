// captain.js

const uid = localStorage.getItem('wasselni_uid');
const uname = localStorage.getItem('wasselni_name');
if (!uid || localStorage.getItem('wasselni_role') !== 'captain') {
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

let myLat = 30.0, myLng = 31.4;
const map = L.map('map', { zoomControl: true }).setView([myLat, myLng], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

function makeIcon(emoji, size=36) {
  return L.divIcon({ html: `<div style="font-size:${size}px">${emoji}</div>`, iconSize: [size, size], iconAnchor: [size/2, size/2] });
}

let myMarker = null, pasMarker = null;
function setMyMarker(lat, lng) {
  if (myMarker) myMarker.setLatLng([lat, lng]);
  else myMarker = L.marker([lat, lng], { icon: makeIcon('🏍️', 42) }).addTo(map);
}
function centerMap() { map.setView([myLat, myLng], 15); }

function startGPS() {
  if (!navigator.geolocation) return;
  navigator.geolocation.watchPosition(pos => {
    myLat = pos.coords.latitude;
    myLng = pos.coords.longitude;
    setMyMarker(myLat, myLng);
    db.collection('users').doc(uid).update({ location: { lat: myLat, lng: myLng } });
    if (currentRideId) {
      db.collection('rides').doc(currentRideId).update({ captainLocation: { lat: myLat, lng: myLng } });
    }
  }, null, { enableHighAccuracy: true });
}
startGPS();

let isOnline = false, currentRideId = null, pendingListener = null, countdownTimer = null, rideListener = null;
let countdownSecs = 30;

function showState(id) {
  document.querySelectorAll('.panel-state').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

async function toggleOnline() {
  isOnline = !isOnline;
  const tog = document.getElementById('online-toggle');
  const label = document.getElementById('online-label');
  tog.classList.toggle('on', isOnline);
  label.textContent = isOnline ? 'أون لاين' : 'أوف لاين';
  await db.collection('users').doc(uid).update({ isOnline });
  if (isOnline) {
    showState('state-online');
    listenForRides();
    showToast('🟢 أنت أون لاين');
  } else {
    if (pendingListener) pendingListener();
    showState('state-offline');
    showToast('🔴 أنت أوف لاين');
  }
}

function listenForRides() {
  if (pendingListener) return;
  pendingListener = db.collection('rides').where('status', '==', 'pending').onSnapshot(snap => {
    if (!isOnline || currentRideId) return;
    snap.docChanges().forEach(change => {
      if (change.type === 'added') showRideRequest(change.doc.id, change.doc.data());
    });
  });
}

function showRideRequest(rideId, data) {
  currentRideId = rideId;
  document.getElementById('req-name').textContent = data.passengerName || '—';
  document.getElementById('req-phone').textContent = data.passengerPhone || '—';
  if (data.passengerLocation) {
    if (pasMarker) pasMarker.remove();
    pasMarker = L.marker([data.passengerLocation.lat, data.passengerLocation.lng], { icon: makeIcon('📍', 36) }).addTo(map);
    map.fitBounds([[myLat, myLng], [data.passengerLocation.lat, data.passengerLocation.lng]]);
  }
  showState('state-request');
  startCountdown();
}

function startCountdown() {
  clearInterval(countdownTimer);
  countdownSecs = 30;
  const num = document.getElementById('ring-num');
  countdownTimer = setInterval(() => {
    countdownSecs--;
    num.textContent = countdownSecs;
    if (countdownSecs <= 0) rejectRide();
  }, 1000);
}

async function acceptRide() {
  clearInterval(countdownTimer);
  if (!currentRideId) return;
  const snap = await db.collection('rides').doc(currentRideId).get();
  if (snap.data().status !== 'pending') {
    showToast('الطلب اتلغى');
    currentRideId = null;
    showState('state-online');
    return;
  }
  await db.collection('rides').doc(currentRideId).update({
    status: 'accepted', captainId: uid, captainName: uname, captainLocation: { lat: myLat, lng: myLng }
  });
  document.getElementById('active-name').textContent = snap.data().passengerName;
  document.getElementById('active-phone').textContent = snap.data().passengerPhone;
  window.currentPassengerPhone = snap.data().passengerPhone;
  showState('state-active');
  showToast('✅ قبلت الطلب');
  rideListener = db.collection('rides').doc(currentRideId).onSnapshot(s => {
    if (s.data()?.status === 'cancelled') {
      cleanupRide();
      showState('state-online');
      showToast('❌ الراكب ألغى الطلب');
    }
  });
}

function callPassenger() {
  if (window.currentPassengerPhone) window.location.href = `tel:+20${window.currentPassengerPhone}`;
}

async function rejectRide() {
  clearInterval(countdownTimer);
  if (pasMarker) pasMarker.remove();
  currentRideId = null;
  showState('state-online');
}

async function markArrived() {
  await db.collection('rides').doc(currentRideId).update({ status: 'ongoing' });
  document.getElementById('step1').className = 'step-pill done';
  document.getElementById('step2').className = 'step-pill active-step';
  document.getElementById('btn-arrived').style.display = 'none';
  document.getElementById('btn-finish').style.display = '';
  showToast('📍 تم الوصول');
}

async function finishRide() {
  await db.collection('rides').doc(currentRideId).update({ status: 'done' });
  showToast('✅ تمت الرحلة');
  cleanupRide();
  setTimeout(() => showState('state-online'), 1500);
}

function cleanupRide() {
  if (rideListener) rideListener();
  if (pasMarker) pasMarker.remove();
  currentRideId = null;
}

async function logout() {
  await db.collection('users').doc(uid).update({ isOnline: false });
  localStorage.clear();
  window.location.href = 'index.html';
        }
