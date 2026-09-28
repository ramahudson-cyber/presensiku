/* Service worker untuk push notification FCM (PWA / web).
   Dipakai oleh @capacitor/push-notifications? Tidak — khusus web browser.
   Pesan dengan payload `notification` otomatis ditampilkan oleh FCM SDK,
   jadi tidak perlu handler onBackgroundMessage (menghindari notifikasi ganda). */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDwzvKm_fl3kOZTa9GAxxwCr1Z39TZk7Zw",
  authDomain: "presensiku-5bc08.firebaseapp.com",
  projectId: "presensiku-5bc08",
  storageBucket: "presensiku-5bc08.firebasestorage.app",
  messagingSenderId: "1515707309",
  appId: "1:1515707309:web:251d8f86a695c4f6615f24",
});

try {
  firebase.messaging();
} catch (e) {
  // Browser tidak mendukung — abaikan
}
