import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { isIOSStandalone, registerWebPush } from "../services/pushNotificationService";
import { toast } from "react-toastify";
import { Bell, X, Info, Loader2 } from "lucide-react";

const DISMISS_KEY = "notif_banner_dismissed";

/**
 * Banner izin notifikasi untuk PWA/web (bukan APK native).
 * iOS menuntut prompt izin dari tap nyata pada tombol — otomatisasi
 * invisible tidak pernah cukup di iPhone, jadi banner inilah jalurnya.
 */
export default function NotificationPermissionBanner() {
  const { user } = useAuth();
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === "1"
  );
  const [busy, setBusy] = useState(false);

  const isNative = typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const iosStandalone = isIOSStandalone();
  const isIOSNonStandalone = isIOS && !iosStandalone;
  const pushCapable =
    typeof Notification !== "undefined" && "PushManager" in window && "serviceWorker" in navigator;

  const handleEnable = async () => {
    setBusy(true);
    try {
      const ok = await registerWebPush(user?.id);
      setPermission(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
      if (ok) toast.success("Notifikasi aktif 🎉");
      else if (typeof Notification !== "undefined" && Notification.permission === "denied")
        toast.warning("Izin diblokir — aktifkan via Settings → Safari/Presensiku → Notifikasi");
    } catch (err) {
      toast.error(err.message || "Gagal mengaktifkan notifikasi");
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  // Tidak tampil untuk: APK native, belum login, izin granted/denied, sudah ditutup
  if (isNative || !user || dismissed) return null;
  if (typeof Notification === "undefined" || permission !== "default") return null;
  if (!isIOS && !pushCapable) return null; // perangkat tanpa dukungan push sama sekali

  // iOS Safari tab biasa: arahkan pasang PWA, bukan prompt yang mustahil
  if (isIOSNonStandalone) {
    return (
      <div className="flex items-start gap-3 rounded-3xl border border-sky-200 bg-sky-50 p-4 mb-5">
        <Info size={18} className="text-sky-600 shrink-0 mt-0.5" />
        <div className="text-xs text-sky-800 flex-1">
          <p className="font-bold">Ingin notifikasi real-time?</p>
          <p className="mt-0.5 leading-relaxed">
            Buka menu <b>Share</b> → <b>Add to Home Screen</b>, lalu buka Presensiku dari ikonnya
            (butuh iOS 16.4+). Notifikasi hanya bekerja di mode aplikasi.
          </p>
        </div>
        <button onClick={dismiss} className="text-sky-400 hover:text-sky-600" aria-label="Tutup">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-electric-violet/25 bg-electric-violet/[0.06] p-4 mb-5">
      <div className="p-2.5 rounded-2xl bg-electric-violet/15 shrink-0">
        <Bell size={18} className="text-electric-violet" />
      </div>
      <div className="flex-1 min-w-[180px] text-xs" style={{ color: "#334155" }}>
        <p className="font-bold text-slate-800">Aktifkan notifikasi real-time</p>
        <p className="mt-0.5">Dapatkan info pengumuman & pengingat shift langsung di perangkat Anda.</p>
      </div>
      <button
        onClick={handleEnable}
        disabled={busy}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-electric-violet text-white text-sm font-semibold hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all shrink-0"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
        {busy ? "Memproses..." : "Aktifkan"}
      </button>
      <button
        onClick={dismiss}
        className="p-1.5 text-slate-400 hover:text-slate-600"
        aria-label="Tutup"
      >
        <X size={14} />
      </button>
    </div>
  );
}
