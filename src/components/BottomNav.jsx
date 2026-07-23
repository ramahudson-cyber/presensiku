import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  LayoutDashboard, CalendarDays, History,
  MoreHorizontal, FingerprintPattern, User,
} from "lucide-react";
import { useState } from "react";
import BottomSheet from "./BottomSheet";

export default function BottomNav({ hidden = false }) {
  const { user } = useAuth();
  const { darkMode } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);
  const userRole = user?.role || "pegawai";

  if (hidden) return null;

  const pegawaiMenus = [
    { path: "/employee", label: "Home", icon: LayoutDashboard, end: true },
    { path: "/employee/profile", label: "Profil", icon: User },
    { path: "/employee/schedule", label: "Jadwal", icon: CalendarDays },
    { path: "/employee/history", label: "Riwayat", icon: History },
  ];

  const adminMain = [
    { path: "/admin", label: "Home", icon: LayoutDashboard, end: true },
    { path: "/admin/employees", label: "Pegawai", icon: History }, // Simplified for brevity
  ];

  const mainMenus = userRole === "pegawai" ? pegawaiMenus : adminMain;
  const centerPath = userRole === "pegawai" ? "/employee/attendance" : "/admin/attendance";

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-[85px] px-6 flex items-center justify-between"
           style={{
             background: darkMode ? "linear-gradient(180deg, rgba(22, 19, 32, 0.95), rgba(10, 5, 20, 0.98))" : "rgba(255,255,255,0.98)",
             backdropFilter: "blur(20px)",
             borderTop: darkMode ? "1px solid rgba(255,255,255,0.1)" : "1px solid #e2e8f0"
           }}>
        
        {/* Left Group */}
        <div className="flex items-center gap-6">
          {mainMenus.slice(0, 2).map(item => (
            <NavLink key={item.path} to={item.path} end={item.end} className={({isActive}) => `flex flex-col items-center gap-1 ${isActive ? "text-electric-violet" : "text-slate-400"}`}>
              <item.icon size={22} />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </NavLink>
          ))}
        </div>

        {/* Center Floating Button */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-6">
          <NavLink to={centerPath} className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
                   style={{ background: "linear-gradient(135deg, #BF00FF, #6366f1)" }}>
            <FingerprintPattern size={24} className="text-white" />
          </NavLink>
        </div>

        {/* Right Group */}
        <div className="flex items-center gap-6">
          {mainMenus.slice(2).map(item => (
            <NavLink key={item.path} to={item.path} end={item.end} className={({isActive}) => `flex flex-col items-center gap-1 ${isActive ? "text-electric-violet" : "text-slate-400"}`}>
              <item.icon size={22} />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
