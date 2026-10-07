import { supabase } from "../lib/supabase";
import { getSetting, setSettingValue } from "../lib/settings";

// ---- Modul on/off per instansi --------------------------------------
export async function isPayrollEnabled() {
  return (await getSetting("payroll_enabled", "false")) === "true";
}

export async function setPayrollEnabled(enabled) {
  return setSettingValue("payroll_enabled", enabled ? "true" : "false", "payroll");
}

// ---- Aturan potongan (nominal oleh admin) ---------------------------
export const DEFAULT_PAYROLL_CONFIG = {
  late_tiers: [
    { min: 1, max: 15, nominal: 5000 },
    { min: 16, max: 30, nominal: 10000 },
    { min: 31, max: 60, nominal: 25000 },
    { min: 61, max: null, nominal: 50000 },
  ],
  alpha_nominal_per_day: 100000,
  no_checkout_nominal: 0,
  early_leave_nominal: 0,
};

export async function getPayrollConfig() {
  const raw = await getSetting("payroll_config", null);
  if (!raw) return structuredClone(DEFAULT_PAYROLL_CONFIG);
  try {
    const parsed = typeof raw === "object" ? raw : JSON.parse(raw);
    return { ...structuredClone(DEFAULT_PAYROLL_CONFIG), ...parsed };
  } catch {
    return structuredClone(DEFAULT_PAYROLL_CONFIG);
  }
}

export async function savePayrollConfig(config) {
  return setSettingValue("payroll_config", JSON.stringify(config), "payroll");
}

// ---- Config gaji per pegawai ----------------------------------------
export async function getEmployeeConfigs() {
  const { data, error } = await supabase
    .from("payroll_employee_config")
    .select("*, user:profiles!payroll_config_user_fk(id, full_name, username, employee_status)")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

// organization_id diambil dari pemanggil (user.active_org_override ?? user.organization_id)
export async function saveEmployeeConfigs(organizationId, rows) {
  const payload = rows.map((r) => ({
    organization_id: organizationId,
    user_id: r.user_id,
    base_component: r.base_component,
    is_active: r.is_active ?? true,
  }));
  const { error } = await supabase
    .from("payroll_employee_config")
    .upsert(payload, { onConflict: "organization_id,user_id" });
  if (error) throw error;
}

// ---- Rekap -----------------------------------------------------------
export async function recalculatePayroll(period) {
  const { data, error } = await supabase.rpc("recalculate_payroll", {
    p_period: period,
  });
  if (error) throw error;
  if (data?.success === false) throw new Error(data.error);
  return data;
}

export async function getPayrollLines(period) {
  let q = supabase
    .from("payroll_lines")
    .select("*, user:profiles!payroll_lines_user_fk(id, full_name, username, employee_status)")
    .order("total_received", { ascending: false });
  if (period) q = q.eq("period_month", period);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function getMyPayrollLines(userId) {
  // Hanya slip milik pegawai yang login — tanpa ini, RLS organisasi
  // membuka slip pegawai lain (termasuk admin) ke daftar pegawai.
  const { data, error } = await supabase
    .from("payroll_lines")
    .select("*")
    .eq("user_id", userId)
    .order("period_month", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Pegawai memicu perhitungan slip untuk periode tertentu (idempoten:
// baris yang sudah ada tidak ditimpa). Menjalankan RPC self-service
// ensure_my_payroll_line — see migrations/20260927120000.
export async function ensureMyPayrollLine(period) {
  const { data, error } = await supabase.rpc("ensure_my_payroll_line", { p_period: period });
  if (error) throw error;
  return data;
}
