import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import usePullToRefresh from "../../hooks/usePullToRefresh";
import PullToRefreshIndicator from "../../components/PullToRefreshIndicator";
import { getShiftDefinition, getWitaDateKey, getZonaWaktuLabel } from "../../lib/shiftTime";
import { Clock } from "lucide-react";

// Token light-mode per DESIGN.md
const T = {
  border: "rgba(31,41,55,0.08)",
  div: "#F1F5F9",
  text: "#0F172A",
  textSec: "#475569",
  textMuted: "#94A3B8",
  iconBg: "#EEF6FF",
};

// Warna titik kalender per shift (satu aksen per shift)
const SHIFT_COLORS = {
  PG: "#10B981", SR: "#F59E0B", SI: "#3B82F6", ML: "#8B5CF6",
};
const NEUTRAL_COLOR = "#94A3B8";
const colorFor = (code) => SHIFT_COLORS[code] || NEUTRAL_COLOR;

const cap = (s) => (s ? s.trim().charAt(0).toUpperCase() + s.trim().slice(1) : s);

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

const fmtJam = (def) => {
  if (!def?.start_time || !def?.end_time) return null;
  return ` ${def.start_time.slice(0, 5).replace(":", ".")} - ${def.end_time.slice(0, 5).replace(":", ".")} ${getZonaWaktuLabel()}`;
};

