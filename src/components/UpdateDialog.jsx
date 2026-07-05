import { useEffect, useState, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { checkUpdate } from "../services/updateService";
import { downloadApk } from "../services/apkDownloader";
import { Download, RefreshCw, Settings } from "lucide-react";

export default function UpdateDialog() {
  const [update, setUpdate] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [permissionRequired, setPermissionRequired] = useState(false);
  const pollingRef = useRef(null);

  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    checkUpdate().then(setUpdate);

    pollingRef.current = setInterval(async () => {
      const result = await checkUpdate();
      if (result) setUpdate(result);
    }, 30000);

    return () => clearInterval(pollingRef.current);
  }, []);

  useEffect(() => {
    if (update?.forceUpdate) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [update?.forceUpdate]);

  if (!update) return null;

  const isForce = update.forceUpdate === true;

  const label = done
    ? `v${update.version} siap diinstal`
    : downloading
      ? `Mengunduh v${update.version}...`
      : isNative
        ? `Update v${update.version} tersedia`
        : `Versi v${update.version} tersedia`;

  const handleUpdate = async () => {
    setDownloading(true);
    setError(null);
    setPermissionRequired(false);

    const result = await downloadApk({
      url: update.apkUrl,
      version: update.version,
      onProgress: (pct) => setProgress(pct),
    });

    if (result.success) {
      setProgress(100);
      setDone(true);
    } else {
      if (result.permissionRequired) {
        setPermissionRequired(true);
      }
      setError(result.error || "Gagal mengunduh");
      setDownloading(false);
      setProgress(0);
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const openInstallSettings = () => {
    if (Capacitor.isNativePlatform()) {
      try {
        Capacitor.getPlatform();
      } catch (_) {}
    }
    const a = document.createElement("a");
    a.href = "package:com.puskesmas.ampenan.siap";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isNative) {
    return (
      <div
        className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 ${
          isForce ? "bg-black" : "bg-black/70 backdrop-blur-sm"
        } animate-fade-in`}
        onClick={isForce ? undefined : (e) => e.target === e.currentTarget && setUpdate(null)}
        style={isForce ? { pointerEvents: "auto" } : undefined}
      >
        <div className="bg-gradient-to-br from-[#1a0533] to-[#2d0a4e] border border-violet-500/30 rounded-2xl w-full max-w-sm shadow-2xl shadow-violet-900/50 animate-fade-in">
          <div className="p-5 border-b border-white/10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg">
              <RefreshCw size={17} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Update Tersedia</h3>
              <p className="text-[10px] text-slate-400">{label}</p>
            </div>
            {!isForce && (
              <button
                onClick={() => setUpdate(null)}
                className="ml-auto text-white/40 hover:text-white/80 text-lg leading-none"
              >
                &times;
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
            <p className="text-xs text-slate-400 text-center">
              Versi baru tersedia. Refresh halaman untuk mendapatkan update.
            </p>
            <button onClick={handleRefresh}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:shadow-lg hover:shadow-violet-900/30 active:scale-[0.98]">
              <RefreshCw size={16} /> Refresh Halaman
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 ${
        isForce ? "bg-black" : "bg-black/70 backdrop-blur-sm"
      } animate-fade-in`}
      onClick={isForce ? undefined : (e) => e.target === e.currentTarget && setUpdate(null)}
      style={isForce ? { pointerEvents: "auto" } : undefined}
    >
      <div className="bg-gradient-to-br from-[#1a0533] to-[#2d0a4e] border border-violet-500/30 rounded-2xl w-full max-w-sm shadow-2xl shadow-violet-900/50 animate-fade-in">
        <div className="p-5 border-b border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg">
            <RefreshCw size={17} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              {done ? "Instalasi" : downloading ? "Mengunduh" : "Update Tersedia"}
            </h3>
            <p className="text-[10px] text-slate-400">{label}</p>
          </div>
          {!isForce && !downloading && !done && (
            <button
              onClick={() => setUpdate(null)}
              className="ml-auto text-white/40 hover:text-white/80 text-lg leading-none"
            >
              &times;
            </button>
          )}
        </div>
        <div className="p-5 space-y-4">
          {update.changelog && !downloading && !done && !error && (
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Pembaruan</p>
              <p className="text-xs text-slate-300 leading-relaxed">{update.changelog}</p>
            </div>
          )}
          {error && (
            <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-3 space-y-2">
              <p className="text-[11px] text-red-300">{error}</p>
              {permissionRequired && (
                <button onClick={openInstallSettings}
                  className="w-full py-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 bg-red-800/50 text-red-200 border border-red-500/30 hover:bg-red-800/70 active:scale-[0.98]">
                  <Settings size={13} /> Buka Pengaturan
                </button>
              )}
            </div>
          )}

          <div className="space-y-2">
            {(downloading || done) && (
              <div className="space-y-2">
                <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 text-center">{progress}%</p>
                {done && (
                  <p className="text-[11px] text-emerald-300 text-center animate-pulse">
                    Update siap diinstal. Membuka installer...
                  </p>
                )}
              </div>
            )}
            {!downloading && !done && !error && (
              <button onClick={handleUpdate}
                className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:shadow-lg hover:shadow-violet-900/30 active:scale-[0.98]">
                <Download size={16} /> Update v{update.version}
              </button>
            )}
            {!downloading && error && (
              <button onClick={handleUpdate}
                className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:shadow-lg hover:shadow-violet-900/30 active:scale-[0.98]">
                <Download size={16} /> Coba Lagi
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
