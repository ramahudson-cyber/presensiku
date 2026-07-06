import { useEffect } from "react";
import { Smartphone, Download, Monitor, Loader } from "lucide-react";

export default function BlockPage() {
  const params = new URLSearchParams(window.location.search);
  const device = params.get("device");

  useEffect(() => {
    if (device === "android") {
      const timer = setTimeout(() => {
        const a = document.createElement("a");
        a.href = "/SIAP-Puskesmas.apk";
        a.download = "SIAP-Puskesmas.apk";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [device]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-obsidian">
      <div className="text-center p-8 max-w-md">
        {device === "android" ? (
          <>
            <div className="flex justify-center mb-4">
              <Loader size={40} className="text-purple-600 animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-pure-white mb-2">
              Mengunduh APK...
            </h1>
            <p className="text-slate-mist mb-4">
              Silakan install aplikasi <strong>SIAP Puskesmas</strong> setelah unduhan selesai, lalu login kembali.
            </p>
            <p className="text-slate-mist mb-6 text-sm">
              Jika unduhan tidak dimulai secara otomatis, klik tombol di bawah:
            </p>
            <a
              href="/SIAP-Puskesmas.apk"
              download
              className="inline-flex items-center gap-2 px-6 py-3 bg-electric-violet text-pure-white rounded-full hover:bg-electric-violet/80 transition-colors"
            >
              <Download size={20} />
              Download APK
            </a>
          </>
        ) : (
          <>
            <Monitor size={64} className="mx-auto text-purple-600 mb-4" />
            <h1 className="text-2xl font-bold text-pure-white mb-2">
              Akses Terbatas
            </h1>
            <p className="text-slate-mist mb-4">
              Halaman ini hanya bisa diakses melalui aplikasi <strong>SIAP Puskesmas</strong> di HP Android.
            </p>
            <p className="text-slate-mist mb-6 text-sm">
              Akses dari laptop/desktop hanya untuk Admin. Silakan buka melalui HP Android yang sudah terinstall aplikasi SIAP Puskesmas.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
