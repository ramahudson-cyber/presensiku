import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import {
  LayoutDashboard, Users, CalendarCheck, CalendarDays,
  FileText, Megaphone, Settings, LogOut,
  ClipboardList, History, Menu, X
} from "lucide-react";

export default function Sidebar({ menuOpen = false, setMenuOpen = () => {} }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const userRole = user?.role || "pegawai";

  // Menu khusus untuk Pegawai (route /employee)
  const pegawaiMenus = [
    { path: "/employee", label: "Dashboard", icon: LayoutDashboard, end: true },
    { path: "/employee/attendance", label: "Absensi", icon: CalendarCheck },
  ];

  // Menu untuk Admin / Super Admin (route /admin)
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
      {/* Tombol Hamburger untuk Mobile */}
      {!menuOpen && (
        <button
          onClick={() => setMenuOpen(true)}
          className="md:hidden fixed top-3 left-3 z-50 p-2 bg-violet-600 text-white rounded-lg shadow-lg shadow-violet-600/30"
          aria-label="Buka Menu"
        >
          <Menu size={20} />
        </button>
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-[260px] bg-gradient-to-b from-violet-900 to-slate-900 text-white flex flex-col z-40 transition-transform duration-300 ease-in-out
        ${menuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* Header / Logo */}
        <div className="p-5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center shadow-lg shrink-0">
              <ClipboardList size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-wide">SIAP</h1>
              <p className="text-[10px] text-purple-300">Puskesmas Ampenan</p>
            </div>
          </div>
          {/* Tombol Close di Mobile */}
          <button
            onClick={() => setMenuOpen(false)}
            className="md:hidden p-1.5 text-purple-300 hover:text-white hover:bg-white/10 rounded-lg transition"
            aria-label="Tutup Menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Info User */}
        {user && (
          <div className="px-5 py-3 border-b border-white/10 bg-white/5">
            <p className="text-sm font-semibold truncate">
              {user.full_name || user.username || "User"}
            </p>
            <p className="text-[10px] text-purple-300 truncate capitalize">
              {userRole.replace("_", " ")}
            </p>
          </div>
        )}

        {/* Navigasi Menu */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {menus.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20"
                      : "text-purple-200 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                <Icon size={18} className="shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Tombol Logout */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-red-300 hover:bg-red-500/20 hover:text-red-200 rounded-xl transition-colors"
          >
            <LogOut size={18} className="shrink-0" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}