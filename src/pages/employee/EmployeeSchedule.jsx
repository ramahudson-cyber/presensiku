import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import {
  ChevronLeft, ChevronRight, Calendar, Sun, Moon, Sunset, CloudSun,
  Loader2, Info
} from "lucide-react";

const SHIFTS = [
  { code: "PG", name: "Pagi", icon: Sun, color: "text-amber-400", bg: "bg-amber-500/15", ring: "ring-amber-500/30" },
  { code: "SR", name: "Sore", icon: Sunset, color: "text-orange-400", bg: "bg-orange-500/15", ring: "ring-orange-500/30" },
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
    <div className="space-y-4 animate-fade-in min-w-0 pb-24 md:pb-6">
      {/* HEADER */}
      <div className="relative bg-gradient-to-br from-violet-600/15 via-purple-700/10 to-transparent rounded-2xl p-5 md:p-6 border border-white/10 overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-600/10 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none" />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-700 rounded-xl flex items-center justify-center shadow-lg shadow-violet-900/30">
            <Calendar size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Jadwal Shift Saya</h1>
            <p className="text-sm text-slate-400 mt-0.5">Kalender jadwal kerja bulanan</p>
          </div>
        </div>
      </div>

      {/* NAV + STATS */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5">
          <button onClick={() => nav(-1)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all">
            <ChevronLeft size={17} />
          </button>
          <span className="text-sm font-semibold text-white w-[136px] text-center select-none">{MONTHS[month]} {year}</span>
          <button onClick={() => nav(1)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all">
            <ChevronRight size={17} />
          </button>
        </div>
        {!isCurrentMonth && (
          <button onClick={goToday}
            className="px-3 py-1.5 rounded-xl border-gradient bg-transparent text-white text-xs font-medium transition-all active:scale-95">
            Hari Ini
          </button>
        )}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-slate-400 ml-auto">
          <span className="flex items-center gap-1"><Calendar size={12} /> {stats.total} hari</span>
        </div>
      </div>

      {/* LEGEND */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mr-1">Shift</span>
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
            <Loader2 size={28} className="animate-spin text-violet-400" />
            <p className="text-sm text-slate-400">Memuat jadwal...</p>
          </div>
        </div>
      ) : (
        <div className="bg-[#c190ff]/10 border border-white/10 rounded-2xl p-3 md:p-5 overflow-x-auto">
          <div className="min-w-[600px]">
            <div className="grid grid-cols-7 gap-2 mb-2">
              {DAY_SHORT.map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest py-1">
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
                    className={`relative aspect-[4/3] rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 text-xs
                      ${!day ? "invisible" : ""}
                      ${isToday ? "ring-2 ring-violet-500 ring-offset-2 ring-offset-[#05000a]" : ""}
                      ${!shiftInfo
                        ? isWeekend
                          ? "bg-white/[0.01]"
                          : "bg-white/[0.02]"
                        : `${shiftInfo.bg}`
                      }
                    `}>
                    <span className={`text-[11px] font-bold leading-none ${isToday ? "text-violet-300" : isWeekend && !shiftInfo ? "text-slate-600" : "text-slate-400"}`}>
                      {day}
                    </span>
                    {shiftInfo && (
                      <div className={`flex items-center gap-0.5 mt-0.5 ${shiftInfo.color}`}>
                        <shiftInfo.icon size={9} />
                        <span className="text-[7px] font-bold tracking-wider">{shiftInfo.name}</span>
                      </div>
                    )}
                    {!shiftInfo && isWeekend && (
                      <span className="text-[6px] text-slate-600 mt-0.5">Libur</span>
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
              <div key={s.code} className={`${s.bg} border ${s.ring.replace("ring", "border").replace("/30", "/20")} rounded-xl p-3 flex items-center gap-3`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.bg}`}>
                  <Icon size={16} className={s.color} />
                </div>
                <div>
                  <p className="text-base font-bold text-white">{count}</p>
                  <p className={`text-[10px] ${s.color}`}>{s.name}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FOOTER INFO */}
      <div className="flex items-center gap-2 p-3.5 rounded-xl bg-gradient-to-r from-sky-500/5 to-violet-500/5 border border-sky-500/10 text-[11px] text-slate-400">
        <div className="w-6 h-6 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
          <Info size={13} className="text-sky-400" />
        </div>
        <p>Jadwal ini ditetapkan oleh admin. Hubungi admin jika ada perubahan shift.</p>
      </div>
    </div>
  );
}
