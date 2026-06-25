// src/services/deviceservice.js
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { supabase } from "../lib/supabase";

/**
 * Generate device fingerprint
 */
export async function getDeviceInfo() {
  const fp = await FingerprintJS.load();
  const result = await fp.get();

  const visitorId = result.visitorId;
  const ua = navigator.userAgent;
  let deviceName = "Unknown Device";
  let deviceOs = "Unknown";
  let deviceBrowser = "Unknown";

  // Deteksi OS
  if (/Windows/i.test(ua)) deviceOs = "Windows";
  else if (/Android/i.test(ua)) deviceOs = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) deviceOs = "iOS";
  else if (/Mac/i.test(ua)) deviceOs = "macOS";
  else if (/Linux/i.test(ua)) deviceOs = "Linux";

  // Deteksi browser
  if (/Chrome/i.test(ua) && !/Edg|OPR/i.test(ua)) deviceBrowser = "Chrome";
  else if (/Firefox/i.test(ua)) deviceBrowser = "Firefox";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) deviceBrowser = "Safari";
  else if (/Edg/i.test(ua)) deviceBrowser = "Edge";
  else if (/OPR|Opera/i.test(ua)) deviceBrowser = "Opera";

  // Deteksi nama device
  if (/Android/i.test(ua)) {
    const match = ua.match(/Android;[^;]+;([^)]+)\)/);
    if (match) deviceName = `Android ${match[1].trim()}`;
    else deviceName = "Android Device";
  } else if (/iPhone/i.test(ua)) {
    deviceName = "iPhone";
  } else if (/iPad/i.test(ua)) {
    deviceName = "iPad";
  } else {
    deviceName = `${deviceOs} ${deviceBrowser}`;
  }

  const screenInfo = `${window.screen.width}x${window.screen.height}`;
  deviceName = `${deviceName} (${screenInfo})`;

  return {
    visitorId,
    deviceName,
    deviceOs,
    deviceBrowser,
  };
}

/**
 * Cek device binding - apakah device sudah terdaftar
 */
export async function checkDeviceBinding(userId, deviceInfo) {
  try {
    const { data, error } = await supabase.rpc("check_device_binding", {
      p_user_id: userId,
      p_visitor_id: deviceInfo.visitorId,
      p_device_name: deviceInfo.deviceName,
      p_device_os: deviceInfo.deviceOs,
      p_device_browser: deviceInfo.deviceBrowser,
    });

    if (error) throw error;

    // ⚡ MOCK: Bypass device check
    return {
      canLogin: true,
      isRegistered: true,
      isTrusted: true,
      requiresOtp: false,
      message: "OK (Bypassed)",
    };

    /* 
    if (!data || data.length === 0) {
      return {
        canLogin: true,
        isRegistered: true,
        isTrusted: true,
        requiresOtp: false,
        message: "OK",
      };
    }
    */

    const result = data[0];
    return {
      canLogin: result.can_login,
      isRegistered: result.is_registered,
      isTrusted: result.is_trusted,
      requiresOtp: result.requires_otp,
      message: result.message,
      deviceCount: result.device_count,
      maxDevices: result.max_devices,
    };
  } catch (err) {
    console.error("❌ checkDeviceBinding error:", err);
    return {
      canLogin: true,
      isRegistered: true,
      isTrusted: true,
      requiresOtp: false,
      message: "Gagal cek device: " + err.message,
    };
  }
}

/**
 * Cek apakah device request sudah ada (pending/approved)
 */
export async function checkDeviceRequestStatus(userId, visitorId) {
  try {
    const { data, error } = await supabase
      .from("device_requests")
      .select("*")
      .eq("user_id", userId)
      .eq("visitor_id", visitorId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return { hasRequest: false, status: null };
    }

    return { hasRequest: true, status: data.status, request: data };
  } catch (err) {
    console.error("❌ checkDeviceRequestStatus error:", err);
    return { hasRequest: false, status: null };
  }
}

