import { Bell, LogOut, Menu, Moon, Sun, Search, Stethoscope } from "lucide-react";
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

function Header({ onMenuClick }) {
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
      className="sticky top-0 z-30 bg-[#160a29]/80 backdrop-blur-xl border-b border-white/10"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-center justify-between h-[60px] md:h-16 px-3 md:px-6">
        {/* LEFT: Logo (mobile) + Hamburger (mobile) + Title */}
        <div className="flex items-center gap-2 min-w-0 flex-1 md:flex-none">
          {/* Mobile logo (no hamburger on small screens → logo acts as home indicator) */}
          <div className="md:hidden flex items-center gap-1.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-900/40">
              <Stethoscope size={16} className="text-white" />
            </div>
            <span className="text-sm font-bold text-white tracking-tight">SIAP</span>
          </div>

          {/* Mobile hamburger (kept for safety — but layout above is logo+title) */}
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              aria-label="Open menu"
              className="md:hidden p-2 -ml-1 rounded-lg text-violet-200 hover:bg-white/10 transition shrink-0"
            >
              <Menu size={22} />
            </button>
          )}

          {/* Desktop title */}
          <h1 className="hidden md:block text-xl font-bold text-white truncate">
            {title}
          </h1>
        </div>

        {/* MIDDLE: Search (desktop only) */}
        <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
          <div className="relative w-full group">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-300/60 group-focus-within:text-violet-300 transition"
            />
            <input
              type="text"
              placeholder="Cari pegawai, riwayat, pengumuman…"
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-violet-300/40 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all backdrop-blur-sm"
            />
          </div>
        </div>

        {/* Mobile title (compact, centered area) */}
        <div className="md:hidden flex-1 text-center">
          <h1 className="text-sm font-semibold text-white truncate px-2">{title}</h1>
        </div>

        {/* RIGHT: Theme toggle, Notifications, Logout */}
        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg text-violet-200 hover:bg-white/5 hover:scale-105 transition-all"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="p-2 rounded-lg text-violet-200 hover:bg-white/5 hover:scale-105 relative transition-all"
            aria-label="Notifications"
          >
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-[#160a29]"></span>
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
