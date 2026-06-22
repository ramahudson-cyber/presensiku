import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import {
  MapPin, Camera, Clock, CheckCircle2,
  RefreshCw, Loader2, ShieldAlert, X, Sparkles
} from "lucide-react";
import * as faceapi from "face-api.js";

const PUSKESMAS_LOCATION = { latitude: -8.5699, longitude: 116.0770 };
const RADIUS_METER = 50000; // TEST MODE — ubah ke 300 untuk produksi
const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";

// Jam masuk default: 08:00. Terlambat jika > 08:00.
const STANDARD_CLOCK_IN_HOUR = 8;

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getDeviceInfoLite() {
  const ua = navigator.userAgent;
  let deviceName = "Unknown Device";
  let deviceOs = "Unknown";
  let deviceBrowser = "Unknown";

  if (/Windows/i.test(ua)) deviceOs = "Windows";
  else if (/Android/i.test(ua)) deviceOs = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) deviceOs = "iOS";
  else if (/Mac/i.test(ua)) deviceOs = "macOS";

  if (/Chrome/i.test(ua) && !/Edg|OPR/i.test(ua)) deviceBrowser = "Chrome";
  else if (/Firefox/i.test(ua)) deviceBrowser = "Firefox";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) deviceBrowser = "Safari";

  if (/Android/i.test(ua)) {
    const m = ua.match(/Android;[^;]+;([^)]+)\)/);
    deviceName = m ? `Android ${m[1].trim()}` : "Android Device";
  } else if (/iPhone/i.test(ua)) deviceName = "iPhone";
  else if (/iPad/i.test(ua)) deviceName = "iPad";
  else deviceName = `${deviceOs} ${deviceBrowser}`;

  return deviceName;
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
  const [cameraOpen, setCameraOpen] = useState(false);
  const [faceStatus, setFaceStatus] = useState("idle");
  const [faceMessage, setFaceMessage] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [isFakeGPS, setIsFakeGPS] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [deviceVisitorId, setDeviceVisitorId] = useState("");

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
        ]);
        setModelsLoaded(true);
      } catch (err) { console.error("Gagal load model:", err); }
    };
    loadModels();
    getLocation();
    fetchTodayAttendance();
    getDeviceVisitorId();
  }, []);

  const getDeviceVisitorId = async () => {
    try {
      const FingerprintJS = (await import("@fingerprintjs/fingerprintjs")).default;
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      setDeviceVisitorId(result.visitorId);
    } catch (err) {
      console.error("Fingerprint error:", err);
      setDeviceVisitorId("fallback-" + Date.now());
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();
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
      (err) => { setLocationStatus("error"); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // ============================================================
  // SAVE ABSENSI — sesuai schema asli Supabase
  // ============================================================
  const saveAttendanceToSupabase = async (photoData, location) => {
    try {
      setSavingAttendance(true);
      const now = new Date();
      const today = now.toISOString().split("T")[0];

      // Hitung keterlambatan
      const standardTime = new Date(now);
      standardTime.setHours(STANDARD_CLOCK_IN_HOUR, 0, 0, 0);
      const lateMs = now - standardTime;
      const isLate = lateMs > 0;
      const lateMinutes = isLate ? Math.floor(lateMs / 60000) : 0;
      const status = isLate ? "terlambat" : "hadir";

      const deviceName = getDeviceInfoLite();

      // Payload sesuai schema attendance:
      // - selfie_in_url (text)         → foto base64
      // - location_in (jsonb)          → { lat, lng, accuracy, altitude }
      // - device_visitor_id (text)     → fingerprint
      // - device_name (text)           → nama device
      // - attendance_status (enum)     → 'hadir' | 'terlambat'
      // - shift_code (enum)            → 'PG' (default)
      // - is_late (bool)               → true/false
      // - late_minutes (int)           → menit keterlambatan
      const payload = {
        user_id: user.id,
        date: today,
        clock_in_time: now.toISOString(),
        clock_out_time: null,
        location_in: location ? {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          altitude: location.altitude,
          distance_from_puskesmas: distance,
        } : null,
        location_out: null,
        selfie_in_url: photoData,
        selfie_out_url: null,
        attendance_status: status,
        shift_code: "PG",
        is_late: isLate,
        late_minutes: lateMinutes,
        notes: null,
        device_visitor_id: deviceVisitorId,
        device_name: deviceName,
      };

      const { data, error } = await supabase
        .from("attendance")
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error("❌ Insert error:", error);
        // Fallback: coba update jika sudah ada record hari ini (constraint unique user_id+date)
        if (error.code === "23505") {
          const { error: updateErr } = await supabase
            .from("attendance")
            .update({
              clock_in_time: now.toISOString(),
              location_in: payload.location_in,
              selfie_in_url: photoData,
              attendance_status: status,
              is_late: isLate,
              late_minutes: lateMinutes,
              device_visitor_id: deviceVisitorId,
              device_name: deviceName,
            })
            .eq("user_id", user.id)
            .eq("date", today);
          if (updateErr) throw updateErr;
        } else {
          throw error;
        }
      }

      await fetchTodayAttendance();
      return true;
    } catch (err) {
      console.error("❌ saveAttendanceToSupabase error:", err);
      setCameraError("Gagal menyimpan absensi: " + err.message);
      return false;
    } finally {
      setSavingAttendance(false);
    }
  };

  const openCameraModal = async () => {
    if (!modelsLoaded) {
      setCameraError("AI model belum siap. Tunggu beberapa detik.");
      return;
    }
    setCameraError("");
    setFaceStatus("loading");
    setFaceMessage("Menyiapkan kamera...");
    setCameraOpen(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false
      });
      streamRef.current = stream;

      await new Promise(resolve => setTimeout(resolve, 300));

      if (!videoRef.current) throw new Error("Video element tidak ter-render.");

      const video = videoRef.current;
      video.srcObject = stream;

      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
        setTimeout(reject, 5000);
      });

      try { await video.play(); }
      catch (playErr) {
        video.muted = true;
        await video.play().catch(() => {});
      }

      setFaceStatus("scanning");
      setFaceMessage("Posisikan wajah di dalam lingkaran");
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
      cleanupCamera();
      setCameraOpen(false);
    }
  };

  const cleanupCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const closeCameraModal = () => {
    cleanupCamera();
    setCameraOpen(false);
    setFaceStatus("idle");
    setFaceMessage("");
    setCameraError("");
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
        setFaceMessage("Wajah belum terdeteksi");
        if (streamRef.current) requestAnimationFrame(detectionLoop);
        return;
      }
      const box = detection.detection.box;
      const vw = videoRef.current.videoWidth;
      const vh = videoRef.current.videoHeight;
      const margin = 20;
      const isCropped = box.x < margin || box.y < margin || box.x + box.width > vw - margin || box.y + box.height > vh - margin;
      const isTooSmall = box.width < vw * 0.35 || box.height < vh * 0.35;
      if (isCropped || isTooSmall) {
        setFaceStatus("scanning");
        setFaceMessage(isCropped ? "Wajah terpotong — posisikan full" : "Mendekatlah ke kamera");
        if (streamRef.current) requestAnimationFrame(detectionLoop);
        return;
      }
      if (detection.expressions.happy > 0.7) {
        setFaceStatus("success");
        setFaceMessage("Menyimpan absensi...");
        const canvas = canvasRef.current;
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const photoData = canvas.toDataURL("image/jpeg", 0.8);
        cleanupCamera();

        const saved = await saveAttendanceToSupabase(photoData, currentCoords);
        if (saved) {
          setFaceMessage("✅ Absensi tersimpan!");
          setTimeout(() => closeCameraModal(), 1800);
        } else {
          setFaceStatus("idle");
          setFaceMessage("");
        }
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
    <>
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
                <p className="text-sm font-semibold text-white">
                  Sudah Absen {todayAttendance.is_late && <span className="text-amber-400 text-[10px]">(Terlambat {todayAttendance.late_minutes}m)</span>}
                </p>
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
          {locationStatus === "valid" && <p className="text-xs text-emerald-400">✅ Dalam radius ({distance}m)</p>}
          {locationStatus === "invalid" && !isFakeGPS && (
            <p className="text-xs text-red-400">❌ Di luar radius ({distance}m)</p>
          )}
          {locationStatus === "error" && <p className="text-xs text-red-400">GPS tidak aktif.</p>}
        </div>

        {!todayAttendance && (
          <button
            onClick={openCameraModal}
            disabled={locationStatus !== "valid" || isFakeGPS || !modelsLoaded || savingAttendance}
            className="w-full py-4 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-2xl font-semibold transition disabled:opacity-40 flex items-center justify-center gap-2 shadow-xl shadow-purple-900/30"
          >
            {savingAttendance ? (
              <><Loader2 size={20} className="animate-spin" /> Menyimpan...</>
            ) : modelsLoaded ? (
              <><Camera size={20} /> Verifikasi Wajah</>
            ) : (
              <><Loader2 size={20} className="animate-spin" /> Memuat AI...</>
            )}
          </button>
        )}
      </div>

      {cameraOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black p-4 animate-fade-in">
          <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-violet-900/40 via-violet-900/10 to-transparent pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-purple-900/30 to-transparent pointer-events-none"></div>

          <div className="relative w-full max-w-md flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-700 rounded-xl flex items-center justify-center shadow-lg">
                <Sparkles size={18} className="text-white" />
              </div>
              <div>
                <h2 className="text-white font-bold text-base">Verifikasi Wajah</h2>
                <p className="text-violet-300/60 text-[11px]">Posisikan wajah & senyum</p>
              </div>
            </div>
            <button
              onClick={closeCameraModal}
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition active:scale-95"
              aria-label="Tutup"
            >
              <X size={20} />
            </button>
          </div>

          {cameraError && (
            <div className="relative w-full max-w-md mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
              <p className="text-xs text-red-300 text-center">{cameraError}</p>
            </div>
          )}

          <div className="relative w-full max-w-md aspect-square">
            <div className="absolute -inset-4 bg-gradient-to-br from-violet-600/20 to-purple-800/20 rounded-[2rem] blur-2xl"></div>

            <div className="relative w-full h-full rounded-[2rem] overflow-hidden bg-slate-900 shadow-2xl border border-white/10">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                width={640}
                height={640}
                className="w-full h-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />
              <canvas ref={canvasRef} className="hidden" />

              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className={`w-3/5 h-4/5 border-4 rounded-[50%] transition-all duration-300 ${
                    faceStatus === "success" ? "border-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.5)]" :
                    faceStatus === "smiling" ? "border-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.4)]" :
                    faceStatus === "scanning" ? "border-white/60" :
                    "border-white/30"
                  }`}
                  style={{ borderStyle: faceStatus === "scanning" || faceStatus === "idle" ? "dashed" : "solid" }}
                ></div>
              </div>

              <div className="absolute top-4 left-4 w-6 h-6 border-l-2 border-t-2 border-white/40 rounded-tl-lg"></div>
              <div className="absolute top-4 right-4 w-6 h-6 border-r-2 border-t-2 border-white/40 rounded-tr-lg"></div>
              <div className="absolute bottom-4 left-4 w-6 h-6 border-l-2 border-b-2 border-white/40 rounded-bl-lg"></div>
              <div className="absolute bottom-4 right-4 w-6 h-6 border-r-2 border-b-2 border-white/40 rounded-br-lg"></div>

              {(faceStatus === "loading" || faceStatus === "idle") && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
                  <Loader2 size={36} className="animate-spin text-violet-400 mb-3" />
                  <p className="text-white text-sm font-medium">{faceMessage || "Menyiapkan..."}</p>
                  <p className="text-violet-300/50 text-[10px] mt-1">Mohon tunggu sebentar</p>
                </div>
              )}

              {faceStatus === "success" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-500/20 backdrop-blur-sm">
                  <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center shadow-2xl mb-4">
                    <CheckCircle2 size={48} className="text-white" />
                  </div>
                  <p className="text-white font-bold text-lg">Absensi Berhasil!</p>
                  <p className="text-emerald-200 text-xs mt-1">{faceMessage}</p>
                </div>
              )}
            </div>
          </div>

          <div className="relative w-full max-w-md mt-6">
            <div className={`text-center p-3.5 rounded-2xl text-sm font-medium transition-all ${
              faceStatus === "success" ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" :
              faceStatus === "smiling" ? "bg-amber-500/10 text-amber-300 border border-amber-500/20" :
              faceStatus === "scanning" ? "bg-white/5 text-white border border-white/10" :
              "bg-white/5 text-slate-400 border border-white/10"
            }`}>
              {faceMessage || "Menyiapkan kamera..."}
            </div>
          </div>

          {faceStatus === "smiling" && (
            <p className="relative text-center text-violet-300/50 text-[10px] mt-3 max-w-xs">
              Tip: Tampilkan gigi untuk deteksi senyum yang lebih akurat
            </p>
          )}
        </div>
      )}
    </>
  );
}