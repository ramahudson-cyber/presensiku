import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { LogOut, Calendar, AlertCircle, CheckCircle } from "lucide-react";
import { signOut } from "../../services/authService";

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

  const fullName = user?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const role = user?.role || user?.user_metadata?.role || "Pegawai";
  const initials = fullName.split(" ").map(s => s[0]).join("").toUpperCase().slice(0, 2);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Selamat Pagi," : hour < 18 ? "Selamat Siang," : "Selamat Malam,";

  const VevoxCard = ({ title, icon: Icon, children }) => (
    <div className="relative bg-[#161320] border border-violet-500/30 rounded-2xl overflow-hidden mb-5">
      <div className="absolute inset-0 bg-gradient-to-b from-violet-500/20 to-transparent h-1/2 pointer-events-none" />
      <div className="p-5 border-b border-violet-500/10 flex justify-between items-center relative">
        <h3 className="font-semibold text-white">{title}</h3>
        <div className="bg-violet-500/20 p-2 rounded-xl text-violet-300"><Icon size={18} /></div>
      </div>
      <div className="p-5 relative">{children}</div>
    </div>
  );

  return (
    <div className="w-full max-w-lg mx-auto bg-[#050505] min-h-screen text-white p-6">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-[70px] h-[70px] rounded-full bg-violet-600 flex items-center justify-center text-2xl font-bold border-4 border-white/10 shrink-0 shadow-lg">{initials}</div>
        <div>
          <div className="text-[13px] opacity-70 mb-[2px]">{greeting}</div>
          <div className="text-[18px] font-bold mb-[2px]">{fullName}</div>
          <div className="text-violet-400 text-[13px] font-medium">{role}</div>
        </div>
      </div>

      <VevoxCard title="Status Absensi" icon={CheckCircle}>
         <div className="flex items-center gap-3">
           <span className={`px-3 py-1 rounded-full text-xs font-bold ${todayAttendance ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
             ● {todayAttendance ? "Sudah Absen" : "Belum Absen"}
           </span>
           <span className="opacity-80 text-sm">{todayAttendance ? `Masuk: ${new Date(todayAttendance.clock_in_time).toLocaleTimeString("id-ID", {hour:"2-digit",minute:"2-digit"})}` : "Silakan absen segera"}</span>
         </div>
      </VevoxCard>

      <VevoxCard title="Rekap Bulan Ini" icon={Calendar}>
        <div className="grid grid-cols-2 gap-3">
           {[ {l:"Hadir",v:stats.hadir,c:"text-emerald-400"}, {l:"Izin",v:stats.izin,c:"text-amber-400"}, {l:"Sakit",v:stats.sakit,c:"text-blue-400"}, {l:"Alpha",v:stats.alpha,c:"text-rose-400"} ].map(i => (
             <div key={i.l} className="bg-black/20 p-3 rounded-xl text-center border border-white/5">
               <div className={`text-lg font-bold ${i.c}`}>{i.v}</div>
               <div className="text-[10px] text-slate-400 uppercase">{i.l}</div>
             </div>
           ))}
        </div>
      </VevoxCard>
      
      <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate("/employee/attendance")} className="bg-violet-600 p-4 rounded-2xl text-center text-sm font-bold hover:bg-violet-700 transition">Absen</button>
          <button onClick={() => navigate("/employee/history")} className="bg-white/10 p-4 rounded-2xl text-center text-sm font-bold hover:bg-white/20 transition">Riwayat</button>
      </div>
    </div>
  );
}