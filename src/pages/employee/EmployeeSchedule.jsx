import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import BottomSheet from "../../components/BottomSheet";
import {
  ChevronLeft, ChevronRight, ChevronDown, Calendar, Sun, Moon, Sunset, CloudSun,
  Loader2, Info
} from "lucide-react";

// Light-mode tokens — per DESIGN.md
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
  rowBg: 'rgba(15,23,42,0.02)',
  iconBg: '#F5F3FF',
};

const SHIFTS = [
  { code: "PG", name: "Pagi", icon: Sun, badgeClass: "cal-badge-pg" },
  { code: "SR", name: "Sore", icon: Sunset, badgeClass: "cal-badge-sr" },
  { code: "SI", name: "Siang", icon: CloudSun, badgeClass: "cal-badge-si" },
  { code: "ML", name: "Malam", icon: Moon, badgeClass: "cal-badge-ml" },
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

  // Pull-to-refresh (page scroll)
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
    if (window.scrollY <= 0 && !isRefreshing) {
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

  const initials = user?.full_name?.charAt(0)?.toUpperCase() || "R";

  return (
    <div className="min-h-screen w-full font-sans absolute top-0 left-0 right-0 pb-24"
      style={{ background: T.bg, color: T.text }}
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>

      {/* ── HEADER — simple elegant (sama dengan Riwayat) ── */}
      <div className="pt-14 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} aria-label="Kembali"
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 hover:bg-white hover:shadow-sm active:scale-90"
              style={{ color: T.text }}>
              <ChevronLeft size={20} />
            </button>
            <span className="text-[17px] font-bold tracking-tight" style={{ color: T.text }}>Jadwal Shift</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover border" style={{ borderColor: 'rgba(191,0,255,0.15)' }} />
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold"
                style={{ background: T.iconBg, color: '#BF00FF', border: '1px solid rgba(191,0,255,0.15)' }}>
                {initials}
              </div>
            )}
            <span className="text-[9px] font-medium leading-none max-w-[72px] truncate text-center" style={{ color: T.sub }}>
              {user?.position || user?.role || "Pegawai"}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 mt-6 space-y-4">
        {/* Pull to refresh indicator */}
        <div className="flex items-center justify-center overflow-hidden transition-all duration-300"
          style={{ height: pullDistance > 0 ? `${pullDistance}px` : '0px', opacity: Math.min(pullDistance / 55, 1) }}>
          {isRefreshing ? (
            <Loader2 size={20} className="animate-spin" style={{ color: '#BF00FF' }} />
          ) : (
            <ChevronDown size={20} className="transition-transform duration-300" style={{ color: '#BF00FF', transform: pullDistance >= 55 ? 'rotate(180deg)' : 'none' }} />
          )}
        </div>

        {/* NAV + STATS */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={openMonthPicker}
            className="flex items-center gap-2 bg-white border rounded-2xl px-3.5 py-2 cursor-pointer transition-all active:scale-[0.97]"
            style={{ background: T.surface, borderColor: T.border, boxShadow: T.shadow }}>
            <Calendar size={15} className="shrink-0" style={{ color: T.textSec }} />
            <span className="text-sm font-semibold select-none min-w-[100px] text-left" style={{ color: T.text }}>{MONTHS[month]} {year}</span>
            <ChevronDown size={14} className="shrink-0" style={{ color: T.textMuted }} />
          </button>
          {!isCurrentMonth && (
            <button onClick={goToday}
              className="px-3 py-1.5 rounded-full border text-xs font-medium transition-all active:scale-95"
              style={{ borderColor: T.border, background: T.surface, color: T.textSec, boxShadow: T.shadow }}>
              Hari Ini
            </button>
          )}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border text-[11px] ml-auto"
            style={{ background: T.surface, borderColor: T.border, color: T.textSec, boxShadow: T.shadow }}>
            <span className="flex items-center gap-1"><Calendar size={12} /> {stats.total} hari</span>
          </div>
        </div>

        {/* LEGEND */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[8px] font-semibold uppercase tracking-wider mr-0.5" style={{ color: T.textSec }}>Shift</span>
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
              <div className="w-8 h-8 border-2 border-[#BF00FF] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm" style={{ color: T.textMuted }}>Memuat jadwal...</p>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl p-3 md:p-5 overflow-x-auto"
            style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
            <div className="grid grid-cols-7 gap-1.5 mb-1.5">
              {DAY_SHORT.map(d => (
                <div key={d} className="text-center text-[9px] font-bold uppercase tracking-widest py-1" style={{ color: T.textMuted }}>
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
                const ShiftIcon = shiftInfo ? shiftInfo.icon : null;

                return (
                  <div key={i}
                    className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center transition-all duration-200 cursor-default select-none
                      ${!day ? "invisible" : ""}
                      ${isToday ? "bg-white ring-2 ring-[#BF00FF] ring-offset-1 ring-offset-white shadow-[0_0_14px_rgba(191,0,255,0.25)]"
                        : shiftInfo ? shiftInfo.badgeClass
                        : isWeekend ? "bg-slate-100" : "bg-slate-50"}
                    `}>
                    <span className={`text-[10px] font-bold leading-none ${
                      isToday ? "text-[#BF00FF]"
                        : shiftInfo ? "" : isWeekend ? "text-slate-400" : "text-slate-600"
                    }`}>
                      {day}
                    </span>
                    {ShiftIcon && (
                      <ShiftIcon size={9} className={`mt-0.5 ${isToday ? "text-[#BF00FF]" : ""}`} />
                    )}
                    {!shiftInfo && isWeekend && (
                      <span className="text-[5px] text-slate-400 mt-0.5 leading-none">Libur</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TODAY SCHEDULE INFO */}
        {(() => {
          const nowD = new Date();
          const todayStr = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, "0")}-${String(nowD.getDate()).padStart(2, "0")}`;
          const todaySched = schedules[todayStr];
          const shiftInfo = todaySched ? SHIFT_MAP[todaySched.shift_code] : null;
          if (!todaySched || !shiftInfo) return null;
          return (
            <div className="rounded-xl p-3 text-center"
              style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <span className="text-[10px] font-medium">
                <span style={{ color: T.textSec }}>Jadwal hari ini: </span>
                <span style={{ color: T.text }}>
                  {nowD.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  {' '}<span style={{ color: '#BF00FF' }}>({shiftInfo.name})</span>
                </span>
              </span>
            </div>
          );
        })()}

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
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-white border text-[11px]"
          style={{ background: T.surface, borderColor: T.border, color: T.textSec, boxShadow: T.shadow }}>
          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: T.iconBg }}>
            <Info size={13} style={{ color: '#BF00FF' }} />
          </div>
          <p>Jadwal ini ditetapkan oleh admin. Hubungi admin jika ada perubahan shift.</p>
        </div>
      </div>

      {/* MONTH PICKER BOTTOM SHEET */}
      <BottomSheet open={showMonthPicker} onClose={() => setShowMonthPicker(false)}
        title="Pilih Bulan" subtitle={`Tahun ${pickerYear}`}>
        <div className="space-y-5">
          {/* Year nav */}
          <div className="flex items-center justify-center gap-6 py-2">
            <button onClick={() => setPickerYear(p => p - 1)}
              className="p-2 rounded-xl hover:bg-slate-100 transition-all" style={{ color: T.textSec }}>
              <ChevronLeft size={18} />
            </button>
            <span className="text-lg font-bold w-20 text-center select-none" style={{ color: T.text }}>{pickerYear}</span>
            <button onClick={() => setPickerYear(p => p + 1)}
              className="p-2 rounded-xl hover:bg-slate-100 transition-all" style={{ color: T.textSec }}>
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
                    ${isActive ? "bg-[#BF00FF] text-white shadow-lg"
                      : "bg-white border text-slate-600 hover:bg-slate-50"}`}
                  style={isActive ? { boxShadow: '0 8px 20px rgba(191,0,255,0.3)' } : { borderColor: T.border, background: T.surface }}>
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
