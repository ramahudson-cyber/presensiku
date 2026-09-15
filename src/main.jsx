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
sessionStorage.removeItem("boot-recovered");
// Reset guard auto-reload supaya cold-start berikutnya boleh reload lagi.
// Aman dari dobel-reload: inline script index.html membaca flag SAAT PARSE
// (sebelum file ini jalan), jadi reload hasil sesi ini tetap ter-guard.
sessionStorage.removeItem("sw-reloaded");    // kunci lama (sisa sesi)
sessionStorage.removeItem("web-autoreload"); // kunci lama (sisa sesi)
sessionStorage.removeItem("app-reloaded");   // kunci baru bersama

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
