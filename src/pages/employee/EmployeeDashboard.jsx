import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getAttendanceHistory } from "../../services/attendanceService";
import { useAuth } from "../../context/AuthContext";
import { CheckCircle, Calendar, PieChart, History, Megaphone, Clock, Sun, Sunset, ArrowRight } from "lucide-react";

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

      const [stRes, attRes, shiftRes, monthAttRes, annRes, histRes, schedRes] = await withTimeout(Promise.all([
        supabase.rpc('get_server_time'),
        supabase.from("attendance").select("*").eq("user_id", user.id).eq("date", today).maybeSingle(),
        supabase.from("employee_schedules").select("shift_code").eq("user_id", user.id).eq("date", today).maybeSingle(),
        supabase.from("attendance").select("attendance_status").eq("user_id", user.id).gte("date", monthStartStr),
        supabase.from("announcements").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(3),
        getAttendanceHistory(user.id),
        supabase.from("employee_schedules").select("date, shift_code").eq("user_id", user.id).gte("date", monthStartStr).lte("date", monthEndStr),
      ]), 20000, "fetchAll");

      if (stRes.data) setServerTime(new Date(stRes.data));

      setTodayAttendance(attRes.data);

      setShift(shiftRes.data?.shift_code ? getShiftName(shiftRes.data.shift_code) : "N/A");

      const s = { hadir: 0, izin: 0, sakit: 0, alpha: 0 };
      monthAttRes.data?.forEach(a => {
        const st = a.attendance_status === 'terlambat' ? 'hadir' : a.attendance_status;
        if (s[st] !== undefined) s[st]++;
      });

      const schedules = schedRes.data || [];
      const jadwalCount = schedules.length;

      const workingDaysSoFar = schedules.filter(
        (sch) => new Date(sch.date + 'T00:00:00') <= new Date(today + 'T00:00:00')
      ).length;

      const totalHadir = s.hadir;
      const alphaCount = Math.max(0, workingDaysSoFar - totalHadir - s.izin - s.sakit);

      setStats({ ...s, alpha: alphaCount, jadwalCount });
      setAnnouncements(annRes.data || []);

      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split("T")[0];
      const recentSchedules = schedRes.data
        ? schedRes.data.filter(sch => sch.date >= weekAgoStr)
          .sort((a, b) => b.date.localeCompare(a.date))
        : [];

      const attMap = {};
      (histRes || []).forEach(a => { attMap[a.date] = a; });

      const mergedHistory = recentSchedules.map(sch => {
        const att = attMap[sch.date] || null;
        const isPast = sch.date < today;
        return {
          ...sch,
          shift_code: sch.shift_code,
          ...(att ? {
            attendance_status: att.attendance_status,
            clock_in_time: att.clock_in_time,
            clock_out_time: att.clock_out_time,
            late_minutes: att.late_minutes,
            id: att.id,
          } : {
            attendance_status: isPast ? 'alpha' : 'belum',
            clock_in_time: null,
            clock_out_time: null,
            late_minutes: 0,
            id: sch.date + '-merged',
          }),
        };
      });

      setAttendanceHistory(mergedHistory.filter(h => h.attendance_status !== 'belum'));
    } catch (e) {
      console.error(e);
      setFetchError(e.message?.includes('Timeout') ? 'Koneksi lambat. Coba lagi.' : 'Gagal memuat data. Periksa koneksi.');
    } finally { setLoading(false); }
  };

  // Light-mode helpers
  const T = {
    bg: '#F4F2FB',
    surface: '#FFFFFF',
    border: 'rgba(31,41,55,0.08)',
    div: '#F1F5F9',
    text: '#0F172A',
    textSec: '#475569',
    textMuted: '#94A3B8',
    sub: '#6B7280',
    shadow: '0 4px 16px rgba(15,23,42,0.06)',
    shadowLg: '0 8px 24px rgba(15,23,42,0.08)',
    rowBg: 'rgba(15,23,42,0.02)',
    rowBgActive: (c) => `linear-gradient(90deg, ${c}10, transparent)`,
    donutTrack: 'rgba(0,0,0,0.06)',
    donutText: '#111827',
    donutSub: '#475563',
  };

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: T.bg }}>
      <div className="flex flex-col items-center gap-3">
        {fetchError ? (
          <>
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-1">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="text-red-600 text-xs font-medium text-center max-w-[200px]">{fetchError}</div>
            <button onClick={retryFetchData}
              className="mt-3 px-6 py-2 bg-[#BF00FF] hover:bg-[#a000e6] text-white text-xs font-semibold rounded-full transition-all duration-200 shadow-md">
              Coba Lagi
            </button>
          </>
        ) : (
          <>
            <div className="w-10 h-10 border-4 border-[#BF00FF] border-t-transparent rounded-full animate-spin"></div>
            <div className="text-gray-500 text-xs tracking-widest uppercase">Memuat...</div>
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
    <div className="min-h-screen w-full font-sans absolute top-0 left-0 pb-24" style={{ background: T.bg, color: T.text }}>
      {/* HERO — vibrant violet gradient */}
      <div className="w-full p-8 pt-12 shadow-lg rounded-b-[32px]"
        style={{ background: 'linear-gradient(160deg, #C44DFF 0%, #BF00FF 30%, #8A00CC 60%, #4A0099 100%)' }}>
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-8">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-16 h-16 rounded-2xl object-cover border border-white/30 shadow-md" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-white/15 border border-white/30 flex items-center justify-center font-bold text-2xl text-white shadow-inner">
                {user?.full_name?.charAt(0)?.toUpperCase() || "R"}
              </div>
            )}
            <div className="flex-1">
              <div className="text-[11px] uppercase tracking-[0.2em] opacity-80 text-white">{getGreeting(serverTime.getHours())},</div>
              <div className="text-2xl font-bold text-white">{user?.full_name || "Rama Hudson"}</div>
              <div className="text-xs opacity-75 mt-0.5 text-white">{user?.role || "Pegawai"}</div>
            </div>
          </div>
          <div className="flex justify-between items-end">
            <div>
              <div className="text-4xl font-bold text-white">{serverTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</div>
              <div className="text-xs opacity-70 mt-1 text-white">{serverTime.toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
              <div className="text-[10px] mt-2 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full inline-block font-semibold text-white" style={{ border: '1px solid rgba(255,255,255,0.25)' }}>
                SHIFT: {(shift || 'N/A').toUpperCase()}
              </div>
            </div>
            <Link to="/employee/attendance" className="bg-white text-[#8A00CC] px-8 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-200">
              Absen <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto space-y-6 p-4 mt-6">
        {/* SECTION TITLE: Status hari ini */}
        <div className="px-4 flex items-center gap-3 mb-4">
          <div className="w-8 h-8 flex items-center justify-center shrink-0 bg-purple-50 rounded-full">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#BF00FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className="pt-0.5">
            <div className="text-lg font-extrabold tracking-tight" style={{ color: T.text }}>Status hari ini</div>
            <div className="text-[10px] mt-0.5 font-normal" style={{ color: T.textMuted }}>Pantau waktu kehadiran anda</div>
          </div>
        </div>

        {/* 2 CARDS: MASUK & PULANG */}
        <div className="grid grid-cols-2 gap-3">
          {/* MASUK — Purple Gradient */}
          <div className="rounded-3xl p-5 relative overflow-hidden shadow-lg text-white"
            style={{ background: 'linear-gradient(135deg, #BF00FF 0%, #8A00CC 100%)', boxShadow: '0 6px 20px rgba(191,0,255,0.25)' }}>
            <div className="text-[9px] uppercase tracking-[0.2em] opacity-75 font-semibold mb-3 flex items-center gap-1.5">
              <Sun size={13} /> Masuk
            </div>
            {todayAttendance?.clock_in_time ? (
              <>
                <div className="text-[28px] font-extrabold leading-none tracking-tight mb-2">
                  {formatTime(todayAttendance.clock_in_time)}
                </div>
                {todayAttendance.is_late ? (
                  <div className="inline-flex items-center gap-1.5 text-[9px] font-semibold bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.25)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
                    <span className="opacity-90">Terlambat</span>
                    <span className="opacity-75">{todayAttendance.late_minutes} menit</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 text-[9px] font-semibold bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.25)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                    <span className="opacity-90">Tepat Waktu</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="text-base font-bold leading-none mb-2" style={{ color: '#FFFFFF' }}>Belum Absen</div>
                <div className="text-[20px] font-bold leading-none opacity-50 mb-2">--:--</div>
                <div className="inline-flex items-center gap-1.5 text-[9px] font-semibold bg-white/10 px-2.5 py-1 rounded-full opacity-60" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>—</div>
              </>
            )}
          </div>

          {/* PULANG — Green-Yellow Gradient */}
          <div className="rounded-3xl p-5 relative overflow-hidden shadow-lg"
            style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #85c600 100%)', color: '#000000', boxShadow: '0 6px 20px rgba(133,198,0,0.2)' }}>
            <div className="text-[9px] uppercase tracking-[0.2em] opacity-65 font-semibold mb-3 flex items-center gap-1.5">
              <Sunset size={13} /> Pulang
            </div>
            {todayAttendance?.clock_out_time ? (
              <>
                <div className="text-[28px] font-extrabold leading-none tracking-tight mb-2">
                  {formatTime(todayAttendance.clock_out_time)}
                </div>
                <div className="inline-flex items-center gap-1.5 text-[9px] font-semibold bg-black/10 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Selesai
                </div>
              </>
            ) : (
              <>
                <div className="text-base font-bold leading-none mb-2" style={{ color: '#000000' }}>Belum Absen</div>
                <div className="inline-flex items-center gap-1.5 text-[9px] font-semibold bg-black/5 px-2.5 py-1 rounded-full opacity-50">—</div>
              </>
            )}
          </div>
        </div>

        {/* STATS CARD — DONUT + RINGKASAN */}
        <div className="rounded-3xl p-5 relative overflow-hidden"
          style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>

          <div className="flex items-center justify-between px-1 pt-1 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-1 h-4 rounded-full shrink-0" style={{ background: "linear-gradient(180deg, #BF00FF, #3B82F6)" }} />
              <span className="text-xs font-bold tracking-wide" style={{ color: T.text }}>Ringkasan Kehadiran</span>
            </div>
            <span className="text-[10px] font-medium" style={{ color: T.sub }}>
              {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
            </span>
          </div>

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
                    <circle cx="50" cy="50" r="42" fill="none" stroke={T.donutTrack} strokeWidth="8"/>
                    <circle cx="50" cy="50" r="42" fill="none" stroke="url(#dgd)" strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={c}
                      strokeDashoffset={offset}
                      transform="rotate(-90, 50, 50)"
                      style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[22px] font-extrabold leading-none" style={{ fontFamily: "'Urbanist', sans-serif", color: T.donutText }}>{pct}%</span>
                    <span className="text-[7px] font-medium uppercase tracking-[0.5px] mt-0.5" style={{ color: T.donutSub }}>Hadir</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold" style={{ color: T.text }}>Kehadiran Bulan Ini</div>
                  <div className="text-[9px] mt-0.5" style={{ color: T.sub }}>
                    <span className="font-semibold">{stats.hadir}</span> hari hadir dari <span className="font-semibold">{stats.jadwalCount}</span> hari kerja
                  </div>
                  <div className="flex gap-3 mt-2.5">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: "linear-gradient(135deg, #BF00FF, #7066ed)" }} />
                      <span className="text-[8px]" style={{ color: T.sub }}>Hadir</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: "rgba(0,0,0,0.12)" }} />
                      <span className="text-[8px]" style={{ color: T.sub }}>Alpha</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="mx-0 my-2 h-px" style={{ background: T.div }} />

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
                    background: active ? `linear-gradient(90deg, ${item.color}12, transparent)` : "transparent",
                    borderLeft: `2px solid ${active ? "transparent" : item.color}33`,
                    opacity: active ? 1 : 0.5,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#F5F3FF' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#BF00FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {item.label === "Hadir" && <polyline points="20 6 9 17 4 12"/>}
                      {item.label === "Izin" && <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
                      {item.label === "Sakit" && <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>}
                      {item.label === "Alpha" && <><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></>}
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold" style={{ color: T.text }}>{item.label}</div>
                    <div className="text-[9px]" style={{ color: T.sub }}>{item.desc}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-medium tabular-nums" style={{ color: T.text }}>{item.v}</div>
                    <div className="text-[9px] font-medium" style={{ color: T.sub }}>{item.v} dari {stats.jadwalCount} hari</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t flex items-center justify-between pt-3 mt-1" style={{ borderColor: T.div }}>
            <span className="text-[9px] font-medium" style={{ color: T.sub }}>
              Periode: 1 — {new Date().getDate() > 0 ? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() : 31} {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
            </span>
            <span className="text-[9px] font-medium tabular-nums" style={{ color: T.sub }}>
              {stats.hadir} dari {stats.jadwalCount} hari kerja
            </span>
          </div>
        </div>

        {/* HISTORY CARD */}
        <div className="rounded-3xl p-5 relative overflow-hidden"
          style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, #BF00FF, #3B82F6)' }} />
              <h3 className="text-sm font-bold tracking-wide" style={{ color: T.text }}>Riwayat Absensi</h3>
            </div>
            <Link to="/employee/history" className="flex items-center gap-1 text-[10px] font-semibold text-[#BF00FF] hover:underline">
              Lihat Semua <History size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-[1fr_44px_44px_70px] gap-3 px-3.5 mb-1 text-[9px] uppercase tracking-[0.15em] font-bold">
            <div style={{ color: T.textMuted }}>Tanggal</div>
            <div className="text-center" style={{ color: T.textMuted }}>Masuk</div>
            <div className="text-center" style={{ color: T.textMuted }}>Pulang</div>
            <div className="text-right" style={{ color: T.textMuted }}>Status</div>
          </div>

          <div className="space-y-1">
            {attendanceHistory.length > 0 ? (() => {
              const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
              return attendanceHistory.filter(att => new Date(att.date) >= weekAgo);
            })().map(att => {
              const isLate = att.attendance_status === 'terlambat';
              const isHadir = att.attendance_status === 'hadir';
              const isAlpha = att.attendance_status === 'alpha';
              const isBelum = att.attendance_status === 'belum';
              const fmtIn = formatTime(att.clock_in_time);
              const fmtOut = att.clock_out_time ? formatTime(att.clock_out_time) : '-';
              const dateObj = new Date(att.date + 'T00:00:00');
              const dateLabel = dateObj.toLocaleDateString("id-ID", { day: 'numeric', month: 'short' });
              const dayLabel = dateObj.toLocaleDateString("id-ID", { weekday: 'short' });
              return (
                <div key={att.id}
                  className="grid grid-cols-[1fr_44px_44px_70px] gap-3 items-center px-3 py-3 rounded-xl transition-all duration-200"
                  style={{
                    background: T.rowBg,
                    borderLeft: isLate ? "2px solid rgba(249,115,22,0.4)" : isAlpha ? "2px solid rgba(239,68,68,0.4)" : isBelum ? "2px solid rgba(59,130,246,0.3)" : "2px solid transparent",
                  }}>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold" style={{ color: T.text }}>
                      {dateLabel}
                    </div>
                    <div className="text-[9px] uppercase tracking-wider" style={{ color: T.textMuted }}>
                      {dayLabel}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[11px] font-semibold tabular-nums" style={{ color: T.textSec }}>{fmtIn}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[11px] font-semibold tabular-nums" style={{ color: T.textSec }}>{fmtOut}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold" style={{
                      color: isLate ? '#F59E0B' :
                      isHadir ? '#10B981' :
                      isAlpha ? '#EF4444' :
                      isBelum ? '#3B82F6' :
                      T.textMuted
                    }}>
                      {isHadir ? 'Tepat Waktu' : isLate ? 'Terlambat' : isAlpha ? 'Alpha' : isBelum ? 'Belum' :
                       att.attendance_status ? att.attendance_status.charAt(0).toUpperCase() + att.attendance_status.slice(1) : '-'}
                    </div>
                    {isLate && att.late_minutes > 0 && (
                      <div className="text-[9px] font-medium" style={{ color: T.textMuted }}>
                        {att.late_minutes} menit
                      </div>
                    )}
                  </div>
                </div>
              );
            }) : (
              <div className="text-xs text-center py-6" style={{ color: T.textMuted }}>Belum ada riwayat absensi.</div>
            )}
          </div>
        </div>

        {/* PENGUMUMAN CARD */}
        <div className="rounded-3xl p-5 relative overflow-hidden"
          style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, #BF00FF, #3B82F6)' }} />
              <h3 className="text-xs font-bold tracking-wide" style={{ color: T.text }}>Pengumuman</h3>
            </div>
            <Megaphone size={16} style={{ color: T.textMuted }} />
          </div>

          <div className="space-y-2">
            {announcements.length > 0 ? announcements.map(a => (
              <div key={a.id}
                className="rounded-xl px-4 py-3 transition-all duration-200 hover:translate-x-1"
                style={{ background: T.rowBg, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <div className="text-xs font-semibold" style={{ color: T.text }}>{a.title}</div>
                <div className="text-[10px] mt-0.5" style={{ color: T.textSec }}>{a.content}</div>
              </div>
            )) : (
              <div className="text-xs py-6 text-center" style={{ color: T.textMuted }}>
                Tidak ada pengumuman.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
