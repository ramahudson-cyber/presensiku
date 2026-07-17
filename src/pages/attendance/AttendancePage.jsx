import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import {
  CheckCircle2, Loader2, ShieldAlert
} from "lucide-react";
import LocationMap from "../../components/LocationMap";
import AttendanceResultSheet from "../../components/AttendanceResultSheet";
import { getCurrentPosition } from "../../services/geoService";
import { getPuskesmasLocation, calculateDistance, verifyLocationServer } from "../../services/attendanceService";

const SHIFT_NAMES = { PG: "Pagi", SR: "Sore", SI: "Siang", ML: "Malam" };

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
  else if (/Edg/i.test(ua)) deviceBrowser = "Edge";
  else if (/OPR|Opera/i.test(ua)) deviceBrowser = "Opera";

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

  const [todayAttendance, setTodayAttendance] = useState(null);
  const [todaySchedule, setTodaySchedule] = useState(null);
  const [locationStatus, setLocationStatus] = useState("checking");
  const [distance, setDistance] = useState(null);
  const [currentCoords, setCurrentCoords] = useState(null);

  const [serverTime, setServerTime] = useState(null);
  const [serverOffset, setServerOffset] = useState(0);
  const [displayTime, setDisplayTime] = useState(new Date());

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isFakeGPS, setIsFakeGPS] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deviceVisitorId, setDeviceVisitorId] = useState("");
  const [puskesmasLocation, setPuskesmasLocation] = useState({ latitude: -8.5697, longitude: 116.0821, radius_meter: 200, name: "Puskesmas Ampenan" });
  const prevDistanceRef = useRef(null);
  const DISTANCE_THRESHOLD = 5;
  const [refreshing, setRefreshing] = useState(false);



  const [resultSheetOpen, setResultSheetOpen] = useState(false);
  const [resultType, setResultType] = useState("in");
  const [resultData, setResultData] = useState(null);

  const syncServerTime = async () => {
    try {
      const t0 = Date.now();
      const { data, error } = await supabase.rpc("get_server_time");
      const t1 = Date.now();
      if (error) throw error;
      const serverMs = new Date(data).getTime();
      const offset = serverMs - (t0 + (t1 - t0) / 2);
      setServerOffset(offset);
      setServerTime(new Date(serverMs));
    } catch (err) {
      console.error("Server time sync failed:", err);
    }
  };

  useEffect(() => {
    const t = setInterval(() => {
      setDisplayTime(new Date(Date.now() + serverOffset));
    }, 1000);
    return () => clearInterval(t);
  }, [serverOffset]);

  useEffect(() => {
    syncServerTime();
    getLocation();
    fetchTodayAttendance();
    fetchTodaySchedule();
    getDeviceVisitorId();
    getPuskesmasLocation().then(loc => {
      if (loc) setPuskesmasLocation(loc);
    });
    const timeSync = setInterval(syncServerTime, 5 * 60 * 1000);
    const locationCheck = setInterval(getLocation, 5 * 1000);

    return () => {
      clearInterval(timeSync);
      clearInterval(locationCheck);
    };
  }, []);

  const getDeviceVisitorId = async () => {
    try {
      const FingerprintJS = (await import("@fingerprintjs/fingerprintjs")).default;
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      setDeviceVisitorId(result.visitorId);
    } catch {
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

  const getLocation = async () => {
    setLocationStatus("checking");
    setIsFakeGPS(false);
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 5000);
    try {
      const loc = await getCurrentPosition();
      setCurrentCoords(loc);

      const isFake = (loc.accuracy < 3) && (loc.altitude === null || loc.altitude === 0);
      if (isFake) {
        setIsFakeGPS(true);
        setLocationStatus("invalid");
        setRefreshing(false);
        return;
      }

      const serverResult = await verifyLocationServer(loc.latitude, loc.longitude, loc.accuracy);
      if (serverResult) {
        if (!serverResult.valid) {
          if (serverResult.suspicious_accuracy) setIsFakeGPS(true);
          setLocationStatus("invalid");
          setDistance(serverResult.distance);
          setError(serverResult.error);
          setRefreshing(false);
          return;
        }
        setDistance(serverResult.distance);
        setLocationStatus("valid");
        setError("");
      } else {
        const dist = calculateDistance(loc.latitude, loc.longitude, puskesmasLocation.latitude, puskesmasLocation.longitude);
        const rounded = Math.round(dist);
        prevDistanceRef.current = rounded;
        setDistance(rounded);
        const isValid = rounded <= ((puskesmasLocation.radius_meter || 200) + (loc.accuracy || 0));
        setLocationStatus(isValid ? "valid" : "invalid");
        if (isValid) setError("");
      }
    } catch {
      setLocationStatus("error");
    }
    setRefreshing(false);
  };

  const getTodayScheduleInfo = async (witaDate, userId) => {
    const today = witaDate.toISOString().split("T")[0];
    const { data } = await supabase
      .from("employee_schedules")
      .select("shift_code")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();
    return data;
  };

  const getShiftSchedule = async (shiftCode, dayOfWeek) => {
    const { data } = await supabase
      .from("shift_schedules")
      .select("start_time, latest_check_in, crosses_midnight, is_working_day")
      .eq("shift_code", shiftCode)
      .eq("day_of_week", dayOfWeek)
      .single();
    return data;
  };

  const validateLocationOnServer = async (latitude, longitude, accuracy) => {
  const result = await verifyLocationServer(latitude, longitude, accuracy);
  if (!result) return { valid: false, error: "Gagal validasi server. Coba lagi." };
  return result;
};

const handleCheckIn = async () => {
    setError("");
    setSuccessMsg("");
    setSaving(true);
    try {
      const freshLoc = await getCurrentPosition();
      const isFake = (freshLoc.accuracy < 3) && (freshLoc.altitude === null || freshLoc.altitude === 0);
      if (isFake) {
        setIsFakeGPS(true);
        setError("Terdeteksi Fake GPS! Absen ditolak.");
        setSaving(false);
        return;
      }

      // Validasi SERVER sebelum absen
      const serverCheck = await validateLocationOnServer(freshLoc.latitude, freshLoc.longitude, freshLoc.accuracy);
      if (!serverCheck.valid) {
        setError(serverCheck.error || "Anda di luar radius absen. Silakan mendekat ke Puskesmas.");
        setIsFakeGPS(!!serverCheck.suspicious_accuracy);
        setSaving(false);
        return;
      }

      setCurrentCoords(freshLoc);
      setDistance(serverCheck.distance);
      setLocationStatus("valid");

      const deviceName = getDeviceInfoLite();

      const { data: serverNow, error: timeErr } = await supabase.rpc("get_server_time");
      if (timeErr) throw timeErr;
      const now = new Date(serverNow);

      const witaMs = now.getTime() + (8 * 60 * 60 * 1000);
      const witaDate = new Date(witaMs);
      const today = witaDate.toISOString().split("T")[0];

      const schedule = await getTodayScheduleInfo(witaDate, user.id);
      const shiftCode = schedule?.shift_code || "PG";

      const pgDayOfWeek = (witaDate.getUTCDay() + 6) % 7;
      const shiftSchedule = await getShiftSchedule(shiftCode, pgDayOfWeek);

      const witaHour = witaDate.getUTCHours();
      const witaMinute = witaDate.getUTCMinutes();
      const totalWitaMinutes = witaHour * 60 + witaMinute;

      let isLate = false;
      let lateMinutes = 0;
      let status = "hadir";

      if (shiftSchedule?.is_working_day && shiftSchedule?.start_time) {
        const [sh, sm] = shiftSchedule.start_time.split(":").map(Number);
        const shiftStartMinutes = sh * 60 + sm;
        const [lh, lm] = (shiftSchedule.latest_check_in || shiftSchedule.start_time).split(":").map(Number);
        const lateThreshold = lh * 60 + lm;

        isLate = totalWitaMinutes > lateThreshold;
        lateMinutes = isLate ? totalWitaMinutes - shiftStartMinutes : 0;
        status = isLate ? "terlambat" : "hadir";

        if (lateMinutes > 600) {
          setError("Anda terlambat " + lateMinutes + " menit. Tidak dapat absen. Hubungi admin.");
          setSaving(false);
          return;
        }
      }

      const payload = {
        user_id: user.id,
        date: today,
        clock_in_time: now.toISOString(),
        clock_out_time: null,
        location_in: {
          latitude: freshLoc.latitude,
          longitude: freshLoc.longitude,
          accuracy: freshLoc.accuracy,
          altitude: freshLoc.altitude,
          distance_from_puskesmas: serverCheck.distance,
        },
        location_out: null,
        selfie_in_url: null,
        selfie_out_url: null,
        attendance_status: status,
        shift_code: shiftCode,
        schedule_match: !!schedule,
        is_late: isLate,
        late_minutes: lateMinutes,
        notes: null,
        device_visitor_id: deviceVisitorId,
        device_name: deviceName,
      };

      const { data: inserted, error } = await supabase
        .from("attendance")
        .upsert(payload, { onConflict: "user_id,date" })
        .select()
        .single();

      if (error) throw error;

      setTodayAttendance(inserted);
      setResultData(inserted);
      setResultType("in");
      setResultSheetOpen(true);
    } catch (err) {
      setError("Gagal absen: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const handleCheckOut = async () => {
    setError("");
    setSuccessMsg("");
    setSaving(true);
    try {
      const freshLoc = await getCurrentPosition();
      const isFake = (freshLoc.accuracy < 3) && (freshLoc.altitude === null || freshLoc.altitude === 0);
      if (isFake) {
        setIsFakeGPS(true);
        setError("Terdeteksi Fake GPS! Absen pulang ditolak.");
        setSaving(false);
        return;
      }

      // Validasi SERVER sebelum absen pulang
      const serverCheck = await validateLocationOnServer(freshLoc.latitude, freshLoc.longitude, freshLoc.accuracy);
      if (!serverCheck.valid) {
        setError(serverCheck.error || "Anda di luar radius absen. Tidak bisa absen pulang.");
        setIsFakeGPS(!!serverCheck.suspicious_accuracy);
        setSaving(false);
        return;
      }

      setCurrentCoords(freshLoc);
      setDistance(serverCheck.distance);
      setLocationStatus("valid");

      const deviceName = getDeviceInfoLite();

      const { data: serverNow, error: timeErr } = await supabase.rpc("get_server_time");
      if (timeErr) throw timeErr;
      const now = new Date(serverNow);

      const { data: updated, error } = await supabase
        .from("attendance")
        .update({
          clock_out_time: now.toISOString(),
          location_out: {
            latitude: freshLoc.latitude,
            longitude: freshLoc.longitude,
            accuracy: freshLoc.accuracy,
            altitude: freshLoc.altitude,
            distance_from_puskesmas: serverCheck.distance,
          },
          selfie_out_url: null,
          device_visitor_id: deviceVisitorId,
          device_name: deviceName,
        })
        .eq("id", todayAttendance.id)
        .select()
        .single();

      if (error) throw error;

      setTodayAttendance(updated);
      setResultData(updated);
      setResultType("out");
      setResultSheetOpen(true);
    } catch (err) {
      setError("Gagal absen pulang: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const timeStr = displayTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = displayTime.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const radiusBg = currentCoords
    ? { latitude: currentCoords.latitude, longitude: currentCoords.longitude }
    : puskesmasLocation;

  return (
    <div className="fixed inset-0 z-10 top-[var(--header-h,0px)] overflow-hidden bg-[#0d0a14]">
      {/* Ambient Glow Orbs */}
      <div className="absolute top-[-120px] right-[-80px] w-[300px] h-[300px] bg-[radial-gradient(circle,rgba(191,0,255,0.08)_0%,transparent_70%)] rounded-full pointer-events-none z-[1]"></div>
      <div className="absolute bottom-[-100px] left-[-60px] w-[250px] h-[250px] bg-[radial-gradient(circle,rgba(74,222,128,0.05)_0%,transparent_70%)] rounded-full pointer-events-none z-[1]"></div>

      {/* Map Fullscreen */}
      <div className="absolute inset-0 z-0">
        {currentCoords ? (
          <LocationMap
            userLocation={{ latitude: currentCoords.latitude, longitude: currentCoords.longitude }}
            puskesmasLocation={{ latitude: puskesmasLocation.latitude, longitude: puskesmasLocation.longitude }}
            distance={distance}
            status={locationStatus}
            fullscreen={true}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d0a14]">
            <Loader2 size={28} className="animate-spin text-periwinkle-glow/60 mb-3" />
            <p className="text-xs text-white/30">Mendapatkan lokasi...</p>
          </div>
        )}
      </div>

      {/* Overlay Content */}
      <div className="absolute inset-0 z-10 flex flex-col pt-16 sm:pt-20 px-4 pb-24 pointer-events-none">
        {/* Top: Server Time + Location Card */}
        <div className="pointer-events-auto space-y-2">
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-xl rounded-full px-3.5 py-2 border border-black/10 shadow-sm">
            <div>
              <p className="text-[8px] text-black uppercase tracking-[0.6px]">{dateStr}</p>
              <p className="text-sm font-bold font-mono tabular-nums tracking-tight text-black">{timeStr}</p>
            </div>
            {serverTime ? (
              <span className="w-1.5 h-1.5 rounded-full bg-green-yellow shadow-[0_0_6px_rgba(173,255,47,0.6)] animate-breathe shrink-0"></span>
            ) : (
              <Loader2 size={12} className="animate-spin text-periwinkle-glow shrink-0" />
            )}
          </div>

          {/* Location Card */}
          <div className="bg-white/85 backdrop-blur-2xl rounded-[18px] p-3.5 border border-black/10 shadow-sm">
            {/* Row 1: Location + Status Pill */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[10px] bg-electric-violet/15 border border-electric-violet/6 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#BF00FF" strokeWidth="2" strokeLinecap="round">
                    <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[13px] font-extrabold text-black tracking-tight leading-tight">{puskesmasLocation.name || "Puskesmas Ampenan"}</p>
                  <p className="text-[8px] font-semibold text-black uppercase tracking-[0.5px]">Lokasi Absensi</p>
                </div>
              </div>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
                locationStatus === "valid"
                  ? "bg-black border border-black"
                  : locationStatus === "invalid"
                  ? "bg-red-500/10 border border-red-500/20"
                  : "bg-black/5 border border-black/10"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  locationStatus === "valid" ? "bg-pure-white shadow-[0_0_6px_rgba(255,255,255,0.5)] animate-breathe" :
                  locationStatus === "invalid" ? "bg-red-400" : "bg-black/30"
                }`}></span>
                <span className={`text-[8px] font-bold uppercase tracking-[0.3px] ${
                  locationStatus === "valid" ? "text-pure-white" :
                  locationStatus === "invalid" ? "text-red-400" :
                  "text-black/50"
                }`}>
                  {locationStatus === "valid" ? "Dalam Radius" :
                   locationStatus === "invalid" ? "Luar Radius" :
                   locationStatus === "checking" ? "Cek..." :
                   "Error"}
                </span>
              </div>
            </div>

            {/* Row 2: Distance + Shift */}
            <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-black/[0.06]">
              <div className="flex items-center gap-1 px-2 py-1 rounded-full">
                <span className="text-[9px] text-black">📍</span>
                <span className="text-[9px] font-medium text-black">
                  <strong className="text-black font-bold">{distance || "—"}</strong> dari {puskesmasLocation.name?.toLowerCase?.() || "puskesmas"}
                </span>
              </div>
              <div className="ml-auto px-2 py-1 rounded-full border border-electric-violet/4">
                <span className="text-[8px] font-bold text-black uppercase tracking-[1px]">
                  {"Shift " + (todaySchedule?.name || (todayAttendance?.shift_code ? SHIFT_NAMES[todayAttendance.shift_code] : ""))}
                </span>
              </div>
            </div>

            {/* Attendance Status */}
            {todayAttendance && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-black/[0.06]">
                <div className={`w-2 h-2 rounded-full ${todayAttendance.is_late ? "bg-green-yellow" : "bg-green-yellow"}`}></div>
                <span className="text-[9px] font-semibold text-black">
                  {todayAttendance.clock_out_time
                    ? "Selesai"
                    : todayAttendance.is_late
                      ? `Terlambat ${todayAttendance.late_minutes}m`
                      : "Belum absen pulang"}
                </span>
                <div className="ml-auto flex gap-2">
                  <span className="text-[8px] text-black">Masuk {formatTimeSimple(todayAttendance.clock_in_time)}</span>
                  {todayAttendance.clock_out_time && (
                    <span className="text-[8px] text-periwinkle-glow/40">Pulang {formatTimeSimple(todayAttendance.clock_out_time)}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Error banner */}
          {error && (
            <div className="px-3 py-2 rounded-xl">
              <p className="text-[10px] text-red-600 font-medium">{error}</p>
            </div>
          )}
          {successMsg && (
            <div className="px-3 py-2 rounded-xl flex items-center gap-2">
              <CheckCircle2 size={12} className="text-green-yellow shrink-0" />
              <p className="text-[10px] text-green-600">{successMsg}</p>
            </div>
          )}
          {isFakeGPS && (
            <div className="px-3 py-2 rounded-xl flex items-center gap-2">
              <ShieldAlert size={12} className="text-red-400 shrink-0" />
              <p className="text-[9px] text-red-600 font-medium">Terdeteksi Fake GPS! Absen ditolak.</p>
            </div>
          )}
	        </div>

	        {todayAttendance && todayAttendance.clock_out_time ? null : (
          <div className="pointer-events-auto flex flex-col items-center gap-2 pb-2">
            <div className="relative">
              <div className="absolute inset-[-8px] rounded-full bg-gradient-to-br from-electric-violet/20 to-transparent blur-2xl animate-ring-pulse"></div>
              <div className="absolute inset-[-2px] rounded-full border border-white/[0.05]"></div>
              <button
                onClick={todayAttendance ? handleCheckOut : handleCheckIn}
                disabled={locationStatus !== "valid" || isFakeGPS || saving || !serverTime}
                className="relative w-[76px] h-[76px] rounded-full bg-gradient-to-br from-electric-violet/25 to-electric-violet/10 border border-electric-violet/10 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-md"
              >
                {saving ? (
                  <Loader2 size={24} className="animate-spin text-white/80" />
                ) : !serverTime ? (
                  <Loader2 size={24} className="animate-spin text-white/50" />
                ) : (
                  <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a6 6 0 0 0-6 6c0 3.5-1 5.5-1.5 6.5a3 3 0 0 0 1 3.8"/>
                    <path d="M12 2a6 6 0 0 1 6 6c0 3.5 1 5.5 1.5 6.5a3 3 0 0 1-1 3.8"/>
                    <path d="M8 14a4 4 0 0 1 8 0"/>
                    <path d="M10 19a2 2 0 0 1 4 0"/>
                    <path d="M9 7c0-1.1.9-2 2-2s2 .9 2 2v3"/>
                    <path d="M9 12v3"/>
                    <path d="M15 12v3"/>
                  </svg>
                )}
              </button>
            </div>
            <span className="text-[10px] font-bold text-black tracking-[2px] uppercase">
              {saving ? "Menyimpan..." : !serverTime ? "Sinkron..." : todayAttendance ? "Absen Pulang" : "Absen Sekarang"}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Sheet */}
      <div className="relative z-20">
        <AttendanceResultSheet
          open={resultSheetOpen}
          onClose={() => setResultSheetOpen(false)}
          data={resultData}
          type={resultType}
        />
      </div>
    </div>
  );
}

function formatTimeSimple(isoString) {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
