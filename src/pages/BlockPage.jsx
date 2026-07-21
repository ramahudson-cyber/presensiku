import { useSearchParams } from "react-router-dom";
import { Smartphone, Monitor } from "lucide-react";

export default function BlockPage() {
  const [searchParams] = useSearchParams();
  const device = searchParams.get("device");

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-obsidian">
      <div className="text-center p-8 max-w-md">
        {device === "android" ? (
          <>
            <Smartphone size={64} className="mx-auto text-purple-600 mb-4" />
            <h1 className="text-2xl font-bold text-pure-white mb-2">
              Akses Terbatas
            </h1>
            <p className="text-slate-mist mb-4">
              Halaman ini hanya bisa diakses melalui Aplikasi <strong>Presensiku</strong>.
            </p>
            <p className="text-slate-mist text-sm">
              Silakan login melalui Aplikasi Presensiku yang sudah terinstall di HP Android Anda.
            </p>
          </>
        ) : (
          <>
            <Monitor size={64} className="mx-auto text-purple-600 mb-4" />
            <h1 className="text-2xl font-bold text-pure-white mb-2">
              Akses Terbatas
            </h1>
            <p className="text-slate-mist mb-4">
              Halaman ini hanya bisa diakses melalui Aplikasi <strong>Presensiku</strong> di HP Android.
            </p>
            <p className="text-slate-mist text-sm">
              Akses dari laptop/desktop hanya untuk Admin. Silakan buka melalui HP Android yang sudah terinstall aplikasi Presensiku.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
