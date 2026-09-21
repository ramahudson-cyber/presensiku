import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, CalendarDays,
  Users, History, FileText, Megaphone, Settings, MoreHorizontal,
  FingerprintPattern, User, ClipboardList,
} from "lucide-react";
import { useState } from "react";
import BottomSheet from "./BottomSheet";

export default function BottomNav({ hidden = false }) {
  const { user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const userRole = user?.role || "pegawai";

  if (hidden) return null;

  // Pegawai: Izin/Sakit di bar (slot bekas Profil); Profil masuk Bottom Sheet "Menu"
  const pegawaiMenus = [
    { path: "/employee", label: "Home", icon: LayoutDashboard, end: true },
    { path: "/employee/leave", label: "Izin/Sakit", icon: ClipboardList },
    { path: "/employee/schedule", label: "Jadwal", icon: CalendarDays },
  ];

  const pegawaiMore = [
    { path: "/employee/profile", label: "Profil", icon: User },
    { path: "/employee/history", label: "Riwayat Kehadiran", icon: History },
  ];

  const adminMain = [
    { path: "/admin", label: "Home", icon: LayoutDashboard, end: true },
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
  const moreMenus = userRole === "pegawai" ? pegawaiMore : adminMore;
  const centerPath = userRole === "pegawai"
    ? "/employee/attendance"
    : "/admin/attendance";

  // The center action gets a real grid column. This keeps it centered even when
  // the left and right groups contain a different number of items.
  const moreLabel = userRole === "pegawai" ? "Menu" : "Lainnya";
  const navItems = moreMenus.length > 0
    ? [...mainMenus, { key: "more", label: moreLabel, icon: MoreHorizontal }]
    : mainMenus;
  const midIndex = Math.ceil(navItems.length / 2);
  const leftMenus = navItems.slice(0, midIndex);
  const rightMenus = navItems.slice(midIndex);

  const renderMenuItem = (item) => {
    const Icon = item.icon;

    if (item.key === "more") {
      return (
        <button
          key={item.key}
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-label="Buka menu lainnya"
          className="flex min-w-0 w-full h-full flex-col items-center justify-center gap-0.5 px-0.5 pt-2 text-slate-500 transition hover:text-electric-violet active:scale-[0.98]"
        >
          <span className="rounded-xl p-1">
            <Icon size={22} strokeWidth={2} />
          </span>
          <span className="max-w-full px-0.5 text-center text-[10px] font-medium leading-[1.1] break-words">
            {item.label}
          </span>
        </button>
      );
    }

    return (
      <NavLink
        key={item.path}
        to={item.path}
        end={item.end}
        className={({ isActive }) =>
          `flex min-w-0 w-full h-full flex-col items-center justify-center gap-0.5 px-0.5 pt-2 text-center transition active:scale-[0.98] ${
            isActive ? "text-electric-violet" : "text-slate-500"
          }`
        }
      >
        {({ isActive }) => (
          <>
            <span className={`rounded-xl p-1 transition-all ${isActive ? "bg-electric-violet/15 scale-110" : ""}`}>
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
            </span>
            <span
              className={`max-w-full px-0.5 text-center text-[10px] leading-[1.1] break-words ${
                isActive ? "font-semibold" : "font-medium"
              }`}
            >
              {item.label}
            </span>
          </>
        )}
      </NavLink>
    );
  };

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {/* The middle column is reserved in flow; the floating action never steals a menu slot. */}
        <div className="absolute -top-5 left-1/2 z-20 -translate-x-1/2 text-center">
          <NavLink
            to={centerPath}
            aria-label="Buka presensi"
            className="hero-card-bg flex h-16 w-16 items-center justify-center rounded-full border-4 border-white text-3xl shadow-lg shadow-purple-500/50"
            style={{ background: "linear-gradient(135deg, #BF00FF, #6366f1)", color: "#ffffff" }}
          >
            <FingerprintPattern size={28} className="text-white" />
          </NavLink>
          <p className="mt-[5px] text-[10px] font-bold uppercase leading-none tracking-tight text-slate-600">
            Presensi
          </p>
        </div>

        <div className="absolute left-1/2 top-0 z-10 h-8 w-24 -translate-x-1/2 rounded-b-2xl bg-white/95" />

        <div
          className="grid h-[85px] w-full grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] items-stretch rounded-t-3xl border-t border-gray-100 px-2 shadow-[0_-8px_30px_rgba(0,0,0,0.15)] sm:px-4"
          style={{
            background: "linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.99))",
            backdropFilter: "blur(20px)",
          }}
        >
          <div
            className="grid min-w-0"
            style={{ gridTemplateColumns: `repeat(${leftMenus.length}, minmax(0, 1fr))` }}
          >
            {leftMenus.map(renderMenuItem)}
          </div>

          <div aria-hidden="true" />

          <div
            className="grid min-w-0"
            style={{ gridTemplateColumns: `repeat(${rightMenus.length}, minmax(0, 1fr))` }}
          >
            {rightMenus.map(renderMenuItem)}
          </div>
        </div>
      </nav>

      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Menu Lainnya">
        <div className="grid grid-cols-3 gap-3">
          {moreMenus.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-2 rounded-3xl p-4 text-center transition-all ${
                    isActive
                      ? "bg-electric-violet/10 text-electric-violet"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`
                }
              >
                <Icon size={24} />
                <span className="text-[10px] font-medium leading-tight">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
}
