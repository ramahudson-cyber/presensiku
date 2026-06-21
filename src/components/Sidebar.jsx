import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import {
  LayoutDashboard, Users, CalendarCheck, CalendarDays,
  FileText, Megaphone, Settings, LogOut, ChevronLeft, ChevronRight,
  ClipboardList, History, Menu, X
} from "lucide-react";

export default function Sidebar({ isMobileOpen = false, setIsMobileOpen = () => {} }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const menuItems = [
    { path: user?.role === "pegawai" ? "/employee" : "/admin", label: "Dashboard", icon: LayoutDashboard, roles: ["super_admin", "admin_puskesmas", "pegawai"], end: true },
    { path: "/admin/employees", label: "Pegawai", icon: Users, roles: ["super_admin", "admin_puskesmas"] },
    { path: user?.role === "pegawai" ? "/employee" : "/admin/attendance", label: "Absensi", icon: CalendarCheck, roles: ["super_admin", "admin_puskesmas", "pegawai"] },
    { path: "/admin/attendance-history", label: "Riwayat Absensi", icon: History, roles: ["super_admin", "admin_puskesmas"] },
    { path: "/admin/schedules", label: "Jadwal Kerja", icon: CalendarDays, roles: ["super_admin", "admin_puskesmas"] },
    { path: "/admin/leave", label: "Cuti & Izin", icon: FileText, roles: ["super_admin", "admin_puskesmas", "supervisor"] },
    { path: "/admin/announcements", label: "Pengumuman", icon: Megaphone, roles: ["super_admin", "admin_puskesmas"] },
    { path: "/admin/settings", label: "Pengaturan", icon: Settings, roles: ["super_admin"] },
  ];

  const userRole = user?.role || "pegawai";
  const filteredMenus = menuItems.filter(item => item.roles.includes(userRole));

  return (
    <>
      {/* Mobile Hamburger Button - Fixed top left */}
      {!isMobileOpen && (
        <button 
          onClick={() => setIsMobileOpen(true)}
          className="md:hidden fixed top-4 left-4 z-50 p-2 bg-violet-600 text-white rounded-lg shadow-lg"
        >
          <Menu size={24} />
        </button>
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-[280px] bg-gradient-to-b from-violet-900 to-black text-white flex flex-col transition-transform duration-300 z-40
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* Header / Logo */}
        <div className="p-6 flex items-center justify-between border-b border-purple-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
              <ClipboardList size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-wider">SIAP</h1>
              <p className="text-xs text-purple-300">Puskesmas Ampenan</p>
            </div>
          </div>
          {/* Close button for mobile */}
          <button 
            onClick={() => setIsMobileOpen(false)}
            className="md:hidden text-purple-300 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* User Info */}
        {user && (
          <div className="px-6 py-4 border-b border-purple-700/50 bg-purple-900/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center font-bold text-sm">
                {user.full_name?.charAt(0) || user.username?.charAt(0) || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {user.full_name || user.username || "User"}
                </p>
                <p className="text-xs text-purple-300 truncate capitalize">
                  {userRole.replace("_", " ")}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {filteredMenus.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                onClick={() => setIsMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30"
                      : "text-purple-200 hover:bg-purple-700/50 hover:text-white"
                  }`
                }
              >
                <Icon size={20} className="shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-purple-700/50">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-red-300 hover:bg-red-500/20 hover:text-red-200 rounded-xl transition-colors"
          >
            <LogOut size={20} className="shrink-0" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}