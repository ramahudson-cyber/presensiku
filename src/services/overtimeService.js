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

export async function reviewOvertimeRequest(requestId, action, { hours = null, rejectionReason = null } = {}) {
  const { data, error } = await supabase.rpc("review_overtime_request", {
    p_request_id: requestId,
    p_action: action,
    p_hours: hours,
    p_rejection_reason: rejectionReason,
  });
  if (error) throw error;
  return unwrap(data);
}

export async function adminCreateOvertime({ user_id, date, start_time, end_time, reason }) {
  const { data, error } = await supabase.rpc("admin_create_overtime", {
    p_user_id: user_id,
    p_date: date,
    p_start_time: start_time,
    p_end_time: end_time,
    p_reason: reason || null,
  });
  if (error) throw error;
  return unwrap(data);
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
