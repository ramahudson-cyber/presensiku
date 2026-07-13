import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getAttendanceHistory } from "../../services/attendanceService";
import { useAuth } from "../../context/AuthContext";
import {
  CheckCircle, XCircle, AlertCircle, Calendar, Clock, BarChart3, History, Bell, Settings, LogOut
} from "lucide-react";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [stats, setStats] = useState({ hadir: 0, izin: 0, sakit: 0, alpha: 0 });
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data: att } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();
      setTodayAttendance(att);

      const monthStart = new Date();
      monthStart.setDate(1);
      const { data: monthData } = await supabase
        .from("attendance")
        .select("attendance_status")
        .eq("user_id", user.id)
        .gte("date", monthStart.toISOString().split("T")[0]);

      const s = { hadir: 0, izin: 0, sakit: 0, alpha: 0 };
      monthData?.forEach(a => { if (s[a.attendance_status] !== undefined) s[a.attendance_status]++; });
      setStats(s);

      const { data: ann } = await supabase
        .from("announcements")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(3);
      setAnnouncements(ann || []);

      const history = await getAttendanceHistory(user.id);
      setAttendanceHistory(history);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-[#060311] text-white">Loading...</div>;

  const now = new Date();
  return (
    <div className="min-h-screen bg-[#060311] text-white p-5 font-sans">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#660099] to-[#060311] rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/10 border border-white/10 flex items-center justify-center font-bold text-xl">RH</div>
              <div>
                <div className="text-[10px] uppercase tracking-widest opacity-60">Selamat Pagi,</div>
                <div className="text-xl font-bold">{user?.full_name || "Rama Hudson"}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Bell size={20} className="opacity-60" />
              <Settings size={20} className="opacity-60" />
              <LogOut size={20} className="opacity-60" />
            </div>
          </div>
          <div className="pt-4 border-t border-white/10 flex justify-between items-center">
            <div>
              <div className="text-2xl font-semibold">{now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</div>
              <div className="text-xs opacity-50">{now.toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
            <Link to="/employee/attendance" className="bg-white/5 px-5 py-2.5 rounded-full text-xs font-bold border border-white/10">Absen</Link>
          </div>
        </div>

        {/* Status Card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/5 rounded-3xl p-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 mb-4">Status Hari Ini</div>
          {todayAttendance ? (
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400"><CheckCircle size={24}/></div>
              <div>
                <div className="font-bold">Sudah Absen</div>
                <div className="text-xs opacity-60">Masuk: {new Date(todayAttendance.clock_in_time).toLocaleTimeString("id-ID", {hour:"2-digit",minute:"2-digit"})}</div>
              </div>
            </div>
          ) : (
            <div className="text-sm opacity-60">Belum melakukan absensi hari ini.</div>
          )}
        </div>

        {/* Stats */}
        <div className="bg-white/5 backdrop-blur-md border border-white/5 rounded-3xl p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">Statistik Bulan Ini</div>
            <BarChart3 size={16} className="text-[#BF00FF]"/>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[ {v:stats.hadir, l:'Hadir'}, {v:stats.izin, l:'Izin'}, {v:stats.sakit, l:'Sakit'}, {v:stats.alpha, l:'Alpha'} ].map((s,i) => (
              <div key={i} className="bg-white/5 rounded-2xl p-3 text-center">
                <div className="text-xl font-light">{s.v}</div>
                <div className="text-[8px] uppercase tracking-wider opacity-50">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* History */}
        <div className="bg-white/5 backdrop-blur-md border border-white/5 rounded-3xl p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">Riwayat Absensi</div>
            <History size={16} className="text-[#BF00FF]"/>
          </div>
          <div className="space-y-4">
            {attendanceHistory.slice(0, 3).map(att => (
              <div key={att.id} className="flex justify-between items-center text-sm">
                <div>
                  <div className="text-xs">{new Date(att.date).toLocaleDateString("id-ID", { day: 'numeric', month: 'long' })}</div>
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-50">{att.attendance_status}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
