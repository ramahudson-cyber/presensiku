import { useEffect, useState, useRef } from "react";
import { checkUpdate } from "../services/updateService";
import { Capacitor } from "@capacitor/core";
import { Download, RefreshCw, X, Loader2 } from "lucide-react";

export default function UpdateDialog() {
  const [update, setUpdate] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const isNative = Capacitor.isNativePlatform();
  const listenerRef = useRef(null);

  useEffect(() => {
    checkUpdate().then(setUpdate);
  }, []);

  useEffect(() => {
    return () => {
      if (listenerRef.current) {
        listenerRef.current.remove();
        listenerRef.current = null;
      }
    };
  }, []);

  if (!update || dismissed) return null;

  const handleUpdate = async () => {
    setDownloading(true);
    setError(null);

    if (isNative && update.apkUrl) {
      try {
        const { registerPlugin } = await import("@capacitor/core");
        const plugin = registerPlugin("ApkDownloadPlugin");
        listenerRef.current = plugin.addListener("downloadProgress", (event) => {
          setProgress(event.percent || 0);
        });
        const result = await plugin.downloadApk({ url: update.apkUrl, version: update.version });
        if (!result || !result.success) {
          setError(result?.error || "Gagal download");
        }
      } catch (err) {
        setError("Gagal download: " + (err.message || ""));
      }
      setDownloading(false);
    } else if (update.apkUrl) {
      try {
        window.open(update.apkUrl, "_blank");
      } catch {
        setError("Gagal membuka browser. Salin link: " + update.apkUrl);
      }
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-gradient-to-br from-[#1a0533] to-[#2d0a4e] border border-violet-500/30 rounded-2xl w-full max-w-sm shadow-2xl shadow-violet-900/50 animate-fade-in">
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg">
              <RefreshCw size={17} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {downloading ? "Mengunduh..." : "Update Tersedia"}
              </h3>
              <p className="text-[10px] text-slate-400">v{update.version}</p>
            </div>
          </div>
          {!update.forceUpdate && !downloading && (
            <button onClick={() => setDismissed(true)}
              className="border-gradient bg-transparent text-white p-1.5 rounded-lg transition-all">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="p-5 space-y-4">
          {update.changelog && !downloading && (
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Pembaruan</p>
              <p className="text-xs text-slate-300 leading-relaxed">{update.changelog}</p>
            </div>
          )}
          {error && (
            <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-3">
              <p className="text-[11px] text-red-300 break-all">{error}</p>
            </div>
          )}

          {downloading ? (
            <div className="space-y-2">
              <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 text-center">{progress}%</p>
              {progress >= 100 && (
                <p className="text-[11px] text-emerald-300 text-center animate-pulse">
                  Download selesai. Membuka installer...
                </p>
              )}
            </div>
          ) : (
            <button onClick={handleUpdate}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:shadow-lg hover:shadow-violet-900/30 active:scale-[0.98]">
              <Download size={16} /> Download APK v{update.version}
            </button>
          )}

          {!update.forceUpdate && !downloading && (
            <button onClick={() => setDismissed(true)}
              className="w-full py-2 text-xs text-slate-400 hover:text-white transition">
              Nanti Saja
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
