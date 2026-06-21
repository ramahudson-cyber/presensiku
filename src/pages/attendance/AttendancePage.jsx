import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import * as faceapi from "face-api.js";
import { toast } from "react-toastify";
import {
  MapPin, Camera, Clock, CheckCircle2, XCircle,
  AlertTriangle, RefreshCw, LogIn, Loader2, Stethoscope, ShieldAlert
} from "lucide-react";

const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";
const PUSKESMAS_LOCATION = { latitude: -8.5697, longitude: 116.0821, name: "Puskesmas Ampenan" };
const RADIUS_METER = 200;

// Status Style
const STATUS_STYLE = {
  hadir: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Hadir" },
  izin: { bg: "bg-amber-100", text: "text-amber-700", label: "Izin" },
  sakit: { bg: "bg-orange-100", text: "text-orange-700", label: "Sakit" },
  cuti: { bg: "bg-sky-100", text: "text-sky-700", label: "Cuti" },
  alpha: { bg: "bg-red-100", text: "text-red-700", label: "Alpha" },
};

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function AttendancePage() {
  const { user } = useAuth();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("checking");
  const [distance, setDistance] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Face Detection States
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [faceStatus, setFaceStatus] = useState("idle"); // idle, loading, scanning, smiling, success
  const [faceMessage, setFaceMessage] = useState("");
  const [isFakeGPS, setIsFakeGPS] = useState(false);

  // Real-time clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load Face Models
  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Gagal load model:", err);
        toast.error("Gagal memuat model AI wajah");
      }
    };
    loadModels();
  }, []);

  // Get Location with Fake GPS Detection
  const getLocation = () => {
    setLocationStatus("checking");
    setIsFakeGPS(false);

    if (!navigator.geolocation) {
      setLocationStatus("error");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude
        };
        setLocation(loc);

        // === ANTI FAKE GPS HEURISTIK ===
        // 1. Akurasi terlalu sempurna (< 5 meter) = curiga Fake GPS
        // 2. Altitude null/0 = curiga Fake GPS (GPS asli biasanya punya ketinggian)
        if (loc.accuracy < 5 || loc.altitude === null || loc.altitude === 0) {
          setIsFakeGPS(true);
          setLocationStatus("invalid");
          toast.error("⚠️ Terdeteksi Fake GPS! Matikan aplikasi lokasi palsu.");
          return;
        }

        const dist = calculateDistance(loc.latitude, loc.longitude, PUSKESMAS_LOCATION.latitude, PUSKESMAS_LOCATION.longitude);
        setDistance(Math.round(dist));
        setLocationStatus(dist <= RADIUS_METER ? "valid" : "invalid");
      },
      () => setLocationStatus("error"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    getLocation();
    setLoading(false); // ← TAMBAHKAN INI supaya loading berhenti
  }, []);

  // Start Camera & Face Detection
  const startCamera = async () => {
    if (!modelsLoaded) {
      toast.error("Model AI belum siap, tunggu sebentar...");
      return;
    }

    try {
      setFaceStatus("loading");
      setFaceMessage("Mengaktifkan kamera...");
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 480 } },
        audio: false
      });
      
      videoRef.current.srcObject = stream;
      streamRef.current = stream;
      
      await new Promise(resolve => videoRef.current.onloadeddata = resolve);
      videoRef.current.play();
      
      setCameraActive(true);
      setFaceStatus("scanning");
      setFaceMessage("Posisikan wajah full di lingkaran");
      
      // Start detection loop
      detectionLoop();
    } catch (err) {
      setFaceStatus("idle");
      toast.error("Gagal akses kamera");
    }
  };

  // Face Detection Loop (Full Frame + Smile)
  const detectionLoop = async () => {
    if (!videoRef.current || !streamRef.current) return;

    try {
      const detection = await faceapi
        .detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 })
        )
        .withFaceLandmarks()
        .withFaceExpressions();

      if (!detection) {
        setFaceStatus("scanning");
        setFaceMessage("Wajah tidak terdeteksi. Posisikan wajah di lingkaran.");
        if (streamRef.current) requestAnimationFrame(detectionLoop);
        return;
      }

      // Validasi Full Frame
      const box = detection.detection.box;
      const vw = videoRef.current.videoWidth;
      const vh = videoRef.current.videoHeight;
      const margin = 20;
      
      const isCropped = box.x < margin || box.y < margin || box.x + box.width > vw - margin || box.y + box.height > vh - margin;
      const isTooSmall = box.width < vw * 0.4 || box.height < vh * 0.4;

      if (isCropped || isTooSmall) {
        setFaceStatus("scanning");
        setFaceMessage(isCropped ? "Wajah terpotong! Posisikan full dahi-dagu" : "Mendekatlah ke kamera");
        if (streamRef.current) requestAnimationFrame(detectionLoop);
        return;
      }

      // Cek Senyum
      const happyScore = detection.expressions.happy;
      
      if (happyScore > 0.7) {
        // SENYUM TERDETEKSI!
        setFaceStatus("success");
        setFaceMessage("Senyum terdeteksi! Memproses...");
        
        // Capture photo
        const canvas = canvasRef.current;
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        // Add watermark
        const now = new Date();
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
        ctx.font = "bold 16px Arial";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.fillText(`${now.toLocaleDateString('id-ID')} - ${now.toLocaleTimeString('id-ID')}`, canvas.width / 2, canvas.height - 15);
        
        const photoData = canvas.toDataURL("image/jpeg", 0.8);
        
        // Stop camera
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
        
        // Submit attendance
        await handleSubmit("in", photoData);
        return;
      }

      // Wajah valid tapi belum senyum
      setFaceStatus("smiling");
      setFaceMessage("😊 Senyum ke kamera!");
      
      if (streamRef.current) requestAnimationFrame(detectionLoop);
    } catch (err) {
      if (streamRef.current) requestAnimationFrame(detectionLoop);
    }
  };

  // Submit Attendance
  const handleSubmit = async (type, photoData) => {
    setSubmitting(true);
    try {
      if (locationStatus !== "valid") {
        toast.error(`Anda di luar radius ${RADIUS_METER}m!`);
        return;
      }
      
      // TODO: Ganti dengan call service clockIn/clockOut
      toast.success("✅ Absensi berhasil! Waktu server mencatat.");
      setTodayAttendance({ clock_in_time: new Date().toISOString(), attendance_status: "hadir" });
      
      setFaceStatus("idle");
      setCameraActive(false);
    } catch (err) {
      toast.error("Gagal: " + err.message);
      setFaceStatus("idle");
      setCameraActive(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefreshLocation = () => {
    getLocation();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 size={36} className="animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      {/* Hero Clock */}
      <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-teal-600 to-cyan-800 p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1 opacity-80">
              <Stethoscope size={14} />
              <span className="text-xs font-medium tracking-wide uppercase">Puskesmas Ampenan</span>
            </div>
            <p className="text-sm opacity-70">
              {currentTime.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-mono font-bold tabular-nums tracking-tight">
              {currentTime.toLocaleTimeString("id-ID")}
            </p>
          </div>
        </div>
      </div>

      {/* Status Absensi */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
        {todayAttendance ? (
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Status Hari Ini</span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_STYLE[todayAttendance.attendance_status]?.bg} ${STATUS_STYLE[todayAttendance.attendance_status]?.text}`}>
              {STATUS_STYLE[todayAttendance.attendance_status]?.label || "-"}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-gray-400">
            <Clock size={20} />
            <p className="text-sm">Belum absen hari ini</p>
          </div>
        )}
      </div>

      {/* GPS Location */}
      <div className={`rounded-2xl border shadow-sm p-5 ${
        locationStatus === "valid" ? "bg-emerald-50 border-emerald-200" :
        locationStatus === "invalid" ? "bg-red-50 border-red-200" :
        "bg-gray-50 border-gray-200"
      }`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <MapPin size={16} className={locationStatus === "valid" ? "text-emerald-600" : "text-red-500"} />
            Lokasi GPS
          </span>
          <button onClick={handleRefreshLocation} className="text-xs text-teal-600 flex items-center gap-1">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
        
        {isFakeGPS && (
          <div className="mb-3 p-3 bg-red-100 border border-red-300 rounded-lg flex items-center gap-2">
            <ShieldAlert size={16} className="text-red-600" />
            <p className="text-xs text-red-700 font-medium">Terdeteksi Fake GPS! Matikan aplikasi lokasi palsu.</p>
          </div>
        )}
        
        {locationStatus === "checking" && <p className="text-sm text-gray-500">Mendeteksi lokasi...</p>}
        {locationStatus === "valid" && <p className="text-sm text-emerald-700">Dalam radius Puskesmas ({distance}m)</p>}
        {locationStatus === "invalid" && !isFakeGPS && <p className="text-sm text-red-600">Di luar radius ({distance}m)</p>}
        {locationStatus === "error" && <p className="text-sm text-red-500">GPS tidak aktif</p>}
      </div>

      {/* Face Verification / Camera */}
      {!todayAttendance && (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Camera size={16} className="text-teal-600" />
            Verifikasi Wajah (Senyum)
          </h2>

          {!cameraActive ? (
            <button
              onClick={startCamera}
              disabled={locationStatus !== "valid" || isFakeGPS || !modelsLoaded}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2"
            >
              {modelsLoaded ? <><Camera size={16} /> Buka Kamera</> : <><Loader2 size={16} className="animate-spin" /> Memuat AI...</>}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scaleX(-1)" />
                <canvas ref={canvasRef} className="hidden" />
                
                {/* Overlay Frame */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className={`w-3/4 h-3/4 border-4 rounded-2xl transition-all ${
                    faceStatus === "success" ? "border-emerald-500 shadow-lg shadow-emerald-500/50" :
                    faceStatus === "smiling" ? "border-amber-500" :
                    "border-white/50 border-dashed"
                  }`}></div>
                </div>
              </div>
              
              <div className={`text-center text-sm font-medium p-3 rounded-lg ${
                faceStatus === "success" ? "bg-emerald-50 text-emerald-700" :
                faceStatus === "smiling" ? "bg-amber-50 text-amber-700" :
                "bg-gray-50 text-gray-600"
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