import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import {
  MapPin, Camera, Clock, CheckCircle2,
  RefreshCw, Loader2, ShieldAlert, X
} from "lucide-react";
import * as faceapi from "face-api.js";

// ============================================================
// KONFIGURASI LOKASI PUSKESMAS
// Puskesmas Perawatan Ampenan, Jl. Saleh Sungkar No.14
// ============================================================
const PUSKESMAS_LOCATION = { latitude: -8.5699, longitude: 116.0770 };
const RADIUS_METER = 50000; // ⚠️ TEST MODE: 50km — ubah ke 300 sebelum produksi
const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function AttendancePage() {
  const { user } = useAuth();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [todayAttendance, setTodayAttendance] = useState(null);
  const [locationStatus, setLocationStatus] = useState("checking");
  const [distance, setDistance] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [currentCoords, setCurrentCoords] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelLoadingProgress, setModelLoadingProgress] = useState("Idle");
  const [cameraActive, setCameraActive] = useState(false);
  const [faceStatus, setFaceStatus] = useState("idle");
  const [faceMessage, setFaceMessage] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [isFakeGPS, setIsFakeGPS] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const loadModels = async () => {
      try {
        setModelLoadingProgress("Mengunduh AI model (1/3)...");
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        setModelLoadingProgress("Mengunduh AI model (2/3)...");
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        setModelLoadingProgress("Mengunduh AI model (3/3)...");
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        setModelLoadingProgress("Selesai");
        setModelsLoaded(true);
      } catch (err) {
        console.error("Gagal load model:", err);
        setModelLoadingProgress("Gagal load AI: " + err.message);
      }
    };
    loadModels();
    getLocation();
    fetchTodayAttendance();
  }, []);

  const fetchTodayAttendance = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase.from("attendance").select("*").eq("user_id", user.id).eq("date", today).maybeSingle();
      setTodayAttendance(data);
    } catch (e) { console.error(e); }
  };

  const getLocation = () => {
    setLocationStatus("checking");
    setIsFakeGPS(false);
    if (!navigator.geolocation) { setLocationStatus("error"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude
        };
        setCurrentCoords(loc);
        setGpsAccuracy(Math.round(loc.accuracy));
        const isFake = (loc.accuracy < 3) && (loc.altitude === null || loc.altitude === 0);
        if (isFake) { setIsFakeGPS(true); setLocationStatus("invalid"); return; }
        const dist = calculateDistance(loc.latitude, loc.longitude, PUSKESMAS_LOCATION.latitude, PUSKESMAS_LOCATION.longitude);
        setDistance(Math.round(dist));
        setLocationStatus(dist <= RADIUS_METER ? "valid" : "invalid");
      },
      (err) => {
        console.error("GPS error:", err);
        setLocationStatus("error");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // ============================================================
  // FIX CAMERA BLACK BOX: gunakan onloadedmetadata + play() catch
  // ============================================================
  const startCamera = async () => {
    if (!modelsLoaded) {
      setCameraError("AI model belum siap. Tunggu sampai 100%.");
      return;
    }
    setCameraError("");
    setFaceStatus("loading");
    setFaceMessage("Mengaktifkan kamera...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });

      setCameraActive(true);
      streamRef.current = stream;

      // Tunggu React render video element
      await new Promise(resolve => setTimeout(resolve, 200));

      if (!videoRef.current) {
        throw new Error("Video element tidak ter-render.");
      }

      const video = videoRef.current;
      video.srcObject = stream;

      // FIX: tunggu metadata load dulu sebelum play
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
        setTimeout(reject, 5000);
      });

      // FIX: play() dengan catch error (Safari iOS sering reject)
      try {
        await video.play();
      } catch (playErr) {
        console.warn("Autoplay issue, trying again:", playErr);
        video.muted = true;
        await video.play().catch(() => {});
      }

      setFaceStatus("scanning");
      setFaceMessage("Posisikan wajah di lingkaran");
      detectionLoop();
    } catch (err) {
      console.error("Camera error:", err);
      setCameraError(
        err.name === "NotAllowedError" ? "Izin kamera ditolak. Buka Settings → Browser → Camera → Allow." :
        err.name === "NotFoundError" ? "Kamera tidak ditemukan." :
        "Gagal akses kamera: " + err.message
      );
      setFaceStatus("idle");
      setFaceMessage("");
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setFaceStatus("idle");
    setFaceMessage("");
  };

  const detectionLoop = async () => {
    if (!videoRef.current || !streamRef.current) return;
    try {
      const detection = await faceapi.detectSingleFace(
        videoRef.current,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 })
      ).withFaceLandmarks().withFaceExpressions();

      if (!detection) {
        setFaceStatus("scanning");
        setFaceMessage("Wajah tidak terdeteksi. Coba terangi wajah.");
        if (streamRef.current) requestAnimationFrame(detectionLoop);
        return;
      }
      const box = detection.detection.box;
      const vw = videoRef.current.videoWidth;
      const vh = videoRef.current.videoHeight;
      const margin = 20;
      const isCropped = box.x < margin || box.y < margin || box.x + box.width > vw - margin || box.y + box.height > vh - margin;
      const isTooSmall = box.width < vw * 0.4 || box.height < vh * 0.4;
      if (isCropped || isTooSmall) {
        setFaceStatus("scanning");
        setFaceMessage(isCropped ? "Wajah terpotong! Posisikan full" : "Mendekatlah ke kamera");
        if (streamRef.current) requestAnimationFrame(detectionLoop);
        return;
      }
      if (detection.expressions.happy > 0.7) {
        setFaceStatus("success");
        setFaceMessage("✅ Senyum terdeteksi! Absensi berhasil.");
        const canvas = canvasRef.current;
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const photoData = canvas.toDataURL("image/jpeg", 0.8);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
        setTodayAttendance({ clock_in_time: new Date().toISOString(), attendance_status: "hadir" });
        setTimeout(() => {
          setFaceStatus("idle");
          setCameraActive(false);
        }, 2000);
        return;
      }
      setFaceStatus("smiling");
      setFaceMessage("😊 Senyum ke kamera!");
      if (streamRef.current) requestAnimationFrame(detectionLoop);
    } catch (err) {
      console.error("Detection error:", err);
      if (streamRef.current) requestAnimationFrame(detectionLoop);
    }
  };

  const timeStr = currentTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = currentTime.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="relative bg-gradient-to-br from-violet-600 to-purple-800 rounded-2xl p-5 text-white shadow-xl shadow-purple-900/30 overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
        <div className="relative">
          <p className="text-[10px] opacity-70 uppercase tracking-wider">{dateStr}</p>
          <p className="text-2xl font-bold mt-1">{timeStr}</p>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
        {todayAttendance ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 size={18} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Sudah Absen</p>
              <p className="text-[11px] text-slate-400">Masuk: {new Date(todayAttendance.clock_in_time).toLocaleTimeString("id-ID", {hour:"2-digit",minute:"2-digit"})}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-slate-400">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <Clock size={18} className="text-violet-400" />
            </div>
            <p className="text-sm">Belum absen hari ini</p>
          </div>
        )}
      </div>

      <div className={`rounded-2xl border p-4 backdrop-blur-sm ${
        locationStatus === "valid" ? "bg-emerald-500/5 border-emerald-500/20" :
        locationStatus === "invalid" ? "bg-red-500/5 border-red-500/20" :
        "bg-white/5 border-white/10"
      }`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-white flex items-center gap-2">
            <MapPin size={16} className={locationStatus === "valid" ? "text-emerald-400" : "text-red-400"} />
            Lokasi GPS
          </span>
          <button onClick={getLocation} className="text-xs text-violet-400 flex items-center gap-1">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
        {isFakeGPS && (
          <div className="mb-2 p-2 bg-red-500/10 rounded-lg flex items-center gap-2">
            <ShieldAlert size={14} className="text-red-400" />
            <p className="text-xs text-red-300 font-medium">Terdeteksi Fake GPS!</p>
          </div>
        )}
        {locationStatus === "checking" && <p className="text-xs text-slate-400">Mendeteksi...</p>}
        {locationStatus === "valid" && <p className="text-xs text-emerald-400">✅ Dalam radius ({distance}m) — TEST MODE</p>}
        {locationStatus === "invalid" && !isFakeGPS && (
          <p className="text-xs text-red-400">❌ Di luar radius ({distance}m)</p>
        )}
        {locationStatus === "error" && <p className="text-xs text-red-400">GPS tidak aktif.</p>}
        {currentCoords && (
          <div className="mt-3 pt-3 border-t border-white/10 space-y-1">
            <p className="text-[10px] text-slate-500 font-mono">
              📍 Anda: {currentCoords.latitude.toFixed(6)}, {currentCoords.longitude.toFixed(6)}
            </p>
            <p className="text-[10px] text-slate-500 font-mono">
              🏥 Puskesmas: {PUSKESMAS_LOCATION.latitude}, {PUSKESMAS_LOCATION.longitude}
            </p>
            <p className="text-[10px] text-slate-500 font-mono">
              📏 Akurasi GPS: ±{gpsAccuracy}m
            </p>
          </div>
        )}
      </div>

      {!todayAttendance && (
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white">Verifikasi Wajah (Senyum)</p>
            {cameraActive && (
              <button onClick={stopCamera} className="text-xs text-red-400 flex items-center gap-1">
                <X size={12} /> Tutup
              </button>
            )}
          </div>

          {!modelsLoaded && (
            <div className="mb-3 p-3 bg-violet-500/10 rounded-lg flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-violet-400" />
              <p className="text-xs text-violet-300">{modelLoadingProgress}</p>
            </div>
          )}

          {cameraError && (
            <div className="mb-3 p-3 bg-red-500/10 rounded-lg">
              <p className="text-xs text-red-300">{cameraError}</p>
            </div>
          )}

          {!cameraActive ? (
            <button
              onClick={startCamera}
              disabled={locationStatus !== "valid" || isFakeGPS || !modelsLoaded}
              className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl font-semibold text-sm transition disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {modelsLoaded ? <><Camera size={16} /> Buka Kamera</> : <><Loader2 size={16} className="animate-spin" /> Memuat AI...</>}
            </button>
          ) : (
            <div className="space-y-3">
              {/* FIX: video pakai width/height attribute + muted + playsInline */}
              <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  width={480}
                  height={480}
                  className="w-full h-full object-cover"
                  style={{ transform: "scaleX(-1)" }}
                />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className={`w-3/4 h-3/4 border-4 rounded-2xl transition-all ${
                    faceStatus === "success" ? "border-emerald-500" :
                    faceStatus === "smiling" ? "border-amber-500" :
                    "border-white/30 border-dashed"
                  }`}></div>
                </div>
              </div>
              <div className={`text-center text-xs font-medium p-2 rounded-lg ${
                faceStatus === "success" ? "bg-emerald-500/10 text-emerald-400" :
                faceStatus === "smiling" ? "bg-amber-500/10 text-amber-400" :
                "bg-white/5 text-slate-400"
              }`}>
                {faceMessage}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}