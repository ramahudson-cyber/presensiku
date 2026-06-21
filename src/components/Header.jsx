import { Bell, LogOut, Moon, Sun } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import Swal from "sweetalert2";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { signOut } from "../services/authService";

const PAGE_TITLES = {
  "/admin": "Dashboard",
  "/admin/employees": "Manajemen Pegawai",
  "/admin/attendance": "Absensi",
  "/admin/attendance-history": "Riwayat Absensi",
  "/admin/schedules": "Jadwal Kerja",
  "/admin/leave": "Cuti & Izin",
  "/admin/announcements": "Pengumuman",
  "/admin/settings": "Pengaturan Sistem",
  "/employee": "Absensi Saya",
};

const ROLE_LABELS = {
  super_admin: "Super Admin",
  admin_puskesmas: "Admin Puskesmas",
  kepala_unit: "Kepala Unit",
  pegawai: "Pegawai",
};

function Header({ onMenuClick }) {
  const { darkMode, setDarkMode } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const pageTitle = PAGE_TITLES[location.pathname] || "SIAP Puskesmas";
  const roleLabel = ROLE_LABELS[user?.role] || "User";

  async function handleLogout() {
    const { error } = await signOut();
    if (error) {
      Swal.fire({ icon: "error", title: "Logout Gagal", text: error.message });
      return;
    }
    localStorage.removeItem("session");
    navigate("/");
  }

  return (
    <header className="sticky top-0 z-20 h-20 bg-white dark:bg-slate-950 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8">
      <div className="flex items-center gap-3">
        {/* Spacer for mobile hamburger menu (positioned fixed top-4 left-4) */}
        <div className="w-8 md:hidden"></div>
        
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-gray-800 dark:text-white truncate">
            {pageTitle}
          </h1>
          <p className="text-xs md:text-sm text-gray-400 dark:text-gray-500 hidden sm:block">
            {roleLabel} • {user?.full_name || user?.email || ""}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <button className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition relative">
          <Bell size={20} />
        </button>

        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
            {user?.full_name?.charAt(0) || user?.username?.charAt(0) || "U"}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
              {user?.full_name || user?.username || "User"}
            </p>
            <p className="text-[10px] text-gray-400">{roleLabel}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-2 px-2 md:px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 transition text-xs md:text-sm font-medium"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}

export default Header;