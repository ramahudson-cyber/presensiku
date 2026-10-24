// src/services/overtimeService.js
// Wrapper RPC sistem lembur. Semua tulisan lewat RPC SECURITY DEFINER —
// angka uang dihitung di server, klien tidak pernah mengirim nominal.
import { supabase } from "../lib/supabase";
import { getSetting, setSettingValue } from "../lib/settings";

// ---- Settings lembur (custom oleh admin per instansi) ----------------
export const DEFAULT_OVERTIME_CONFIG = {
  rate_per_hour: 15000,
  min_minutes: 30,
  max_hours_per_day: 4,
};

export async function getOvertimeConfig() {
  const [rate, minMin, maxHours] = await Promise.all([
    getSetting("overtime_rate_per_hour", String(DEFAULT_OVERTIME_CONFIG.rate_per_hour)),
    getSetting("overtime_min_minutes", String(DEFAULT_OVERTIME_CONFIG.min_minutes)),
    getSetting("overtime_max_hours_per_day", String(DEFAULT_OVERTIME_CONFIG.max_hours_per_day)),
  ]);
  const num = (v, d) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : d;
  };
  return {
    rate_per_hour: num(rate, DEFAULT_OVERTIME_CONFIG.rate_per_hour),
    min_minutes: num(minMin, DEFAULT_OVERTIME_CONFIG.min_minutes),
    max_hours_per_day: num(maxHours, DEFAULT_OVERTIME_CONFIG.max_hours_per_day),
  };
}

export async function saveOvertimeConfig({ rate_per_hour, min_minutes, max_hours_per_day }) {
  await setSettingValue("overtime_rate_per_hour", String(rate_per_hour), "overtime");
  await setSettingValue("overtime_min_minutes", String(min_minutes), "overtime");
  await setSettingValue("overtime_max_hours_per_day", String(max_hours_per_day), "overtime");
}

// ---- Helper: pastikan hasil RPC sukses, else throw pesan Indonesia ----
function unwrap(data) {
  if (data?.success === false) throw new Error(data.error || "Gagal memproses lembur");
  return data;
}

// ---- Pegawai ----------------------------------------------------------
export async function createOvertimeRequest({ date, start_time, end_time, reason }) {
  const { data, error } = await supabase.rpc("create_overtime_request", {
    p_date: date,
    p_start_time: start_time,
    p_end_time: end_time,
    p_reason: reason || null,
  });
  if (error) throw error;
  return unwrap(data);
}

