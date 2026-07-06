const VERSION_URL = "https://siap-ampenan.vercel.app/version.json";
const CURRENT_VERSION = "1.6.6";
const CURRENT_VERSION_CODE = 18;

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

export function getCurrentVersion() {
  return { version: CURRENT_VERSION, versionCode: CURRENT_VERSION_CODE };
}
