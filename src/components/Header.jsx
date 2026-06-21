import { Bell, LogOut, Moon, Sun } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { signOut } from "../services/authService";

const TITLES = {
  "/admin": "Dashboard", "/admin/employees": "Pegawai", "/admin/attendance": "Absensi",
  "/admin/attendance-history": "Riwayat", "/admin/schedules": "Jadwal", "/admin/leave": "Cuti",
  "/admin/announcements": "Pengumuman", "/admin/settings": "Pengaturan",
  "/employee": "Dashboard", "/employee/attendance": "Absensi",
};

function Header({ onMenuClick }) {
  const { darkMode, setDarkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const title = TITLES[location.pathname] || "SIAP";

  const handleLogout = async () => { await signOut(); navigate("/"); };

  return (
    <header className="sticky top-0 z-20 bg-[#160a29]/80 backdrop-blur-xl border-b border-white/10">
      <div className="flex items-center justify-between h-16 px-4 md:px-6">
        <div className="flex items-center gap-3">
          {/* Spacer for mobile hamburger */}
          <div className="w-8 md:hidden"></div>
          <h1 className="text-base md:text-xl font-bold text-white">{title}</h1>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-lg text-violet-200 hover:bg-white/5">
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="p-2 rounded-lg text-violet-200 hover:bg-white/5 relative">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          <button onClick={handleLogout} className="p-2 rounded-lg text-red-300 hover:bg-red-500/10">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;