import {
  Bell, LogOut, Users, CalendarCheck, History, CalendarDays,
  FileText, Megaphone, Settings, Building2, LayoutDashboard,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { signOut } from "../services/authService";

/* Header violet ala hero dashboard — preview admin-header-all-pages-preview.html
   (disetujui). Tampil di semua halaman admin non-dashboard. */
const PAGES = {
  "/admin/employees": { icon: Users, title: "Pegawai", desc: "Kelola data pegawai puskesmas" },
  "/admin/attendance": { icon: CalendarCheck, title: "Absensi", desc: "Pantau absensi pegawai hari ini" },
  "/admin/attendance-history": { icon: History, title: "Riwayat Absensi", desc: "Rekap kehadiran seluruh pegawai" },
  "/admin/schedules": { icon: CalendarDays, title: "Jadwal Kerja", desc: "Susun jadwal shift per bulan" },
  "/admin/leave": { icon: FileText, title: "Cuti & Izin", desc: "Kelola pengajuan cuti, izin, dan sakit" },
  "/admin/announcements": { icon: Megaphone, title: "Pengumuman", desc: "Berita untuk seluruh pegawai" },
  "/admin/organizations": { icon: Building2, title: "Kelola Instansi", desc: "Instansi platform Presensiku" },
  "/admin/settings": { icon: Settings, title: "Pengaturan", desc: "Konfigurasi aplikasi & instansi" },
};

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const page = PAGES[location.pathname] || { icon: LayoutDashboard, title: "Presensiku", desc: "" };
  const Icon = page.icon;

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
      <div className="hero-card-bg mx-3 sm:mx-4 md:mx-5 lg:mx-6 xl:mx-8 bg-gradient-to-r from-[#C44DFF] via-[#BF00FF] to-[#8A00CC] rounded-[24px] shadow-xl ring-1 ring-violet-300/40">
        <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4">
          {/* Icon chip */}
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0 shadow-md">
            <Icon size={18} className="text-white" />
          </div>
          {/* Judul halaman */}
          <div className="min-w-0 flex-1">
            <div className="text-base sm:text-lg font-bold text-white truncate tracking-tight">{page.title}</div>
            {page.desc && (
              <div className="text-[10px] sm:text-[11px] text-white/70 truncate font-medium uppercase tracking-wider">{page.desc}</div>
            )}
          </div>
          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => navigate("/admin/announcements")}
              className="relative w-9 h-9 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
              aria-label="Pengumuman"
            >
              <Bell size={15} className="text-white" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-400 rounded-full ring-2 ring-[#8A00CC]" />
            </button>
            <button
              onClick={handleLogout}
              className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
              aria-label="Logout"
            >
              <LogOut size={15} className="text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Header;
