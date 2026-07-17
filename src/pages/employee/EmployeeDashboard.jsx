import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getAttendanceHistory } from "../../services/attendanceService";
import { useAuth } from "../../context/AuthContext";
import { CheckCircle, Calendar, PieChart, History, Megaphone, Clock, Sun, Sunset, Moon } from "lucide-react";
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
              <div className="text-4xl font-bold text-white">{now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</div>
              <div className="text-xs opacity-50 mt-1 text-white">{now.toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
              <div className="text-[10px] mt-2 bg-white/10 px-2 py-0.5 rounded inline-block font-semibold text-white">Shift: {shift}</div>
            </div>
            <Link to="/employee/attendance" className="bg-white text-[#660099] px-8 py-3 rounded-xl font-bold text-sm">Absen</Link>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto space-y-6 p-4 mt-6">
        {/* SECTION TITLE: Status hari ini */}
        <div className="px-4 flex items-center gap-3 mb-4">
          <div className="w-8 h-8 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className="pt-0.5">
            <div className="text-xl font-medium tracking-tight text-white">Status hari ini</div>
            <div className="text-xs text-white/35 mt-0.5 font-normal">Pantau waktu kehadiran anda</div>
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
                  <div className="inline-flex flex-col items-center px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm">
                    <span className="text-[9px] font-bold text-red-300 leading-tight">Terlambat</span>
                    <span className="text-[7px] font-semibold text-red-200 leading-tight">{todayAttendance.late_minutes}m</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 text-[9px] font-semibold bg-white/15 backdrop-blur-sm px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Tepat Waktu
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="text-[20px] font-bold leading-none opacity-50 mb-2">--:--</div>
                <div className="inline-flex items-center gap-1.5 text-[9px] font-semibold bg-white/10 px-2.5 py-1 rounded-full opacity-50">
                  Belum Absen
                </div>
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
                <div className="text-base font-bold leading-none opacity-40 mb-2">Belum Absen</div>
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
            <div className="text-xl font-extrabold tracking-tight text-white">Statistik bulan ini</div>
            <div className="text-xs text-white/35 mt-0.5 font-normal">Ringkasan kehadiran anda bulan ini</div>
          </div>
        </div>

        {/* STATS PREMIUM CARD */}
        <div className="bg-white/5 backdrop-blur-md border border-white/5 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#BF00FF] to-transparent rounded-t-3xl"></div>
          {(() => {
            const total = stats.hadir + stats.izin + stats.sakit + stats.alpha;
            const max = Math.max(stats.hadir, stats.izin, stats.sakit, stats.alpha, 1);
            const c = 2 * Math.PI * 32;
            const items = [
              { k:'hadir', v:stats.hadir, color:'#ADFF2F', label:'Hadir' },
              { k:'izin', v:stats.izin, color:'#fbbf24', label:'Izin' },
              { k:'sakit', v:stats.sakit, color:'#fb923c', label:'Sakit' },
              { k:'alpha', v:stats.alpha, color:'#f87171', label:'Alpha' },
            ];
            let offset = 0;
            const segments = items.map(it => {
              const pct = total > 0 ? it.v / total : 0;
              const len = c * pct;
              const seg = { ...it, dasharray: `${len} ${c - len}`, dashoffset: -offset, pct: Math.round(pct * 100) };
              offset += len;
              return seg;
            });
            return (
              <>
                <div className="flex items-center gap-5 mb-5 p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div className="relative w-20 h-20 shrink-0">
                    <svg className="w-20 h-20" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6"/>
                      {segments.map(s => s.v > 0 && (
                        <circle key={s.k} cx="40" cy="40" r="32" fill="none" stroke={s.color} strokeWidth="6"
                          strokeDasharray={s.dasharray} strokeDashoffset={s.dashoffset}
                          transform="rotate(-90, 40, 40)" strokeLinecap="round"
                          style={{filter: s.k === 'hadir' ? 'drop-shadow(0 0 6px rgba(173,255,47,0.4))' : 'none'}} />
                      ))}
                      <circle cx="40" cy="40" r="22" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
                      <text x="40" y="44" textAnchor="middle" fill="white" fontSize="20" fontWeight="700">{total}</text>
                    </svg>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 flex-1">
                    {segments.map(s => (
                      <div key={s.k} className="flex items-center gap-1.5 text-[10px]">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:s.color}}></span>
                        <span className="opacity-70">{s.label}</span>
                        <span className="ml-auto font-semibold" style={{color:s.color}}>{s.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mb-5 p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div className="flex items-end gap-3 h-24">
                    {items.map(it => {
                      const pct = Math.max((it.v / max) * 100, 5);
                      return (
                        <div key={it.k} className="flex-1 flex flex-col items-center justify-end h-full">
                          <div className="text-xs font-bold mb-1.5" style={{color:it.color}}>{it.v}</div>
                          <div className="w-full rounded-t-lg relative overflow-hidden transition-all duration-500"
                            style={{height:`${pct}%`, background:`linear-gradient(180deg, ${it.color}, ${it.color}22)`, boxShadow: it.v > 0 ? `0 0 16px ${it.color}33` : 'none'}}>
                          </div>
                          <div className="text-[8px] uppercase tracking-wider opacity-40 mt-2">{it.label}</div>
                          <div className="text-[7px] opacity-25 mt-0.5">{total > 0 ? Math.round(it.v/total*100) : 0}%</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {items.map(it => (
                    <div key={it.k} className="bg-white/5 rounded-2xl p-3 text-center border border-white/5 relative overflow-hidden hover:-translate-y-0.5 transition-all duration-300">
                      <div className="absolute top-0 left-2 right-2 h-0.5 rounded-b-sm" style={{background:it.color, boxShadow: it.v > 0 ? `0 0 8px ${it.color}44` : 'none'}}></div>
                      <div className="text-2xl font-extralight tracking-tight leading-none mb-1" style={{color:it.color}}>{it.v}</div>
                      <div className="text-[8px] uppercase tracking-wider opacity-50">{it.label}</div>
                      <div className="text-[8px] font-semibold opacity-20 mt-1">{total > 0 ? Math.round(it.v/total*100) : 0}%</div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/5 rounded-3xl p-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-70 mb-4 flex justify-between">Riwayat Absensi <History size={14}/></div>
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
                <div className={`text-right text-xs font-bold uppercase px-2 py-1 rounded-full whitespace-nowrap justify-self-end ${
                  att.attendance_status === 'terlambat' ? 'bg-amber-400/15 text-amber-400' :
                  att.attendance_status === 'hadir' ? 'bg-emerald-400/15 text-emerald-400' :
                  'bg-white/10 opacity-80'
                }`}>
                  {att.attendance_status}
                </div>
              </div>
            )) : <div className="text-xs opacity-80 text-center py-6">Belum ada riwayat.</div>}
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/5 rounded-3xl p-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-70 mb-4 flex justify-between">Pengumuman <Megaphone size={14}/></div>
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