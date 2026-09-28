/* Service worker untuk push notification FCM (PWA / web) — jalur
   BACKGROUND: menerima event push walau PWA tidak dibuka.
   Pesan dengan payload `notification` otomatis ditampilkan oleh FCM SDK;
   onBackgroundMessage di bawah sebagai jaring pengaman untuk payload
   data-only (menampilkan notifikasi eksplisit, menghindari ganda untuk
   payload notification karena FCM compat menandai processed). */
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

const APP_URL = "https://presensiku-beige.vercel.app/";

try {
  const messaging = firebase.messaging();

  // Jaring pengaman: payload data-only (tanpa `notification`) tidak
  // otomatis ditampilkan — tampilkan manual.
  messaging.onBackgroundMessage((payload) => {
    if (payload.notification) return; // sudah ditangani FCM otomatis
    const d = payload.data || {};
    self.registration.showNotification(d.title || "Presensiku", {
      body: d.body || d.message || "Ada pembaruan di Presensiku",
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      data: { url: d.url || APP_URL },
      tag: d.tag || "presensiku",
    });
  });
} catch (e) {
  // Browser tidak mendukung — abaikan
}

// Klik notifikasi: fokus jendela yang ada, atau buka aplikasi
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || APP_URL;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(target) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
