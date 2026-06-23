import * as faceapi from "face-api.js";

let modelsPromise = null;
const MODEL_URL = "/models";

export function preloadFaceModels() {
  if (!modelsPromise) {
    console.log("🚀 Preloading face-api models...");
    modelsPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    ]).then(() => {
      console.log("✅ Face models preloaded");
      warmUpModels();
    }).catch(err => {
      console.error("❌ Preload failed:", err);
      modelsPromise = null;
    });
  }
  return modelsPromise;
}

async function warmUpModels() {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 160;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, 160, 160);
    await faceapi.detectSingleFace(
      canvas,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 160 })
    );
    console.log("✅ Face models warmed up");
    } catch { /* warmup not critical */ }
}