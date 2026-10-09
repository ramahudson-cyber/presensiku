// Sinyal integritas perangkat & pencatatan event keamanan absensi.
//
// Penolakan absen di server memakai RAISE EXCEPTION yang me-rollback seluruh
// transaksi, sehingga percobaan fake GPS yang DITOLAK tidak tercatat di audit
// log biasa. Untuk itu client mencatat event ke tabel attendance_security_events
// lewat RPC tersendiri (SECURITY DEFINER) — best-effort, tidak pernah
// menggagalkan alur absen.

import { supabase } from "../lib/supabase";

/**
 * Minta verdict Play Integrity dari Edge Function (native Android saja).
 * Best-effort: bila gagal/tidak tersedia → null (server fail-closed bila
 * attendance_require_integrity=true).
 *
 * @returns {Promise<string|null>} verdict, mis. 'MEETS_DEVICE_INTEGRITY'
 */
export async function fetchIntegrityVerdict() {
  try {
    const { Capacitor, registerPlugin } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      return null;
    }
    const plugin = registerPlugin("PlayIntegrityPlugin");
    const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const res = await plugin.requestToken({ nonce });
    if (!res?.available || !res?.token) return null;

    const { data, error } = await supabase.functions.invoke("verify-integrity", {
      body: { integrity_token: res.token, nonce: res.nonce },
    });
    if (error) throw error;
    return data?.verdict || null;
  } catch (err) {
    console.warn("fetchIntegrityVerdict gagal:", err?.message);
    return null;
  }
}

/**
 * Bangun objek sinyal integritas untuk disisipkan ke payload lokasi absensi.
 * Bentuk ini dibaca server oleh parse_client_integrity().
 *
 * @param {object} mockCheck hasil detectMockLocation()
 * @param {object} extra     { integrityVerdict?, deviceVisitorId? }
 */
export function buildIntegritySignal(mockCheck, extra = {}) {
  const signal = mockCheck?.signal || {};
  return {
    mock_detected: !!(mockCheck?.isMock ?? signal.mock_detected),
    mock_apps: signal.mock_apps || null,
    emulator: !!(mockCheck?.emulator ?? signal.emulator),
    rooted: !!(mockCheck?.rooted ?? signal.rooted),
    runtime: mockCheck?.runtime || signal.runtime || "web",
    platform: mockCheck?.platform || signal.platform || null,
    app_version_code: mockCheck?.appVersionCode ?? signal.app_version_code ?? null,
    plugin_missing: !!signal.plugin_missing,
    integrity_verdict: extra.integrityVerdict || null,
    device_visitor_id: extra.deviceVisitorId || null,
  };
}

/**
 * Sisipkan sinyal integritas ke objek location sebelum dikirim ke server.
 * Server (trigger guard) yang menjadi otoritas akhir.
 */
export function attachIntegrity(location, integritySignal) {
  if (!location) return location;
  return {
    ...location,
    runtime: integritySignal?.runtime,
    platform: integritySignal?.platform,
    app_version_code: integritySignal?.app_version_code,
    device_visitor_id: integritySignal?.device_visitor_id,
    mock_detected: integritySignal?.mock_detected,
    mock_apps: integritySignal?.mock_apps,
    integrity_verdict: integritySignal?.integrity_verdict,
    client_integrity: integritySignal,
  };
}

/**
 * Catat event keamanan absensi (best-effort). Tidak pernah throw.
 */
export async function logSecurityEvent(eventType, { severity = "warning", location = null, violations = null } = {}) {
  try {
    await supabase.rpc("log_attendance_security_event", {
      p_event_type: eventType,
      p_severity: severity,
      p_loc: location,
      p_violations: violations,
    });
  } catch (err) {
    // Jangan ganggu UX absen karena logging gagal.
    console.warn("logSecurityEvent gagal:", err?.message);
  }
}
