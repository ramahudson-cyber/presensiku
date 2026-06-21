import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import {
  LayoutDashboard, Users, CalendarCheck, CalendarDays,
  FileText, Megaphone, Settings, LogOut,
  History, Menu, X
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
      {/* Tombol Hamburger */}
      {!menuOpen && (
        <button
          onClick={() => setMenuOpen(true)}
          className="md:hidden fixed top-3 left-3 z-50 p-2 bg-violet-600 text-white rounded-xl shadow-lg shadow-violet-600/30"
          aria-label="Buka Menu"
        >
          <Menu size={20} />
        </button>
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-[270px] bg-gradient-to-b from-violet-950 via-slate-950 to-purple-950 text-white flex flex-col z-40 transition-transform duration-300 ease-in-out
        ${menuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* Header / Logo - Sinkron dengan Login */}
        <div className="p-5 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl rotate-6 opacity-40"></div>
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-xl -rotate-3 opacity-40"></div>
              <div className="relative w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-700 rounded-xl flex items-center justify-center shadow-lg shadow-violet-600/30">
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white">
                  <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M12 22V12M2 7l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="2" fill="currentColor"/>
                </svg>
              </div>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">SIAP</h1>
              <p className="text-[10px] text-violet-300/60">Puskesmas Ampenan</p>
            </div>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            className="md:hidden p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition"
            aria-label="Tutup Menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Info User */}
        <div className="px-5 py-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-xs font-bold shrink-0">
              {user?.full_name?.charAt(0) || user?.username?.charAt(0) || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{user?.full_name || user?.username || "User"}</p>
              <p className="text-[9px] text-violet-300/50 capitalize">{userRole.replace("_", " ")}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">Menu</p>
          {menus.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm ${
                    isActive
                      ? "bg-gradient-to-r from-violet-600/80 to-purple-600/60 text-white shadow-lg shadow-violet-900/30 font-semibold"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`
                }
              >
                <Icon size={17} className="shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-white/5">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition text-sm"
          >
            <LogOut size={17} className="shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}