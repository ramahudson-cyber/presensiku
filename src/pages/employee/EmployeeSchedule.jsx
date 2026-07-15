import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import BottomSheet from "../../components/BottomSheet";
import {
  ChevronLeft, ChevronRight, ChevronDown, Calendar, Sun, Moon, Sunset, CloudSun,
  Loader2, Info
} from "lucide-react";

const SHIFTS = [
  { code: "PG", name: "Pagi", icon: Sun, premiumClass: "cal-premium-pg", badgeClass: "cal-badge-pg", textColor: "text-white" },
  { code: "SR", name: "Sore", icon: Sunset, premiumClass: "cal-premium-sr", badgeClass: "cal-badge-sr", textColor: "text-white" },
  { code: "SI", name: "Siang", icon: CloudSun, premiumClass: "cal-premium-si", badgeClass: "cal-badge-si", textColor: "text-[#1a2e05]" },
  { code: "ML", name: "Malam", icon: Moon, premiumClass: "cal-premium-ml", badgeClass: "cal-badge-ml", textColor: "text-white" },
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
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const scrollRef = useRef(null);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);

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

  const openMonthPicker = () => {
    setPickerYear(year);
    setShowMonthPicker(true);
  };

  const selectMonth = (m) => {
    setMonth(m);
    setYear(pickerYear);
    setShowMonthPicker(false);
  };

  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  // Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    if (!user?.id) return;
    setIsRefreshing(true);
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
      console.error("Gagal refresh jadwal", e);
    } finally {
      setIsRefreshing(false);
    }
  }, [user?.id, year, month, lastDay]);

  const handleTouchStart = (e) => {
    if (scrollRef.current && scrollRef.current.scrollTop === 0 && !isRefreshing) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  };

  const handleTouchMove = (e) => {
    if (!isPulling.current || isRefreshing) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0) {
      setPullDistance(Math.min(diff / 2.5, 80));
    } else {
      if (pullDistance > 0) setPullDistance(0);
      isPulling.current = false;
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance >= 55) {
      handleRefresh();
    }
    setPullDistance(0);
    isPulling.current = false;
  };

  return (
			    <div className="h-screen overflow-hidden bg-transparent">
			      {/* TOP HEADER - fixed, gak bisa scroll */}
					      <div className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-5 pt-10 pb-5 bg-gradient-to-b from-white dark:from-onyx to-transparent">
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
        
	        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 pb-24 scrollbar-thin"
	          onTouchStart={handleTouchStart}
	          onTouchMove={handleTouchMove}
	          onTouchEnd={handleTouchEnd}
	        >
	          {/* Pull to refresh indicator */}
	          <div className="flex items-center justify-center overflow-hidden transition-all duration-300"
	            style={{
	              height: pullDistance > 0 ? `${pullDistance}px` : '0px',
	              opacity: Math.min(pullDistance / 55, 1)
	            }}
	          >
	            {isRefreshing ? (
	              <Loader2 size={20} className="animate-spin text-electric-violet" />
	            ) : (
	              <ChevronDown size={20} className={`text-electric-violet transition-transform duration-300 ${pullDistance >= 55 ? 'rotate-180' : ''}`} />
	            )}
	          </div>
		          <div className="max-w-md mx-auto space-y-4">
	
		            {/* NAV + STATS */}
	            <div className="flex flex-col sm:flex-row gap-3">
	              <button onClick={openMonthPicker}
	                className="flex items-center gap-2 bg-slate-100 dark:bg-onyx border border-slate-200 dark:border-white/[0.06] rounded-2xl px-3.5 py-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-white/[0.03] transition-all active:scale-[0.97]">
	                <Calendar size={15} className="text-slate-500 dark:text-slate-mist shrink-0" />
	                <span className="text-sm font-semibold text-slate-800 dark:text-pure-white select-none min-w-[100px] text-left">{MONTHS[month]} {year}</span>
	                <ChevronDown size={14} className="text-slate-400 dark:text-slate-mist shrink-0" />
	              </button>
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
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[8px] font-semibold text-slate-500 dark:text-slate-mist uppercase tracking-wider mr-0.5">Shift</span>
              {SHIFTS.map(s => {
                const Icon = s.icon;
                return (
                  <span key={s.code} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold ${s.badgeClass}`}>
                    <Icon size={10} /> {s.name}
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
            <div className="grid grid-cols-7 gap-1.5 mb-1.5">
              {DAY_SHORT.map(d => (
                <div key={d} className="text-center text-[9px] font-bold text-slate-mist dark:text-slate-mist uppercase tracking-widest py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {days.map((day, i) => {
                const key = dateStr(day);
                const sched = key ? schedules[key] : undefined;
                const shiftInfo = sched ? SHIFT_MAP[sched.shift_code] : null;
                const isToday = day && year === now.getFullYear() && month === now.getMonth() && day === now.getDate();
                const dayOfWeek = day ? (new Date(year, month, day).getDay() + 6) % 7 : -1;
                const isWeekend = dayOfWeek >= 5;

                return (
                  <div key={i}
                    className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center transition-all duration-200 cursor-default select-none
                      ${!day ? "invisible" : ""}
                      ${isToday
                        ? ""
                        : shiftInfo 
                          ? shiftInfo.premiumClass
                          : isWeekend
                            ? "bg-slate-100 dark:bg-white/[0.02]"
                            : "bg-slate-50 dark:bg-white/[0.03]"
                      }
                      ${isToday ? "ring-2 ring-violet-500 ring-offset-1 ring-offset-white dark:ring-offset-onyx shadow-[0_0_14px_rgba(139,92,246,0.35)]" : ""}
                    `}>
                    <span className={`text-[10px] font-bold leading-none ${
                      isToday
                        ? "text-violet-500"
                        : shiftInfo 
                          ? ""
                          : isWeekend 
                            ? "text-slate-400 dark:text-slate-mist" 
                            : "text-slate-600 dark:text-slate-mist"
                    }`}>
                      {day}
                    </span>
                    {shiftInfo && (
                      <shiftInfo.icon size={9} className={`mt-0.5 ${isToday ? "text-violet-500" : ""}`} />
                    )}
                    {!shiftInfo && isWeekend && (
                      <span className="text-[5px] text-slate-mist mt-0.5 leading-none">Libur</span>
                    )}
                  </div>
                );
              })}
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
		              <div key={s.code} className={`${s.badgeClass} rounded-xl p-3 flex flex-col items-center text-center gap-2`}>
		                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-black/10">
		                  <Icon size={16} />
		                </div>
		                <div>
		                  <p className="text-xl font-extrabold leading-none opacity-90">{count}</p>
		                  <p className="text-[10px] font-medium mt-0.5 opacity-70">hari kerja</p>
		                </div>
		                <p className="text-[9px] font-bold uppercase tracking-wider opacity-80">Shift {s.name}</p>
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

      {/* MONTH PICKER BOTTOM SHEET */}
      <BottomSheet open={showMonthPicker} onClose={() => setShowMonthPicker(false)}
        title="Pilih Bulan" subtitle={`Tahun ${pickerYear}`}>
        <div className="space-y-5">
          {/* Year nav */}
          <div className="flex items-center justify-center gap-6 py-2">
            <button onClick={() => setPickerYear(p => p - 1)}
              className="p-2 rounded-xl hover:bg-white/10 text-slate-mist hover:text-pure-white transition-all">
              <ChevronLeft size={18} />
            </button>
            <span className="text-lg font-bold text-pure-white w-20 text-center select-none">{pickerYear}</span>
            <button onClick={() => setPickerYear(p => p + 1)}
              className="p-2 rounded-xl hover:bg-white/10 text-slate-mist hover:text-pure-white transition-all">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-4 gap-2">
            {MONTHS.map((name, i) => {
              const isActive = month === i && pickerYear === year;
              return (
                <button key={i} onClick={() => selectMonth(i)}
                  className={`p-3 rounded-2xl text-sm font-semibold transition-all active:scale-95
                    ${isActive
                      ? "bg-electric-violet text-pure-white shadow-lg shadow-electric-violet/30"
                      : "bg-onyx border border-white/[0.06] text-slate-mist hover:bg-white/[0.06] hover:text-pure-white"
                    }
                  `}>
                  {name.substring(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      </BottomSheet>
	  </div>
  );
}
