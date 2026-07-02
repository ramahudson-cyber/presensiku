import { useEffect, useState } from "react";
import { checkUpdate } from "../services/updateService";
import { Download, RefreshCw, X, Loader2 } from "lucide-react";

export default function UpdateDialog() {
  const [update, setUpdate] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    checkUpdate().then(setUpdate);
  }, []);

  if (!update || dismissed) return null;

  const handleDownload = async () => {
    if (!update.apkUrl) return;
    setDownloading(true);
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: update.apkUrl });
    } catch {
      window.location.href = update.apkUrl;
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
          {update.apkUrl ? (
            <button onClick={handleDownload} disabled={downloading}
              className="border-gradient bg-transparent text-white w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-violet-900/30 active:scale-[0.98] transition-all disabled:opacity-50">
              {downloading ? <><Loader2 size={16} className="animate-spin" /> Membuka...</> : <><Download size={16} /> Download APK</>}
            </button>
          ) : (
            <p className="text-xs text-amber-300/70 text-center">APK belum tersedia. Hubungi admin.</p>
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
