import { Capacitor } from "@capacitor/core";

export async function downloadApk({ url, version, onProgress }) {
  if (Capacitor.isNativePlatform()) {
    try {
      const { registerPlugin } = await import("@capacitor/core");
      const plugin = registerPlugin("ApkDownloadPlugin");

      const listener = plugin.addListener("downloadProgress", (event) => {
        onProgress?.(event.percent || 0);
      });

      const result = await plugin.downloadApk({ url, version });

      listener.remove();

      if (result?.success) {
        onProgress?.(100);
        return { success: true };
      }

      console.warn("Native download gagal, fallback ke web:", result?.error);
    } catch (err) {
      console.warn("Native download error, fallback ke web:", err.message);
    }
  }

  return downloadWithFetch(url, version, onProgress);
}

async function downloadWithFetch(url, version, onProgress) {
  try {
    const response = await fetch(url);

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
    return { success: false, error: err.message };
  }
}
