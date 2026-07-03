import * as faceapi from "face-api.js";

let modelsPromise = null;
const LOCAL_URL = "/models";
const CDN_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";

async function loadModelsFrom(url) {
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(url),
    faceapi.nets.faceLandmark68Net.loadFromUri(url),
    faceapi.nets.faceExpressionNet.loadFromUri(url),
  ]);
}

export function preloadFaceModels() {
  if (!modelsPromise) {
    modelsPromise = (async () => {
      try {
        await loadModelsFrom(LOCAL_URL);
      } catch (err) {
        console.warn("⚠️ Local model load failed, trying CDN:", err.message);
        try {
          await loadModelsFrom(CDN_URL);
        } catch (cdnErr) {
          console.error("❌ CDN model load also failed:", cdnErr);
          throw cdnErr;
        }
      }
      warmUpModels();
    })();
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