import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { CheckCircle, XCircle, AlertCircle, ChevronRight, Calendar, Bell, Clock, ArrowRight, LogOut, BookOpen, UserCheck, Star } from "lucide-react";
import { signOut } from "../../services/authService";
import ThemeToggle from "../../components/ThemeToggle";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [stats, setStats] = useState({ hadir: 0, izin: 0, sakit: 0, alpha: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const monthStart = new Date(); monthStart.setDate(1);
      const monthStr = monthStart.toISOString().split("T")[0];

      const [attRes, monthRes] = await Promise.all([
        supabase.from("attendance").select("*").eq("user_id", user.id).eq("date", today).maybeSingle(),
        supabase.from("attendance").select("attendance_status").eq("user_id", user.id).gte("date", monthStr),
      ]);

      setTodayAttendance(attRes.data);
      const s = { hadir: 0, izin: 0, sakit: 0, alpha: 0 };
      monthRes.data?.forEach(a => { const k = (a.attendance_status || "").toLowerCase(); if (s[k] !== undefined) s[k]++; });
      setStats(s);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const initials = (user?.full_name || user?.user_metadata?.full_name || user?.email || "U").split(" ").map(s => s[0]).join("").toUpperCase().slice(0, 2);
  const fullName = user?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const role = user?.role || user?.user_metadata?.role || "Pegawai";

  return (
    <div className="animate-fade-in relative w-full max-w-lg mx-auto flex flex-1 flex-col bg-[#161320] min-h-screen">
      {/* Hero */}
      <div className="relative h-44 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#BF00FF] via-[#660099] to-[#33004D]" />
        <div className="absolute inset-0 bg-black/20" />
      </div>

      <div className="px-6 pb-8 relative">
        {/* Avatar & Stats */}
        <div className="flex items-end -mt-12 mb-4 gap-5">
          <div className="w-24 h-24 rounded-full border-4 border-[#161320] bg-gray-800 shadow-xl overflow-hidden">
             <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-white bg-gradient-to-br from-violet-500 to-indigo-600">
               {initials}
             </div>
          </div>
          <div className="flex gap-6 mb-2">
            <div className="text-center"><div className="text-xl font-bold text-white">{stats.hadir + stats.izin + stats.sakit}</div><div className="text-xs text-white/60">Total</div></div>
            <div className="text-center"><div className="text-xl font-bold text-white">{stats.hadir}</div><div className="text-xs text-white/60">Hadir</div></div>
          </div>
        </div>

        {/* Profile Info */}
        <h2 className="text-2xl font-bold text-white">{fullName}</h2>
        <p className="text-[#adff2f] font-medium text-sm mb-6">{role}</p>
        
        {/* Actions */}
        <div className="flex gap-3 mb-6">
          <button onClick={() => navigate("/employee/profile")} className="flex-1 bg-white/5 border border-white/10 text-white text-xs py-3 rounded-2xl font-semibold">Edit Profil</button>
          <button onClick={() => navigate("/employee/attendance")} className="flex-1 bg-[#7c3aed] text-white text-xs py-3 rounded-2xl font-semibold shadow-lg shadow-violet-900/20">Absen Sekarang</button>
        </div>

        {/* Status */}
        <div className="bg-black/20 border border-white/5 p-4 rounded-2xl flex justify-between items-center text-sm text-white/70">
           <span>Status Hari Ini:</span>
           <span className="text-[#adff2f] font-bold flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-[#adff2f] animate-pulse"></div>
             {todayAttendance ? "Hadir" : "Belum Absen"}
           </span>
        </div>
      </div>
    </div>
  );
}