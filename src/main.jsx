import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { preloadFaceModels } from "./utils/preloadModels";
import "./index.css";

// 🚀 Preload AI models di background sejak app pertama load
// (saat user buka halaman absen, model sudah siap — kamera lebih cepat)
preloadFaceModels();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);