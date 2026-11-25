import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import usePullToRefresh from "../../hooks/usePullToRefresh";
import PullToRefreshIndicator from "../../components/PullToRefreshIndicator";
import Skeleton from "../../components/Skeleton";
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

// Normalisasi hasil query jadwal 1 bulan → map tanggal + statistik per shift
const buildMonthData = (rows) => {
  const m = {};
  const count = { total: 0 };
  (rows || []).forEach((x) => {
    m[x.date] = x;
    count.total++;
    count[x.shift_code] = (count[x.shift_code] || 0) + 1;
  });
  return { schedules: m, stats: count };
};

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
  const [popup, setPopup] = useState(null);
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
  const dateStr = (d) => d ? `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;

  // Cache data per bulan → pindah bulan instan (tanpa overlay loading).
  const monthCacheRef = useRef(new Map());
  const userId = user?.id;

  const fetchMonth = useCallback(async (y, m, { force = false } = {}) => {
    if (!userId) return null;
    const key = `${y}-${m}`;
    if (!force && monthCacheRef.current.has(key)) return monthCacheRef.current.get(key);
    const mm = String(m + 1).padStart(2, "0");
    const last = new Date(y, m + 1, 0).getDate();
    const { data } = await supabase
      .from("employee_schedules")
      .select("date, shift_code")
      .eq("user_id", userId)
      .gte("date", `${y}-${mm}-01`)
      .lte("date", `${y}-${mm}-${String(last).padStart(2, "0")}`);
    const res = buildMonthData(data);
    monthCacheRef.current.set(key, res);
    return res;
  }, [userId]);

  // Muat bulan tampil: pakai cache dulu supaya animasi geser tidak terpotong.
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    const key = `${year}-${month}`;
    const cached = monthCacheRef.current.get(key);
    if (cached) {
      setSchedules(cached.schedules);
      setStats(cached.stats);
      setLoading(false);
      return undefined;
    }
    // Cache miss: kosongkan data bulan lama (hindari angka stale), tanpa overlay.
    setSchedules({});
    setStats({ total: 0 });
    (async () => {
      try {
        const res = await fetchMonth(year, month);
        if (!cancelled && res) {
          setSchedules(res.schedules);
          setStats(res.stats);
        }
      } catch (e) {
        console.error("Gagal muat jadwal", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, year, month, fetchMonth]);

  // Prefetch bulan sebelum & sesudah → swipe berikutnya langsung tampil.
  useEffect(() => {
    if (!userId) return;
    [new Date(year, month + 1, 1), new Date(year, month - 1, 1)].forEach((d) => {
      const y = d.getFullYear();
      const m = d.getMonth();
      if (!monthCacheRef.current.has(`${y}-${m}`)) fetchMonth(y, m).catch(() => {});
    });
  }, [userId, year, month, fetchMonth]);

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

  // Pull-to-refresh (page scroll) — bypass cache bulan aktif
  const handleRefresh = useCallback(async () => {
    if (!userId) return;
    try {
      monthCacheRef.current.delete(`${year}-${month}`);
      const res = await fetchMonth(year, month, { force: true });
      if (res) { setSchedules(res.schedules); setStats(res.stats); }
    } catch (e) {
      console.error("Gagal refresh jadwal", e);
    }
  }, [userId, year, month, fetchMonth]);

  const { pullDistance, isRefreshing } = usePullToRefresh(handleRefresh);
  const cardRef = useRef(null);
  const stackOneRef = useRef(null);
  const stackTwoRef = useRef(null);
  // ── Geser kartu kalender untuk berpindah bulan (animasi tumpukan) ──
  const calWrapRef = useRef(null);
  let pdY = useRef(null);
  let dragDist = useRef(0);
  let suppressClick = useRef(false);
  let tapTarget = useRef(null);

  const applyDrag = (v) => {
    const dist = Math.max(-340, Math.min(340, v));
    if (cardRef.current) {
      cardRef.current.style.willChange = "transform";
      cardRef.current.style.transition = "none";
      cardRef.current.style.transform =
        `translateX(${dist * 0.72}px) rotate(${dist * 0.006}deg) scale(${1 - Math.abs(dist) * 0.00007})`;
    }
    if (stackOneRef.current) {
      stackOneRef.current.style.willChange = "transform";
      stackOneRef.current.style.transition = "none";
      stackOneRef.current.style.transform = `translateX(${dist * 0.26}px)`;
    }
    if (stackTwoRef.current) {
      stackTwoRef.current.style.willChange = "transform";
      stackTwoRef.current.style.transition = "none";
      stackTwoRef.current.style.transform = `translateX(${dist * 0.14}px)`;
    }
  };
  const springBack = () => {
    const ease = "transform .38s cubic-bezier(0.22, 1, 0.36, 1)";
    [cardRef, stackOneRef, stackTwoRef].forEach((ref) => {
      if (!ref.current) return;
      ref.current.style.transition = ease;
      ref.current.style.transform = "translateX(0) rotate(0deg) scale(1)";
    });
  };
  const changeMonthAnimated = (dir) => {
    if (animatingRef.current) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      changeMonth(dir);
      return;
    }
    animatingRef.current = true;
    const card = cardRef.current;
    const s1 = stackOneRef.current;
    const s2 = stackTwoRef.current;
    const easeOut = "transform .2s cubic-bezier(0.32, 0.72, 0, 1), opacity .16s ease-in";
    const easeIn = "transform .44s cubic-bezier(0.16, 1, 0.3, 1), opacity .26s ease-out";

    [card, s1, s2].forEach((el) => { if (el) el.style.willChange = "transform, opacity"; });

    // Fase keluar: kartu meluncur cepat + mengecil + miring halus
    if (card) {
      card.style.transition = easeOut;
      card.style.transform = `translateX(${dir * -104}%) rotate(${dir * -1.4}deg) scale(0.94)`;
      card.style.opacity = "0";
    }
    if (s1) { s1.style.transition = easeOut; s1.style.transform = `translateX(${dir * -18}px) scale(0.985)`; }
    if (s2) { s2.style.transition = easeOut; s2.style.transform = `translateX(${dir * -10}px) scale(0.97)`; }

    window.setTimeout(() => {
      changeMonth(dir);
      // Fase masuk: kartu baru datang dari arah swipe dengan easing spring
      if (card) {
        card.style.transition = "none";
        card.style.transform = `translateX(${dir * 88}%) rotate(${dir * 1.4}deg) scale(0.94)`;
        card.style.opacity = "0";
      }
      if (s1) { s1.style.transition = "none"; s1.style.transform = `translateX(${dir * 18}px) scale(0.985)`; }
      if (s2) { s2.style.transition = "none"; s2.style.transform = `translateX(${dir * 10}px) scale(0.97)`; }
      void card?.offsetHeight;
      if (card) {
        card.style.transition = easeIn;
        card.style.transform = "translateX(0) rotate(0deg) scale(1)";
        card.style.opacity = "1";
      }
      if (s1) { s1.style.transition = easeIn; s1.style.transform = "translateX(0) scale(1)"; }
      if (s2) { s2.style.transition = easeIn; s2.style.transform = "translateX(0) scale(1)"; }
      window.setTimeout(() => {
        animatingRef.current = false;
        [card, s1, s2].forEach((el) => {
          if (!el) return;
          el.style.transition = "";
          el.style.transform = "";
          el.style.opacity = "";
          el.style.willChange = "";
        });
      }, 450);
    }, 200);
  };

  const onWrapPointerDown = (e) => {
    if (animatingRef.current) return;
    pdY.current = e.clientX; dragDist.current = 0; suppressClick.current = false;
    tapTarget.current = e.target?.closest?.("button[data-key]") || null;
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
    const tap = tapTarget.current;
    pdY.current = null; dragDist.current = 0; tapTarget.current = null;
    if (d < -90) changeMonthAnimated(1);
    else if (d > 90) changeMonthAnimated(-1);
    else {
      springBack();
      // Tap tanggal: buka popover di pointerup (pointer capture membuat
      // event click ter-retarget ke wrapper, jadi onClick tombol tidak andal)
      if (tap && Math.abs(d) < 12) {
        suppressClick.current = true;
        openPopup(tap.dataset.key, tap);
      }
    }
  };
  const onWrapPointerCancel = () => { pdY.current = null; tapTarget.current = null; springBack(); };
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

  const popSched = popup ? schedules[popup.key] : null;
  const popDef = popSched ? getShiftDefinition(shiftDefs, { date: popup.key, shift_code: popSched.shift_code }) : null;
  const popJam = popDef ? fmtJam(popDef) : null;
  const popShiftName = popSched
    ? (shiftsList?.find((s) => s.code === popSched.shift_code)?.name || cap(popSched.shift_code))
    : null;
  const popDateLabel = popup?.key
    ? new Date(popup.key + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";

  // ── Popover kecil di atas tanggal (pengganti bottom sheet) ──
  const POPUP_W = 236;
  const openPopup = (key, el) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const half = POPUP_W / 2;
    const centerX = r.left + r.width / 2;
    const left = Math.min(Math.max(centerX, 16 + half), window.innerWidth - 16 - half);
    const placement = r.top > 210 ? "top" : "bottom";
    setSelected(key);
    setPopup({
      key,
      left,
      top: placement === "top" ? r.top - 10 : r.bottom + 10,
      placement,
      arrow: Math.min(half - 26, Math.max(-(half - 26), centerX - left)),
    });
  };
  const closePopup = () => setPopup(null);

  useEffect(() => {
    if (!popup) return undefined;
    const close = () => setPopup(null);
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [popup]);


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
              const shiftColor = sched ? colorFor(sched.shift_code) : null;
              return (
                <div key={i} className="relative aspect-square flex items-center justify-center">
                  {day ? (
                    <button type="button"
                      data-key={key}
                      onClick={(e) => openPopup(key, e.currentTarget)}
                      className={`relative w-full max-w-[44px] h-full flex flex-col items-center justify-center rounded-full border-none transition-all duration-150
                        ${!shiftColor && !isSel ? "bg-transparent hover:bg-[#EEF6FF]" : ""}`}
                      style={{
                        background: shiftColor || undefined,
                        boxShadow: isSel
                          ? shiftColor
                            ? "0 0 0 2.5px #0F172A, 0 8px 18px -6px rgba(4,26,74,0.45)"
                            : "0 0 0 2.5px #0F172A"
                          : shiftColor ? `0 6px 14px -7px ${shiftColor}b3` : null,
                      }}>
                      <span className="text-[13.5px] leading-none"
                        style={{
                          color: shiftColor ? "#fff" : isSel ? "#0F172A" : isToday ? "#1F74E0" : T.textSec,
                          fontWeight: isSel || isToday || shiftColor ? 800 : 700,
                        }}>
                        {day}
                      </span>
                      {isToday && shiftColor && (
                        <span className="rounded-full mt-1 bg-white" style={{ width: 4, height: 4 }} />
                      )}
                    </button>
                  ) : <span />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="text-center text-[10.5px] font-semibold mt-7" style={{ color: "rgba(255,255,255,0.9)" }}>
        Geser kartu kalender untuk berpindah bulan
      </p>


      {/* ── PREMIUM CARD: shift hari ini (hitam) + keterangan warna (putih) ── */}
      <div className="mx-4 mt-3 relative rounded-[26px] overflow-hidden"
        style={{ background: "#101828", boxShadow: "0 16px 36px rgba(4,26,74,0.42)" }}>
        <div className="flex items-center justify-between gap-3 px-[18px] pt-4 pb-4">
          <div className="min-w-0">
            <span className="block text-[9.5px] font-bold" style={{ color: "rgba(255,255,255,0.92)" }}>
              Keterangan shift hari ini
            </span>
            <div className="flex items-center gap-2 mt-1">
              {todayShift && (
                <span className="w-3 h-3 rounded-full flex-none"
                  style={{ background: colorFor(todayShift.shift_code) }} />
              )}
              <span className="text-[14px] font-extrabold truncate"
                style={{ color: "#fff", letterSpacing: "-0.01em" }}>
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
        <div className="bg-white rounded-[26px] px-4 pt-3 pb-3"
          style={{ boxShadow: "0 -8px 24px rgba(4,26,74,0.18)" }}>
          <p className="m-0 text-[11px] font-extrabold" style={{ color: T.textMuted }}>
            Keterangan warna shift · {MONTHS[month]} {year}
          </p>
          <div>
            {shiftsList === null ? (
              [0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-2 py-[6px]">
                  <Skeleton width={10} height={10} radius={999} />
                  <Skeleton width={104} height={10} />
                  <Skeleton width={40} height={16} radius={999} style={{ marginLeft: "auto" }} />
                  <Skeleton width={76} height={9} />
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
                  <span className="flex-none text-[10px] font-bold" style={{ color: "#64748B" }}>
                    {legendJamFor(s.code) || "—"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>


      {loading && (
        <div className="fixed inset-0 z-40 overflow-y-auto"
          style={{ background: "linear-gradient(168deg, #1B54DE 0%, #2F8BF8 58%, #1F74E0 100%)" }}>
          <div className="mx-auto max-w-md px-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 18px)" }}>
            <div className="flex items-center justify-between">
              <Skeleton dark width={36} height={36} radius={999} />
              <Skeleton dark width={110} height={16} />
              <span style={{ width: 36 }} />
            </div>
            <div className="mt-5 rounded-[28px] bg-white" style={{ padding: "16px 14px 14px" }}>
              <Skeleton width={128} height={18} style={{ margin: "0 auto 16px" }} />
              <div className="grid grid-cols-7" style={{ gap: 6, marginBottom: 8 }}>
                {[...Array(7)].map((_, i) => (
                  <Skeleton key={i} width={22} height={8} style={{ margin: "0 auto" }} />
                ))}
              </div>
              <div className="grid grid-cols-7">
                {[...Array(42)].map((_, i) => (
                  <div key={i} className="aspect-square flex items-center justify-center">
                    <Skeleton width={30} height={30} radius={999} />
                  </div>
                ))}
              </div>
            </div>
            <p className="text-center text-[10.5px] font-semibold mt-7" style={{ color: "rgba(255,255,255,0.9)" }}>
              Geser kartu kalender untuk berpindah bulan
            </p>
            <div className="mt-3 rounded-[26px] overflow-hidden" style={{ background: "#101828" }}>
              <div className="flex items-center justify-between px-[18px] pt-4 pb-4">
                <div style={{ display: "grid", gap: 8 }}>
                  <Skeleton dark width={110} height={9} />
                  <Skeleton dark width={150} height={14} />
                </div>
                <Skeleton dark width={92} height={24} radius={999} />
              </div>
              <div className="bg-white rounded-[26px] px-4 pt-3 pb-3" style={{ display: "grid", gap: 12 }}>
                <Skeleton width={170} height={10} />
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton width={10} height={10} radius={999} />
                    <Skeleton width="38%" height={10} />
                    <Skeleton width={40} height={16} radius={999} style={{ marginLeft: "auto" }} />
                    <Skeleton width={78} height={9} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── POPOVER PREMIUM DETAIL TANGGAL (di atas tanggal yang diklik) ── */}
      {popup && (
        <>
          <div className="fixed inset-0 z-40" onClick={closePopup} aria-hidden="true" />
          <div role="dialog" aria-label={`Detail jadwal ${popDateLabel}`}
            className="fixed z-50"
            style={{
              left: popup.left,
              top: popup.top,
              width: POPUP_W,
              transform: popup.placement === "top" ? "translate(-50%, -100%)" : "translate(-50%, 0)",
            }}>
            <div
              className={`relative bg-white rounded-[18px] animate-popover-in ${popup.placement === "top" ? "origin-bottom" : "origin-top"}`}
              style={{
                border: "1px solid rgba(15,23,42,0.07)",
                boxShadow: "0 18px 44px -14px rgba(15,23,42,0.38), 0 4px 12px rgba(15,23,42,0.06)",
              }}>
              <div className="px-3.5 pt-3 pb-2.5">
                <p className="m-0 text-[9.5px] font-bold uppercase" style={{ color: T.textMuted, letterSpacing: "0.05em" }}>
                  {popDateLabel}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2.5 h-2.5 rounded-full flex-none"
                    style={{ background: popSched ? colorFor(popSched.shift_code) : "#CBD5E1" }} />
                  <b className="text-[13px] font-extrabold truncate"
                    style={{ color: T.text, letterSpacing: "-0.01em" }}>
                    {popSched && popShiftName ? `Shift ${popShiftName}` : "Tidak ada jadwal"}
                  </b>
                </div>
                {popSched && popShiftName ? (
                  <>
                    <div className="flex items-center gap-1.5 mt-2 rounded-[10px] px-2 py-1.5"
                      style={{ background: "#F1F6FF" }}>
                      <Clock size={13} style={{ color: "#1F74E0" }} />
                      <span className="text-[10.5px] font-bold" style={{ color: "#1E3A8A" }}>
                        {popJam ? popJam.trim() : `Sesuai pengaturan instansi`}
                      </span>
                    </div>
                    <p className="m-0 mt-2 text-[9.5px] font-semibold" style={{ color: T.textMuted }}>
                      Ditetapkan oleh admin melalui kelola jadwal.
                    </p>
                  </>
                ) : (
                  <p className="m-0 mt-2 text-[9.5px] font-semibold leading-relaxed" style={{ color: T.textMuted }}>
                    Tidak ada penugasan shift untuk tanggal ini.
                  </p>
                )}
              </div>
              <span aria-hidden="true" className="absolute w-3 h-3 bg-white rotate-45"
                style={popup.placement === "top"
                  ? {
                    left: `calc(50% + ${popup.arrow}px)`,
                    bottom: -6,
                    borderRadius: 2,
                    borderRight: "1px solid rgba(15,23,42,0.07)",
                    borderBottom: "1px solid rgba(15,23,42,0.07)",
                  }
                  : {
                    left: `calc(50% + ${popup.arrow}px)`,
                    top: -6,
                    borderRadius: 2,
                    borderLeft: "1px solid rgba(15,23,42,0.07)",
                    borderTop: "1px solid rgba(15,23,42,0.07)",
                  }} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
