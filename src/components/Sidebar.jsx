import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { getCurrentVersion } from "../services/updateService";
import { getSetting } from "../lib/settings";
import {
  LayoutDashboard, Users, CalendarCheck, CalendarDays,
  FileText, Megaphone, Settings, LogOut,
  History, X, ClipboardList, Building2, Wallet, Bell
} from "lucide-react";
import { useState, useEffect } from "react";
import ProfileSheet from "./ProfileSheet";

export default function Sidebar({ menuOpen = false, setMenuOpen = () => {} }) {
  const { user, switchedOrg } = useAuth();
  const navigate = useNavigate();
  const [payrollOn, setPayrollOn] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const userRole = user?.role || "pegawai";

  // Modul Gaji (opsional per instansi) — menu admin hanya bila aktif
  useEffect(() => {
    (async () => {
      try {
        setPayrollOn((await getSetting("payroll_enabled", "false")) === "true");
      } catch { /* default off */ }
    })();
  }, [userRole]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const pegawaiMenus = [
    { path: "/employee/notifications", label: "Pengumuman", icon: Bell },
    { path: "/employee", label: "Dashboard", icon: LayoutDashboard, end: true },
    { path: "/employee/attendance", label: "Absensi", icon: CalendarCheck },
    { path: "/employee/schedule", label: "Jadwal Shift", icon: CalendarDays },
    { path: "/employee/leave", label: "Izin / Sakit", icon: ClipboardList },
  ];

  // Menu khusus platform super_admin (Kelola Instansi)
  const superAdminMenus = [
    { path: "/admin/organizations", label: "Kelola Instansi", icon: Building2 },
  ];

  const adminMenus = [
    { path: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
    { path: "/admin/employees", label: "Pegawai", icon: Users },
    { path: "/admin/attendance", label: "Absensi", icon: CalendarCheck },
    { path: "/admin/attendance-history", label: "Riwayat Absensi", icon: History },
    { path: "/admin/schedules", label: "Jadwal Kerja", icon: CalendarDays },
    { path: "/admin/leave", label: "Cuti & Izin", icon: FileText },
    ...(payrollOn ? [{ path: "/admin/payroll", label: "Gaji", icon: Wallet }] : []),
    { path: "/admin/announcements", label: "Pengumuman", icon: Megaphone },
    ...(userRole === "super_admin" ? superAdminMenus : []),
    { path: "/admin/settings", label: "Pengaturan", icon: Settings },
    { path: "/admin/profile", label: "Profil", icon: Users },
  ];

  const menus = userRole === "pegawai" ? pegawaiMenus : adminMenus;

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user?.role !== "pegawai") return;
    let cancelled = false;
    const fetchUnread = async () => {
      try {
        const iso = new Date().toISOString();
        const { count: annCount } = await supabase
          .from("announcements")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true)
          .or(`expires_at.is.null,expires_at.gte.${iso}`);
        const { count: ackCount } = await supabase
          .from("announcement_acks")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);
        if (!cancelled) setUnreadCount(Math.max(0, (annCount || 0) - (ackCount || 0)));
      } catch (e) { /* silent */ }
    };
    fetchUnread();
    const id = setInterval(fetchUnread, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, [user?.id, user?.role]);

  return (
    <>
      <aside
        className={`fixed top-0 left-0 h-full w-[260px] sidebar-gradient flex flex-col z-40 border-r border-white/15 shadow-2xl shadow-violet-950/20 transition-transform duration-300
        ${menuOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0"}`}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {/* Close button (mobile only) */}
        <div className="flex justify-end px-4 pt-3 xl:hidden">
          <button onClick={() => setMenuOpen(false)} className="border-gradient bg-transparent text-pure-white rounded-lg transition">
            <X size={18} />
          </button>
        </div>

        {/* User Info */}
        <div className="px-5 py-4 border-b border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setProfileOpen(true)} aria-label="Menu foto profil"
              className="shrink-0 cursor-pointer rounded-full outline-none transition-all duration-200 active:scale-95 hover:ring-2 hover:ring-white/30 focus-visible:ring-2 focus-visible:ring-white/40">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-electric-violet to-deep-indigo flex items-center justify-center text-xs font-bold shrink-0 text-pure-white overflow-hidden">
                {user?.avatar_url || user?.user_metadata?.avatar_url ? (
                  <img src={user?.avatar_url || user?.user_metadata?.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  user?.full_name?.charAt(0) || user?.username?.charAt(0) || "U"
                )}
              </div>
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-pure-white">{user?.full_name || user?.username || "User"}</p>
              <p className="text-[10px] text-slate-mist capitalize">{userRole === "admin_puskesmas" ? "admin" : userRole.replace("_", " ")}</p>
              {switchedOrg && (
                <p className="mt-1 inline-flex items-center gap-1 text-[9px] font-bold text-green-300 bg-green-400/10 border border-green-400/30 rounded-full px-2 py-0.5 max-w-full">
                  <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse shrink-0" />
                  <span className="truncate">MODE: {switchedOrg.name}</span>
                </p>
              )}
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
                {item.label === "Pengumuman" && unreadCount > 0 && (
                  <span className="text-[9px] font-bold bg-rose-400 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-tight">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
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

      {/* Foto profil diklik → sheet profil + keluar */}
      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}

