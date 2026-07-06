import { Capacitor } from "@capacitor/core";

async function tryDownloadNative({ url, version, onProgress, plugin }) {
  const listener = plugin.addListener("downloadProgress", (event) => {
    onProgress?.(event.percent || 0);
  });
  try {
    const result = await plugin.downloadApk({ url, version });
    return { result, listener };
  } catch (err) {
    listener.remove();
    throw err;
  }
}

export async function downloadApk({ url, version, onProgress, fallbackUrl }) {
  if (Capacitor.isNativePlatform()) {
    try {
      const { registerPlugin } = await import("@capacitor/core");
      const plugin = registerPlugin("ApkDownloadPlugin");

      let { result, listener } = await tryDownloadNative({ url, version, onProgress, plugin });

      if (!result?.success && fallbackUrl) {
        const retry = await tryDownloadNative({ url: fallbackUrl, version, onProgress, plugin });
        result = retry.result;
        listener = retry.listener;
      }

      listener.remove();

      if (result?.success) {
        onProgress?.(100);
        return { success: true, installerOpened: result?.installerOpened ?? true, apkPath: result?.apkPath };
      }

      if (result?.permissionRequired) {
        return {
          success: false,
          error: "Aktifkan 'Izinkan instal dari sumber tidak dikenal' di pengaturan, lalu coba lagi.",
          permissionRequired: true,
        };
      }

      return {
        success: false,
        error: result?.error || "Gagal mengunduh",
      };
    } catch (err) {
      return {
        success: false,
        error: err.message || "Gagal mengunduh",
      };
    }
  }

  return downloadWithFetch(url, version, onProgress);
}

async function downloadWithFetch(url, version, onProgress) {
  try {
    const response = await fetch(url, { mode: "cors" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentLength = response.headers.get("Content-Length");
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      loaded += value.length;

      const percent = total > 0 ? Math.round((loaded * 100) / total) : 0;
      onProgress?.(Math.min(percent, 99));
    }

    const blob = new Blob(chunks, { type: "application/vnd.android.package-archive" });
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `SIAP-Puskesmas-${version || "latest"}.apk`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

    onProgress?.(100);
    return { success: true };
  } catch (err) {
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `SIAP-Puskesmas-${version || "latest"}.apk`;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      onProgress?.(100);
      return { success: true };
    }
    return { success: false, error: err.message };
  }
}
