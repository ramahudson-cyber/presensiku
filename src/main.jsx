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
// Reset flag auto-reload SW supaya update berikutnya juga bisa auto-reload.
sessionStorage.removeItem("sw-reloaded");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
