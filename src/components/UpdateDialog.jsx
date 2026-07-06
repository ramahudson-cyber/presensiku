import { useEffect, useState, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { checkUpdate } from "../services/updateService";
import { downloadApk } from "../services/apkDownloader";
import { Download, RefreshCw, Settings, FileDown } from "lucide-react";

export default function UpdateDialog() {
  const [update, setUpdate] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [permissionRequired, setPermissionRequired] = useState(false);
  const [installerOpened, setInstallerOpened] = useState(true);
  const pollingRef = useRef(null);
  const fallbackTimerRef = useRef(null);

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

  const handleManualInstall = () => {
    const url = update.apkUrlFallback || update.apkUrl;
    const a = document.createElement("a");
    a.href = url;
    a.download = `SIAP-Puskesmas-${update.version}.apk`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleUpdate = async () => {
    setDownloading(true);
    setError(null);
    setPermissionRequired(false);

    const result = await downloadApk({
      url: update.apkUrl,
      fallbackUrl: update.apkUrlFallback,
      version: update.version,
      onProgress: (pct) => setProgress(pct),
    });

    if (result.success) {
      setProgress(100);
      setDone(true);
      const opened = result.installerOpened !== false;
      setInstallerOpened(opened);
      if (!opened) {
        setError("Installer tidak terbuka secara otomatis. Silakan buka file APK manual.");
      }
      fallbackTimerRef.current = setTimeout(() => {
        if (!opened) {
          setError("Klik 'Buka Manual' untuk menginstall APK.");
        }
      }, 5000);
    } else {
      if (result.permissionRequired) {
        setPermissionRequired(true);
      }
      setError(result.error || "Gagal mengunduh");
      setDownloading(false);
      setProgress(0);
    }
  };

  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    };
  }, []);

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
        <div className="bg-onyx border border-electric-violet/30 rounded-3xl w-full max-w-sm shadow-2xl animate-fade-in">
          <div className="p-5 border-b border-white/[0.06] flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-electric-violet to-deep-indigo flex items-center justify-center shadow-lg">
              <RefreshCw size={17} className="text-pure-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-pure-white">Update Tersedia</h3>
              <p className="text-[10px] text-slate-mist">{label}</p>
            </div>
            {!isForce && (
              <button
                onClick={() => setUpdate(null)}
                className="ml-auto text-pure-white/40 hover:text-pure-white/80 text-lg leading-none"
              >
                &times;
              </button>
            )}
          </div>
          <div className="p-5 space-y-4">
            {update.changelog && (
              <div>
                <p className="text-[10px] font-bold text-slate-mist uppercase tracking-wider mb-1.5">Pembaruan</p>
                <p className="text-xs text-slate-mist leading-relaxed">{update.changelog}</p>
              </div>
            )}
            <p className="text-xs text-slate-mist text-center">
              Versi baru tersedia. Refresh halaman untuk mendapatkan update.
            </p>
            <button onClick={handleRefresh}
              className="w-full py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-electric-violet to-purple-600 text-pure-white hover:shadow-lg active:scale-[0.98]">
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
      <div className="bg-onyx border border-electric-violet/30 rounded-3xl w-full max-w-sm shadow-2xl animate-fade-in">
        <div className="p-5 border-b border-white/[0.06] flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-electric-violet to-deep-indigo flex items-center justify-center shadow-lg">
            <RefreshCw size={17} className="text-pure-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-pure-white">
              {done ? "Instalasi" : downloading ? "Mengunduh" : "Update Tersedia"}
            </h3>
            <p className="text-[10px] text-slate-mist">{label}</p>
          </div>
          {!isForce && !downloading && !done && (
            <button
              onClick={() => setUpdate(null)}
              className="ml-auto text-pure-white/40 hover:text-pure-white/80 text-lg leading-none"
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
            <div className="bg-red-900/30 border border-red-500/30 rounded-2xl p-3 space-y-2">
              <p className="text-[11px] text-red-300">{error}</p>
              {permissionRequired && (
                <button onClick={openInstallSettings}
                  className="w-full py-2 rounded-full text-[11px] font-semibold flex items-center justify-center gap-1.5 bg-red-800/50 text-red-200 border border-red-500/30 hover:bg-red-800/70 active:scale-[0.98]">
                  <Settings size={13} /> Buka Pengaturan
                </button>
              )}
              {done && !installerOpened && (
                <button onClick={handleManualInstall}
                  className="w-full py-2 rounded-full text-[11px] font-semibold flex items-center justify-center gap-1.5 bg-electric-violet text-pure-white hover:brightness-110 active:scale-[0.98]">
                  <FileDown size={13} /> Buka Manual APK
                </button>
              )}
            </div>
          )}

          <div className="space-y-2">
            {(downloading || done) && (
              <div className="space-y-2">
                <div className="w-full bg-white/[0.06] rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-electric-violet to-purple-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-mist text-center">{progress}%</p>
                {done && installerOpened && (
                  <p className="text-[11px] text-emerald-300 text-center animate-pulse">
                    Update siap diinstal. Membuka installer...
                  </p>
                )}
                {done && !installerOpened && (
                  <button onClick={handleManualInstall}
                    className="w-full py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-electric-violet to-purple-600 text-pure-white hover:shadow-lg active:scale-[0.98]">
                    <FileDown size={16} /> Buka Manual
                  </button>
                )}
              </div>
            )}
            {!downloading && !done && !error && (
              <button onClick={handleUpdate}
                className="w-full py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-electric-violet to-purple-600 text-pure-white hover:shadow-lg active:scale-[0.98]">
                <Download size={16} /> Update v{update.version}
              </button>
            )}
            {!downloading && error && !done && (
              <button onClick={handleUpdate}
                className="w-full py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-electric-violet to-purple-600 text-pure-white hover:shadow-lg active:scale-[0.98]">
                <Download size={16} /> Coba Lagi
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
