import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import {
  MapPin, Clock, CheckCircle2,
  RefreshCw, Loader2, ShieldAlert, ShieldCheck, LogOut
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
  const [puskesmasLocation, setPuskesmasLocation] = useState({ latitude: -8.5697, longitude: 116.0821, radius_meter: 200 });
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

  return (
    <div className="space-y-2.5 animate-fade-in">
      {/* Server Time Compact Card — Premium */}
      <div className="relative bg-[#0a0a12] rounded-[20px] p-3.5 text-white shadow-lg border border-white/[0.04] overflow-hidden">
        <div className="absolute top-0 right-0 w-20 h-20 bg-electric-violet/5 rounded-full -mr-8 -mt-8"></div>
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-[9px] text-white/40 uppercase tracking-[0.6px]">{dateStr}</p>
            <p className="text-xl font-bold font-mono tabular-nums mt-0.5 tracking-tight">{timeStr}</p>
          </div>
          {serverTime && (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-yellow shadow-[0_0_6px_rgba(173,255,47,0.6)]"></span>
              <span className="text-[9px] text-green-yellow/70 font-semibold tracking-wider">SYNC</span>
            </div>
          )}
          {!serverTime && (
            <div className="flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin text-periwinkle-glow" />
              <span className="text-[9px] text-periwinkle-glow/60">Sync...</span>
            </div>
          )}
        </div>
      </div>

      {/* Status Card — Compact Premium */}
      <div className="relative bg-gradient-to-br from-electric-violet/[0.07] to-[#0a0a12] backdrop-blur-xl rounded-[18px] p-3 border border-electric-violet/[0.04] shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        <div className="absolute top-[-20px] right-[-10px] w-16 h-16 bg-electric-violet/5 rounded-full pointer-events-none"></div>
        <div className="relative z-[1]">
          {todayAttendance ? (
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 ${
                todayAttendance.clock_out_time ? "bg-electric-violet/15 border border-electric-violet/8" : "bg-green-yellow/10 border border-green-yellow/8"
              }`}>
                {todayAttendance.clock_out_time
                  ? <CheckCircle2 size={15} className="text-periwinkle-glow" />
                  : <CheckCircle2 size={15} className="text-green-yellow" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-white tracking-tight">
                  {todayAttendance.clock_out_time ? "Sudah Absen (Selesai)" : "Sudah Absen Masuk"}
                  {todayAttendance.is_late && <span className="text-green-yellow text-[9px] ml-1">(Terlambat {todayAttendance.late_minutes}m)</span>}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] text-white/30 uppercase tracking-wider">Masuk</span>
                    <span className="text-[10px] text-white/60 font-semibold">
                      {new Date(todayAttendance.clock_in_time).toLocaleTimeString("id-ID", {hour:"2-digit",minute:"2-digit"})}
                    </span>
                  </div>
                  {todayAttendance.clock_out_time && (
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] text-white/30 uppercase tracking-wider">Pulang</span>
                      <span className="text-[10px] text-periwinkle-glow font-semibold">
                        {new Date(todayAttendance.clock_out_time).toLocaleTimeString("id-ID", {hour:"2-digit",minute:"2-digit"})}
                      </span>
                    </div>
                  )}
                  {todayAttendance.shift_code && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider
                      ${todayAttendance.shift_code === "PG" ? "bg-green-yellow/10 text-green-yellow" : ""}
                      ${todayAttendance.shift_code === "SR" ? "bg-green-yellow/10 text-green-yellow" : ""}
                      ${todayAttendance.shift_code === "SI" ? "bg-sky-500/10 text-sky-300" : ""}
                      ${todayAttendance.shift_code === "ML" ? "bg-violet-500/10 text-violet-300" : ""}
                    `}>
                      {SHIFT_NAMES[todayAttendance.shift_code] || todayAttendance.shift_code}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[10px] bg-electric-violet/10 border border-electric-violet/8 flex items-center justify-center shrink-0">
                <Clock size={14} className="text-periwinkle-glow" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-white tracking-tight">Belum absen hari ini</p>
                {todaySchedule ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider
                      ${todaySchedule.code === "PG" ? "bg-green-yellow/10 text-green-yellow" : ""}
                      ${todaySchedule.code === "SR" ? "bg-green-yellow/10 text-green-yellow" : ""}
                      ${todaySchedule.code === "SI" ? "bg-sky-500/10 text-sky-300" : ""}
                      ${todaySchedule.code === "ML" ? "bg-violet-500/10 text-violet-300" : ""}
                    `}>
                      {todaySchedule.name}
                    </span>
                    <span className="text-[9px] text-white/30">Jadwal hari ini</span>
                  </div>
                ) : (
                  <p className="text-[9px] text-green-yellow/60 mt-0.5">Tidak ada jadwal shift hari ini</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Location Card — Premium Map */}
      <div className="bg-[#0a0a12] rounded-[20px] border border-white/[0.03] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-[8px] flex items-center justify-center ${
              locationStatus === "valid" ? "bg-green-yellow/10" :
              locationStatus === "invalid" ? "bg-red-500/10" :
              "bg-white/5"
            }`}>
              <MapPin size={13} className={
                locationStatus === "valid" ? "text-green-yellow" :
                locationStatus === "invalid" ? "text-red-400" :
                "text-white/30"
              } />
            </div>
            <div>
              <p className="text-[12px] font-bold text-white">Lokasi</p>
              <p className="text-[9px] text-white/30">
                {locationStatus === "valid" ? `${distance}m dari Puskesmas` :
                 locationStatus === "checking" ? "Mendeteksi..." :
                 locationStatus === "error" ? "GPS tidak aktif" :
                 "Di luar radius"}
              </p>
            </div>
          </div>
          <button onClick={getLocation} disabled={refreshing}
            className="w-7 h-7 rounded-[8px] bg-electric-violet/10 text-white flex items-center justify-center hover:bg-electric-violet/20 active:scale-90 transition-all disabled:opacity-40">
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>

        {currentCoords && (
          <div className="px-3.5 pb-3">
            <LocationMap
              userLocation={{ latitude: currentCoords.latitude, longitude: currentCoords.longitude }}
              puskesmasLocation={{ latitude: puskesmasLocation.latitude, longitude: puskesmasLocation.longitude }}
              distance={distance}
              status={locationStatus}
            />
          </div>
        )}

        {!currentCoords && (
          <div className="px-3.5 pb-3">
            <div className="rounded-2xl bg-onyx border border-white/[0.04] flex flex-col items-center justify-center" style={{ height: 160 }}>
              <Loader2 size={18} className="animate-spin text-periwinkle-glow/60 mb-1.5" />
              <p className="text-[10px] text-white/30">Mendapatkan lokasi...</p>
            </div>
          </div>
        )}

        {isFakeGPS && (
          <div className="mx-3.5 mb-3 p-2.5 bg-red-500/8 rounded-xl flex items-center gap-2 border border-red-500/10">
            <ShieldAlert size={13} className="text-red-400 shrink-0" />
            <p className="text-[10px] text-red-300 font-medium">Terdeteksi Fake GPS! Absen ditolak.</p>
          </div>
        )}
      </div>

      {error && (
        <div className="p-2.5">
          <p className="text-[11px] text-red-400">{error}</p>
        </div>
      )}

      {successMsg && (
        <div className="p-2.5 rounded-2xl bg-green-yellow/8 border border-green-yellow/20 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-green-yellow shrink-0" />
          <p className="text-[11px] text-green-yellow">{successMsg}</p>
        </div>
      )}

      <AttendanceResultSheet
        open={resultSheetOpen}
        onClose={() => setResultSheetOpen(false)}
        data={resultData}
        type={resultType}
      />

      {/* Fingerprint Button — Premium */}
      {todayAttendance && todayAttendance.clock_out_time ? null : (
        <div className="flex flex-col items-center gap-2 pt-1 pb-2">
          <div className="relative">
            <div className="absolute inset-[-6px] rounded-full bg-gradient-to-br from-electric-violet/20 to-transparent blur-xl animate-pulse-slow"></div>
            <div className="absolute inset-0 rounded-full border border-white/[0.04]"></div>
            <button
              onClick={todayAttendance ? handleCheckOut : handleCheckIn}
              disabled={locationStatus !== "valid" || isFakeGPS || saving || !serverTime}
              className="relative w-16 h-16 rounded-full bg-gradient-to-br from-electric-violet/25 to-electric-violet/10 border border-electric-violet/10 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm"
            >
              {saving ? (
                <Loader2 size={22} className="animate-spin text-white/80" />
              ) : !serverTime ? (
                <Loader2 size={22} className="animate-spin text-white/50" />
              ) : (
                <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
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
          <span className="text-[10px] font-bold text-white/50 tracking-[1.5px] uppercase">
            {saving ? "Menyimpan..." : !serverTime ? "Sinkron..." : todayAttendance ? "Absen Pulang" : "Absen Sekarang"}
          </span>
        </div>
      )}
    </div>
  );
}
