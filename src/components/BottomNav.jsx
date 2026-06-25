import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Users, CalendarCheck, History,
  CalendarDays, FileText, Megaphone, Settings, MoreHorizontal
} from "lucide-react";
import { useState } from "react";
import { X } from "lucide-react";

export default function BottomNav() {
  const { user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const userRole = user?.role || "pegawai";

  // Menu untuk Pegawai (cuma 2, simple)
  const pegawaiMenus = [
    { path: "/employee", label: "Home", icon: LayoutDashboard, end: true },
    { path: "/employee/attendance", label: "Absensi", icon: CalendarCheck },
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
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#160a29]/95 backdrop-blur-xl border-t border-white/10"
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
                    isActive ? "text-violet-400" : "text-slate-500"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`p-1.5 rounded-xl transition-all ${isActive ? "bg-violet-500/15 scale-110" : ""}`}>
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
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-slate-500 hover:text-violet-400 transition"
            >
              <div className="p-1.5 rounded-xl">
                <MoreHorizontal size={22} strokeWidth={2} />
              </div>
              <span className="text-[10px] font-medium">Lainnya</span>
            </button>
          )}
        </div>
      </nav>

      {/* More Sheet — slide up from bottom */}
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex items-end animate-fade-in"
          onClick={() => setMoreOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>

          {/* Sheet */}
              <div
                className="relative w-full bg-[#1a0d2e] rounded-t-3xl border-t border-white/10 p-5 pb-8"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)" }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Handle bar */}
                <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-5"></div>

                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-base">Menu Lainnya</h3>
                  <button
                    onClick={() => setMoreOpen(false)}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 flex items-center justify-center"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {moreMenus.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => setMoreOpen(false)}
                        className={({ isActive }) =>
                          `flex flex-col items-center gap-2 p-4 rounded-2xl transition-all ${
                            isActive
                              ? "bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-lg shadow-violet-900/30"
                              : "bg-white/5 hover:bg-white/10"
                          }`
                        }
                      >
                        <Icon size={24} />
                        <span className="text-[10px] font-medium text-center leading-tight">{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
        </div>
      )}
    </>
  );
}
