import { Bell, LogOut, Moon, Sun, Search, Stethoscope } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { signOut } from "../services/authService";

const TITLES = {
  "/admin": "Dashboard",
  "/admin/employees": "Pegawai",
  "/admin/attendance": "Absensi",
  "/admin/attendance-history": "Riwayat",
  "/admin/schedules": "Jadwal",
  "/admin/leave": "Cuti",
  "/admin/announcements": "Pengumuman",
  "/admin/settings": "Pengaturan",
  "/employee": "Dashboard",
  "/employee/attendance": "Absensi",
};

function Header() {
  const { darkMode, setDarkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const title = TITLES[location.pathname] || "SIAP";

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header
      className="sticky top-0 z-30 bg-white/75 dark:bg-[#160a29]/80 backdrop-blur-xl border-b border-slate-200/70 dark:border-white/10 transition-colors duration-300"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-center justify-between h-[60px] md:h-16 px-3 md:px-6">
        {/* LEFT: Logo (mobile) + Title */}
        <div className="flex items-center gap-2 min-w-0 flex-1 xl:flex-none">
          {/* Mobile logo */}
          <div className="xl:hidden flex items-center gap-1.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-900/40">
              <Stethoscope size={16} className="text-white" />
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">SIAP</span>
          </div>

          {/* Desktop title */}
          <h1 className="hidden xl:block text-xl font-bold text-slate-900 dark:text-white truncate">
            {title}
          </h1>
        </div>

        {/* MIDDLE: Search (desktop only) */}
        <div className="hidden xl:flex items-center flex-1 max-w-md mx-6">
          <div className="relative w-full group">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-violet-300/60 group-focus-within:text-violet-500 dark:group-focus-within:text-violet-300 transition"
            />
            <input
              type="text"
              placeholder="Cari pegawai, riwayat, pengumuman…"
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-violet-300/40 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all backdrop-blur-sm"
            />
          </div>
        </div>

        {/* Mobile title (compact, centered area) */}
        <div className="xl:hidden flex-1 text-center">
          <h1 className="text-sm font-semibold text-slate-900 dark:text-white truncate px-2">{title}</h1>
        </div>

        {/* RIGHT: Theme toggle, Notifications, Logout */}
        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg text-slate-600 dark:text-violet-200 hover:bg-slate-100 dark:hover:bg-white/5 hover:scale-105 transition-all"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="p-2 rounded-lg text-slate-600 dark:text-violet-200 hover:bg-slate-100 dark:hover:bg-white/5 hover:scale-105 relative transition-all"
            aria-label="Notifications"
          >
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white dark:ring-[#160a29]"></span>
          </button>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-rose-300 hover:bg-rose-500/10 hover:scale-105 transition-all"
            aria-label="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
