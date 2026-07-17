// src/services/attendanceservice.js
import { supabase } from "../lib/supabase";

// ✅ Fallback default (dipakai kalau gagal fetch dari DB)
const DEFAULT_PUSKESMAS_LOCATION = {
  latitude: -8.5697,
  longitude: 116.0821,
  name: "Puskesmas Ampenan",
};
const DEFAULT_RADIUS_METER = 200;

/**
 * Ambil lokasi puskesmas aktif dari database
 * @returns {Promise<{latitude, longitude, name, radius_meter}>}
 */
export async function getPuskesmasLocation() {
  try {
    const { data, error } = await supabase.rpc('get_active_location');

    if (error) throw error;

    if (data && data.length > 0) {
      const loc = data[0];
      return {
        latitude: parseFloat(loc.latitude),
        longitude: parseFloat(loc.longitude),
        name: loc.name,
        radius_meter: loc.radius_meter,
      };
    }

    return { ...DEFAULT_PUSKESMAS_LOCATION, radius_meter: DEFAULT_RADIUS_METER };
  } catch (err) {
    console.error("❌ Gagal fetch lokasi dari DB, pakai default:", err.message);
    return { ...DEFAULT_PUSKESMAS_LOCATION, radius_meter: DEFAULT_RADIUS_METER };
  }
}

/**
 * Ambil radius meter
 */
export async function getRadiusMeter() {
  const loc = await getPuskesmasLocation();
  return loc.radius_meter;
}

/**
 * Hitung jarak dalam meter (Haversine formula)
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Cek apakah user dalam radius puskesmas
 * + ANTI FAKE GPS DETECTION
 */
export async function isWithinRadius(userLat, userLon, accuracy, altitude) {
  const puskesmas = await getPuskesmasLocation();
  const distance = calculateDistance(
    userLat, userLon,
    puskesmas.latitude,
    puskesmas.longitude
  );
  
  // === ANTI FAKE GPS HEURISTIK ===
  // 1. Akurasi terlalu sempurna (< 5 meter) = curiga Fake GPS
  // 2. Altitude null/0 = curiga Fake GPS (GPS asli biasanya punya ketinggian)
  const isSuspiciousAccuracy = accuracy && accuracy < 5;
  const isSuspiciousAltitude = altitude === null || altitude === 0 || altitude === undefined;
  const isFakeGPS = isSuspiciousAccuracy || isSuspiciousAltitude;
  
  return {
    withinRadius: distance <= puskesmas.radius_meter,
    distance: Math.round(distance),
    puskesmasName: puskesmas.name,
    radius: puskesmas.radius_meter,
    isFakeGPS: isFakeGPS,
    accuracy: accuracy,
    altitude: altitude,
  };
}

/**
 * Ambil absensi hari ini
 */
export async function getTodayAttendance(userId) {
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Clock In — otomatis hitung terlambat dari shift schedule
 */
export async function clockIn(userId, location) {
  // Ambil server time WITA
  const { data: serverNow, error: timeErr } = await supabase.rpc("get_server_time");
  if (timeErr) throw timeErr;
  const now = new Date(serverNow);
  const witaMs = now.getTime() + (8 * 60 * 60 * 1000);
  const witaDate = new Date(witaMs);
  const today = witaDate.toISOString().split("T")[0];

  // Ambil jadwal shift hari ini
  let isLate = false;
  let lateMinutes = 0;
  let attendanceStatus = "hadir";
  let shiftCode = null;

  const { data: schedule } = await supabase
    .from("employee_schedules")
    .select("shift_code")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();

  if (schedule?.shift_code) {
    shiftCode = schedule.shift_code;
    const dayOfWeek = (witaDate.getUTCDay() + 6) % 7; // Senin=0

    const { data: shiftSched } = await supabase
      .from("shift_schedules")
      .select("start_time, latest_check_in, is_working_day")
      .eq("shift_code", shiftCode)
      .eq("day_of_week", dayOfWeek)
      .single();

    if (shiftSched?.is_working_day && shiftSched?.start_time) {
      const witaHour = witaDate.getUTCHours();
      const witaMinute = witaDate.getUTCMinutes();
      const totalWitaMinutes = witaHour * 60 + witaMinute;

      const [lh, lm] = (shiftSched.latest_check_in || shiftSched.start_time).split(":").map(Number);
      const lateThreshold = lh * 60 + lm;

      isLate = totalWitaMinutes > lateThreshold;
      lateMinutes = isLate ? totalWitaMinutes - (shiftSched.start_time.split(":").map(Number)[0] * 60 + shiftSched.start_time.split(":").map(Number)[1]) : 0;
      attendanceStatus = isLate ? "terlambat" : "hadir";
    }
  }

  const { data, error } = await supabase
    .from("attendance")
    .insert({
      user_id: userId,
      date: today,
      clock_in_time: now.toISOString(),
      location_in: location,
      selfie_in_url: null,
      attendance_status: attendanceStatus,
      shift_code: shiftCode,
      is_late: isLate,
      late_minutes: lateMinutes,
      schedule_match: !!schedule,
    })
    .select()
    .single();

  if (error) throw error;

  await supabase.rpc('log_audit', {
    p_action: 'CLOCK_IN',
    p_description: `Clock in berhasil`,
    p_entity_type: 'attendance',
    p_entity_id: data.id,
    p_metadata: { location, server_time: data.clock_in_time, is_late: isLate, late_minutes: lateMinutes }
  }).catch(() => {});

  return data;
}

/**
 * Clock Out
 */
export async function clockOut(userId, location) {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("attendance")
    .update({
      location_out: location,
      selfie_out_url: null,
    })
    .eq("user_id", userId)
    .eq("date", today)
    .select()
    .single();

  if (error) throw error;

  await supabase.rpc('log_audit', {
    p_action: 'CLOCK_OUT',
    p_description: `Clock out berhasil`,
    p_entity_type: 'attendance',
    p_entity_id: data.id,
    p_metadata: { location, server_time: data.clock_out_time }
  }).catch(() => {});

  return data;
}

/**
 * Riwayat absensi
 */
export async function getAttendanceHistory(userId, limit = 30) {
  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/**
 * Validasi lokasi di SERVER via RPC
 * Klien KIRIM koordinat → Server VALIDASI radius → Kembalikan hasil
 * Tidak bisa diakali dengan manipulasi client-side
 */
export async function verifyLocationServer(latitude, longitude, accuracy) {
  try {
    const { data, error } = await supabase.rpc('verify_attendance_location', {
      p_latitude: latitude,
      p_longitude: longitude,
      p_accuracy: accuracy,
    });
    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Server location verification failed:", err);
    return null;
  }
}

// ✅ Export untuk kompatibilitas
export const PUSKESMAS_LOCATION = DEFAULT_PUSKESMAS_LOCATION;
export const RADIUS_METER = DEFAULT_RADIUS_METER;