import { Bell, LogOut, Clock } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
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
  }).replace(/\b\w/g, c => c.toUpperCase());
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
        {/* LEFT: Avatar + Greeting + Date */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white text-xs font-bold shadow-lg shrink-0">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 truncate tracking-tight">
              Hai, {userName}
            </h1>
            <span className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 truncate font-medium">
              {todayLabel}
            </span>
          </div>
        </div>

        {/* RIGHT: Actions */}
        <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
          {/* <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2.5 md:p-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button> */}
          <button className="p-2.5 md:p-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] relative transition-colors" aria-label="Notifications">
            <Bell size={18} />
            <span className="absolute top-2 right-2 md:top-2.5 md:right-2.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white dark:ring-[#0f0524]"></span>
          </button>
          <button
            onClick={handleLogout}
            className="border-gradient bg-transparent text-white dark:hover:bg-rose-500/10 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
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

