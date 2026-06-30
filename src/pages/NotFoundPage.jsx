import { Link } from "react-router-dom";
import { FileQuestion } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950">
      <div className="text-center p-8">
        <FileQuestion size={64} className="mx-auto text-gray-400 mb-4" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          404 - Halaman Tidak Ditemukan
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Halaman yang Anda cari tidak ada.
        </p>
        <Link
          to="/"
          className="px-6 py-3 border-gradient bg-transparent text-white rounded-xl transition-colors"
        >
          Kembali ke Login
        </Link>
      </div>
    </div>
  );
}
