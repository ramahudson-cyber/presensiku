import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { getCurrentVersion } from "../services/updateService";
import {
  LayoutDashboard, Users, CalendarCheck, CalendarDays,
  FileText, Megaphone, Settings, LogOut,
  History, X
} from "lucide-react";

export default function Sidebar({ menuOpen = false, setMenuOpen = () => {} }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const userRole = user?.role || "pegawai";

  const pegawaiMenus = [
    { path: "/employee", label: "Dashboard", icon: LayoutDashboard, end: true },
    { path: "/employee/attendance", label: "Absensi", icon: CalendarCheck },
    { path: "/employee/schedule", label: "Jadwal Shift", icon: CalendarDays },
  ];

  const adminMenus = [
    { path: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
    { path: "/admin/employees", label: "Pegawai", icon: Users },
    { path: "/admin/attendance", label: "Absensi", icon: CalendarCheck },
    { path: "/admin/attendance-history", label: "Riwayat Absensi", icon: History },
    { path: "/admin/schedules", label: "Jadwal Kerja", icon: CalendarDays },
    { path: "/admin/leave", label: "Cuti & Izin", icon: FileText },
    { path: "/admin/announcements", label: "Pengumuman", icon: Megaphone },
    { path: "/admin/settings", label: "Pengaturan", icon: Settings },
  ];

  const menus = userRole === "pegawai" ? pegawaiMenus : adminMenus;

  return (
    <>
      <aside
        className={`fixed top-0 left-0 h-full w-[260px] sidebar-gradient flex flex-col z-40 border-r border-white/15 shadow-2xl shadow-violet-950/20 transition-transform duration-300
        ${menuOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0"}`}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {/* Logo */}
        <div className="p-5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-electric-violet to-deep-indigo rounded-xl flex items-center justify-center shadow-lg shrink-0">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white">
                <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M12 22V12M2 7l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-wide text-pure-white">Hadir.Kuy</h1>
              <p className="text-[10px] text-slate-mist">Absen anti ribet, kerja makin greget</p>
            </div>
          </div>
              <button onClick={() => setMenuOpen(false)} className="xl:hidden border-gradient bg-transparent text-pure-white rounded-lg transition">
            <X size={18} />
          </button>
        </div>

        {/* User Info */}
        <div className="px-5 py-4 border-b border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-electric-violet to-deep-indigo flex items-center justify-center text-xs font-bold shrink-0 text-pure-white">
              {user?.full_name?.charAt(0) || user?.username?.charAt(0) || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-pure-white">{user?.full_name || user?.username || "User"}</p>
              <p className="text-[10px] text-slate-mist capitalize">{userRole.replace("_", " ")}</p>
            </div>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="text-[9px] font-bold text-slate-mist/60 uppercase tracking-widest px-3 mb-2">Menu Utama</p>
          {menus.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-sm ${
                    isActive
                      ? "border-gradient bg-transparent text-white font-semibold"
                      : "hover:bg-white/10"
                  }`
                }
              >
                <Icon size={18} className="shrink-0" />
                <span className="flex-1">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-white/10" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-3 text-red-400/80 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition text-sm"
          >
            <LogOut size={18} className="shrink-0" />
            <span>Logout</span>
          </button>
            <p className="text-[9px] text-slate-mist/40 text-center mt-2 select-none">v{getCurrentVersion().version}</p>
        </div>
      </aside>
    </>
  );
}

