import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarDays,
  FileText,
  Megaphone,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  History,          // ← TAMBAHKAN
} from "lucide-react";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const menuItems = [
    {
      path: "/admin",
      label: "Dashboard",
      icon: LayoutDashboard,
      roles: ["super_admin", "admin_puskesmas", "admin_kecamatan"],
    },
    {
      path: "/admin/employees",
      label: "Pegawai",
      icon: Users,
      roles: ["super_admin", "admin_puskesmas"],
    },
    {
      path: user?.role === "pegawai" ? "/employee" : "/admin/attendance",
      label: "Absensi",
      icon: CalendarCheck,
      roles: ["super_admin", "admin_puskesmas", "supervisor", "pegawai"],
    },
    // ── TAMBAHKAN MENU INI ──────────────────────────────────────────────────
    {
      path: "/admin/attendance-history",
      label: "Riwayat Absensi",
      icon: History,
      roles: ["super_admin", "admin_puskesmas"],
    },
    // ───────────────────────────────────────────────────────────────────────
    {
      path: "/admin/schedules",
      label: "Jadwal Kerja",
      icon: CalendarDays,
      roles: ["super_admin", "admin_puskesmas"],
    },
    {
      path: "/admin/leave",
      label: "Cuti & Izin",
      icon: FileText,
      roles: ["super_admin", "admin_puskesmas", "supervisor"],
    },
    {
      path: "/admin/announcements",
      label: "Pengumuman",
      icon: Megaphone,
      roles: ["super_admin", "admin_puskesmas"],
    },
    {
      path: "/admin/settings",
      label: "Pengaturan",
      icon: Settings,
      roles: ["super_admin"],
    },
  ];

  const userRole     = user?.role || "pegawai";
  const filteredMenus = menuItems.filter(item => item.roles.includes(userRole));

  return (
    <aside
      className={`${
        collapsed ? "w-20" : "w-[280px]"
      } bg-gradient-to-b from-violet-900 to-black text-white flex flex-col transition-all duration-300 min-h-screen shadow-2xl fixed top-0 left-0 z-40`}
    >
      {/* Header / Logo */}
      <div className="p-6 flex items-center justify-between border-b border-purple-700/50">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
              <ClipboardList size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-wider">SIAP</h1>
              <p className="text-xs text-purple-300">Puskesmas Ampenan</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mx-auto shadow-lg">
            <ClipboardList size={24} className="text-white" />
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 hover:bg-purple-700/50 rounded-lg transition-colors"
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* User Info */}
      {!collapsed && user && (
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
              end={item.path === "/admin"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30"
                    : "text-purple-200 hover:bg-purple-700/50 hover:text-white"
                }`
              }
            >
              <Icon size={20} className="shrink-0" />
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
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
          {!collapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </aside>
  );
}