export async function getMyOvertimeRequests() {
  const { data, error } = await supabase
    .from("overtime_requests")
    .select("*")
    .order("date", { ascending: false })
    .order("start_time", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
}

export async function cancelOvertimeRequest(requestId) {
  const { data, error } = await supabase.rpc("cancel_overtime_request", {
    p_request_id: requestId,
  });
  if (error) throw error;
  return unwrap(data);
}

// ---- Admin ------------------------------------------------------------
export async function getOvertimeRequests({ status = "", dateFrom = "", dateTo = "" } = {}) {
  let q = supabase
    .from("overtime_requests")
    .select("*, user:profiles!overtime_requests_user_id_fkey(id, full_name, username, position)")
    .order("date", { ascending: false })
    .order("start_time", { ascending: false })
    .limit(500);
  if (status) q = q.eq("status", status);
  if (dateFrom) q = q.gte("date", dateFrom);
  if (dateTo) q = q.lte("date", dateTo);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function reviewOvertimeRequest(requestId, action, { hours = null, rejectionReason = null, payMode = null, fixedAmount = null } = {}) {
  const { data, error } = await supabase.rpc("review_overtime_request", {
    p_request_id: requestId,
    p_action: action,
    p_hours: hours,
    p_rejection_reason: rejectionReason,
    p_pay_mode: payMode,
    p_fixed_amount: fixedAmount,
  });
  if (error) throw error;
  return unwrap(data);
}

// Admin membatalkan lembur yang SUDAH disetujui (hapus slot + slip draft
// bulan lembur dihitung ulang oleh RPC).
export async function adminCancelOvertime(requestId) {
  const { data, error } = await supabase.rpc("admin_cancel_overtime", {
    p_request_id: requestId,
  });
  if (error) throw error;
  return unwrap(data);
}

export async function adminCreateOvertime({ user_id, date, start_time, end_time, reason, pay_mode = "hourly", fixed_amount = null }) {
  const { data, error } = await supabase.rpc("admin_create_overtime", {
    p_user_id: user_id,
    p_date: date,
    p_start_time: start_time,
    p_end_time: end_time,
    p_reason: reason || null,
    p_pay_mode: pay_mode,
    p_fixed_amount: fixed_amount,
  });
  if (error) throw error;
  return unwrap(data);
}

// Jam selesai lembur APPROVED untuk user+tanggal (dipakai aturan batas absen
// pulang). Dua kelompok slot dikembalikan terpisah supaya pemanggil bisa
// menghitung waktu selesai efektif dengan benar:
//   plain = "HH:MM" terakhir slot sehari (end > start)
//   cross = "HH:MM" terakhir slot lintas tengah malam (end <= start → besok)
// Beberapa slot lembur per hari dimungkinkan (unique index user+date+start_time).
export async function getApprovedOvertimeSlots(userId, date) {
  if (!userId || !date) return null;
  const { data, error } = await supabase
    .from("overtime_requests")
    .select("start_time, end_time")
    .eq("user_id", userId)
    .eq("date", date)
    .eq("status", "approved");
  if (error) throw error;
  const valid = (data || [])
    .map((r) => ({ start: r.start_time || "", end: r.end_time || "" }))
    .filter((s) => /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(s.end) && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(s.start));
  if (valid.length === 0) return null;
  const maxOf = (arr) => arr.sort().pop() || null;
  return {
    plain: maxOf(valid.filter((s) => s.end > s.start).map((s) => s.end)),
    cross: maxOf(valid.filter((s) => s.end <= s.start).map((s) => s.end)),
  };
}

// Rekap uang lembur disetujui per pegawai untuk periode "YYYY-MM".
// Dipakai PayrollPage — read-only, tidak mengubah slip yang ada.
export async function getApprovedOvertimeTotals(period) {
  const from = `${period}-01`;
  const to = new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0)
    .toISOString()
    .slice(0, 10);
  const { data, error } = await supabase
    .from("overtime_requests")
    .select("user_id, approved_hours, pay_amount")
    .eq("status", "approved")
    .gte("date", from)
    .lte("date", to);
  if (error) throw error;
  const byUser = new Map();
  for (const r of data || []) {
    const prev = byUser.get(r.user_id) || { overtime_hours: 0, overtime_amount: 0 };
    prev.overtime_hours += Number(r.approved_hours || 0);
    prev.overtime_amount += Number(r.pay_amount || 0);
    byUser.set(r.user_id, prev);
  }
  return byUser;
}

// Overtime APPROVED per user+tanggal dalam rentang bebas (untuk export riwayat
// absensi). Multi-slot per hari dijumlahkan (unique index user+date+start_time).
// Return: Map<`${user_id}|${date}`, { hours, amount }>
export async function getApprovedOvertimeByDateRange(dateFrom, dateTo) {
  const { data, error } = await supabase
    .from("overtime_requests")
    .select("user_id, date, approved_hours, pay_amount")
    .eq("status", "approved")
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .range(0, 1999);
  if (error) throw error;
  const map = new Map();
  (data || []).forEach((r) => {
    const key = `${r.user_id}|${r.date}`;
    const cur = map.get(key) || { hours: 0, amount: 0 };
    cur.hours += Number(r.approved_hours || 0);
    cur.amount += Number(r.pay_amount || 0);
    map.set(key, cur);
  });
  return map;
}
