import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getAttendanceHistory } from "../../services/attendanceService";
import { useAuth } from "../../context/AuthContext";
import { CheckCircle, Calendar, PieChart, History, Megaphone, Clock, Sun, Moon } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const { darkMode, toggleTheme } = useTheme();
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
    <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-[#660099] border-t-transparent rounded-full animate-spin"></div>
        <div className="text-white/50 text-xs tracking-widest uppercase">Memuat...</div>
      </div>
    </div>
  );

  const now = new Date();
  const getStatusColor = (status) => {
    if (status === 'hadir' || status === 'tepat waktu') return 'text-emerald-400';
    if (status === 'terlambat') return 'text-amber-400';
    return 'text-white';
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    // If it's an ISO timestamp, convert from UTC to local WITA (Asia/Makassar)
    if (timeStr.includes('T')) {
      return new Date(timeStr).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Makassar",
      });
    }
    // Plain "HH:MM:SS" string — display as-is
    return timeStr.substring(0, 5);
  };

  return (
    <div className="min-h-screen w-full bg-transparent text-white font-sans absolute top-0 left-0 pb-24">
      <div className="hero-card-bg w-full p-8 pt-12 shadow-2xl border-b border-white/5 rounded-b-[40px]" style={{ background: 'linear-gradient(160deg, #BF40FF 0%, #6600CC 35%, #2B0066 65%, #000000 100%)' }}>
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center font-bold text-2xl">RH</div>
            <div className="flex-1">
              <div className="text-[11px] uppercase tracking-[0.2em] opacity-60">Selamat Pagi,</div>
              <div className="text-2xl font-bold">{user?.full_name || "Rama Hudson"}</div>
              <div className="text-xs opacity-70 mt-0.5">{user?.role || "Pegawai"}</div>
            </div>
            <button
              onClick={toggleTheme}
              className="relative w-11 h-11 rounded-xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-all duration-300 group shrink-0"
              aria-label="Toggle tema"
            >
              <Sun size={18} className={`absolute transition-all duration-500 ${darkMode ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'}`} />
              <Moon size={18} className={`absolute transition-all duration-500 ${darkMode ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'}`} />
            </button>
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
                    <div className={`text-[10px] font-medium ${getStatusColor(todayAttendance.attendance_status)}`}>{todayAttendance.attendance_status || 'Tepat Waktu'}</div>
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
          <div className="grid grid-cols-[1fr_55px_55px_90px] gap-3 mb-2 text-[9px] uppercase tracking-wider opacity-40">
            <div>Tanggal</div>
            <div className="text-center">Masuk</div>
            <div className="text-center">Pulang</div>
            <div className="text-right">Status</div>
          </div>
          <div className="space-y-1">
            {attendanceHistory.length > 0 ? attendanceHistory.slice(0, 5).map(att => (
              <div key={att.id} className="grid grid-cols-[1fr_55px_55px_90px] gap-3 items-center bg-white/5 -mx-6 px-6 py-3">
                <div>
                  <div className="text-xs font-semibold">
                    {new Date(att.date).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div className="text-[10px] opacity-40 capitalize">Shift</div>
                </div>
                <div className="text-center text-xs font-medium tabular-nums">{formatTime(att.clock_in_time)}</div>
                <div className="text-center text-xs font-medium tabular-nums">{formatTime(att.clock_out_time)}</div>
                <div className={`text-right text-xs font-bold uppercase px-2 py-1 rounded-full whitespace-nowrap justify-self-end ${
                  att.attendance_status === 'terlambat' ? 'bg-amber-400/15 text-amber-400' :
                  att.attendance_status === 'hadir' ? 'bg-emerald-400/15 text-emerald-400' :
                  'bg-white/10 opacity-80'
                }`}>
                  {att.attendance_status}
                </div>
              </div>
            )) : <div className="text-xs opacity-60 text-center py-6">Belum ada riwayat.</div>}
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
