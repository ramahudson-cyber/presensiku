import { useEffect, useState } from "react";
import { checkUpdate } from "../services/updateService";
import { Capacitor } from "@capacitor/core";
import { Download, RefreshCw, X, Loader2, Zap } from "lucide-react";

export default function UpdateDialog() {
  const [update, setUpdate] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    checkUpdate().then(setUpdate);
  }, []);

  if (!update || dismissed) return null;

  const isOtaPossible = isNative && !!update.bundleUrl && !update.requiresNativeUpdate;
  const buttonLabel = isOtaPossible
    ? `Update ke v${update.version}`
    : `Download APK v${update.version}`;
  const Icon = isOtaPossible ? Zap : Download;

  const handleUpdate = async () => {
    setDownloading(true);
    setError(null);

    if (isOtaPossible) {
      try {
        const { applyOtaUpdate } = await import("../services/otaService");
        const result = await applyOtaUpdate(update.bundleUrl, update.version);
        if (!result.success) {
          setError(result.error);
          setDownloading(false);
        }
      } catch (err) {
        setError("Gagal update: " + (err.message || ""));
        setDownloading(false);
      }
    } else if (update.apkUrl) {
      try {
        const { Browser } = await import("@capacitor/browser");
        await Browser.open({ url: update.apkUrl });
      } catch {
        try {
          window.open(update.apkUrl, "_blank");
        } catch {
          setError("Gagal membuka browser. Salin link: " + update.apkUrl);
        }
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
              <h3 className="text-sm font-bold text-white">Update Tersedia</h3>
              <p className="text-[10px] text-slate-400">v{update.version}</p>
            </div>
          </div>
          {!update.forceUpdate && (
            <button onClick={() => setDismissed(true)}
              className="border-gradient bg-transparent text-white p-1.5 rounded-lg transition-all">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="p-5 space-y-4">
          {update.changelog && (
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
          <button onClick={handleUpdate} disabled={downloading}
            className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:shadow-lg hover:shadow-violet-900/30 active:scale-[0.98]">
            {downloading ? <><Loader2 size={16} className="animate-spin" /> {isOtaPossible ? "Mengupdate..." : "Membuka..."}</> : <><Icon size={16} /> {buttonLabel}</>}
          </button>
          {isOtaPossible && (
            <p className="text-[9px] text-slate-500 text-center">Update cepat tanpa download APK ulang</p>
          )}
          {!update.forceUpdate && (
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
