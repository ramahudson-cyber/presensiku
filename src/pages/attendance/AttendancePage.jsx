import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import {
  MapPin, Clock, CheckCircle2,
  RefreshCw, Loader2, ShieldAlert, ShieldCheck, LogOut
} from "lucide-react";
import LocationMap from "../../components/LocationMap";
import { getCurrentPosition } from "../../services/geoService";

const PUSKESMAS_LOCATION = { latitude: -8.5699, longitude: 116.0770 };
const RADIUS_METER = 999999;

const SHIFT_NAMES = { PG: "Pagi", SR: "Sore", SI: "Siang", ML: "Malam" };

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
    const t = setInterval(syncServerTime, 5 * 60 * 1000);
    getLocation();
    fetchTodayAttendance();
    fetchTodaySchedule();
    getDeviceVisitorId();
    return () => clearInterval(t);
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
    try {
      const loc = await getCurrentPosition();
      setCurrentCoords(loc);
      const isFake = (loc.accuracy < 3) && (loc.altitude === null || loc.altitude === 0);
      if (isFake) { setIsFakeGPS(true); setLocationStatus("invalid"); return; }
      const dist = calculateDistance(loc.latitude, loc.longitude, PUSKESMAS_LOCATION.latitude, PUSKESMAS_LOCATION.longitude);
      setDistance(Math.round(dist));
      setLocationStatus(dist <= RADIUS_METER ? "valid" : "invalid");
    } catch {
      setLocationStatus("error");
    }
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

  const handleCheckIn = async () => {
    setError("");
    setSuccessMsg("");
    setSaving(true);
    try {
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
        location_in: currentCoords ? {
          latitude: currentCoords.latitude,
          longitude: currentCoords.longitude,
          accuracy: currentCoords.accuracy,
          altitude: currentCoords.altitude,
          distance_from_puskesmas: distance,
        } : null,
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

      const { error } = await supabase
        .from("attendance")
        .upsert(payload, { onConflict: "user_id,date" })
        .select()
        .single();

      if (error) throw error;

      setSuccessMsg("Absensi berhasil!");
      await fetchTodayAttendance();
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
      const deviceName = getDeviceInfoLite();

      const { data: serverNow, error: timeErr } = await supabase.rpc("get_server_time");
      if (timeErr) throw timeErr;
      const now = new Date(serverNow);

      const { error } = await supabase
        .from("attendance")
        .update({
          clock_out_time: now.toISOString(),
          location_out: currentCoords ? {
            latitude: currentCoords.latitude,
            longitude: currentCoords.longitude,
            accuracy: currentCoords.accuracy,
            altitude: currentCoords.altitude,
            distance_from_puskesmas: distance,
          } : null,
          selfie_out_url: null,
          device_visitor_id: deviceVisitorId,
          device_name: deviceName,
        })
        .eq("id", todayAttendance.id);

      if (error) throw error;

      setSuccessMsg("Absen pulang berhasil!");
      await fetchTodayAttendance();
    } catch (err) {
      setError("Gagal absen pulang: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const timeStr = displayTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = displayTime.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="relative bg-onyx rounded-2xl p-5 text-pure-white shadow-lg border border-white/[0.06] overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-electric-violet/5 rounded-full -mr-16 -mt-16"></div>
        <div className="relative">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-mist uppercase tracking-wider">{dateStr}</p>
            {serverTime && (
              <div className="flex items-center gap-1 text-[9px] bg-electric-violet/10 text-periwinkle-glow px-2 py-1 rounded-full">
                <ShieldCheck size={10} /> <span>Server Time</span>
              </div>
            )}
          </div>
          <p className="text-2xl font-bold mt-1 font-mono tabular-nums">{timeStr}</p>
          {!serverTime && (
            <p className="text-[10px] text-amber-200 mt-1 flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" /> Sinkron server...
            </p>
          )}
        </div>
      </div>

      <div className="design-card p-4">
        {todayAttendance ? (
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${todayAttendance.clock_out_time ? "bg-electric-violet/20" : "bg-emerald-500/20"}`}>
              {todayAttendance.clock_out_time ? <CheckCircle2 size={18} className="text-periwinkle-glow" /> : <CheckCircle2 size={18} className="text-emerald-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-pure-white">
                {todayAttendance.clock_out_time ? "Sudah Absen (Selesai)" : "Sudah Absen Masuk"}{" "}
                {todayAttendance.is_late && <span className="text-amber-400 text-[10px]">(Terlambat {todayAttendance.late_minutes}m)</span>}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-slate-mist">Masuk</span>
                  <span className="text-[11px] text-slate-mist">
                    {new Date(todayAttendance.clock_in_time).toLocaleTimeString("id-ID", {hour:"2-digit",minute:"2-digit"})}
                  </span>
                </div>
                {todayAttendance.clock_out_time && (
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-slate-mist">Pulang</span>
                    <span className="text-[11px] text-periwinkle-glow">
                      {new Date(todayAttendance.clock_out_time).toLocaleTimeString("id-ID", {hour:"2-digit",minute:"2-digit"})}
                    </span>
                  </div>
                )}
                {todayAttendance.shift_code && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold
                    ${todayAttendance.shift_code === "PG" ? "bg-amber-500/15 text-amber-300" : ""}
                    ${todayAttendance.shift_code === "SR" ? "bg-orange-500/15 text-orange-300" : ""}
                    ${todayAttendance.shift_code === "SI" ? "bg-sky-500/15 text-sky-300" : ""}
                    ${todayAttendance.shift_code === "ML" ? "bg-violet-500/15 text-violet-300" : ""}
                  `}>
                    {SHIFT_NAMES[todayAttendance.shift_code] || todayAttendance.shift_code}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-electric-violet/20 flex items-center justify-center">
              <Clock size={18} className="text-periwinkle-glow" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-pure-white">Belum absen hari ini</p>
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
                  <span className="text-[10px] text-slate-mist">Jadwal hari ini</span>
                </div>
              ) : (
                <p className="text-[10px] text-amber-300/70 mt-1">Tidak ada jadwal shift hari ini</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="design-card overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-2xl flex items-center justify-center ${
              locationStatus === "valid" ? "bg-emerald-500/20" :
              locationStatus === "invalid" ? "bg-red-500/20" :
              "bg-slate-500/20"
            }`}>
              <MapPin size={15} className={
                locationStatus === "valid" ? "text-emerald-400" :
                locationStatus === "invalid" ? "text-red-400" :
                "text-slate-mist"
              } />
            </div>
            <div>
              <p className="text-sm font-semibold text-pure-white">Lokasi</p>
              <p className="text-[10px] text-slate-mist">
                {locationStatus === "valid" ? `${distance}m dari Puskesmas` :
                 locationStatus === "checking" ? "Mendeteksi..." :
                 locationStatus === "error" ? "GPS tidak aktif" :
                 "Di luar radius"}
              </p>
            </div>
          </div>
          <button onClick={getLocation}
            className="w-8 h-8 rounded-2xl border-gradient bg-transparent hover:bg-white/10 text-pure-white flex items-center justify-center transition active:scale-90">
            <RefreshCw size={14} className={locationStatus === "checking" ? "animate-spin" : ""} />
          </button>
        </div>

        {currentCoords && (
          <div className="px-4 pb-4">
            <LocationMap
              userLocation={{ latitude: currentCoords.latitude, longitude: currentCoords.longitude }}
              puskesmasLocation={PUSKESMAS_LOCATION}
              distance={distance}
              status={locationStatus}
            />
          </div>
        )}

        {!currentCoords && (
          <div className="px-4 pb-4">
            <div className="rounded-2xl bg-onyx border border-white/[0.06] flex flex-col items-center justify-center" style={{ height: 200 }}>
              <Loader2 size={24} className="animate-spin text-periwinkle-glow mb-2" />
              <p className="text-xs text-slate-mist">Mendapatkan lokasi...</p>
            </div>
          </div>
        )}

        {isFakeGPS && (
          <div className="mx-4 mb-4 p-3 bg-red-500/10 rounded-xl flex items-center gap-2.5 border border-red-500/20">
            <ShieldAlert size={16} className="text-red-400 shrink-0" />
            <p className="text-xs text-red-300 font-medium">Terdeteksi Fake GPS! Absen ditolak.</p>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30">
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <p className="text-xs text-emerald-300">{successMsg}</p>
        </div>
      )}

      {todayAttendance && todayAttendance.clock_out_time ? null : (
        <button
          onClick={todayAttendance ? handleCheckOut : handleCheckIn}
          disabled={locationStatus !== "valid" || isFakeGPS || saving || !serverTime}
          className="w-full py-4 border-gradient bg-transparent rounded-full font-semibold transition disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg"
        >
          {saving ? (
            <><Loader2 size={20} className="animate-spin" /> Menyimpan...</>
          ) : !serverTime ? (
            <><Loader2 size={20} className="animate-spin" /> Sinkron server...</>
          ) : todayAttendance ? (
            <><LogOut size={20} /> Absen Pulang</>
          ) : (
            <><Clock size={20} /> Absen Sekarang</>
          )}
        </button>
      )}
    </div>
  );
}
