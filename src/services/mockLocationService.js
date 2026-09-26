// Deteksi mock/fake location untuk APK native (Android).
// Web/PWA tidak didukung — validasi lokasi di web murni server-side.
// APK lama tanpa plugin native akan melaporkan supported: false (tidak memblokir).

let cachedPlugin = null;

const getPlugin = async () => {
  if (cachedPlugin) return cachedPlugin;
  const { registerPlugin } = await import("@capacitor/core");
  cachedPlugin = registerPlugin("MockLocationPlugin");
  return cachedPlugin;
};

/**
 * @returns {{ supported: boolean, isMock: boolean, mockAppDetected?: boolean,
 *             lastFixMocked?: boolean, legacyMockSetting?: boolean, mockApps?: string[] }}
 */
export async function detectMockLocation() {
  const { isNativePlatform } = await import("../lib/devicePlatform");
  if (!isNativePlatform()) {
    return { supported: false, isMock: false };
  }
  try {
    const plugin = await getPlugin();
    const res = await plugin.detect();
    return { supported: true, isMock: !!res.isMock, ...res };
  } catch (err) {
    console.warn("⚠️ MockLocationPlugin tidak tersedia:", err?.message);
    return { supported: false, isMock: false };
  }
}

export function mockBlockMessage(mockCheck) {
  if (mockCheck?.mockAppDetected && Array.isArray(mockCheck.mockApps) && mockCheck.mockApps.length > 0) {
    return `Terdeteksi aplikasi lokasi palsu (${mockCheck.mockApps.join(", ")}). Matikan aplikasi tersebut lalu hubungi admin jika memang bukan milik Anda.`;
  }
  return "Terdeteksi Fake GPS! Absen ditolak.";
}
