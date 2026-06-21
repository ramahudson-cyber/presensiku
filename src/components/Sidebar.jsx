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
      {!menuOpen && (
        <button
          onClick={() => setMenuOpen(true)}
          className="md:hidden fixed top-3 left-3 z-50 p-2 bg-[#6B4BA3] text-white rounded-xl shadow-lg"
        >
          <Menu size={20} />
        </button>
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-[260px] bg-[#160a29]/80 backdrop-blur-xl text-white flex flex-col z-40 border-r border-white/10 transition-transform duration-300
        ${menuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* Logo */}
        <div className="p-5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-700 rounded-xl flex items-center justify-center shadow-lg shrink-0">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white">
                <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M12 22V12M2 7l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="2" fill="currentColor"/>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-wide">SIAP</h1>
              <p className="text-[10px] text-violet-300/70">Puskesmas Ampenan</p>
            </div>
          </div>
          <button onClick={() => setMenuOpen(false)} className="md:hidden p-1.5 text-violet-300 hover:text-white hover:bg-white/10 rounded-lg transition">
            <X size={18} />
          </button>
        </div>

        {/* User Info */}
        <div className="px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-xs font-bold shrink-0">
              {user?.full_name?.charAt(0) || user?.username?.charAt(0) || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user?.full_name || user?.username || "User"}</p>
              <p className="text-[10px] text-violet-300/60 capitalize">{userRole.replace("_", " ")}</p>
            </div>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">Menu Utama</p>
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
                      ? "bg-gradient-to-r from-violet-600 to-purple-700 text-white shadow-lg shadow-violet-900/30 font-semibold"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
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
        <div className="p-3 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-3 text-red-400/80 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition text-sm"
          >
            <LogOut size={18} className="shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}