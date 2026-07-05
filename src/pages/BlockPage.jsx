import { Smartphone, Download } from "lucide-react";

export default function BlockPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-obsidian">
      <div className="text-center p-8 max-w-md">
        <Smartphone size={64} className="mx-auto text-purple-600 mb-4" />
        <h1 className="text-2xl font-bold text-pure-white mb-2">
          Akses Terbatas
        </h1>
        <p className="text-slate-mist mb-4">
          Halaman ini hanya bisa diakses melalui aplikasi <strong>SIAP Puskesmas</strong> yang terinstal di HP Android.
        </p>
        <p className="text-slate-mist mb-6 text-sm">
          Silakan install aplikasi terlebih dahulu, lalu login kembali.
        </p>
        <a
          href="/SIAP-Puskesmas.apk"
          download
          className="inline-flex items-center gap-2 px-6 py-3 bg-electric-violet text-pure-white rounded-full hover:bg-electric-violet/80 transition-colors"
        >
          <Download size={20} />
          Download APK
        </a>
      </div>
    </div>
  );
}
