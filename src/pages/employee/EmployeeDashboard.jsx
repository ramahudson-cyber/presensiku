import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { CheckCircle, XCircle, AlertCircle, Bell, LogOut } from "lucide-react";
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

  return (
    <div className="relative w-full max-w-lg mx-auto min-h-screen bg-[#0a0e1a] text-white p-6">
      {/* Ambient Glows */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-violet-600/20 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] translate-x-1/2 translate-y-1/2 pointer-events-none" />

      {/* Header */}
      <div className="flex justify-between items-center mb-8 relative z-10">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center font-bold shadow-lg">
             {fullName.substring(0,2).toUpperCase()}
           </div>
           <div>
             <h1 className="font-bold text-lg">{fullName}</h1>
             <p className="text-xs text-slate-400">{role}</p>
           </div>
        </div>
        <button onClick={() => signOut()} className="p-2 bg-white/5 rounded-full border border-white/10"><LogOut size={18}/></button>
      </div>

      {/* Content Card */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative z-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Status Hari Ini</h2>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${todayAttendance ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
            {todayAttendance ? "Hadir" : "Belum Absen"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
           {[ {l:"Hadir",v:stats.hadir,c:"text-emerald-400"}, {l:"Izin",v:stats.izin,c:"text-amber-400"}, {l:"Sakit",v:stats.sakit,c:"text-blue-400"}, {l:"Alpha",v:stats.alpha,c:"text-rose-400"} ].map(i => (
             <div key={i.l} className="bg-black/20 p-4 rounded-2xl border border-white/5 text-center">
               <div className={`text-xl font-bold ${i.c}`}>{i.v}</div>
               <div className="text-[10px] text-slate-400 uppercase">{i.l}</div>
             </div>
           ))}
        </div>

        <Link to="/employee/attendance" className="block w-full py-4 bg-emerald-500 hover:bg-emerald-600 rounded-2xl text-center font-bold text-sm transition-all">
          {todayAttendance ? "Lihat Absensi" : "Absen Sekarang"}
        </Link>
      </div>
    </div>
  );
}