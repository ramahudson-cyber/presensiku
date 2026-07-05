// src/services/deviceservice.js
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { supabase } from "../lib/supabase";
import { isNativePlatform, isAndroidCapacitor } from "../lib/devicePlatform";

/**
 * Generate device info (platform-aware)
 * - Android (Capacitor) → prioritaskan IMEI, fallback Android ID
 * - iOS (Capacitor) → Device.getId()
 * - Web → FingerprintJS
 */
export async function getDeviceInfo() {
  let visitorId, deviceName = "Unknown Device", deviceOs = "Unknown", deviceBrowser = "Unknown", deviceType = "web";
  let imei = null, serial = null;

  if (isNativePlatform()) {
    try {
      const { Device } = await import('@capacitor/device');
      const infoResult = await Device.getInfo();
      deviceOs = infoResult.operatingSystem;
      deviceName = infoResult.model || infoResult.manufacturer || "Unknown Device";
      deviceBrowser = infoResult.platform || "Native";

      if (isAndroidCapacitor()) {
        deviceType = "android";

        // 🔥 Prioritaskan IMEI (permanen per hardware)
        // Plugin akan otomatis request permission jika belum granted
        try {
          const { registerPlugin } = await import('@capacitor/core');
          const ImeiPlugin = registerPlugin('ImeiPlugin');
          const imeiResult = await ImeiPlugin.getImeiInfo();
          
          if (imeiResult.permissionDenied) {
            // User menolak permission - fallback ke Android ID
            console.log("⚠️ IMEI permission denied by user, using Android ID fallback");
          } else if (imeiResult.imei) {
            // Permission granted & IMEI berhasil diambil
            visitorId = imeiResult.imei;
            imei = imeiResult.imei;
            serial = imeiResult.serial;
            console.log("✅ IMEI berhasil diambil:", imei);
          } else if (imeiResult.hasPermission && !imeiResult.imei) {
            // Permission granted tapi IMEI null (device tanpa SIM/IMEI)
            console.log("⚠️ Permission granted tapi IMEI tidak tersedia");
          }
        } catch (err) {
          console.warn("⚠️ IMEI plugin error:", err.message);
        }

        // Fallback ke Android ID jika IMEI tidak tersedia
        if (!visitorId) {
          try {
            const idResult = await Device.getId();
            visitorId = idResult.identifier || idResult.uuid;
            console.log("📱 Menggunakan Android ID fallback:", visitorId);
          } catch (err2) {
            console.warn("⚠️ Device.getId error:", err2.message);
          }
        }
      } else {
        deviceType = "ios";
        try {
          const idResult = await Device.getId();
          visitorId = idResult.identifier || idResult.uuid;
        } catch (err2) {
          console.warn("⚠️ iOS Device.getId error:", err2.message);
        }
      }
    } catch (err) {
      console.error("❌ Capacitor Device error:", err);
    }
  } else {
    try {
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      visitorId = result.visitorId;
      deviceType = "web";
    } catch (err) {
      console.warn("⚠️ FingerprintJS error:", err.message);
    }
  }

  // FINAL FALLBACK: visitorId WAJIB ada
  if (!visitorId) {
    visitorId = "device-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    console.warn("⚠️ Final fallback visitorId:", visitorId);
  }

  // Deteksi OS & browser dari User-Agent (fallback + untuk semua platform)
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) deviceOs = deviceOs === "Unknown" ? "Windows" : deviceOs;
  else if (/Android/i.test(ua)) deviceOs = deviceOs === "Unknown" ? "Android" : deviceOs;
  else if (/iPhone|iPad|iPod/i.test(ua)) deviceOs = deviceOs === "Unknown" ? "iOS" : deviceOs;
  else if (/Mac/i.test(ua)) deviceOs = deviceOs === "Unknown" ? "macOS" : deviceOs;
  else if (/Linux/i.test(ua)) deviceOs = deviceOs === "Unknown" ? "Linux" : deviceOs;

  if (/Chrome/i.test(ua) && !/Edg|OPR/i.test(ua)) deviceBrowser = deviceBrowser === "Unknown" ? "Chrome" : deviceBrowser;
  else if (/Firefox/i.test(ua)) deviceBrowser = deviceBrowser === "Unknown" ? "Firefox" : deviceBrowser;
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) deviceBrowser = deviceBrowser === "Unknown" ? "Safari" : deviceBrowser;
  else if (/Edg/i.test(ua)) deviceBrowser = deviceBrowser === "Unknown" ? "Edge" : deviceBrowser;
  else if (/OPR|Opera/i.test(ua)) deviceBrowser = deviceBrowser === "Unknown" ? "Opera" : deviceBrowser;

  if (/Android/i.test(ua)) {
    const match = ua.match(/Android;[^;]+;([^)]+)\)/);
    if (match) deviceName = `Android ${match[1].trim()}`;
    else if (deviceName === "Unknown Device") deviceName = "Android Device";
  } else if (/iPhone/i.test(ua)) {
    deviceName = "iPhone";
  } else if (/iPad/i.test(ua)) {
    deviceName = "iPad";
  } else if (deviceName === "Unknown Device") {
    deviceName = `${deviceOs} ${deviceBrowser}`;
  }

  const screenInfo = `${window.screen.width}x${window.screen.height}`;
  deviceName = `${deviceName} (${screenInfo})`;

  return {
    visitorId,
    deviceName,
    deviceOs,
    deviceBrowser,
    deviceType,
    imei,
    serial,
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
      p_device_type: deviceInfo.deviceType,
      p_imei: deviceInfo.imei || null,
      p_serial: deviceInfo.serial || null,
    });

    if (error) throw error;

    if (!data) {
      return {
        canLogin: true,
        isRegistered: true,
        isTrusted: true,
        requiresOtp: false,
        message: "OK",
      };
    }

    const result = data;
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
      p_device_type: deviceInfo.deviceType,
      p_imei: deviceInfo.imei || null,
      p_serial: deviceInfo.serial || null,
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
    .eq("user", userId)
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