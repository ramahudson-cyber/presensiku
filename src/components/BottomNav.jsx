import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  LayoutDashboard, CalendarCheck, CalendarDays,
  Users, History, FileText, Megaphone, Settings, MoreHorizontal,
  FingerprintPattern, User,
} from "lucide-react";
import { useState } from "react";
import BottomSheet from "./BottomSheet";

export default function BottomNav({ hidden = false }) {
  const { user } = useAuth();
  const { darkMode } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);
  const userRole = user?.role || "pegawai";

  if (hidden) return null;

  // Menu untuk Pegawai — 2 items (Absensi diganti floating button)
  const pegawaiMenus = [
    { path: "/employee", label: "Home", icon: LayoutDashboard, end: true },
    { path: "/employee/profile", label: "Profil", icon: User },
    { path: "/employee/schedule", label: "Jadwal", icon: CalendarDays },
    { path: "/employee/history", label: "Riwayat", icon: History },
  ];

  // Admin: 3 main + more menus
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
  const moreMenus = userRole === "pegawai" ? [] : adminMore;

  // Insert placeholder at middle index for center floating button
  const midIndex = Math.ceil(mainMenus.length / 2);
  const displayMenus = mainMenus.slice(0, midIndex).concat(null, mainMenus.slice(midIndex));

  const centerPath = userRole === "pegawai"
    ? "/employee/attendance"
    : "/admin/attendance";

  return (
    <>
      {/* Bottom Navigation Bar — Crypto Wallet Style */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {/* Center Floating Button — Fingerprint / Presensi */}
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-center z-20">
          <NavLink
            to={centerPath}
            className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl shadow-lg shadow-purple-500/50 border-4 ${
              darkMode ? "border-[#0a0514]" : "border-white"
            }`}
            style={{ background: "linear-gradient(135deg, #BF00FF, #6366f1)", color: "#ffffff" }}
          >
            <FingerprintPattern size={28} className="text-white" />
          </NavLink>
          <p className={`text-[10px] mt-1 font-bold tracking-tight uppercase ${
            darkMode ? "text-slate-400" : "text-slate-600"
          }`}>Presensi</p>
        </div>

        {/* Cutout Notch — blends with app background */}
        <div className={`absolute left-1/2 -translate-x-1/2 top-0 w-32 h-8 z-10 rounded-b-2xl ${
          darkMode ? "bg-[#161320]/85" : "bg-white/95"
        }`}></div>

        {/* Navbar Base — Glassmorphism */}
        <div
          className={`w-full h-[85px] rounded-t-3xl flex justify-center items-center gap-1 shadow-[0_-8px_30px_rgba(0,0,0,0.15)] border-t ${
            darkMode ? "border-white/10" : "border-gray-100"
          }`}
          style={{
            background: darkMode 
              ? "linear-gradient(180deg, rgba(22, 19, 32, 0.95), rgba(10, 5, 20, 0.98))"
              : "linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.99))",
            backdropFilter: "blur(20px)",
          }}
        >
          {displayMenus.map((item, i) => {
            if (item === null) {
              return (
                <div key="center-placeholder" className="w-32 shrink-0 h-full" />
              );
            }
            const Icon = item.icon;
            return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center gap-0.5 h-full pt-2 transition-all w-[65px] ${
                      isActive ? "text-electric-violet" : (darkMode ? "text-slate-mist" : "text-slate-500")
                    }`
                  }
              >
                {({ isActive }) => (
                  <>
                    <div className={`p-1 rounded-xl transition-all ${isActive ? "bg-electric-violet/15 scale-110" : ""}`}>
                      <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    <span className={`text-xs mt-0.5 ${isActive ? "font-semibold" : "font-medium"}`}>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}

          {/* More Button — only admin */}
          {moreMenus.length > 0 && (
            <button
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full pt-2 text-slate-mist hover:text-electric-violet transition"
            >
              <div className="p-1 rounded-xl">
                <MoreHorizontal size={22} strokeWidth={2} />
              </div>
              <span className="text-xs mt-0.5 font-medium">Lainnya</span>
            </button>
          )}
        </div>
      </nav>

      {/* More Sheet — Admin Only */}
      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Menu Lainnya">
        <div className="grid grid-cols-3 gap-3">
          {moreMenus.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.path} to={item.path} onClick={() => setMoreOpen(false)}
                     className={({ isActive }) =>
                  `flex flex-col items-center gap-2 p-4 rounded-3xl transition-all ${isActive
                    ? "bg-white/10 text-pure-white"
                    : "bg-white/5 hover:bg-white/[0.07]"}`
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
