import { Bell, LogOut, Menu, Moon, Sun } from "lucide-react";
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
      className="sticky top-0 z-30 bg-[#160a29]/95 backdrop-blur-xl border-b border-white/10"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <div className="flex items-center justify-between h-[60px] px-4 md:px-6">
        {/* LEFT: Hamburger (mobile only) + Title */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={onMenuClick}
            aria-label="Open menu"
            className="md:hidden p-2.5 -ml-1 rounded-xl bg-white/5 hover:bg-white/10 text-violet-200 transition shrink-0 active:scale-95"
          >
            <Menu size={26} strokeWidth={2.2} />
          </button>
          <h1 className="text-lg md:text-2xl font-bold text-white truncate tracking-tight">
            {title}
          </h1>
        </div>

        {/* RIGHT: Theme toggle, Notifications, Logout */}
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2.5 rounded-xl text-violet-200 hover:bg-white/5 transition active:scale-95"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            className="p-2.5 rounded-xl text-violet-200 hover:bg-white/5 relative transition active:scale-95"
            aria-label="Notifications"
          >
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-[#160a29]"></span>
          </button>
          <button
            onClick={handleLogout}
            className="p-2.5 rounded-xl text-red-300 hover:bg-red-500/10 transition active:scale-95"
            aria-label="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;