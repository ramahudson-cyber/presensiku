import { Bell, LogOut, Moon, Sun, Search, Clock } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { signOut } from "../services/authService";
import { useState, useEffect } from "react";

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const title = TITLES[location.pathname] || "SIAP";
  const userName = user?.full_name || user?.username || "User";

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const todayLabel = now.toLocaleDateString("id-ID", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header
      className="sticky top-0 z-30 bg-white/80 dark:bg-[#0f0524]/90 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/[0.06] transition-colors duration-300"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-center justify-between h-[72px] md:h-20 px-4 md:px-10">
        {/* LEFT: Greeting */}
        <div className="flex items-center min-w-0 flex-1">
          <div className="flex flex-col min-w-0">
            <h1 className="text-base sm:text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100 truncate tracking-tight">
              Hai, {userName}
            </h1>
            <span className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate uppercase tracking-widest font-medium opacity-80">
              {todayLabel}
            </span>
          </div>
        </div>

        {/* MIDDLE: Clock (mobile: right side of date) */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.05] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.05] mr-4">
          <Clock size={12} />
          <span className="font-mono tabular-nums font-semibold">{timeStr} WITA</span>
        </div>

        {/* MIDDLE: Search (desktop only) */}
        <div className="hidden xl:flex items-center flex-1 max-w-md mx-6">
          <div className="relative w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Cari pegawai, riwayat..."
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-100/80 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-slate-300 dark:focus:border-slate-600 transition-colors"
            />
          </div>
        </div>

        {/* RIGHT: Actions */}
        <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2.5 md:p-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="p-2.5 md:p-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] relative transition-colors" aria-label="Notifications">
            <Bell size={18} />
            <span className="absolute top-2 right-2 md:top-2.5 md:right-2.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white dark:ring-[#0f0524]"></span>
          </button>
          <button
            onClick={handleLogout}
            className="p-2.5 md:p-3 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
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
