import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getAttendanceHistory } from "../../services/attendanceService";
import { useAuth } from "../../context/AuthContext";
import { CheckCircle, Calendar, PieChart, History, Megaphone, Clock } from "lucide-react";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [stats, setStats] = useState({ hadir: 0, izin: 0, sakit: 0, alpha: 0 });
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shift, setShift] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const today = new Date().toLocaleString("sv-SE", {timeZone: "Asia/Makassar"}).split(" ")[0];
      const { data: att } = await supabase.from("attendance").select("*").eq("user_id", user.id).eq("date", today).maybeSingle();
      setTodayAttendance(att);
      
      const { data: shiftData } = await supabase.from("employee_schedules").select("shift_code").eq("user_id", user.id).eq("date", today).maybeSingle();
      setShift(shiftData?.shift_code || "N/A");

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

  if (loading) return (
    <div className="fixed inset-0 bg-[#060311] flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-[#660099] border-t-transparent rounded-full animate-spin"></div>
        <div className="text-white/50 text-xs tracking-widest uppercase">Memuat...</div>
      </div>
    </div>
  );

  const now = new Date();
  const getStatusColor = (status) => {
    if (status === 'tepat waktu') return 'text-emerald-400';
    if (status === 'terlambat') return 'text-amber-400';
    return 'text-white';
  };

  const formatTime = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="min-h-screen w-full bg-[#060311] text-white font-sans absolute top-0 left-0 pb-24">
      <div className="w-full bg-gradient-to-br from-[#660099] to-[#060311] p-8 pt-12 shadow-2xl border-b border-white/5 rounded-b-[40px]">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center font-bold text-2xl">RH</div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] opacity-60">Selamat Pagi,</div>
              <div className="text-2xl font-bold">{user?.full_name || "Rama Hudson"}</div>
              <div className="text-xs opacity-70 mt-0.5">{user?.role || "Pegawai"}</div>
            </div>
          </div>
          <div className="flex justify-between items-end">
            <div>
              <div className="text-4xl font-bold">{now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</div>
              <div className="text-xs opacity-50 mt-1">{now.toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
              <div className="text-[10px] mt-2 bg-white/10 px-2 py-0.5 rounded inline-block font-semibold">Shift: {shift}</div>
            </div>
            <Link to="/employee/attendance" className="bg-white text-[#660099] px-8 py-3 rounded-xl font-bold text-sm">Absen</Link>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto space-y-6 p-4 mt-6">
        <div className="bg-white/5 backdrop-blur-md border border-white/5 rounded-3xl p-6 relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#BF00FF] to-transparent rounded-t-3xl"></div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 mb-4 flex justify-between">Status Hari Ini <Clock size={14}/></div>
          
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1">
                <div className="text-[10px] opacity-60 uppercase">Masuk</div>
                {todayAttendance?.clock_in_time ? (
                  <>
                    <div className="font-bold text-sm">{formatTime(todayAttendance.clock_in_time)}</div>
                    <div className={`text-[10px] font-medium ${getStatusColor(todayAttendance.check_in_status)}`}>{todayAttendance.check_in_status || 'Tepat Waktu'}</div>
                  </>
                ) : <div className="text-xs opacity-40">--:--</div>}
             </div>
             <div className="space-y-1">
                <div className="text-[10px] opacity-60 uppercase">Pulang</div>
                {todayAttendance?.clock_out_time ? (
                  <>
                    <div className="font-bold text-sm">{formatTime(todayAttendance.clock_out_time)}</div>
                    <div className="text-[10px] text-emerald-400 font-medium">Selesai</div>
                  </>
                ) : <div className="text-xs opacity-40">Belum Absen</div>}
             </div>
          </div>
        </div>

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

        <div className="bg-white/5 backdrop-blur-md border border-white/5 rounded-3xl p-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 mb-4 flex justify-between">Riwayat Absensi <History size={14}/></div>
          <div className="grid grid-cols-4 gap-2 text-[9px] uppercase tracking-wider opacity-40 mb-3 px-1">
              <div className="col-span-1">Tanggal</div>
              <div className="text-center">Masuk</div>
              <div className="text-center">Pulang</div>
              <div className="text-right">Status</div>
          </div>
          <div className="space-y-3">
            {attendanceHistory.length > 0 ? attendanceHistory.slice(0, 3).map(att => (
              <div key={att.id} className="grid grid-cols-4 gap-2 items-center text-[10px] bg-white/5 p-3 rounded-2xl">
                <div className="font-medium text-[9px] leading-tight">
                  {new Date(att.date).toLocaleDateString("id-ID", { day: 'numeric', month: 'short' })}
                  <span className="block opacity-40 capitalize">Shift Pagi</span>
                </div>
                <div className="text-center">{att.clock_in_time ? att.clock_in_time.substring(0, 5) : '-'}</div>
                <div className="text-center">{att.clock_out_time ? att.clock_out_time.substring(0, 5) : '-'}</div>
                <div className="text-right font-bold uppercase opacity-80 truncate">{att.attendance_status}</div>
              </div>
            )) : <div className="text-xs opacity-60 text-center py-4">Belum ada riwayat.</div>}
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/5 rounded-3xl p-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 mb-4 flex justify-between">Pengumuman <Megaphone size={14}/></div>
          <div className="space-y-3">
            {announcements.length > 0 ? announcements.map(a => (
              <div key={a.id} className="p-3 bg-white/5 rounded-2xl">
                <div className="text-sm font-semibold">{a.title}</div>
                <div className="text-xs opacity-60 mt-1">{a.content}</div>
              </div>
            )) : <div className="text-xs opacity-60">Tidak ada pengumuman.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
