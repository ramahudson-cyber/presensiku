// Deteksi mock/fake location untuk APK native (Android).
// Web/PWA tidak didukung deteksi plugin — validasi lokasi di web murni
// server-side (radius + velocity + sinyal integritas).
//
// PENTING (anti-fail-open): bila APK native TAPI plugin tidak tersedia/error,
// hasilnya BUKAN "aman" melainkan supported:false + needsUpdate:true. Client
// wajib memperlakukan ini sebagai sinyal mencurigakan dan mengirimkannya ke
// server; server yang menjadi otoritas akhir (lihat assert_client_integrity).

let cachedPlugin = null;

const getPlugin = async () => {
  if (cachedPlugin) return cachedPlugin;
  const { registerPlugin } = await import("@capacitor/core");
  cachedPlugin = registerPlugin("MockLocationPlugin");
  return cachedPlugin;
};

// Ambil versionCode aplikasi (dari updateService — sudah dipakai di seluruh app).
async function getAppVersionCode() {
  try {
    const { getCurrentVersion } = await import("./updateService");
    const v = getCurrentVersion();
    return v?.versionCode ?? null;
  } catch {
    return null;
  }
}

/**
 * @returns {{ supported: boolean, isMock: boolean, needsUpdate?: boolean,
 *             mockAppDetected?: boolean, lastFixMocked?: boolean,
 *             legacyMockSetting?: boolean, emulator?: boolean, rooted?: boolean,
 *             mockApps?: string[], runtime?: string, platform?: string,
 *             appVersionCode?: number, signal?: object }}
 */
export async function detectMockLocation() {
  const { isNativePlatform, getDeviceType } = await import("../lib/devicePlatform");
  const native = isNativePlatform();
  const platform = getDeviceType();

  if (!native) {
    // Web/PWA: tidak ada deteksi client-side. Server yang memvalidasi.
    return { supported: false, isMock: false, runtime: "web", platform };
  }

  try {
    const plugin = await getPlugin();
    const res = await plugin.detect();
    const appVersionCode = await getAppVersionCode();
    const emulator = !!res.emulator;
    const rooted = !!res.rooted;
    const isMock = !!res.isMock || emulator;
    const signal = {
      mock_detected: isMock,
      mock_apps: Array.isArray(res.mockApps) ? res.mockApps.join(", ") : (res.mockApps || null),
      emulator,
      rooted,
      runtime: "native",
      platform,
      app_version_code: appVersionCode,
    };
    return {
      supported: true,
      isMock,
      needsUpdate: false,
      runtime: "native",
      platform,
      appVersionCode,
      emulator,
      rooted,
      signal,
      ...res,
    };
  } catch (err) {
    console.warn("⚠️ MockLocationPlugin tidak tersedia:", err?.message);
    // Fail-SAFE: APK native tanpa plugin = indikasi APK lama/dimodifikasi.
    // Jangan anggap aman — tandai butuh update & kirim sinyal ke server.
    return {
      supported: false,
      isMock: false,
      needsUpdate: true,
      runtime: "native",
      platform,
      signal: {
        mock_detected: false,
        runtime: "native",
        platform,
        plugin_missing: true,
      },
    };
  }
}

export function mockBlockMessage(mockCheck) {
  if (mockCheck?.emulator) {
    return "Absen tidak diizinkan dari emulator. Gunakan perangkat HP asli dengan aplikasi Presensiku.";
  }
  if (mockCheck?.mockAppDetected && Array.isArray(mockCheck.mockApps) && mockCheck.mockApps.length > 0) {
    return `Terdeteksi aplikasi lokasi palsu (${mockCheck.mockApps.join(", ")}). Matikan aplikasi tersebut lalu hubungi admin jika memang bukan milik Anda.`;
  }
  return "Terdeteksi Fake GPS! Absen ditolak.";
}
