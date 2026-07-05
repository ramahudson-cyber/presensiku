import { Link } from "react-router-dom";
import { ShieldX } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-obsidian">
      <div className="text-center p-8">
        <ShieldX size={64} className="mx-auto text-red-500 mb-4" />
        <h1 className="text-3xl font-bold text-pure-white mb-2">
          Akses Ditolak
        </h1>
        <p className="text-slate-mist mb-6">
          Anda tidak memiliki izin untuk mengakses halaman ini.
        </p>
        <Link
          to="/"
          className="design-btn-ghost"
        >
          Kembali ke Login
        </Link>
      </div>
    </div>
  );
}