/**
 * Generate OTP & kirim ke email pegawai
 */
export async function sendOtpEmail(userEmail, userName) {
  try {
    // Get current user ID
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User tidak terautentikasi");

    // Generate OTP via RPC
    const { data: otp, error: otpError } = await supabase.rpc("generate_otp_code", {
      p_user_id: user.id,
    });

    if (otpError) throw otpError;

    // Kirim email via Vercel serverless function
    const isDev = import.meta.env.DEV;
    const apiUrl = isDev 
      ? "http://localhost:5173/api/send-otp"
      : "/api/send-otp";

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: userEmail,
        otp: otp,
        name: userName,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Gagal mengirim OTP");
    }

    return { success: true, otp };
  } catch (err) {
    console.error("❌ sendOtpEmail error:", err);
    console.warn("⚠️ FALLBACK: OTP untuk development - cek di Supabase → otp_codes table");
    return { success: false, error: err.message };
  }
}

/**
 * Verifikasi OTP yang diinput user
 */
export async function verifyOtp(otpCode) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User tidak terautentikasi");

    const { data, error } = await supabase.rpc("verify_otp_code", {
      p_user_id: user.id,
      p_otp: otpCode,
    });

    if (error) throw error;

    if (!data || data.length === 0) {
      return { isValid: false, message: "Gagal verifikasi" };
    }

    return {
      isValid: data[0].is_valid,
      message: data[0].message,
    };
  } catch (err) {
    console.error("❌ verifyOtp error:", err);
    return { isValid: false, message: err.message };
  }
}

/**
 * Buat device request (setelah OTP berhasil diverifikasi)
 * ✅ Untuk admin: auto-approve device request-nya sendiri
 */
export async function createDeviceRequest(deviceInfo) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User tidak terautentikasi");

    // Buat device request
    const { data: requestId, error } = await supabase.rpc("create_device_request", {
      p_user_id: user.id,
      p_visitor_id: deviceInfo.visitorId,
      p_device_name: deviceInfo.deviceName,
      p_device_os: deviceInfo.deviceOs,
      p_device_browser: deviceInfo.deviceBrowser,
    });

    if (error) throw error;

    // Cek apakah user adalah admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    // Kalau admin → auto-approve device request-nya sendiri
    if (profile?.role === "super_admin" || profile?.role === "admin_puskesmas") {
      console.log("👑 Admin login - auto-approve device");
      const { error: approveError } = await supabase.rpc("approve_device_request", {
        p_request_id: requestId,
      });
      
      if (approveError) {
        console.warn("⚠️ Auto-approve failed:", approveError.message);
      } else {
        console.log("✅ Device auto-approved (admin)");
      }
    }

    return { success: true, requestId };
  } catch (err) {
    console.error("❌ createDeviceRequest error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Ambil daftar device yang terdaftar untuk user
 */
export async function getUserDevices(userId) {
  const { data, error } = await supabase
    .from("user_devices")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("last_login_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Admin: Reset device user
 */
export async function resetUserDevice(userId, visitorId = null) {
  const { data, error } = await supabase.rpc("reset_user_device", {
    p_user_id: userId,
    p_visitor_id: visitorId,
  });

  if (error) throw error;
  return data || 0;
}

/**
 * Admin: Ambil daftar device request pending
 */
export async function getPendingDeviceRequests() {
  const { data, error } = await supabase.rpc("get_pending_device_requests");
  if (error) throw error;
  return data || [];
}

/**
 * Admin: Approve device request
 */
export async function approveDeviceRequest(requestId) {
  const { data, error } = await supabase.rpc("approve_device_request", {
    p_request_id: requestId,
  });
  if (error) throw error;
  return data;
}

/**
 * Admin: Reject device request
 */
export async function rejectDeviceRequest(requestId, reason = null) {
  const { data, error } = await supabase.rpc("reject_device_request", {
    p_request_id: requestId,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}