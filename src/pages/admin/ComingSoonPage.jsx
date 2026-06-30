import { Construction, ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

// ✅ Map path → nama modul
const MODULE_NAMES = {
  "/admin/schedules": "Jadwal Kerja",
  "/admin/leave": "Cuti & Izin",
  "/admin/announcements": "Pengumuman",
  "/admin/settings": "Pengaturan Sistem",
  "/admin/reports": "Laporan Bulanan",
};

export default function ComingSoonPage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const moduleName = MODULE_NAMES[location.pathname] || "Modul";

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      {/* Icon */}
      <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-100 to-pink-100 dark:from-violet-900/30 dark:to-pink-900/30 flex items-center justify-center mb-6">
        <Construction size={48} className="text-violet-500" />
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-3">
        {moduleName}
      </h1>
      <p className="text-gray-500 dark:text-gray-400 mb-2 max-w-md">
        Modul ini sedang dalam pengembangan (Sprint berikutnya).
      </p>
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-8">
        Sementara ini, silakan gunakan modul yang sudah aktif.
      </p>

      {/* Tombol kembali */}
      <button
        onClick={() => navigate("/admin")}
        className="inline-flex items-center gap-2 px-5 py-2.5 border-gradient bg-transparent text-white text-sm font-medium rounded-xl transition-colors"
      >
        <ArrowLeft size={16} />
        Kembali ke Dashboard
      </button>
    </div>
  );
}
