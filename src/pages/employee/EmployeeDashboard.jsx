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
      monthData?.forEach(a => {
        const st = a.attendance_status === 'terlambat' ? 'hadir' : a.attendance_status;
        if (s[st] !== undefined) s[st]++;
      });
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
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#BF00FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className="pt-0.5">
            <div className="text-xl font-extrabold tracking-tight text-white">Status hari ini</div>
            <div className="text-xs text-black/50 dark:text-white/35 mt-0.5 font-normal">Pantau waktu kehadiran anda</div>
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
            <div className="text-xl font-extrabold tracking-tight text-white">Statistik bulan ini</div>
            <div className="text-xs text-black/50 dark:text-white/35 mt-0.5 font-normal">Ringkasan kehadiran anda bulan ini</div>
          </div>
        </div>

        {/* STATS CARD PREMIUM */}
        <div className="bg-white/5 backdrop-blur-md border border-white/5 rounded-3xl p-6 relative overflow-hidden stats-card">
          <div className="bg-grid" />
          <div className="bg-orb-1" />
          <div className="bg-orb-2" />
          <div className="bg-ring-glow" />

          <div className="content">
            {(() => {
              const total = stats.hadir + stats.izin + stats.sakit + stats.alpha;
              const c = 2 * Math.PI * 40;
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
                  {/* Title row */}
                  <div className="flex justify-between items-center mb-5 pb-4 border-b border-white/5">
                    <h3 className="text-sm font-bold text-white">Statistik</h3>
                    <span className="text-xs px-3 py-1 rounded-full bg-electric-violet/10 text-electric-violet font-semibold">Total: {total}</span>
                  </div>

                  {/* Long horizontal cards — white text */}
                  <div className="flex flex-col gap-2 mb-5">
                    {segments.map(s => (
                      <div key={s.k} className="flex items-center justify-between rounded-xl px-4 py-3.5 border backdrop-blur-sm hover:-translate-y-0.5 transition-all duration-300"
                        style={{ background: `${s.color}08`, borderColor: `${s.color}15` }}>
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{background: s.color}} />
                          <span className="text-xs font-medium text-white">{s.label}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-lg font-bold text-white tabular-nums">{s.v}</span>
                          <span className="text-[10px] text-white/40 font-medium">{s.pct}%</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Viz row: Ring + Bar list */}
                  <div className="flex gap-4 items-stretch bg-white/5 rounded-2xl p-4 border border-white/5">
                    {/* Donut Ring */}
                    <div className="relative w-[100px] h-[100px] shrink-0">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8"/>
                        {segments.filter(s => s.v > 0).map(s => (
                          <circle key={s.k} cx="50" cy="50" r="40" fill="none" stroke={s.color} strokeWidth="8"
                            strokeDasharray={s.dasharray} strokeDashoffset={s.dashoffset}
                            strokeLinecap="round" transform="rotate(-90, 50, 50)"
                            style={{filter: s.k === 'hadir' ? 'drop-shadow(0 0 6px rgba(173,255,47,0.3))' : 'none'}} />
                        ))}
                        <circle cx="50" cy="50" r="28" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center text-xl font-extrabold text-white">{total}</div>
                    </div>

                    {/* Horizontal Bar List */}
                    <div className="flex-1 flex flex-col justify-center gap-2">
                      {segments.map(s => (
                        <div key={s.k} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{background: s.color, boxShadow: s.v > 0 ? `0 0 4px ${s.color}88` : 'none'}} />
                          <span className="text-[10px] text-white/50 w-10">{s.label}</span>
                          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-1000"
                              style={{width: `${s.pct}%`, background: `linear-gradient(90deg, ${s.color}, ${s.color}66)`}} />
                          </div>
                          <span className="text-[11px] font-semibold w-8 text-right" style={{color: s.color}}>{s.v}</span>
                        </div>
                      ))}
                    </div>
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