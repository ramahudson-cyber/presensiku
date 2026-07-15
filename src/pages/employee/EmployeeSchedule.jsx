import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import {
  ChevronLeft, ChevronRight, Calendar, Sun, Moon, Sunset, CloudSun,
  Loader2, Info
} from "lucide-react";

const SHIFTS = [
  { code: "PG", name: "Pagi", icon: Sun, color: "text-green-yellow", bg: "bg-green-yellow/15", ring: "ring-green-yellow/30" },
  { code: "SR", name: "Sore", icon: Sunset, color: "text-green-yellow", bg: "bg-green-yellow/15", ring: "ring-green-yellow/30" },
  { code: "SI", name: "Siang", icon: CloudSun, color: "text-sky-400", bg: "bg-sky-500/15", ring: "ring-sky-500/30" },
  { code: "ML", name: "Malam", icon: Moon, color: "text-violet-400", bg: "bg-violet-500/15", ring: "ring-violet-500/30" },
];

const SHIFT_MAP = Object.fromEntries(SHIFTS.map(s => [s.code, s]));

const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const DAY_SHORT = ["Sen","Sel","Rab","Kam","Jum","Sab","Min"];

function getDaysInMonth(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days = [];
  const pad = (first.getDay() + 6) % 7;
  for (let i = 0; i < pad; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(d);
  return days;
}

	export default function EmployeeSchedule() {
	  const { user } = useAuth();
	  const navigate = useNavigate();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [schedules, setSchedules] = useState({});
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, PG: 0, SR: 0, SI: 0, ML: 0 });

  const days = getDaysInMonth(year, month);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const dateStr = (d) => d ? `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;

  const loadSchedules = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const s = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const e = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const { data } = await supabase
        .from("employee_schedules")
        .select("date, shift_code")
        .eq("user_id", user.id)
        .gte("date", s)
        .lte("date", e);
      const m = {};
      const count = { total: 0, PG: 0, SR: 0, SI: 0, ML: 0 };
      (data || []).forEach(x => {
        m[x.date] = x;
        count.total++;
        if (count[x.shift_code] !== undefined) count[x.shift_code]++;
      });
      setSchedules(m);
      setStats(count);
    } catch (e) {
      console.error("Gagal muat jadwal", e);
    } finally {
      setLoading(false);
    }
  }, [user?.id, year, month, lastDay]);

  useEffect(() => { loadSchedules(); }, [loadSchedules]);

  const nav = (dir) => {
    let m = month + dir;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  };

  const goToday = () => {
    setMonth(new Date().getMonth());
    setYear(new Date().getFullYear());
  };

  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  return (
		    <div className="h-screen overflow-hidden bg-transparent">
		      {/* TOP HEADER */}
		      <div className="flex items-center gap-3 pl-3 pr-5 pt-4 pb-2">
	        <button onClick={() => navigate(-1)} className="bg-none border-0 flex items-center justify-center text-electric-violet dark:text-periwinkle-glow p-1 cursor-pointer shrink-0 hover:opacity-70 transition-opacity">
	          <ChevronLeft size={26} />
	        </button>
	        <div className="flex items-center justify-center shrink-0 text-electric-violet dark:text-periwinkle-glow">
	          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
	            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
	            <line x1="16" y1="2" x2="16" y2="6"/>
	            <line x1="8" y1="2" x2="8" y2="6"/>
	            <line x1="3" y1="10" x2="21" y2="10"/>
	            <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>
	          </svg>
	        </div>
	        <div>
	          <h2 className="text-lg font-bold text-slate-800 dark:text-pure-white tracking-tight leading-tight">Jadwal Shift Saya</h2>
	          <p className="text-xs text-slate-500 dark:text-slate-mist mt-0.5">Kalender jadwal kerja bulanan</p>
	        </div>
	      </div>

	      {/* Persistent Premium Bottom Sheet */}
      <div className="fixed bottom-0 left-0 w-full z-20 h-[85vh] bg-white dark:bg-onyx border-t border-slate-200 dark:border-white/10 rounded-t-[32px] shadow-[0_-20px_40px_-10px_rgba(0,0,0,0.2)] flex flex-col overflow-hidden transition-colors duration-500">
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-white/20 rounded-full mx-auto my-4 shrink-0" />
        
        <div className="flex-1 overflow-y-auto px-6 pb-24 scrollbar-thin">
	          <div className="max-w-md mx-auto space-y-4">
	
	            {/* NAV + STATS */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-onyx border border-slate-200 dark:border-white/[0.06] rounded-2xl px-2.5 py-1.5">
                <button onClick={() => nav(-1)} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-mist hover:text-slate-800 dark:hover:text-pure-white transition-all">
                  <ChevronLeft size={17} />
                </button>
                <span className="text-sm font-semibold text-slate-800 dark:text-pure-white w-[136px] text-center select-none">{MONTHS[month]} {year}</span>
                <button onClick={() => nav(1)} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-mist hover:text-slate-800 dark:hover:text-pure-white transition-all">
                  <ChevronRight size={17} />
                </button>
              </div>
              {!isCurrentMonth && (
                <button onClick={goToday}
                  className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-transparent bg-transparent dark:bg-white/5 text-slate-600 dark:text-pure-white text-xs font-medium transition-all active:scale-95">
                  Hari Ini
                </button>
              )}
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-onyx border border-slate-200 dark:border-white/[0.06] text-[11px] text-slate-500 dark:text-slate-mist ml-auto">
                <span className="flex items-center gap-1"><Calendar size={12} /> {stats.total} hari</span>
              </div>
            </div>


            {/* LEGEND */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-mist uppercase tracking-wider mr-1">Shift</span>
              {SHIFTS.map(s => {
                const Icon = s.icon;
                return (
                  <span key={s.code} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium ${s.bg} ${s.color} ring-1 ${s.ring}`}>
                    <Icon size={11} /> {s.name}
                  </span>
                );
              })}
            </div>

            {/* CALENDAR */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin text-periwinkle-glow" />
            <p className="text-sm text-slate-mist">Memuat jadwal...</p>
          </div>
        </div>
      ) : (
        <div className="design-card p-3 md:p-5 overflow-x-auto">
          <div className="min-w-[600px]">
            <div className="grid grid-cols-7 gap-2 mb-2">
              {DAY_SHORT.map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-slate-mist uppercase tracking-widest py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {days.map((day, i) => {
                const key = dateStr(day);
                const sched = key ? schedules[key] : undefined;
                const shiftInfo = sched ? SHIFT_MAP[sched.shift_code] : null;
                const isToday = day && year === now.getFullYear() && month === now.getMonth() && day === now.getDate();
                const dayOfWeek = day ? (new Date(year, month, day).getDay() + 6) % 7 : -1;
                const isWeekend = dayOfWeek >= 5;

                return (
                  <div key={i}
                    className={`relative aspect-[4/3] rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 text-xs
                      ${!day ? "invisible" : ""}
                      ${isToday ? "ring-2 ring-violet-500 ring-offset-2 ring-offset-white dark:ring-offset-onyx" : ""}
                      ${!shiftInfo
                        ? isWeekend
                          ? "bg-slate-100 dark:bg-white/[0.01]"
                          : "bg-slate-50 dark:bg-white/[0.02]"
                        : `${shiftInfo.bg}`
                      }
                    `}>
                    <span className={`text-[11px] font-bold leading-none ${isToday ? "text-violet-500" : isWeekend && !shiftInfo ? "text-slate-400 dark:text-slate-mist" : "text-slate-600 dark:text-slate-mist"}`}>
                      {day}
                    </span>
                    {shiftInfo && (
                      <div className={`flex items-center gap-0.5 mt-0.5 ${shiftInfo.color}`}>
                        <shiftInfo.icon size={9} />
                        <span className="text-[7px] font-bold tracking-wider">{shiftInfo.name}</span>
                      </div>
                    )}
                    {!shiftInfo && isWeekend && (
                      <span className="text-[6px] text-slate-mist mt-0.5">Libur</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

	      {/* SUMMARY CARDS */}
	      {!loading && stats.total > 0 && (
	        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
	          {SHIFTS.map(s => {
	            const Icon = s.icon;
	            const count = stats[s.code] || 0;
	            if (count === 0) return null;
	            return (
	              <div key={s.code} className={`${s.bg} border ${s.ring.replace("ring", "border").replace("/30", "/20")} rounded-xl p-3 flex flex-col items-center text-center gap-2`}>
	                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.bg}`}>
	                  <Icon size={16} className={s.color} />
	                </div>
	                <div>
	                  <p className="text-xl font-extrabold text-slate-900 dark:text-pure-white leading-none">{count}</p>
	                  <p className="text-[10px] font-medium text-slate-500 dark:text-slate-mist mt-0.5">hari kerja</p>
	                </div>
	                <p className={`text-[9px] font-bold uppercase tracking-wider ${s.color}`}>Shift {s.name}</p>
	              </div>
	            );
	          })}
	        </div>
	      )}

      {/* FOOTER INFO */}
      <div className="flex items-center gap-2 p-3.5 rounded-xl bg-gradient-to-r from-sky-500/5 to-violet-500/5 border border-sky-500/10 text-[11px] text-slate-mist">
        <div className="w-6 h-6 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
          <Info size={13} className="text-sky-400" />
        </div>
        <p>Jadwal ini ditetapkan oleh admin. Hubungi admin jika ada perubahan shift.</p>
      </div>
          </div>
        </div>
      </div>
    </div>
  );
}
