import { useEffect, useState } from "react";
import { checkUpdate } from "../services/updateService";
import { downloadApk } from "../services/apkDownloader";
import { Download, RefreshCw } from "lucide-react";

export default function UpdateDialog() {
  const [update, setUpdate] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkUpdate().then(setUpdate);
  }, []);

  if (!update) return null;

  const label = done
    ? `v${update.version} siap diinstal...`
    : downloading
      ? `Mengunduh v${update.version}...`
      : `Download APK v${update.version}`;

  const handleUpdate = async () => {
    setDownloading(true);
    setError(null);

    const result = await downloadApk({
      url: update.apkUrl,
      version: update.version,
      onProgress: (pct) => setProgress(pct),
    });

    if (result.success) {
      setProgress(100);
      setDone(true);
    } else {
      setError(result.error || "Gagal download");
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
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
        </div>
        <div className="p-5 space-y-4">
          {update.changelog && !downloading && !done && (
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
                    Download selesai. Membuka installer...
                  </p>
                )}
              </div>
            )}
            {!downloading && !done && (
              <button onClick={handleUpdate}
                className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:shadow-lg hover:shadow-violet-900/30 active:scale-[0.98]">
                <Download size={16} /> Download APK v{update.version}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
