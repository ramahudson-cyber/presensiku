import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getAttendanceHistory } from "../../services/attendanceService";
import { useAuth } from "../../context/AuthContext";
import { CheckCircle, Calendar, PieChart, History, Megaphone, Clock, Sun, Sunset, Moon, ArrowRight } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(label || `Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

const SHIFT_NAMES = { PG:'PAGI', SR:'SORE', SI:'SIANG', ML:'MALAM' };
const getShiftName = (code) => SHIFT_NAMES[code] || (code || 'Shift').toUpperCase();

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const { darkMode, toggleTheme } = useTheme();
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [stats, setStats] = useState({ hadir: 0, izin: 0, sakit: 0, alpha: 0, jadwalCount: 0 });
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [shift, setShift] = useState(null);
	const [serverTime, setServerTime] = useState(new Date());
	const getGreeting = (h) => {
	  if (h >= 3 && h < 12) return "Selamat Pagi";
	  if (h >= 12 && h < 15) return "Selamat Siang";
	  if (h >= 15 && h < 18) return "Selamat Sore";
	  return "Selamat Malam";
	};

  useEffect(() => { fetchData(); }, []);

  const retryFetchData = () => {
    setFetchError(null);
    setLoading(true);
    fetchData();
  };

  useEffect(() => {
    const id = setInterval(() => {
      setServerTime(prev => new Date(prev.getTime() + 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const fetchData = async () => {
    try {
      const today = new Date().toLocaleString("sv-SE", {timeZone: "Asia/Makassar"}).split(" ")[0];
      const monthStart = new Date(); monthStart.setDate(1);
      const monthStartStr = monthStart.toISOString().split("T")[0];
      const year = monthStart.getFullYear();
      const month = String(monthStart.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, monthStart.getMonth() + 1, 0).getDate();
      const monthEndStr = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

      // Parallel: all independent queries (timeout 20s)
      const [stRes, attRes, shiftRes, schedRes, monthAttRes, annRes, histRes] = await withTimeout(Promise.all([
        supabase.rpc('get_server_time'),
        supabase.from("attendance").select("*").eq("user_id", user.id).eq("date", today).maybeSingle(),
        supabase.from("employee_schedules").select("shift_code").eq("user_id", user.id).eq("date", today).maybeSingle(),
        supabase.from("employee_schedules").select("date, shift_code").eq("user_id", user.id).gte("date", monthStartStr).lte("date", monthEndStr),
        supabase.from("attendance").select("attendance_status").eq("user_id", user.id).gte("date", monthStartStr),
        supabase.from("announcements").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(3),
        getAttendanceHistory(user.id),
      ]), 20000, "fetchAll");

      // Server time
      if (stRes.data) setServerTime(new Date(stRes.data));

      // Today attendance
      setTodayAttendance(attRes.data);

      // Shift
      setShift(shiftRes.data?.shift_code ? getShiftName(shiftRes.data.shift_code) : "N/A");

      // Month attendance stats
      const s = { hadir: 0, izin: 0, sakit: 0, alpha: 0 };
      monthAttRes.data?.forEach(a => {
        const st = a.attendance_status === 'terlambat' ? 'hadir' : a.attendance_status;
        if (s[st] !== undefined) s[st]++;
      });

      // Jadwal count: 2 queries instead of N+1 loop
      let jadwalCount = 0;
      let alphaCount = 0;
      const today = new Date().toISOString().split("T")[0];
      const schedules = schedRes.data || [];
      const attendance = monthAttRes.data || [];
      const shiftCodes = [...new Set(schedules.map(s => s.shift_code).filter(Boolean))];
      let shiftSchedulesData = [];
      if (shiftCodes.length > 0) {
        const { data: ssData } = await withTimeout(supabase
          .from("shift_schedules")
          .select("shift_code, day_of_week, is_working_day")
          .in("shift_code", shiftCodes), 10000, "shiftSchedules");
        shiftSchedulesData = ssData || [];
      }
      schedules.forEach(sch => {
        if (sch.shift_code) {
          const dateObj = new Date(sch.date + 'T00:00:00');
          const dayOfWeek = (dateObj.getDay() + 6) % 7;
          const shiftSch = shiftSchedulesData.find(ss => ss.shift_code === sch.shift_code && ss.day_of_week === dayOfWeek);
          if (shiftSch?.is_working_day) {
            jadwalCount++;
            // Check if past date and no attendance
            if (sch.date <= today) {
              const hasAttendance = attendance.some(a => a.date === sch.date);
              if (!hasAttendance) alphaCount++;
            }
          }
        }
      });

      setStats({ ...s, alpha: alphaCount, jadwalCount });
      setAnnouncements(annRes.data || []);
      setAttendanceHistory(histRes || []);
    } catch (e) {
      console.error(e);
      setFetchError(e.message?.includes('Timeout') ? 'Koneksi lambat. Coba lagi.' : 'Gagal memuat data. Periksa koneksi.');
    } finally { setLoading(false); }
  };

  if (loading) return (
    <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-3">
        {fetchError ? (
          <>
            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mb-1">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="text-red-400 text-xs font-medium text-center max-w-[200px]">{fetchError}</div>
            <button onClick={retryFetchData}
              className="mt-3 px-6 py-2 bg-[#660099] hover:bg-[#7a00b5] text-white text-xs font-semibold rounded-full transition-all duration-200">
              Coba Lagi
            </button>
          </>
        ) : (
          <>
            <div className="w-10 h-10 border-4 border-[#660099] border-t-transparent rounded-full animate-spin"></div>
            <div className="text-white/50 text-xs tracking-widest uppercase">Memuat...</div>
          </>
        )}
      </div>
    </div>
  );

  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    if (timeStr.includes('T')) {
      return new Date(timeStr).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" });
    }
    return timeStr.substring(0, 5);
  };

  return (
    <div className="min-h-screen w-full bg-transparent text-white font-sans absolute top-0 left-0 pb-24">
      <div className="hero-card-bg w-full p-8 pt-12 shadow-2xl border-b border-white/5 rounded-b-[40px]" style={{ background: 'linear-gradient(160deg, #BF40FF 0%, #6600CC 35%, #2B0066 65%, #000000 100%)' }}>
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-8">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-16 h-16 rounded-2xl object-cover border border-white/20" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center font-bold text-2xl text-white">
                {user?.full_name?.charAt(0)?.toUpperCase() || "R"}
              </div>
            )}
            <div className="flex-1">
              <div className="text-[11px] uppercase tracking-[0.2em] opacity-60 text-white">{getGreeting(serverTime.getHours())},</div>
              <div className="text-2xl font-bold text-white">{user?.full_name || "Rama Hudson"}</div>
              <div className="text-xs opacity-70 mt-0.5 text-white">{user?.role || "Pegawai"}</div>
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
              <div className="text-4xl font-bold text-white">{serverTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</div>
              <div className="text-xs opacity-50 mt-1 text-white">{serverTime.toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
              <div className="text-[9px] mt-2 bg-white/10 px-2 py-0.5 rounded inline-block font-semibold text-white">SHIFT: {shift.toUpperCase()}</div>
            </div>
            <Link to="/employee/attendance" className="bg-white text-[#660099] px-8 py-3 rounded-xl font-bold text-sm flex items-center gap-2">
              Absen <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto space-y-6 p-4 mt-6">
        {/* SECTION TITLE: Status hari ini */}
        <div className="px-4 flex items-center gap-3 mb-4">
          <div className="w-8 h-8 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#BF00FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className="pt-0.5">
            <div className="text-lg font-extrabold tracking-tight text-white">Status hari ini</div>
            <div className="text-[10px] text-black/50 dark:text-white/35 mt-0.5 font-normal">Pantau waktu kehadiran anda</div>
          </div>
        </div>

        {/* 2 CARDS: MASUK & PULANG */}
        <div className="grid grid-cols-2 gap-3">
          {/* MASUK — Purple Gradient */}
          <div className="dashboard-status-masuk bg-gradient-to-br from-electric-violet to-deep-indigo rounded-3xl p-5 relative overflow-hidden shadow-lg shadow-electric-violet/25 text-white">
            <div className="text-[9px] uppercase tracking-[0.2em] opacity-70 font-semibold mb-3 flex items-center gap-1.5">
              <Sun size={13} /> Masuk
            </div>
            {todayAttendance?.clock_in_time ? (
              <>
                <div className="text-[28px] font-extrabold leading-none tracking-tight mb-2">
                  {formatTime(todayAttendance.clock_in_time)}
                </div>
                {todayAttendance.is_late ? (
                  <div className="badge-simple">
                    <span className="badge-simple-label">Terlambat</span>
                    <span className="badge-simple-time">{todayAttendance.late_minutes} menit</span>
                  </div>
                ) : (
                  <div className="badge-simple">
                    <span className="badge-simple-label">Tepat Waktu</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="text-base font-bold leading-none mb-2" style={{ color: '#FFFFFF' }}>Belum Absen</div>
                <div className="text-[20px] font-bold leading-none opacity-50 mb-2">--:--</div>
                <div className="inline-flex items-center gap-1.5 text-[9px] font-semibold bg-white/10 px-2.5 py-1 rounded-full opacity-50">—</div>
              </>
            )}
          </div>

          {/* PULANG — Green-Yellow Gradient */}
          <div className="bg-gradient-to-br from-green-yellow to-[#85c600] rounded-3xl p-5 relative overflow-hidden shadow-lg shadow-green-500/20" style={{ color: '#000000' }}>
            <div className="text-[9px] uppercase tracking-[0.2em] opacity-60 font-semibold mb-3 flex items-center gap-1.5">
              <Sunset size={13} /> Pulang
            </div>
            {todayAttendance?.clock_out_time ? (
              <>
                <div className="text-[28px] font-extrabold leading-none tracking-tight mb-2">
                  {formatTime(todayAttendance.clock_out_time)}
                </div>
                <div className="inline-flex items-center gap-1.5 text-[9px] font-semibold bg-black/10 backdrop-blur-sm px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Selesai
                </div>
              </>
            ) : (
              <>
                <div className="text-base font-bold leading-none text-black mb-2">Belum Absen</div>
                <div className="inline-flex items-center gap-1.5 text-[9px] font-semibold bg-black/5 px-2.5 py-1 rounded-full opacity-40">—</div>
              </>
            )}
          </div>
        </div>

        {/* STATS CARD — DONUT + RINGKASAN (match history page) */}
        <div className="rounded-3xl p-5 relative overflow-hidden border transition-all duration-500"
          style={{ background: darkMode ? 'rgba(30,30,50,0.6)' : 'rgba(255,255,255,0.05)', borderColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.05)', boxShadow: darkMode ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.08)', backdropFilter: 'blur(20px)' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-1 pt-1 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-1 h-4 rounded-full shrink-0"
                style={{ background: "linear-gradient(180deg, #BF00FF, #3B82F6)" }} />
              <span className={`text-xs font-bold tracking-wide ${darkMode ? 'text-white' : 'text-gray-900'}`}>Ringkasan Kehadiran</span>
            </div>
            <span className="text-[10px] font-medium" style={{ color: darkMode ? "#9ba1ae" : "#6b7280" }}>
              {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
            </span>
          </div>

          {/* Donut */}
          {(() => {
            const c = 2 * Math.PI * 42;
            const pct = stats.jadwalCount > 0 ? Math.round((stats.hadir / stats.jadwalCount) * 100) : 0;
            const offset = c - (pct / 100) * c;
            return (
              <div className="flex items-center justify-center gap-5 px-0 pt-1 pb-2">
                <div className="relative w-[100px] h-[100px] shrink-0">
                  <svg width="100" height="100" viewBox="0 0 100 100">
                    <defs>
                      <linearGradient id="dgd" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#BF00FF"/>
                        <stop offset="100%" stopColor="#7066ed"/>
                      </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="42" fill="none" stroke={darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)"} strokeWidth="8"/>
                    <circle cx="50" cy="50" r="42" fill="none" stroke="url(#dgd)" strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={c}
                      strokeDashoffset={offset}
                      transform="rotate(-90, 50, 50)"
                      style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[22px] font-extrabold leading-none"
                      style={{ fontFamily: "'Urbanist', sans-serif", color: darkMode ? "#FFFFFF" : "#111827" }}>{pct}%</span>
                    <span className="text-[7px] font-medium uppercase tracking-[0.5px] mt-0.5" style={{ color: darkMode ? "#9ba1ae" : "#4b5563" }}>Hadir</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-[11px] font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Kehadiran Bulan Ini</div>
                  <div className="text-[9px] mt-0.5" style={{ color: darkMode ? "#9ba1ae" : "#6b7280" }}>
                    <span className="font-semibold">{stats.hadir}</span> hari hadir dari <span className="font-semibold">{stats.jadwalCount}</span> hari kerja
                  </div>
                  <div className="flex gap-3 mt-2.5">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: "linear-gradient(135deg, #BF00FF, #7066ed)" }} />
                      <span className="text-[8px]" style={{ color: darkMode ? "#9ba1ae" : "#6b7280" }}>Hadir</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.15)" }} />
                      <span className="text-[8px]" style={{ color: darkMode ? "#9ba1ae" : "#6b7280" }}>Alpha</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Divider */}
          <div className={`mx-0 my-2 h-px ${darkMode ? 'border-white/5' : 'border-gray-100'}`} />

          {/* Stat rows */}
          <div className="px-0 pb-1 pt-0.5">
            {[
              { label:'Hadir', desc:'Kehadiran tepat waktu', v:stats.hadir, color:'#ADFF2F' },
              { label:'Izin', desc:'Diluar tanggung jawab', v:stats.izin, color:'#fbbf24' },
              { label:'Sakit', desc:'Tidak hadir karena sakit', v:stats.sakit, color:'#fb923c' },
              { label:'Alpha', desc:'Tanpa keterangan', v:stats.alpha, color:'#f87171' },
            ].map(item => {
              const active = item.v > 0;
              return (
                <div key={item.label}
                  className="flex items-center gap-3 rounded-xl px-4 py-3.5 transition-all duration-300 hover:translate-x-1"
                  style={{
                    background: active ? `linear-gradient(90deg, ${item.color}08, transparent)` : "transparent",
                    borderLeft: `2px solid ${active ? "transparent" : item.color}33`,
                    opacity: active ? 1 : 0.5,
                    boxShadow: darkMode ? "0 1px 3px rgba(0,0,0,0.3)" : "0 1px 3px rgba(0,0,0,0.06)",
                  }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#BF00FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {item.label === "Hadir" && <polyline points="20 6 9 17 4 12"/>}
                      {item.label === "Izin" && <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
                      {item.label === "Sakit" && <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>}
                      {item.label === "Alpha" && <><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></>}
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{item.label}</div>
                    <div className="text-[9px]" style={{ color: darkMode ? "#9ba1ae" : "#6b7280" }}>{item.desc}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-xl font-medium tabular-nums ${darkMode ? 'text-white' : 'text-gray-900'}`}>{item.v}</div>
                    <div className="text-[9px] font-medium" style={{ color: darkMode ? "#9ba1ae" : "#6b7280" }}>{item.v} dari {stats.jadwalCount} hari</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className={`border-t ${darkMode ? 'border-white/5' : 'border-gray-100'} flex items-center justify-between pt-3 mt-1`}>
            <span className="text-[9px] font-medium" style={{ color: darkMode ? "#9ba1ae" : "#6b7280" }}>
              Periode: 1 — {new Date().getDate() > 0 ? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() : 31} {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
            </span>
            <span className="text-[9px] font-medium tabular-nums" style={{ color: darkMode ? "#9ba1ae" : "#6b7280" }}>
              {stats.hadir} dari {stats.jadwalCount} hari kerja
            </span>
          </div>
        </div>

        {/* HISTORY CARD — GLASSMORPHISM PREMIUM */}
        <div className="rounded-3xl p-5 relative overflow-hidden border transition-all duration-500"
          style={{ background: darkMode ? 'rgba(30,30,50,0.6)' : 'rgba(255,255,255,0.05)', borderColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.05)', boxShadow: darkMode ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.08)', backdropFilter: 'blur(20px)' }}>
          {/* Card Header */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, #BF00FF, #3B82F6)' }} />
              <h3 className={`text-sm font-bold tracking-wide ${darkMode ? 'text-white' : 'text-gray-900'}`}>Riwayat Absensi</h3>
            </div>
            <Link to="/employee/history" className="flex items-center gap-1 text-[10px] font-semibold text-[#BF00FF] hover:underline">
              Lihat Semua <History size={14} />
            </Link>
          </div>

          {/* Header Labels */}
          <div className="grid grid-cols-[1fr_55px_55px_90px] gap-3 mb-2 text-[9px] uppercase tracking-wider font-bold">
            <div className={darkMode ? 'text-white/60' : 'text-gray-500'}>Tanggal</div>
            <div className={`text-center ${darkMode ? 'text-white/60' : 'text-gray-500'}`}>Masuk</div>
            <div className={`text-center ${darkMode ? 'text-white/60' : 'text-gray-500'}`}>Pulang</div>
            <div className={`text-right ${darkMode ? 'text-white/60' : 'text-gray-500'}`}>Status</div>
          </div>

          {/* History Items */}
          <div className="space-y-0.5">
            {attendanceHistory.length > 0 ? (() => {
              const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
              return attendanceHistory.filter(att => new Date(att.date) >= weekAgo);
            })().map(att => {
              const isHadir = att.attendance_status === 'hadir' || att.attendance_status === 'terlambat';
              return (
                <div key={att.id}
                  className="grid grid-cols-[1fr_55px_55px_90px] gap-3 items-center py-1.5 transition-all duration-200 hover:translate-x-1 border-b last:border-0 border-white/5">
                  <div className="text-left min-w-0">
                    <div className={`text-[10.5px] font-bold truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {new Date(att.date).toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'short' })}
                    </div>
                    <div className={`text-[8px] font-medium ${darkMode ? 'text-white/30' : 'text-gray-400'}`}>SHIFT: {getShiftName(att.shift_code)}</div>
                  </div>
                  <div className={`text-center text-xs font-medium tabular-nums ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {formatTime(att.clock_in_time)}
                  </div>
                  <div className={`text-center text-xs font-medium tabular-nums ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {formatTime(att.clock_out_time)}
                  </div>
                  <div className={`text-right text-xs font-bold ${
                    att.attendance_status === 'terlambat' ? 'text-amber-400' :
                    att.attendance_status === 'hadir' ? 'text-emerald-400' :
                    (darkMode ? 'text-white/40' : 'text-gray-500')
                  }`}>
                    <div>{att.attendance_status === 'hadir' ? 'Tepat Waktu' : att.attendance_status === 'terlambat' ? 'Terlambat' : att.attendance_status}</div>
                    {att.attendance_status === 'terlambat' && att.late_minutes > 0 && (
                      <div className="text-[8px] font-semibold opacity-70 leading-tight">{att.late_minutes} menit</div>
                    )}
                  </div>
                </div>
              );
            }) : (
              <div className={`text-xs text-center py-6 ${darkMode ? 'text-white/30' : 'text-gray-400'}`}>Belum ada riwayat.</div>
            )}
          </div>
        </div>

        {/* PENGUMUMAN CARD — GLASSMORPHISM DARK (match STATISTICS-CARD-DESIGN.md) */}
        <div className="rounded-3xl p-5 relative overflow-hidden border transition-all duration-500"
          style={{ background: darkMode ? 'rgba(30,30,50,0.6)' : 'rgba(255,255,255,0.05)', borderColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.05)', boxShadow: darkMode ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.08)', backdropFilter: 'blur(20px)' }}>
          {/* Card Header */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, #BF00FF, #3B82F6)' }} />
              <h3 className={`text-xs font-bold tracking-wide ${darkMode ? 'text-white' : 'text-gray-900'}`}>Pengumuman</h3>
            </div>
            <Megaphone size={16} className={darkMode ? 'text-white/30' : 'text-gray-400'} />
          </div>

          {/* Announcement Items */}
          <div className="space-y-2">
            {announcements.length > 0 ? announcements.map(a => (
              <div key={a.id}
                className="rounded-xl px-4 py-3 transition-all duration-200 hover:translate-x-1"
                style={{
                  background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.06)'
                }}>
                <div className={`text-xs font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{a.title}</div>
                <div className={`text-[10px] mt-0.5 ${darkMode ? 'text-white/70' : 'text-gray-700'}`}>{a.content}</div>
              </div>
            )) : (
              <div className={`text-xs py-6 text-center ${darkMode ? 'text-white/30' : 'text-gray-400'}`}>
                Tidak ada pengumuman.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}