import { Link } from "react-router-dom";
import { FileQuestion } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-obsidian">
      <div className="text-center p-8">
        <FileQuestion size={64} className="mx-auto text-slate-mist mb-4" />
        <h1 className="text-3xl font-bold text-pure-white mb-2">
          404 - Halaman Tidak Ditemukan
        </h1>
        <p className="text-slate-mist mb-6">
          Halaman yang Anda cari tidak ada.
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
