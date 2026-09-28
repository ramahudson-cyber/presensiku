import { initializeApp } from "firebase/app";

// Konfigurasi Firebase Web (project presensiku-5bc08).
// Nilai config web Firebase memang dirancang publik (bukan secret).
export const firebaseConfig = {
  apiKey: "AIzaSyDwzvKm_fl3kOZTa9GAxxwCr1Z39TZk7Zw",
  authDomain: "presensiku-5bc08.firebaseapp.com",
  projectId: "presensiku-5bc08",
  storageBucket: "presensiku-5bc08.firebasestorage.app",
  messagingSenderId: "1515707309",
  appId: "1:1515707309:web:251d8f86a695c4f6615f24",
};

// Web Push certificate (VAPID) dari Firebase Console:
// Project settings → Cloud Messaging → Web Push certificates.
// Kosong = web push dilewati dengan aman (belum dikonfigurasi).
export const FIREBASE_VAPID_KEY = "BF2mWcZ5N0SGy4YL0LAmyl3xIjv4MhZtiyBeagROigtyNv-8c2iQ2Ji_bqelQ4culvNaTK2GM6B97hd4nKa46HU";

let app = null;

export function getFirebaseApp() {
  if (!app) app = initializeApp(firebaseConfig);
  return app;
}
