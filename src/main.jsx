import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { HashRouter } from "react-router-dom";
import "./index.css";

// Migrate users who had the old dark-mode toggle stored: strip any leftover
// `.dark` class and `theme` localStorage entry so the app boots light-only.
document.documentElement.classList.remove("dark");
localStorage.removeItem("theme");

// App berhasil boot — reset flag recovery white screen (lihat index.html).
// Guard auto-reload (app-reloaded & kawan-kawan) SENGAJA tidak dihapus saat
// boot: kalau dihapus di sini, rantai reload lintas load (boot-recovery ->
// webVersionCode -> controllerchange) bisa beruntun dan welcome page
// terlihat reload 2x saat buka pertama setelah deploy. Guard direset hanya
// setelah app stabil beberapa detik, supaya cold-start berikutnya tetap
// boleh reload.
const RESET_RELOAD_GUARDS_MS = 15000;
setTimeout(() => {
  sessionStorage.removeItem("boot-recovered");
  sessionStorage.removeItem("sw-reloaded");    // kunci lama (sisa sesi)
  sessionStorage.removeItem("web-autoreload"); // kunci lama (sisa sesi)
  sessionStorage.removeItem("app-reloaded");   // kunci baru bersama
}, RESET_RELOAD_GUARDS_MS);

// Registrasi service worker manual (vite-plugin-pwa injectRegister: null).
// updateViaCache: "none" memastikan cek /sw.js tidak kena HTTP cache browser,
// jadi SW baru terdeteksi segera setiap cold-open. Retry sekali bila gagal
// (jaringan lemah) supaya registrasi tidak diam-diam hilang.
if ("serviceWorker" in navigator) {
  const registerSW = () =>
    navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  window.addEventListener("load", () => {
    registerSW().catch(() => setTimeout(() => registerSW().catch(() => {}), 5000));
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
