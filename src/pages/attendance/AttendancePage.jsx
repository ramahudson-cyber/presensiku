import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import {
  MapPin, Camera, Clock, CheckCircle2,
  RefreshCw, Loader2, ShieldAlert, X, Sparkles, ShieldCheck
} from "lucide-react";
import * as faceapi from "face-api.js";

const PUSKESMAS_LOCATION = { latitude: -8.5699, longitude: 116.0770 };
const RADIUS_METER = 50000; // TEST MODE — ubah ke 300 untuk produksi
const MODEL_URL = "/models";

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

const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.MSStream;
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const isStandalonePwa = window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches;

export default function AttendancePage() {
  const { user } = useAuth();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const [todayAttendance, setTodayAttendance] = useState(null);
  const [todaySchedule, setTodaySchedule] = useState(null);
  const [locationStatus, setLocationStatus] = useState("checking");
  const [distance, setDistance] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [currentCoords, setCurrentCoords] = useState(null);

  // ⏰ SERVER TIME (anti-cheat)
  const [serverTime, setServerTime] = useState(null);
  const [serverOffset, setServerOffset] = useState(0);
  const [displayTime, setDisplayTime] = useState(new Date());

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelsFailed, setModelsFailed] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [faceStatus, setFaceStatus] = useState("idle");
  const [faceMessage, setFaceMessage] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [persistentError, setPersistentError] = useState("");
  const [isFakeGPS, setIsFakeGPS] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [deviceVisitorId, setDeviceVisitorId] = useState("");
  const cameraStartingRef = useRef(false);

  // ============================================================
  // ⏰ SYNC SERVER TIME — anti-cheat timestamp
  // ============================================================
  const syncServerTime = async () => {
    try {
      const t0 = Date.now();
      const { data, error } = await supabase.rpc("get_server_time");
      const t1 = Date.now();
      if (error) throw error;
      const serverMs = new Date(data).getTime();
      const roundTrip = t1 - t0;
      const offset = serverMs - (t0 + roundTrip / 2);
      setServerOffset(offset);
      setServerTime(new Date(serverMs));
    } catch (err) {
      console.error("Server time sync failed:", err);
      setServerOffset(0);
    }
  };

  useEffect(() => {
    const t = setInterval(() => {
      setDisplayTime(new Date(Date.now() + serverOffset));
    }, 1000);
    return () => clearInterval(t);
  }, [serverOffset]);

  // Warm-up model supaya inference pertama tidak lambat
  const warmUpFaceModels = async () => {
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
    } catch { /* warmup not critical */ }
  };

  // 🔄 iOS Safari BFCACHE + VISIBILITY FIX:
  // Stream kamera & permission context hilang setelah app di-background.
  // Reload halaman saat user kembali agar kamera bisa diakses lagi.
  // - pageshow (bfcache restore): reload dgn time-based guard (30s cooldown)
  // - visibilitychange: jika stream mati dan kamera sedang terbuka, reload
  useEffect(() => {
    const canReload = () => {
      const lastReload = parseInt(sessionStorage.getItem("siap_bfcache_ts") || "0");
      if (Date.now() - lastReload > 30000) {
        sessionStorage.setItem("siap_bfcache_ts", String(Date.now()));
        return true;
      }
      return false;
    };

    const onPageShow = (e) => {
      if (e.persisted && canReload()) {
        window.location.reload();
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && cameraOpen && streamRef.current) {
        const alive = streamRef.current.getVideoTracks().some(t => t.readyState === "live");
        if (!alive && canReload()) {
          window.location.reload();
        }
      }
    };

    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [cameraOpen]);

  useEffect(() => {
    syncServerTime();
    const t = setInterval(syncServerTime, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const loadModels = async () => {
      try {
        let preloadModule;
        try {
          preloadModule = await import("../../utils/preloadModels");
        } catch { preloadModule = null; }

        if (preloadModule) {
          await preloadModule.preloadFaceModels();
        } else {
          await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
          ]);
        }
        setModelsLoaded(true);
        warmUpFaceModels();
      } catch (err) {
        console.error("Gagal load model:", err);
        setModelsFailed(true);
      }
    };
    loadModels();
    getLocation();
    fetchTodayAttendance();
    fetchTodaySchedule();
    getDeviceVisitorId();
    return () => cleanupCamera();
  }, []);

  const getDeviceVisitorId = async () => {
    try {
      const FingerprintJS = (await import("@fingerprintjs/fingerprintjs")).default;
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      setDeviceVisitorId(result.visitorId);
    } catch (err) {
      setDeviceVisitorId("fallback-" + Date.now());
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      const witaMs = Date.now() + serverOffset + (8 * 60 * 60 * 1000);
      const today = new Date(witaMs).toISOString().split("T")[0];
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();
      setTodayAttendance(data);
    } catch (e) { console.error(e); }
  };

  const fetchTodaySchedule = async () => {
    try {
      const witaMs = Date.now() + serverOffset + (8 * 60 * 60 * 1000);
      const witaDate = new Date(witaMs);
      const today = witaDate.toISOString().split("T")[0];
      const pgDayOfWeek = (witaDate.getUTCDay() + 6) % 7;

      const { data: sched } = await supabase
        .from("employee_schedules")
        .select("shift_code")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

      if (sched) {
        const { data: shiftInfo } = await supabase
          .from("shifts")
          .select("name")
          .eq("code", sched.shift_code)
          .single();
        setTodaySchedule({ code: sched.shift_code, name: shiftInfo?.name || sched.shift_code });
      } else {
        setTodaySchedule(null);
      }
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
      () => { setLocationStatus("error"); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // ============================================================
  // 📋 Ambil jadwal shift pegawai hari ini
  // ============================================================
  const getTodaySchedule = async (witaDate, userId) => {
    const today = witaDate.toISOString().split("T")[0];
    const { data } = await supabase
      .from("employee_schedules")
      .select("shift_code")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();
    return data;
  };

  // ============================================================
  // 📋 Ambil jadwal shift (start_time, latest_check_in, dll)
  // ============================================================
  const getShiftSchedule = async (shiftCode, dayOfWeek) => {
    const { data } = await supabase
      .from("shift_schedules")
      .select("start_time, latest_check_in, crosses_midnight, is_working_day")
      .eq("shift_code", shiftCode)
      .eq("day_of_week", dayOfWeek)
      .single();
    return data;
  };

  // ============================================================
  // 💾 SAVE ABSENSI — dengan deteksi shift otomatis
  // ============================================================
  const saveAttendanceToSupabase = async (photoData, location) => {
    try {
      setSavingAttendance(true);
      const deviceName = getDeviceInfoLite();

      // ⏰ Ambil server time (anti-cheat timestamp)
      const { data: serverNow, error: timeErr } = await supabase.rpc("get_server_time");
      if (timeErr) throw timeErr;
      const now = new Date(serverNow);

      // WITA (UTC+8)
      const witaMs = now.getTime() + (8 * 60 * 60 * 1000);
      const witaDate = new Date(witaMs);
      const today = witaDate.toISOString().split("T")[0];

      // ✅ Cari jadwal shift pegawai hari ini
      const schedule = await getTodaySchedule(witaDate, user.id);
      const shiftCode = schedule?.shift_code || "PG";

      // ✅ Konversi JS getUTCDay (0=Minggu) → day_of_week (0=Senin)
      const pgDayOfWeek = (witaDate.getUTCDay() + 6) % 7;

      // ✅ Ambil jadwal shift (start_time, tolerance, crosses_midnight)
      const shiftSchedule = await getShiftSchedule(shiftCode, pgDayOfWeek);

      // ⏰ Hitung keterlambatan
      const witaHour = witaDate.getUTCHours();
      const witaMinute = witaDate.getUTCMinutes();
      const totalWitaMinutes = witaHour * 60 + witaMinute;

      let isLate = false;
      let lateMinutes = 0;
      let status = "hadir";
      let scheduleMatch = !!schedule;

      if (shiftSchedule?.is_working_day && shiftSchedule?.start_time) {
        const [sh, sm] = shiftSchedule.start_time.split(":").map(Number);
        const shiftStartMinutes = sh * 60 + sm;

        // latest_check_in = start_time + 5 menit (toleransi)
        const [lh, lm] = (shiftSchedule.latest_check_in || shiftSchedule.start_time).split(":").map(Number);
        const lateThreshold = lh * 60 + lm;

        isLate = totalWitaMinutes > lateThreshold;
        lateMinutes = isLate ? totalWitaMinutes - shiftStartMinutes : 0;
        status = isLate ? "terlambat" : "hadir";

        // ⛔ Blokir jika terlambat lebih dari 1 jam
        if (lateMinutes > 60) {
          setFaceStatus("idle");
          setFaceMessage("");
          setCameraError("Anda terlambat " + lateMinutes + " menit (maksimal 1 jam). Tidak dapat absen. Hubungi admin.");
          setSavingAttendance(false);
          return false;
        }
      }

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
        shift_code: shiftCode,
        schedule_match: scheduleMatch,
        is_late: isLate,
        late_minutes: lateMinutes,
        notes: null,
        device_visitor_id: deviceVisitorId,
        device_name: deviceName,
      };

      console.log("🔍 Payload:", {
        ...payload,
        selfie_in_url: photoData.substring(0, 50) + "...[truncated]"
      });

      const { data, error } = await supabase
        .from("attendance")
        .upsert(payload, { onConflict: "user_id,date" })
        .select()
        .single();

      if (error) throw error;

      console.log("✅ Attendance saved:", data);
      await fetchTodayAttendance();
      return true;
    } catch (err) {
      console.error("❌ save error:", err);
      const errorDetail = `${err.message || err.toString()} | Code: ${err.code || "N/A"} | Hint: ${err.hint || "N/A"}`;
      setCameraError("GAGAL SAVE: " + errorDetail);
      return false;
    } finally {
      setSavingAttendance(false);
    }
  };

  // ============================================================
  // 📷 CAMERA — SAFARI PWA OPTIMIZED
  // ============================================================

  // 🔒 Track apakah stream camera masih hidup
  const streamAlive = () => {
    return streamRef.current && streamRef.current.getVideoTracks().some(t => t.readyState === "live");
  };

  // ⏱ Throttle detection — jangan overload Safari
  const DETECTION_INTERVAL = 300;
  let detectionTimer = null;

  const capturePhoto = async () => {
    if (!videoRef.current || !streamAlive()) return;
    try {
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
        setFaceStatus("success");
        setFaceMessage("Absensi tersimpan!");
        setTimeout(() => closeCameraModal(), 1800);
      } else {
        setFaceStatus("idle");
        setFaceMessage("");
      }
    } catch {
      setFaceStatus("idle");
      setFaceMessage("Gagal mengambil foto");
    }
  };

  // 📱 Native Camera via file input (fallback untuk PWA Home Screen)
  const handleNativePhoto = async (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    try {
      setFaceStatus("loading");
      setFaceMessage("Memproses foto...");
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const photoData = ev.target.result;
        const saved = await saveAttendanceToSupabase(photoData, currentCoords);
        if (saved) {
          setFaceStatus("success");
          setFaceMessage("Absensi tersimpan!");
          setTimeout(() => closeCameraModal(), 1800);
        } else {
          setFaceStatus("idle");
          setFaceMessage("");
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setFaceStatus("idle");
      setFaceMessage("Gagal memproses foto");
    }
    // Reset input agar bisa pilih file yg sama lagi
    e.target.value = "";
  };

  const openNativeCamera = () => {
    fileInputRef.current?.click();
  };

  const runDetection = async () => {
    if (!videoRef.current || !streamAlive()) return false;

    // Mode sederhana: tanpa face-api, user tap tombol untuk capture
    if (modelsFailed) {
      setFaceStatus("scanning");
      setFaceMessage("Tap tombol untuk mengambil foto");
      return true;
    }

    try {
      const detection = await faceapi.detectSingleFace(
        videoRef.current,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.3 })
      ).withFaceLandmarks().withFaceExpressions();

      if (!detection) {
        setFaceStatus("scanning");
        setFaceMessage("Wajah belum terdeteksi");
        return true;
      }

      const box = detection.detection.box;
      const vw = videoRef.current.videoWidth;
      const vh = videoRef.current.videoHeight;
      const margin = 20;
      const isCropped = box.x < margin || box.y < margin || box.x + box.width > vw - margin || box.y + box.height > vh - margin;
      const isTooSmall = box.width < vw * 0.35 || box.height < vh * 0.35;

      if (isCropped || isTooSmall) {
        setFaceStatus("scanning");
        setFaceMessage(isCropped ? "Wajah terpotong" : "Mendekatlah ke kamera");
        return true;
      }

      if (detection.expressions.happy > 0.7) {
        await capturePhoto();
        return false;
      }

      setFaceStatus("smiling");
      setFaceMessage("Senyum ke kamera!");
      return true;
    } catch {
      return streamAlive();
    }
  };

  const scheduleDetection = () => {
    if (detectionTimer) clearTimeout(detectionTimer);
    if (!streamAlive() || !cameraOpen) return;
    detectionTimer = setTimeout(async () => {
      const next = await runDetection();
      if (next && streamAlive()) scheduleDetection();
    }, DETECTION_INTERVAL);
  };

  const openCameraModal = async () => {
    if (cameraStartingRef.current) return;
    if (!modelsLoaded && !modelsFailed) {
      setPersistentError("AI model belum siap. Tunggu beberapa detik.");
      return;
    }
    cameraStartingRef.current = true;
    setPersistentError("");

    try {
      // 🚨 KRITIS UNTUK SAFARI PWA:
      // getUserMedia HARUS dipanggil di event loop yg sama dengan klik tombol.
      // DILARANG ada state update (setState) SEBELUM getUserMedia.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      streamRef.current = stream;
      setCameraError("");
      setPersistentError("");
      setFaceStatus("loading");
      setFaceMessage("Menyiapkan kamera...");
      setCameraOpen(true);

      // Tunggu video element muncul di DOM
      let video = videoRef.current;
      if (!video) {
        await new Promise(resolve => setTimeout(resolve, 100));
        video = videoRef.current;
        if (!video) throw new Error("Video element tidak ter-render.");
      }

      video.srcObject = stream;

      // ✅ SAFARI WAJIB: onloadedmetadata sebelum play()
      await new Promise((resolve, reject) => {
        let resolved = false;
        const done = () => { if (!resolved) { resolved = true; resolve(); } };
        const fail = (err) => { if (!resolved) { resolved = true; reject(err); } };

        if (video.readyState >= 2) {
          video.play().then(done).catch(fail);
        } else {
          video.onloadedmetadata = () => {
            video.play().then(done).catch(() => {
              video.muted = true;
              video.play().then(done).catch(fail);
            });
          };
          video.onerror = fail;
          setTimeout(() => fail(new Error("Timeout kamera")), 10000);
        }
      });

      setFaceStatus("scanning");
      setFaceMessage("Posisikan wajah di dalam lingkaran");
      scheduleDetection();
    } catch (err) {
      console.error("Camera error:", err);
      const errorMsg = err.name === "NotAllowedError"
        ? (isStandalonePwa
          ? "Izin kamera ditolak (PWA Home Screen).\n\nCoba:\n1. Buka Settings iPhone → cari \"SIAP Puskesmas\" → Camera → Allow\n2. Atau gunakan tombol Kamera Native di bawah"
          : isIOS
            ? "Izin kamera ditolak.\n\nCara perbaiki:\n1. Buka Settings iPhone → Safari → Camera → Allow\n2. Hapus Safari dari App Switcher (geser ke atas)\n3. Buka Safari lagi & coba absen"
            : "Izin kamera ditolak. Setting → Camera → Allow, lalu reload.")
        : err.name === "NotFoundError"
          ? "Kamera tidak ditemukan."
          : err.name === "NotReadableError"
            ? "Kamera sedang dipakai app lain. Tutup app kamera lain."
            : "Gagal akses kamera: " + err.message;

      // Jika modal belum sempat terbuka (gagal di getUserMedia), tampilkan error di halaman utama
      if (!cameraOpen) {
        setPersistentError(errorMsg);
        cleanupCamera();
      } else {
        // Jika modal sudah terbuka (gagal di video playback), tampilkan error di dalam modal
        setCameraError(errorMsg);
        cleanupCamera();
        // Modal tetap terbuka — user bisa baca error & tekan tombol retry/close
      }
    } finally {
      cameraStartingRef.current = false;
    }
  };



  const cleanupCamera = () => {
    if (detectionTimer) {
      clearTimeout(detectionTimer);
      detectionTimer = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => {
        t.removeEventListener("ended", cleanupCamera);
        t.stop();
      });
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

  const timeStr = displayTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = displayTime.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <div className="space-y-3 animate-fade-in">
        <div className="relative bg-white dark:bg-[#1a0d2e] rounded-2xl p-5 text-slate-900 dark:text-white shadow-lg border border-slate-200 dark:border-white/10 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 dark:bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <div className="relative">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">{dateStr}</p>
              {serverTime && (
                <div className="flex items-center gap-1 text-[9px] bg-violet-100 dark:bg-white/10 text-violet-700 dark:text-white px-2 py-1 rounded-full">
                  <ShieldCheck size={10} /> <span>Server Time</span>
                </div>
              )}
            </div>
            <p className="text-2xl font-bold mt-1 font-mono tabular-nums">{timeStr}</p>
            {!serverTime && (
              <p className="text-[10px] text-amber-600 dark:text-amber-200 mt-1 flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" /> Sinkron server...
              </p>
            )}
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
          {todayAttendance ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 size={18} className="text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">
                  Sudah Absen {todayAttendance.is_late && <span className="text-amber-400 text-[10px]">(Terlambat {todayAttendance.late_minutes}m)</span>}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span className="text-[11px] text-slate-400">
                    {new Date(todayAttendance.clock_in_time).toLocaleTimeString("id-ID", {hour:"2-digit",minute:"2-digit"})}
                  </span>
                  {todayAttendance.shift_code && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold
                      ${todayAttendance.shift_code === "PG" ? "bg-amber-500/15 text-amber-300" : ""}
                      ${todayAttendance.shift_code === "SR" ? "bg-orange-500/15 text-orange-300" : ""}
                      ${todayAttendance.shift_code === "SI" ? "bg-sky-500/15 text-sky-300" : ""}
                      ${todayAttendance.shift_code === "ML" ? "bg-violet-500/15 text-violet-300" : ""}
                    `}>
                      {todayAttendance.shift_code}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                <Clock size={18} className="text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">Belum absen hari ini</p>
                {todaySchedule ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold
                      ${todaySchedule.code === "PG" ? "bg-amber-500/15 text-amber-300" : ""}
                      ${todaySchedule.code === "SR" ? "bg-orange-500/15 text-orange-300" : ""}
                      ${todaySchedule.code === "SI" ? "bg-sky-500/15 text-sky-300" : ""}
                      ${todaySchedule.code === "ML" ? "bg-violet-500/15 text-violet-300" : ""}
                    `}>
                      {todaySchedule.name}
                    </span>
                    <span className="text-[10px] text-slate-500">Jadwal hari ini</span>
                  </div>
                ) : (
                  <p className="text-[10px] text-amber-300/70 mt-1">Tidak ada jadwal shift hari ini</p>
                )}
              </div>
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
          {locationStatus === "invalid" && !isFakeGPS && <p className="text-xs text-red-400">❌ Di luar radius ({distance}m)</p>}
          {locationStatus === "error" && <p className="text-xs text-red-400">GPS tidak aktif.</p>}
        </div>

        {!todayAttendance && modelsFailed && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 mb-2">
            Mode AI tidak tersedia di perangkat ini. Gunakan mode foto manual.
          </div>
        )}
        {!todayAttendance && (
          <>
            <button
              onClick={openCameraModal}
              disabled={locationStatus !== "valid" || isFakeGPS || (!modelsLoaded && !modelsFailed) || savingAttendance || !serverTime}
              className="w-full py-4 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-2xl font-semibold transition disabled:opacity-40 flex items-center justify-center gap-2 shadow-xl shadow-purple-900/30"
            >
              {savingAttendance ? (
                <><Loader2 size={20} className="animate-spin" /> Menyimpan...</>
              ) : !serverTime ? (
                <><Loader2 size={20} className="animate-spin" /> Sinkron server...</>
              ) : modelsLoaded ? (
                <><Camera size={20} /> Verifikasi Wajah</>
              ) : modelsFailed ? (
                <><Camera size={20} /> Ambil Foto</>
              ) : (
                <><Loader2 size={20} className="animate-spin" /> Memuat AI...</>
              )}
            </button>
            {isStandalonePwa && (
              <button onClick={openNativeCamera}
                disabled={locationStatus !== "valid" || isFakeGPS || savingAttendance || !serverTime}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl font-semibold transition disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg">
                <Camera size={20} /> Kamera Native (PWA)
              </button>
            )}
          </>
        )}

        {!serverTime && (
          <p className="text-center text-[10px] text-slate-400">
            ⏳ Menunggu sinkronisasi server time untuk mencegah manipulasi waktu
          </p>
        )}

        {persistentError && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30">
            <p className="text-xs text-red-300 whitespace-pre-line">{persistentError}</p>
            {isStandalonePwa && (
              <p className="text-xs text-amber-300 mt-2">
                💡 Tips: PWA Home Screen butuh izin kamera terpisah. 
                Buka Settings → cari "SIAP Puskesmas" → Camera → Allow.
                Atau gunakan tombol Kamera Native di bawah.
              </p>
            )}
            <div className="flex gap-2 mt-3">
              <button onClick={() => setPersistentError("")}
                className="flex-1 py-2 rounded-xl bg-white/10 text-white text-xs font-medium">Tutup</button>
              <button onClick={openNativeCamera}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white text-xs font-medium shadow-lg flex items-center justify-center gap-1.5">
                <Camera size={14} /> Kamera Native
              </button>
            </div>
          </div>
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
                <p className="text-slate-200 text-[11px]">Posisikan wajah & senyum</p>
              </div>
            </div>
            <button onClick={closeCameraModal} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition active:scale-95">
              <X size={20} />
            </button>
          </div>

          {cameraError && (
            <div className="relative w-full max-w-md mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
              <p className="text-xs text-red-300 text-center break-words whitespace-pre-line">{cameraError}</p>
              <div className="flex gap-2 mt-3">
                <button onClick={closeCameraModal}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-white text-xs font-medium">Tutup</button>
                <button onClick={openCameraModal}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white text-xs font-medium shadow-lg">Coba Lagi</button>
                <button onClick={openNativeCamera}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white text-xs font-medium shadow-lg flex items-center justify-center gap-1.5">
                  <Camera size={14} /> Native</button>
              </div>
            </div>
          )}

          <div className="relative w-full max-w-md aspect-square">
            <div className="absolute -inset-4 bg-gradient-to-br from-violet-600/20 to-purple-800/20 rounded-[2rem] blur-2xl"></div>
            <div className="relative w-full h-full rounded-[2rem] overflow-hidden bg-slate-900 shadow-2xl border border-white/10">
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
              <canvas ref={canvasRef} className="hidden" />

              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className={`w-3/5 h-4/5 border-4 rounded-[50%] transition-all duration-300 ${
                  faceStatus === "success" ? "border-violet-400 shadow-[0_0_50px_rgba(167,139,250,0.6)]" :
                  faceStatus === "smiling" ? "border-violet-300 shadow-[0_0_40px_rgba(196,181,253,0.4)]" :
                  faceStatus === "scanning" ? "border-violet-200/60" : "border-violet-300/30"
                }`} style={{ borderStyle: faceStatus === "scanning" || faceStatus === "idle" ? "dashed" : "solid" }}></div>
              </div>

              <div className="absolute top-4 left-4 w-6 h-6 border-l-2 border-t-2 border-white/40 rounded-tl-lg"></div>
              <div className="absolute top-4 right-4 w-6 h-6 border-r-2 border-t-2 border-white/40 rounded-tr-lg"></div>
              <div className="absolute bottom-4 left-4 w-6 h-6 border-l-2 border-b-2 border-white/40 rounded-bl-lg"></div>
              <div className="absolute bottom-4 right-4 w-6 h-6 border-r-2 border-b-2 border-white/40 rounded-br-lg"></div>

              {(faceStatus === "loading" || faceStatus === "idle") && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
                  <Loader2 size={36} className="animate-spin text-violet-400 mb-3" />
                  <p className="text-white text-sm font-medium">{faceMessage || "Menyiapkan..."}</p>
                  <p className="text-slate-300 text-[10px] mt-1">Mohon tunggu sebentar</p>
                </div>
              )}

              {faceStatus === "success" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-violet-600/30 backdrop-blur-sm">
                  <div className="w-24 h-24 bg-gradient-to-br from-violet-500 to-purple-700 rounded-full flex items-center justify-center shadow-2xl shadow-violet-900/50 mb-4">
                    <CheckCircle2 size={48} className="text-white" />
                  </div>
                  <p className="text-white font-bold text-lg">Absensi Berhasil!</p>
                  <p className="text-violet-200 text-xs mt-1">{faceMessage}</p>
                </div>
              )}
            </div>
          </div>

          <div className="relative w-full max-w-md mt-6 space-y-3">
            <div className={`text-center p-3.5 rounded-2xl text-sm font-medium transition-all ${
              faceStatus === "success" ? "bg-violet-500/15 text-violet-200 border border-violet-500/30" :
              faceStatus === "smiling" ? "bg-violet-400/10 text-violet-200 border border-violet-400/20" :
              faceStatus === "scanning" ? "bg-violet-500/5 text-white border border-violet-500/10" :
              "bg-white/5 text-slate-400 border border-white/10"
            }`}>
              {faceMessage || "Menyiapkan kamera..."}
            </div>
            {modelsFailed && faceStatus === "scanning" && (
              <button onClick={capturePhoto}
                className="w-full py-4 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-2xl font-semibold transition active:scale-95 flex items-center justify-center gap-2 shadow-xl shadow-purple-900/30">
                <Camera size={20} /> Ambil Foto
              </button>
            )}
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleNativePhoto} />
    </>
  );
}
