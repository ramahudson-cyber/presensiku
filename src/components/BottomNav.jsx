import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Users, CalendarCheck, History,
  CalendarDays, FileText, Megaphone, Settings, MoreHorizontal
} from "lucide-react";
import { useState } from "react";
import BottomSheet from "./BottomSheet";

export default function BottomNav() {
  const { user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const userRole = user?.role || "pegawai";

  // Menu untuk Pegawai
  const pegawaiMenus = [
    { path: "/employee", label: "Home", icon: LayoutDashboard, end: true },
    { path: "/employee/attendance", label: "Absensi", icon: CalendarCheck },
    { path: "/employee/schedule", label: "Jadwal", icon: CalendarDays },
  ];

  // Menu untuk Admin — 4 main + 4 di "More"
  const adminMain = [
    { path: "/admin", label: "Home", icon: LayoutDashboard, end: true },
    { path: "/admin/attendance", label: "Absensi", icon: CalendarCheck },
    { path: "/admin/employees", label: "Pegawai", icon: Users },
    { path: "/admin/attendance-history", label: "Riwayat", icon: History },
  ];

  const adminMore = [
    { path: "/admin/schedules", label: "Jadwal Kerja", icon: CalendarDays },
    { path: "/admin/leave", label: "Cuti & Izin", icon: FileText },
    { path: "/admin/announcements", label: "Pengumuman", icon: Megaphone },
    { path: "/admin/settings", label: "Pengaturan", icon: Settings },
  ];

  const mainMenus = userRole === "pegawai" ? pegawaiMenus : adminMain;
  const moreMenus = userRole === "pegawai" ? [] : adminMore;

  return (
    <>
      {/* Bottom Navigation Bar — Mobile Only */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-onyx/95 backdrop-blur-xl border-t border-white/[0.06]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-around h-16 px-1">
          {mainMenus.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-all ${
                    isActive ? "text-electric-violet" : "text-slate-mist"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`p-1.5 rounded-2xl transition-all ${isActive ? "bg-electric-violet/15 scale-110" : ""}`}>
                      <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    <span className={`text-[10px] ${isActive ? "font-semibold" : "font-medium"}`}>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}

          {/* More Button — only show if there are more menus */}
          {moreMenus.length > 0 && (
            <button
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-slate-mist hover:text-electric-violet transition"
            >
              <div className="p-1.5 rounded-2xl">
                <MoreHorizontal size={22} strokeWidth={2} />
              </div>
              <span className="text-[10px] font-medium">Lainnya</span>
            </button>
          )}
        </div>
      </nav>

      {/* More Sheet */}
      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Menu Lainnya">
        <div className="grid grid-cols-3 gap-3">
          {moreMenus.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.path} to={item.path} onClick={() => setMoreOpen(false)}
                   className={({ isActive }) =>
                  `flex flex-col items-center gap-2 p-4 rounded-3xl transition-all ${isActive
                    ? "border-gradient bg-transparent text-pure-white"
                    : "bg-white/5 hover:bg-white/10"}`
                }>
                <Icon size={24} />
                <span className="text-[10px] font-medium text-center leading-tight">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
}
