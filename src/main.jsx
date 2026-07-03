import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { preloadFaceModels } from "./utils/preloadModels";
import { Capacitor } from "@capacitor/core";
import "./index.css";

// 🚀 Preload AI models di background sejak app pertama load
preloadFaceModels();

// ✅ Beri tahu CapacitorUpdater bahwa JS bundle berjalan normal
if (Capacitor.isNativePlatform()) {
  import("./services/otaService").then(({ notifyAppReady }) => {
    notifyAppReady();
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
