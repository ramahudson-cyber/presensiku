import * as faceapi from "face-api.js";

let modelsPromise = null;
const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";

export function preloadFaceModels() {
  if (!modelsPromise) {
    console.log("🚀 Preloading face-api models...");
    modelsPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    ]).then(() => {
      console.log("✅ Face models preloaded");
    }).catch(err => {
      console.error("❌ Preload failed:", err);
      modelsPromise = null;
    });
  }
  return modelsPromise;
}