export default function EmployeeSchedule() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [schedules, setSchedules] = useState({});
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0 });
  const [shiftsMaster, setShiftsMaster] = useState(null);
  // Definisi shift instansi (jam mulai/selesai per hari Senin-0)
  const [shiftDefs, setShiftDefs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [todayShift, setTodayShift] = useState(null);
  const animatingRef = useRef(false);

  // Master shift instansi (RLS org-scoped) — nama shift aktif untuk legenda
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ data }, { data: defs }] = await Promise.all([
          supabase.from("shifts").select("code, name, is_active").order("code"),
          supabase.from("shift_schedules")
            .select("shift_code, day_of_week, start_time, end_time, crosses_midnight, is_working_day"),
        ]);
        if (cancelled) return;
        if (data && data.length) setShiftsMaster(data);
        if (defs) setShiftDefs(defs);
      } catch { /* fallback statis */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Shift hari ini (real dari employee_schedules) — untuk kartu hitam
  const todayWita = getWitaDateKey();
  useEffect(() => {
    let cancelled = false;
    if (!user?.id) return undefined;
    (async () => {
      try {
        const { data } = await supabase
          .from("employee_schedules")
          .select("date, shift_code")
          .eq("user_id", user.id)
          .eq("date", todayWita)
          .maybeSingle();
        if (!cancelled) setTodayShift(data || null);
      } catch { if (!cancelled) setTodayShift(null); }
    })();
    return () => { cancelled = true; };
  }, [user?.id, todayWita]);

  // Legenda shift: hanya shift AKTIF instansi (is_active !== false).
  // null = master belum termuat -> legend dirender sebagai skeleton.
  const shiftsList = useMemo(() => {
    if (!shiftsMaster) return null;
    const seen = new Set();
    const out = [];
    shiftsMaster.forEach(s => {
      if (s.is_active === false) return;
      if (!s.code || seen.has(s.code)) return;
      seen.add(s.code);
      out.push({ code: s.code, name: cap(s.name) || s.code, color: colorFor(s.code) });
    });
    return out;
  }, [shiftsMaster]);

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
      const count = { total: 0 };
      (data || []).forEach(x => {
        m[x.date] = x;
        count.total++;
        count[x.shift_code] = (count[x.shift_code] || 0) + 1;
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

  const changeMonth = useCallback((dir) => {
    let m = month + dir;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    const prevDay = selected ? Number(selected.slice(8, 10)) : 1;
    const day = Math.min(prevDay, new Date(y, m + 1, 0).getDate());
    setMonth(m); setYear(y);
    setSelected(`${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }, [month, year, selected]);

  // Pull-to-refresh (page scroll)
  const handleRefresh = useCallback(async () => {
    if (!user?.id) return;
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
      const count = { total: 0 };
      (data || []).forEach(x => {
        m[x.date] = x;
        count.total++;
        count[x.shift_code] = (count[x.shift_code] || 0) + 1;
      });
      setSchedules(m);
      setStats(count);
    } catch (e) {
      console.error("Gagal refresh jadwal", e);
    }
  }, [user?.id, year, month, lastDay]);

  const { pullDistance, isRefreshing } = usePullToRefresh(handleRefresh);
  const cardRef = useRef(null);
  const stackOneRef = useRef(null);
  const stackTwoRef = useRef(null);
  // ── Geser kartu kalender untuk berpindah bulan (animasi tumpukan) ──
  const calWrapRef = useRef(null);
  let pdY = useRef(null);
  let dragDist = useRef(0);
  let suppressClick = useRef(false);

  const applyDrag = (v) => {
    if (cardRef.current) {
      cardRef.current.style.transition = "none";
      cardRef.current.style.transform = `translateX(${v * 0.6}px)`;
    }
    if (stackOneRef.current) {
      stackOneRef.current.style.transition = "none";
      stackOneRef.current.style.transform = `translateX(${v * 0.3}px)`;
    }
    if (stackTwoRef.current) {
      stackTwoRef.current.style.transition = "none";
      stackTwoRef.current.style.transform = `translateX(${v * 0.16}px)`;
    }
  };
  const springBack = () => {
    [cardRef, stackOneRef, stackTwoRef].forEach((ref) => {
      if (!ref.current) return;
      ref.current.style.transition = "transform .34s cubic-bezier(0.22, 1, 0.36, 1)";
      ref.current.style.transform = "translateX(0)";
    });
  };
  const changeMonthAnimated = (dir) => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    const easeOut = "transform .45s cubic-bezier(0.4, 0, 0.2, 1), opacity .45s ease";
    if (cardRef.current) {
      cardRef.current.style.transition = easeOut;
      cardRef.current.style.transform = `translateX(${dir * -108}%) scale(0.96)`;
      cardRef.current.style.opacity = "0";
    }
    if (stackOneRef.current) {
      stackOneRef.current.style.transition = easeOut;
      stackOneRef.current.style.transform = `translateX(${dir * -26}px)`;
    }
    if (stackTwoRef.current) {
      stackTwoRef.current.style.transition = easeOut;
      stackTwoRef.current.style.transform = `translateX(${dir * -16}px)`;
    }
    window.setTimeout(() => {
      changeMonth(dir);
      if (cardRef.current) {
        cardRef.current.style.transition = "none";
        cardRef.current.style.transform = `translateX(${dir * 108}%) scale(0.96)`;
        cardRef.current.style.opacity = "0";
      }
      if (stackOneRef.current) stackOneRef.current.style.transform = `translateX(${dir * 26}px)`;
      if (stackTwoRef.current) stackTwoRef.current.style.transform = `translateX(${dir * 16}px)`;
      void cardRef.current?.offsetHeight;
      const easeIn = "transform .58s cubic-bezier(0.22, 1, 0.36, 1), opacity .58s ease";
      if (cardRef.current) {
        cardRef.current.style.transition = easeIn;
        cardRef.current.style.transform = "translateX(0) scale(1)";
        cardRef.current.style.opacity = "1";
      }
      if (stackOneRef.current) stackOneRef.current.style.transform = "translateX(0)";
      if (stackTwoRef.current) stackTwoRef.current.style.transform = "translateX(0)";
      window.setTimeout(() => { animatingRef.current = false; }, 580);
    }, 430);
  };

  const onWrapPointerDown = (e) => {
    if (animatingRef.current) return;
    pdY.current = e.clientX; dragDist.current = 0; suppressClick.current = false;
    calWrapRef.current?.setPointerCapture(e.pointerId);
  };
  const onWrapPointerMove = (e) => {
    if (pdY.current === null || animatingRef.current) return;
    dragDist.current = e.clientX - pdY.current;
    if (Math.abs(dragDist.current) > 12) suppressClick.current = true;
    applyDrag(dragDist.current);
  };
  const onWrapPointerUp = () => {
    if (pdY.current === null || animatingRef.current) { pdY.current = null; return; }
    const d = dragDist.current;
    pdY.current = null; dragDist.current = 0;
    if (d < -90) changeMonthAnimated(1);
    else if (d > 90) changeMonthAnimated(-1);
    else springBack();
  };
  const onWrapPointerCancel = () => { pdY.current = null; springBack(); };
  const onWrapClickCapture = (e) => {
    if (suppressClick.current) { e.stopPropagation(); e.preventDefault(); suppressClick.current = false; }
  };

  // ── Bottom sheet detail tanggal ──
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const todaySched = isCurrentMonth ? schedules[todayStr] : todayShift;
  const todayDef = todaySched ? getShiftDefinition(shiftDefs, { date: todayStr, shift_code: todaySched.shift_code }) : null;
  const todayJam = todayDef ? fmtJam(todayDef) : null;
  const todayShiftName = todaySched
    ? (shiftsList?.find((s) => s.code === todaySched.shift_code)?.name || cap(todaySched.shift_code))
    : null;

  // Jam legenda: definisi pertama shift tsb pada bulan tampil (dari jadwal riil)
  const legendJamFor = (code) => {
    const dates = Object.keys(schedules).filter((d) => schedules[d]?.shift_code === code).sort();
    for (const date of dates) {
      const jam = fmtJam(getShiftDefinition(shiftDefs, { date, shift_code: code }));
      if (jam) return jam.trim();
    }
    return null;
  };

  const sheetSched = selected ? schedules[selected] : null;
  const sheetDef = sheetSched ? getShiftDefinition(shiftDefs, { date: selected, shift_code: sheetSched.shift_code }) : null;
  const sheetJam = sheetDef ? fmtJam(sheetDef) : null;
  const sheetShiftName = sheetSched
    ? (shiftsList?.find((s) => s.code === sheetSched.shift_code)?.name || cap(sheetSched.shift_code))
    : null;


  return (
    <div className="min-h-screen w-full font-sans absolute top-0 left-0 right-0 pb-24 overflow-hidden"
      style={{ background: "linear-gradient(168deg, #1B54DE 0%, #2F8BF8 58%, #1F74E0 100%)", color: "#fff" }}>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      {/* ── TOPBAR — kembali tanpa background, judul di tengah ── */}
      <div className="relative flex items-center" style={{ padding: "calc(env(safe-area-inset-top, 0px) + 12px) 16px 8px" }}>
        <button type="button" onClick={() => navigate(-1)} aria-label="Kembali"
          className="w-11 h-11 flex-none rounded-full grid place-items-center text-white hover:bg-white/10 active:scale-95 transition-all">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7"/></svg>
        </button>
        <h1 className="flex-1 text-center text-[19px] font-extrabold m-0" style={{ letterSpacing: "-0.02em", color: "#fff" }}>
          Jadwal Kerja
        </h1>
        <span className="w-11 flex-none" />
      </div>

      {/* ── KALENDER TUMPUK ── */}
      <div ref={calWrapRef}
        onPointerDown={onWrapPointerDown}
        onPointerMove={onWrapPointerMove}
        onPointerUp={onWrapPointerUp}
        onPointerCancel={onWrapPointerCancel}
        onClickCapture={onWrapClickCapture}
        className="relative mx-4 mt-2 select-none"
        style={{ touchAction: "pan-y" }}>
        <div ref={stackTwoRef} aria-hidden="true"
          className="absolute bg-white pointer-events-none"
          style={{ left: 32, right: -16, top: 20, bottom: -16, borderRadius: 26, opacity: 0.22 }} />
        <div ref={stackOneRef} aria-hidden="true"
          className="absolute bg-white pointer-events-none"
          style={{ left: 24, right: -8, top: 12, bottom: -10, borderRadius: 26, opacity: 0.5 }} />
        <div ref={cardRef}
          className="relative bg-white overflow-hidden cursor-grab active:cursor-grabbing"
          style={{ borderRadius: 28, padding: "16px 14px 14px", boxShadow: "0 22px 48px rgba(4, 26, 74, 0.42)" }}>
          <div className="relative text-center text-[20px] font-extrabold m-0"
            style={{ letterSpacing: "-0.02em", color: T.text, lineHeight: 1.1, marginTop: -4, marginBottom: 14 }}>
            {MONTHS[month]} {year}
          </div>
          <div className="grid grid-cols-7 mb-1">
            {DAY_SHORT.map((d) => (
              <div key={d} className="text-center text-[9.5px] font-bold" style={{ color: T.textMuted }}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const key = dateStr(day);
              const sched = key ? schedules[key] : undefined;
              const isToday = key === todayWita;
              const isSel = key && key === selected;
              return (
                <div key={i} className="relative aspect-square flex items-center justify-center">
                  {day ? (
                    <button type="button"
                      onClick={() => { setSelected(key); setSheetOpen(true); }}
                      className={`relative w-full max-w-[44px] h-full flex flex-col items-center justify-center rounded-full border-none transition-colors duration-150
                        ${isSel ? "bg-[#2F8BF8]" : "bg-transparent hover:bg-[#EEF6FF]"}`}
                      style={isSel ? { boxShadow: "0 8px 18px -4px rgba(47,139,248,0.6)" } : null}>
                      <span className="text-[13.5px] font-bold leading-none"
                        style={{ color: isSel ? "#fff" : isToday ? "#1F74E0" : T.textSec, fontWeight: isSel || isToday ? 800 : 700 }}>
                        {day}
                      </span>
                      {sched && (
                        <span className="rounded-full mt-1"
                          style={{ width: 5, height: 5, background: colorFor(sched.shift_code) }} />
                      )}
                    </button>
                  ) : <span />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="text-center text-[10.5px] mt-4" style={{ color: "rgba(255,255,255,0.55)" }}>
        Geser kartu kalender untuk berpindah bulan
      </p>


      {/* ── PREMIUM CARD: shift hari ini (hitam) + keterangan warna (putih) ── */}
      <div className="mx-4 mt-9 relative" style={{ aspectRatio: "1.52 / 1", minHeight: 210 }}>
        <div className="absolute inset-0 rounded-[26px]" style={{ background: "#101828", boxShadow: "0 16px 36px rgba(4,26,74,0.42)" }} />
        <div className="absolute flex items-center justify-between gap-3 px-[18px]"
          style={{ top: 0, left: 0, right: 0, height: "34%" }}>
          <div className="min-w-0">
            <span className="block text-[9.5px] font-semibold" style={{ color: "rgba(255,255,255,0.62)" }}>
              Keterangan shift hari ini
            </span>
            <div className="flex items-center gap-2 mt-1">
              {todayShift && (
                <span className="w-3 h-3 rounded-full flex-none"
                  style={{ background: colorFor(todayShift.shift_code) }} />
              )}
              <span className="text-[14px] font-extrabold truncate" style={{ color: "#fff" }} style={{ letterSpacing: "-0.01em" }}>
                {todayShiftName || "Tidak ada jadwal hari ini"}
              </span>
            </div>
          </div>
          {todayJam && (
            <span className="flex-none text-[10.5px] font-bold whitespace-nowrap"
              style={{ color: "#fff", background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.24)", borderRadius: 999, padding: "5px 11px" }}>
              {todayJam.trim()}
            </span>
          )}
        </div>
        <div className="absolute bg-white rounded-[26px] px-4 pt-3 pb-2"
          style={{ inset: "34% 0 0 0", boxShadow: "0 -8px 24px rgba(4,26,74,0.18)" }}>
          <p className="m-0 text-[11px] font-extrabold" style={{ color: T.textMuted }}>
            Keterangan warna shift · {MONTHS[month]} {year}
          </p>
          <div>
            {shiftsList === null ? (
              [0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-2 py-2">
                  <span className="inline-block h-4 w-16 rounded-full bg-slate-200/80 animate-pulse" />
                </div>
              ))
            ) : shiftsList.length === 0 ? (
              <p className="text-[11px] font-semibold py-2 m-0" style={{ color: T.textMuted }}>Belum ada shift aktif.</p>
            ) : (
              shiftsList.map((s) => (
                <div key={s.code} className="flex items-center gap-2 py-[6px]">
                  <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: s.color }} />
                  <span className="flex-1 min-w-0 text-[11.5px] font-bold truncate" style={{ color: T.text }}>
                    Shift {s.name}
                  </span>
                  <span className="flex-none text-[9.5px] font-extrabold rounded-full px-2 py-0.5"
                    style={{ color: "#1F74E0", background: T.iconBg }}>
                    {stats[s.code] || 0} hari
                  </span>
                  <span className="flex-none text-[9.5px] font-medium" style={{ color: T.textMuted }}>
                    {legendJamFor(s.code) || "—"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>


      {loading && !isCurrentMonth && Object.keys(schedules).length === 0 && (
        <div className="fixed inset-0 z-40 flex items-center justify-center" style={{ background: "rgba(27,84,222,0.92)" }}>
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold text-white">Memuat jadwal...</p>
          </div>
        </div>
      )}

      {/* ── BOTTOM SHEET DETAIL TANGGAL ── */}
      {sheetOpen && (
        <>
          <div className="fixed inset-0 z-50" style={{ background: "rgba(15,23,42,0.46)" }}
            onClick={() => setSheetOpen(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-labelledby="jadwal-sheet-title"
            className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md flex flex-col overflow-hidden"
            style={{
              height: "min(72%, 620px)", background: "#fff",
              borderRadius: "28px 28px 0 0", boxShadow: "0 -10px 34px rgba(15,23,42,0.14)",
            }}>
            <div className="flex justify-center pt-2.5 pb-1 cursor-pointer" onClick={() => setSheetOpen(false)} aria-hidden="true">
              <span className="rounded-full" style={{ width: 44, height: 5, background: "#E2E8F0" }} />
            </div>
            <header className="flex items-center gap-3 px-5" style={{ paddingTop: 6, paddingBottom: 14 }}>
              <div className="flex-1 min-w-0">
                <h2 id="jadwal-sheet-title" className="m-0 text-[17px] font-extrabold"
                  style={{ letterSpacing: "-0.02em", color: T.text }}>Detail Jadwal</h2>
                <p className="text-[11.5px] mt-1 m-0" style={{ color: T.textMuted }}>
                  {selected ? new Date(selected + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—"}
                </p>
              </div>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="Tutup"
                className="w-[34px] h-[34px] flex-none rounded-full flex items-center justify-center border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] transition-colors"
                style={{ color: T.textSec }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6 6 18" /></svg>
              </button>
            </header>
            <div className="h-px" style={{ background: T.div }} />
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
              {sheetSched && sheetShiftName ? (
                <>
                  <div className="flex items-center gap-3 rounded-[18px] px-4 py-[14px]"
                    style={{ background: T.iconBg }}>
                    <span className="w-[46px] h-[46px] rounded-full flex items-center justify-center flex-none text-white"
                      style={{ background: colorFor(sheetSched.shift_code) }}>
                      <Clock size={22} />
                    </span>
                    <div>
                      <p className="m-0 text-[16px] font-extrabold" style={{ color: T.text, letterSpacing: "-0.01em" }}>
                        Shift {sheetShiftName}
                      </p>
                      <span className="block mt-0.5 text-[10.5px] font-semibold" style={{ color: T.textMuted }}>
                        Ditetapkan oleh admin
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 rounded-[16px] px-4 py-1"
                    style={{ background: "#F8FAFD" }}>
                    <div className="flex items-center justify-between gap-3 py-2.5">
                      <span className="text-[11px] font-semibold" style={{ color: T.textMuted }}>Jam kerja</span>
                      <b className="text-[12px] font-extrabold" style={{ color: T.text }}>
                        {sheetJam ? sheetJam.trim() : "Sesuai pengaturan instansi"}
                      </b>
                    </div>
                    <div className="flex items-center justify-between gap-3 py-2.5"
                      style={{ borderTop: `1px solid ${T.div}` }}>
                      <span className="text-[11px] font-semibold" style={{ color: T.textMuted }}>Zona waktu</span>
                      <b className="text-[12px] font-extrabold" style={{ color: T.text }}>{getZonaWaktuLabel()} (UTC+8)</b>
                    </div>
                    <div className="flex items-center justify-between gap-3 py-2.5"
                      style={{ borderTop: `1px solid ${T.div}` }}>
                      <span className="text-[11px] font-semibold" style={{ color: T.textMuted }}>Bulan</span>
                      <b className="text-[12px] font-extrabold" style={{ color: T.text }}>{MONTHS[month]} {year}</b>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-10">
                  <b className="block text-[13.5px] font-extrabold" style={{ color: T.text }}>Tidak ada jadwal</b>
                  <p className="mt-1.5 mb-0 mx-auto max-w-[240px] text-[11px] leading-relaxed" style={{ color: T.textMuted }}>
                    Tanggal ini tidak memiliki penugasan shift. Jadwal ditetapkan oleh admin melalui halaman kelola jadwal.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
