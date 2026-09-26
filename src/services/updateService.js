const VERSION_URL = (typeof window !== 'undefined' ? window.location.origin : 'https://presensiku-beige.vercel.app') + '/version.json';
const CURRENT_VERSION = "1.6.11";
const CURRENT_VERSION_CODE = 23;
// Channel update khusus web/PWA — terpisah dari versionCode (milik alur update APK).
// Bump field `webVersionCode` di public/version.json pada deploy web berisi perubahan UI.
const CURRENT_WEB_VERSION_CODE = 4;

export async function checkUpdate() {
  try {
    const res = await fetch(VERSION_URL, { cache: "no-cache" });
    if (!res.ok) return null;
    const data = await res.json();
    const hasUpdate = data.versionCode > CURRENT_VERSION_CODE;
    if (!hasUpdate) return null;
    return {
      version: data.version,
      versionCode: data.versionCode,
      apkUrl: data.apkUrl,
      apkUrlFallback: data.apkUrlFallback,
      bundleUrl: data.bundleUrl,
      changelog: data.changelog,
      requiresNativeUpdate: data.requiresNativeUpdate ?? true,
      forceUpdate: data.forceUpdate,
    };
  } catch {
    return null;
  }
}

// Deteksi deploy web baru. Halaman lama (bundle lama) yang masih berjalan akan
// me-reload otomatis satu kali (lihat UpdateDialog) begitu webVersionCode naik.
export async function checkWebUpdate() {
  try {
    const res = await fetch(VERSION_URL, { cache: "no-cache" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!(data.webVersionCode > CURRENT_WEB_VERSION_CODE)) return null;
    return { webVersionCode: data.webVersionCode };
  } catch {
    return null;
  }
}

export function getCurrentVersion() {
  return { version: CURRENT_VERSION, versionCode: CURRENT_VERSION_CODE };
}
