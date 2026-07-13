import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getAttendanceHistory } from "../../services/attendanceService";
import { useAuth } from "../../context/AuthContext";
import { CheckCircle, PieChart, History, Megaphone, Clock, Calendar } from "lucide-react";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [stats, setStats] = useState({ hadir: 0, izin: 0, sakit: 0, alpha: 0 });
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data: att } = await supabase.from("attendance").select("*").eq("user_id", user.id).eq("date", today).maybeSingle();
      setTodayAttendance(att);
      const monthStart = new Date(); monthStart.setDate(1);
      const { data: monthData } = await supabase.from("attendance").select("attendance_status").eq("user_id", user.id).gte("date", monthStart.toISOString().split("T")[0]);
      const s = { hadir: 0, izin: 0, sakit: 0, alpha: 0 };
      monthData?.forEach(a => { if (s[a.attendance_status] !== undefined) s[a.attendance_status]++; });
      setStats(s);
      const { data: ann } = await supabase.from("announcements").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(3);
      setAnnouncements(ann || []);
      setAttendanceHistory(await getAttendanceHistory(user.id));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-[#060311] text-white">Loading...</div>;

  const now = new Date();
  return (
    <div className="min-h-screen w-full bg-[#060311] text-white font-sans absolute top-0 left-0 pb-24">
      {/* Hero */}
      <div className="w-full bg-gradient-to-br from-[#660099] to-[#060311] p-8 pt-12 shadow-2xl border-b border-white/5 rounded-b-[40px]">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center font-bold text-2xl">RH</div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] opacity-60">Selamat Pagi,</div>
              <div className="text-2xl font-bold">{user?.full_name || "Rama Hudson"}</div>
            </div>
          </div>
          <div className="flex justify-between items-end">
            <div>
              <div className="text-4xl font-bold">{now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</div>
              <div className="text-xs opacity-50 mt-1">{now.toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
            <Link to="/employee/attendance" className="bg-white text-[#660099] px-8 py-3 rounded-xl font-bold text-sm">Absen</Link>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto space-y-6 p-4 mt-6">
        {/* Status */}
        <div className="bg-white/5 backdrop-blur-md border border-white/5 rounded-3xl p-6 relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#BF00FF] to-transparent rounded-t-3xl"></div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 mb-4 flex justify-between">Status Hari Ini <Clock size={14}/></div>
          {todayAttendance ? (
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400"><CheckCircle size={24}/></div>
              <div>
                <div className="font-bold text-sm">Sudah Absen</div>
                <div className="text-[10px] opacity-60">Masuk: {new Date(todayAttendance.clock_in_time).toLocaleTimeString("id-ID", {hour:"2-digit",minute:"2-digit"})}</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="p-3 bg-violet-500/10 rounded-2xl text-violet-400"><Calendar size={24}/></div>
              <div className="text-sm opacity-60">Belum melakukan absensi hari ini.</div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="bg-white/5 backdrop-blur-md border border-white/5 rounded-3xl p-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 mb-6 flex justify-between">Statistik Bulan Ini <PieChart size={14}/></div>
          <div className="grid grid-cols-4 gap-2">
            {[ {v:stats.hadir, l:'Hadir'}, {v:stats.izin, l:'Izin'}, {v:stats.sakit, l:'Sakit'}, {v:stats.alpha, l:'Alpha'} ].map((s,i) => (
              <div key={i} className="bg-white/5 rounded-2xl p-3 text-center border border-white/5">
                <div className="text-xl font-light">{s.v}</div>
                <div className="text-[8px] uppercase tracking-wider opacity-50">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Riwayat */}
        <div className="bg-white/5 backdrop-blur-md border border-white/5 rounded-3xl p-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 mb-4 flex justify-between">Riwayat Absensi <History size={14}/></div>
          <div className="space-y-3">
            {attendanceHistory.length > 0 ? attendanceHistory.slice(0, 3).map(att => (
              <div key={att.id} className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                <div className="text-xs">{new Date(att.date).toLocaleDateString("id-ID", { day: 'numeric', month: 'short' })}</div>
                <div className="text-[10px] font-bold uppercase opacity-60 bg-white/5 px-2 py-1 rounded">{att.attendance_status}</div>
              </div>
            )) : <div className="text-xs opacity-60">Belum ada riwayat.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
