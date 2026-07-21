import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getAttendanceHistory } from "../../services/attendanceService";
import { useAuth } from "../../context/AuthContext";
import { CheckCircle, Calendar, PieChart, History, Megaphone, Clock, Sun, Sunset, Moon, ArrowRight } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const { darkMode, toggleTheme } = useTheme();
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [stats, setStats] = useState({ hadir: 0, izin: 0, sakit: 0, alpha: 0, jadwalCount: 0 });
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shift, setShift] = useState(null);
  const [serverTime, setServerTime] = useState(new Date());

  useEffect(() => { fetchData(); }, []);

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

      // Parallel: all independent queries
      const [stRes, attRes, shiftRes, schedRes, monthAttRes, annRes, histRes] = await Promise.all([
        supabase.rpc('get_server_time'),
        supabase.from("attendance").select("*").eq("user_id", user.id).eq("date", today).maybeSingle(),
        supabase.from("employee_schedules").select("shift_code").eq("user_id", user.id).eq("date", today).maybeSingle(),
        supabase.from("employee_schedules").select("date, shift_code").eq("user_id", user.id).gte("date", monthStartStr).lte("date", monthEndStr),
        supabase.from("attendance").select("attendance_status").eq("user_id", user.id).gte("date", monthStartStr),
        supabase.from("announcements").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(3),
        getAttendanceHistory(user.id),
      ]);

      // Server time
      if (stRes.data) setServerTime(new Date(stRes.data));

      // Today attendance
      setTodayAttendance(attRes.data);

      // Shift
      const shiftNames = { PG:'Pagi', SR:'Sore', SI:'Siang', ML:'Malam' };
      setShift(shiftRes.data?.shift_code ? shiftNames[shiftRes.data.shift_code] || shiftRes.data.shift_code : "N/A");

      // Month attendance stats
      const s = { hadir: 0, izin: 0, sakit: 0, alpha: 0 };
      monthAttRes.data?.forEach(a => {
        const st = a.attendance_status === 'terlambat' ? 'hadir' : a.attendance_status;
        if (s[st] !== undefined) s[st]++;
      });

      // Jadwal count: 2 queries instead of N+1 loop
      let jadwalCount = 0;
      const schedules = schedRes.data || [];
      const shiftCodes = [...new Set(schedules.map(s => s.shift_code).filter(Boolean))];
      let shiftSchedulesData = [];
      if (shiftCodes.length > 0) {
        const { data: ssData } = await supabase
          .from("shift_schedules")
          .select("shift_code, day_of_week, is_working_day")
          .in("shift_code", shiftCodes);
        shiftSchedulesData = ssData || [];
      }
      schedules.forEach(sch => {
        if (sch.shift_code) {
          const dateObj = new Date(sch.date + 'T00:00:00');
          const dayOfWeek = (dateObj.getDay() + 6) % 7;
          const shiftSch = shiftSchedulesData.find(ss => ss.shift_code === sch.shift_code && ss.day_of_week === dayOfWeek);
          if (shiftSch?.is_working_day) jadwalCount++;
        }
      });

      setStats({ ...s, jadwalCount });
      setAnnouncements(annRes.data || []);
      setAttendanceHistory(histRes || []);
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
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center font-bold text-2xl text-white">RH</div>
            <div className="flex-1">
              <div className="text-[11px] uppercase tracking-[0.2em] opacity-60 text-white">Selamat Pagi,</div>
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
              <div className="text-4xl font-bold text-white">{serverTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
              <div className="text-xs opacity-50 mt-1 text-white">{serverTime.toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
              <div className="text-[10px] mt-2 bg-white/10 px-2 py-0.5 rounded inline-block font-semibold text-white">Shift: {shift}</div>
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

        {/* SECTION TITLE */}
        <div className="px-4 flex items-center gap-3 mb-4">
          <div className="w-8 h-8 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#BF00FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          </div>
          <div className="pt-0.5">
            <div className="text-lg font-extrabold tracking-tight text-white">Statistik bulan ini</div>
            <div className="text-[10px] text-black/50 dark:text-white/35 mt-0.5 font-normal">Ringkasan kehadiran anda bulan ini</div>
          </div>
        </div>

        {/* STATS CARD — GLASSMORPHISM PREMIUM */}
        <div className="rounded-3xl p-5 relative overflow-hidden border transition-all duration-500"
          style={{ background: darkMode ? 'rgba(30,30,50,0.6)' : 'rgba(255,255,255,0.05)', borderColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.05)', boxShadow: darkMode ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.08)', backdropFilter: 'blur(20px)' }}>
          <div className="content">
            {(() => {
              const total = stats.hadir + stats.izin + stats.sakit + stats.alpha;
              const items = [
                { k:'hadir', v:stats.hadir, color:'#ADFF2F', glow:'rgba(173,255,47,0.1)', check:'check', label:'Hadir', desc:'Kehadiran tepat waktu' },
                { k:'izin', v:stats.izin, color:'#fbbf24', glow:'rgba(251,191,36,0.1)', check:'info', label:'Izin', desc:'Diluar tanggung jawab' },
                { k:'sakit', v:stats.sakit, color:'#fb923c', glow:'rgba(251,146,60,0.1)', check:'heart', label:'Sakit', desc:'Tidak hadir karena sakit' },
                { k:'alpha', v:stats.alpha, color:'#f87171', glow:'rgba(248,113,113,0.1)', check:'x', label:'Alpha', desc:'Tanpa keterangan' },
              ];

              // Icon SVG components
              const iconCheck = <polyline points="20 6 9 17 4 12"/>;
              const iconInfo = <> <circle cx="12" cy="12" r="10"/> <line x1="12" y1="8" x2="12" y2="12"/> <line x1="12" y1="16" x2="12.01" y2="16"/> </>;
              const iconHeart = <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>;
              const iconX = <> <circle cx="12" cy="12" r="10"/> <line x1="15" y1="9" x2="9" y2="15"/> <line x1="9" y1="9" x2="15" y2="15"/> </>;

              const getIcon = (t) => {
                const s = "2.5"; const cls = "w-5 h-5";
                switch(t) {
                  case 'check': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={s} strokeLinecap="round" strokeLinejoin="round">{iconCheck}</svg>;
                  case 'info': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={s} strokeLinecap="round" strokeLinejoin="round">{iconInfo}</svg>;
                  case 'heart': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={s} strokeLinecap="round" strokeLinejoin="round">{iconHeart}</svg>;
                  case 'x': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={s} strokeLinecap="round" strokeLinejoin="round">{iconX}</svg>;
                }
              };

              const today = new Date();
              const monthLabel = today.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
              const dayRange = `1 — ${today.getDate()} ${today.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`;

              return (
                <>
                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, #BF00FF, #3B82F6)' }} />
                    <span className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-gray-900'} tracking-wide`}>Ringkasan Kehadiran</span>
                    </div>
                    <span className={`text-[10px] ${darkMode ? 'text-white/30' : 'text-gray-400'} font-medium`}>{monthLabel}</span>
                  </div>

                  {/* Stat Items List */}
                  <div className="space-y-2">
                    {items.map(item => {
                      const isActive = item.v > 0;
                      const pct = stats.jadwalCount > 0 ? Math.round((item.v / stats.jadwalCount) * 100) : 0;
                      return (
                        <div key={item.k}
                          className="flex items-center gap-3 rounded-xl px-4 py-3.5 transition-all duration-300 hover:translate-x-1"
                          style={{
                            background: isActive
                              ? `linear-gradient(90deg, ${item.color}08, transparent)`
                              : 'transparent',
                            borderColor: isActive ? 'transparent' : `${item.color}33`,
                            borderLeftWidth: '2px',
                            borderLeftStyle: 'solid',
                            opacity: isActive ? 1 : 0.5,
                            boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.06)'
                          }}>
                          {/* Icon */}
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300"
                            style={{
                              background: 'transparent',
                              boxShadow: 'none'
                            }}>
                            <div style={{ color: '#BF00FF' }}>
                              {getIcon(item.check)}
                            </div>
                          </div>

                          {/* Label + Desc */}
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{item.label}</div>
                            <div className={`text-[9px] ${darkMode ? 'text-white/40' : 'text-gray-500'}`}>{item.desc}</div>
                          </div>

                          {/* Value */}
                          <div className="text-right shrink-0">
                            <div className={`text-xl font-medium tabular-nums ${darkMode ? 'text-white' : 'text-gray-900'}`}>{item.v}</div>
                            <div className={`text-[9px] font-medium ${darkMode ? 'text-white/40' : 'text-gray-400'}`}>
                              {`${item.v} dari ${stats.jadwalCount} hari`}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer Summary */}
                  <div className={`mt-4 pt-4 border-t ${darkMode ? 'border-white/5' : 'border-gray-100'} flex items-center justify-between`}>
                    <span className={`text-[9px] ${darkMode ? 'text-white/25' : 'text-gray-400'} font-medium`}>Periode: {dayRange}</span>
                    <span className="text-[9px] font-medium tabular-nums" style={{ color: stats.hadir > 0 ? (darkMode ? 'rgba(173,255,47,0.5)' : 'rgba(173,255,47,0.7)') : (darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.25)') }}>
                      {stats.hadir} dari {stats.jadwalCount} hari kerja
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/5 rounded-3xl p-6">
          <div className="flex justify-between items-center mb-5 pb-4 border-b border-white/5">
            <h3 className="text-sm font-bold text-white">Riwayat Absensi</h3>
            <History size={16} className="text-white/30" />
          </div>
          <div className="grid grid-cols-[1fr_55px_55px_90px] gap-3 mb-2 text-[9px] uppercase tracking-wider opacity-70">
            <div>Tanggal</div>
            <div className="text-center">Masuk</div>
            <div className="text-center">Pulang</div>
            <div className="text-right">Status</div>
          </div>
          <div className="space-y-1">
            {attendanceHistory.length > 0 ? attendanceHistory.slice(0, 5).map(att => (
              <div key={att.id} className="grid grid-cols-[1fr_55px_55px_90px] gap-3 items-center bg-white/5 -mx-6 px-6 py-3">
                <div>
                  <div className="text-xs font-semibold">{new Date(att.date).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  <div className="text-[10px] opacity-60 capitalize">Shift</div>
                </div>
                <div className="text-center text-xs font-medium tabular-nums">{formatTime(att.clock_in_time)}</div>
                <div className="text-center text-xs font-medium tabular-nums">{formatTime(att.clock_out_time)}</div>
                <div className={`text-right text-xs font-bold uppercase justify-self-end ${
                  att.attendance_status === 'terlambat' ? 'text-amber-400' :
                  att.attendance_status === 'hadir' ? 'text-emerald-400' :
                  'opacity-60'
                }`}>
                  <div>{att.attendance_status}</div>
                  {att.attendance_status === 'terlambat' && att.late_minutes > 0 && (
                    <div className="text-[8px] font-semibold opacity-70 leading-tight">{att.late_minutes} menit</div>
                  )}
                </div>
              </div>
            )) : <div className="text-xs opacity-80 text-center py-6">Belum ada riwayat.</div>}
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/5 rounded-3xl p-6">
          <div className="flex justify-between items-center mb-5 pb-4 border-b border-white/5">
            <h3 className="text-sm font-bold text-white">Pengumuman</h3>
            <Megaphone size={16} className="text-white/30" />
          </div>
          <div className="space-y-3">
            {announcements.length > 0 ? announcements.map(a => (
              <div key={a.id} className="p-3 bg-white/5 rounded-2xl">
                <div className="text-sm font-semibold">{a.title}</div>
                <div className="text-xs opacity-80 mt-1">{a.content}</div>
              </div>
            )) : <div className="text-xs opacity-80">Tidak ada pengumuman.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}