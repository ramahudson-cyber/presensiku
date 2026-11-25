import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getAttendanceHistory } from "../../services/attendanceService";
import { supabase } from "../../lib/supabase";
import {
  getShiftDefinition, getWitaParts, isShiftEnded, getEarlyLeaveInfo, formatDuration,
} from "../../lib/shiftTime";
import usePullToRefresh from "../../hooks/usePullToRefresh";
import PullToRefreshIndicator from "../../components/PullToRefreshIndicator";
import Skeleton from "../../components/Skeleton";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/**
 * Halaman Riwayat Absensi (pegawai).
 *
 * Desain mengikuti preview yang disetujui: header gradasi biru dengan
 * tombol kembali + judul, pill bulan mengambang, kartu "Ringkasan Kehadiran"
 * dengan donat multi-segmen, kartu Statistik Tambahan, dan daftar riwayat
 * bergaya baris dengan badge status + tombol "Lihat Semua".
 *
 * Logika data tetap sama seperti sebelumnya: getAttendanceHistory +
employee_schedules + shift_schedules, derivasi alpha, deteksi sanggahan,
dan perhitungan pulang cepat.
 */

/** Turunkan baris alpha (jadwal kerja lewat tanpa absen). */
function deriveAlphaRows(attRows, schedules, shiftDefinitions, serverNow, userId) {
  const attended = new Set((attRows || []).map((r) => r.date));
  return (schedules || [])
    .filter((s) => !attended.has(s.date) && isShiftEnded(
      s.date, getShiftDefinition(shiftDefinitions, s), serverNow
    ))
    .map((s) => ({
      id: `alpha-${s.date}`,
      user_id: userId,
      date: s.date,
      shift_code: s.shift_code,
      attendance_status: "alpha",
      is_late: false,
      late_minutes: 0,
      clock_in_time: null,
      clock_out_time: null,
      location_in: null,
    }));
}

function StatusIcon({ kind, size = 15, stroke = 2.8 }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round" };
  if (kind === "clock") return <svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></svg>;
  if (kind === "close") return <svg {...p}><path d="M6 18L18 6M6 6l12 12" /></svg>;
  if (kind === "plus") return <svg {...p}><path d="M12 5v14M5 12h14" /></svg>;
  return <svg {...p}><path d="M5 13l4 4L19 7" /></svg>;
}

export default function EmployeeHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const nowParts = getWitaParts(new Date());
  const [year, setYear] = useState(nowParts.year);
  const [month, setMonth] = useState(nowParts.month - 1);
  const [history, setHistory] = useState([]);
  const [schedList, setSchedList] = useState([]);
  const [shiftDefs, setShiftDefs] = useState([]);
  const [workingDaysPassed, setWorkingDaysPassed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [monthPicker, setMonthPicker] = useState(false);

  const todayWita = getWitaParts(new Date()).dateKey;
  const isCurrentMonth = nowParts.year === year && nowParts.month - 1 === month;
  const periodLabel = `${MONTHS[month]} ${year}`;

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);
    setFetchError(null);

    const lastDay = new Date(year, month + 1, 0).getDate();
    const dateFrom = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const dateTo = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const schedDateTo = isCurrentMonth ? todayWita : dateTo;

    try {
      const [{ data: serverTimeData }, attData, schedRes, shiftDefinitionsRes] = await Promise.all([
        supabase.rpc("get_server_time"),
        getAttendanceHistory(user.id, null, dateFrom, dateTo),
        supabase
          .from("employee_schedules")
          .select("date, shift_code")
          .eq("user_id", user.id)
          .gte("date", dateFrom)
          .lte("date", schedDateTo),
        supabase
          .from("shift_schedules")
          .select("shift_code, day_of_week, end_time, crosses_midnight, is_working_day"),
      ]);

      const serverNow = new Date(serverTimeData || Date.now());
      const shiftDefinitions = shiftDefinitionsRes.data || [];
      const schedules = schedRes.data || [];

      setShiftDefs(shiftDefinitions);
      setSchedList(schedules);
      setHistory([...(attData || []), ...deriveAlphaRows(attData, schedules, shiftDefinitions, serverNow, user.id)]
        .sort((a, b) => b.date.localeCompare(a.date)));
      setWorkingDaysPassed(schedules.filter((schedule) => isShiftEnded(
        schedule.date,
        getShiftDefinition(shiftDefinitions, schedule),
        serverNow
      )).length);
    } catch (e) {
      console.error(e);
      setFetchError("Gagal memuat data. Periksa koneksi.");
      setHistory([]);
      setWorkingDaysPassed(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const kick = setTimeout(() => { if (!cancelled) fetchData(); }, 0);
    return () => { cancelled = true; clearTimeout(kick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, year, month]);

  const { pullDistance, isRefreshing } = usePullToRefresh(fetchData);

  // ── Hitungan ──
  const hadir = history.filter((r) => r.attendance_status === "hadir").length;
  const terlambat = history.filter((r) => r.attendance_status === "terlambat").length;
  const izin = history.filter((r) => r.attendance_status === "izin").length;
  const sakit = history.filter((r) => r.attendance_status === "sakit").length;
  const totalHadir = hadir + terlambat;
  const alphaCount = Math.max(0, workingDaysPassed - totalHadir - izin - sakit);
  const totalRecorded = totalHadir + izin + sakit + alphaCount;

  const percent = (n) => (totalRecorded > 0 ? Math.round((n / totalRecorded) * 100) : 0);
  const pctHadir = percent(totalHadir);

  // Predikat sederhana berdasarkan persentase kehadiran.
  const predikat = pctHadir >= 85
    ? { label: "Baik", color: "#059669", bg: "#ECFDF5", border: "rgba(16,185,129,0.25)" }
    : pctHadir >= 70
      ? { label: "Cukup", color: "#B45309", bg: "#FFFBEB", border: "rgba(245,158,11,0.25)" }
      : { label: "Perlu perhatian", color: "#DC2626", bg: "#FEF2F2", border: "rgba(239,68,68,0.22)" };

  // ── Baris riwayat siap render ──
  const rows = useMemo(() => history.map((item, i) => {
    const st = item.attendance_status || "alpha";
    const isSanggah = (item.notes || "").toLowerCase().includes("dikoreksi via sanggahan");
    const isLate = st === "terlambat" && !isSanggah;
    const isLeave = st === "izin" || st === "sakit";
    const isHadir = st === "hadir";

    const inStr = isLeave || isSanggah || !item.clock_in_time
      ? "-"
      : new Date(item.clock_in_time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" }).replace(":", ".");
    const outStr = isLeave || isSanggah || !item.clock_out_time
      ? "-"
      : new Date(item.clock_out_time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" }).replace(":", ".");

    const d = new Date(item.date + "T00:00:00");
    const dayShort = d.toLocaleDateString("id-ID", { weekday: "short" });
    const dateNum = String(d.getDate());
    const monthShort = d.toLocaleDateString("id-ID", { month: "short" });

    let label = "Alpha";
    let badge = "Alpha";
    if (isSanggah) { label = "Koreksi"; badge = "Koreksi"; }
    else if (isLate) { label = "Terlambat"; badge = `Terlambat ${item.late_minutes || 0} menit`; }
    else if (isHadir) {
      const sched = schedList.find((s) => s.date === item.date);
      const def = getShiftDefinition(shiftDefs, { date: item.date, shift_code: item.shift_code || sched?.shift_code });
      const early = getEarlyLeaveInfo(item.clock_out_time, item.date, def, 0);
      label = early ? "Pulang Cepat" : "Hadir";
      badge = early ? `Pulang cepat ${formatDuration(early.earlyMinutes)}` : "Tepat Waktu";
    } else if (st === "izin") { label = "Izin"; badge = "Izin"; }
    else if (st === "sakit") { label = "Sakit"; badge = "Sakit"; }

    const styleKey = isHadir ? "hadir" : isLate ? "terlambat" : st === "izin" ? "izin" : st === "sakit" ? "sakit" : "alpha";

    return {
      key: item.id || `${item.date}-${i}`,
      date: item.date, dayShort, dateNum, monthShort,
      label, badge, styleKey,
      time: `${inStr} – ${outStr}`,
    };
  }), [history, schedList, shiftDefs]);

  const earlyCount = rows.filter((r) => r.label === "Pulang Cepat").length;
  const onTimePct = totalHadir > 0 ? Math.round((hadir / totalHadir) * 100) : 0;

  const CARD = {
    background: "#fff",
    borderRadius: 20,
    border: "1px solid #EEF2F9",
    boxShadow: "0 8px 22px -16px rgba(15,23,42,0.35)",
  };

  const COLORS = {
    hadir:     { bg: "#2F8BF8", chip: "rgba(47,139,248,0.12)", text: "#2F8BF8", icon: "check" },
    terlambat: { bg: "#F59E0B", chip: "rgba(245,158,11,0.14)", text: "#D97706", icon: "clock" },
    izin:      { bg: "#F59E0B", chip: "rgba(245,158,11,0.14)", text: "#D97706", icon: "clock" },
    sakit:     { bg: "#10B981", chip: "rgba(16,185,129,0.14)", text: "#059669", icon: "check" },
    alpha:     { bg: "#EF4444", chip: "rgba(239,68,68,0.12)",  text: "#DC2626", icon: "close" },
  };

  const BAR_GRAD = {
    hadir: "linear-gradient(180deg,#5FAEFF 0%,#2F8BF8 62%,#1F74E0 100%)",
    izin:  "linear-gradient(180deg,#FCD77A 0%,#F59E0B 62%,#D97706 100%)",
    sakit: "linear-gradient(180deg,#5EE0B0 0%,#10B981 62%,#059669 100%)",
    alpha: "linear-gradient(180deg,#FCA5A5 0%,#EF4444 62%,#DC2626 100%)",
  };



  const goThisMonth = () => {
    setMonth(nowParts.month - 1);
    setYear(nowParts.year);
    setMonthPicker(false);
  };

  const cols = [
    { key: "hadir", label: "Hadir", value: totalHadir, color: "#2F8BF8", icon: "check" },
    { key: "izin", label: "Izin", value: izin, color: "#F59E0B", icon: "clock" },
    { key: "sakit", label: "Sakit", value: sakit, color: "#10B981", icon: "plus" },
    { key: "alpha", label: "Alpha", value: alphaCount, color: "#EF4444", icon: "close" },
  ];

  // Batang grafik: tinggi proporsional terhadap total hari tercatat (skala 0-100%),
  // status tanpa catatan tetap tampil sebagai stub 6px agar terbaca "0".
  const chartBars = cols.map((c) => ({
    ...c,
    pct: percent(c.value),
    height: totalRecorded > 0 ? Math.max(6, (c.value / totalRecorded) * 168) : 6,
  }));

  return (
    <div className="hero-card-bg min-h-screen w-full absolute top-0 left-0 right-0 flex flex-col" style={{ background: "#EEF3FB" }}>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      {/* HEADER */}
      <div className="relative shrink-0" style={{ zIndex: 20 }}>
        <header
          className="relative overflow-hidden"
          style={{
            background: "linear-gradient(148deg, #2E76F6 0%, #2F8BF8 50%, #3F93FD 100%)",
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
            paddingBottom: 46,
          }}
        >
          <span className="absolute rounded-full pointer-events-none" style={{ width: 214, height: 214, right: -84, bottom: -122, background: "rgba(255,255,255,0.10)" }} />
          <span className="absolute rounded-full pointer-events-none" style={{ width: 138, height: 138, left: -52, bottom: -66, background: "rgba(255,255,255,0.08)" }} />
          <span className="absolute rounded-full pointer-events-none" style={{ width: 86, height: 86, right: 30, top: -40, background: "rgba(255,255,255,0.10)" }} />

          <div className="relative px-4 flex items-start justify-between">
            <button type="button" onClick={() => navigate("/employee")} aria-label="Kembali"
              className="w-11 h-11 rounded-full active:scale-95 transition flex items-center justify-center shrink-0"
              style={{ background: "rgba(255,255,255,0.22)", color: "#fff" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex-1 min-w-0 text-center px-1 pt-0.5">
              <h1 className="text-[19px] font-extrabold tracking-tight leading-tight" style={{ color: "#fff" }}>
                Riwayat Absensi
              </h1>
              <p className="text-[11px] font-medium mt-1 leading-tight" style={{ color: "rgba(255,255,255,0.86)" }}>
                Pantau kehadiran Anda dengan mudah
              </p>
            </div>

            {/* Spacer — ikon kalender di sini dihapus; pilih periode cukup
                lewat pill bulan di bawah header. */}
            <span className="w-11 shrink-0" />
          </div>
        </header>

        {/* PILL BULAN — mengambang di batas header */}
        <div className="absolute inset-x-0 flex justify-center" style={{ bottom: -22, zIndex: 30 }}>
          <div className="relative">
            <button type="button" onClick={() => setMonthPicker((v) => !v)}
              className="inline-flex items-center gap-2.5 pl-3.5 pr-3 py-2.5 rounded-full active:scale-[0.98] transition"
              style={{ background: "#fff", boxShadow: "0 10px 26px -10px rgba(15,23,42,0.45)" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2F8BF8" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="3.4" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              <span className="text-[14px] font-extrabold text-slate-900 tracking-tight">{periodLabel}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ transform: monthPicker ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {monthPicker && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 py-1.5 z-40">
                <p className="px-3.5 py-1 text-[9.5px] font-bold tracking-widest text-slate-400">Bulan ini</p>
                <button type="button" onClick={goThisMonth}
                  className="w-full px-3.5 py-2 text-left text-[12.5px] font-semibold transition"
                  style={{ color: "#2F8BF8" }}>
                  {MONTHS[nowParts.month - 1]} {nowParts.year}
                </button>
                <div className="my-1 h-px bg-slate-100" />
                <div className="grid grid-cols-1 max-h-56 overflow-y-auto">
                  {MONTHS.map((nm, i) => (
                    <button key={nm} type="button" onClick={() => { setMonth(i); setMonthPicker(false); }}
                      className="w-full px-3.5 py-1.5 text-left text-[12px] hover:bg-slate-50 transition flex items-center justify-between"
                      style={{ color: month === i ? "#2F8BF8" : "#475569", fontWeight: month === i ? 800 : 500 }}>
                      {nm}
                      <span className="flex items-center gap-1">
                        <span onClick={(e) => { e.stopPropagation(); setYear((y) => Math.max(2020, y - 1)); }} className="px-1.5 text-slate-400">‹</span>
                        <span className="text-[10px] text-slate-400">{year}</span>
                        <span onClick={(e) => { e.stopPropagation(); setYear((y) => y + 1); }} className="px-1.5 text-slate-400">›</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SHEET PUTIH */}
      <div className="relative flex-1 min-h-0 overflow-y-auto bg-white"
        style={{ marginTop: -26, borderTopLeftRadius: 28, borderTopRightRadius: 28, zIndex: 10 }}>
        <div className="px-4 pb-8" style={{ paddingTop: 62 }}>
          {loading ? (
            <div style={{ display: 'grid', gap: 16 }}>
              <Skeleton width={150} height={15} />
              <div className="rounded-[20px] p-4" style={{ background: "#fff", border: "1px solid #EDF1F7" }}>
                <div className="flex items-center justify-end">
                  <Skeleton width={78} height={20} radius={999} />
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <Skeleton width={112} height={112} radius={999} />
                  <div className="flex-1" style={{ display: 'grid', gap: 10 }}>
                    <Skeleton width="55%" height={26} />
                    <Skeleton width="82%" height={10} />
                    <Skeleton width="64%" height={10} />
                  </div>
                </div>
                <div className="grid grid-cols-4 mt-4" style={{ gap: 8 }}>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
                      <Skeleton width={18} height={18} radius={999} />
                      <Skeleton width="70%" height={8} />
                      <Skeleton width="52%" height={8} />
                    </div>
                  ))}
                </div>
              </div>
              <Skeleton width={140} height={14} />
              <div className="grid grid-cols-2" style={{ gap: 10 }}>
                {[0, 1].map((i) => <Skeleton key={i} width="100%" height={86} radius={16} />)}
              </div>
              <Skeleton width={120} height={14} />
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-[16px] p-3" style={{ border: "1px solid #EDF1F7", display: 'grid', gap: 8 }}>
                  <div className="flex items-center justify-between">
                    <Skeleton width={110} height={12} />
                    <Skeleton width={56} height={20} radius={999} />
                  </div>
                  <Skeleton width="70%" height={9} />
                </div>
              ))}
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center py-14 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-xs text-red-600 font-medium">{fetchError}</p>
              <button onClick={fetchData} className="mt-4 px-6 py-2 rounded-full text-white text-xs font-semibold" style={{ background: "#2F8BF8" }}>
                Coba Lagi
              </button>
            </div>
          ) : (
            <>
              {/* RINGKASAN KEHADIRAN — judul di luar card; badge predikat
                  diletakkan di dalam card (kanan atas) */}
              <div className="flex items-center mb-2.5">
                <h2 className="text-[14px] font-extrabold text-slate-900 tracking-tight">Ringkasan Kehadiran</h2>
              </div>

              <section className="p-4" style={CARD}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-end gap-2.5 min-w-0">
                    <div className="text-[38px] font-extrabold leading-none tracking-[-0.045em] text-slate-900 tabular-nums">
                      {pctHadir}<span className="text-[17px] font-extrabold tracking-tight" style={{ color: "#94A3B8" }}>%</span>
                    </div>
                    <div className="pb-1 min-w-0">
                      <p className="m-0 text-[11.5px] font-extrabold" style={{ color: "#475569", letterSpacing: "-0.005em" }}>Tingkat kehadiran</p>
                      <p className="m-0 mt-0.5 text-[10.5px] font-semibold" style={{ color: "#64748B" }}>
                        {totalHadir} dari {totalRecorded} hari kerja
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 pl-1 pr-2.5 py-0.5 rounded-full text-[11.5px] font-bold shrink-0"
                    style={{ background: predikat.bg, color: predikat.color }}>
                    <span className="w-4 h-4 rounded-full text-white flex items-center justify-center"
                      style={{ background: predikat.color }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                    </span>
                    {predikat.label}
                  </span>
                </div>

                {/* Grafik batang per status — skala 0-100% dari hari tercatat.
                    Animation-delay bertingkat membuat batang tumbuh bergantian. */}
                <div key={`${year}-${month}`} className="mt-4 grid" style={{ gridTemplateColumns: "32px 1fr", gap: 8 }}>
                  <div className="flex flex-col justify-between items-end" style={{ height: 168, paddingBottom: 1 }}>
                    {["100%", "50%", "0%"].map((t) => (
                      <span key={t} className="text-[8.5px] font-bold tabular-nums" style={{ color: "#94A3B8" }}>{t}</span>
                    ))}
                  </div>
                  <div className="relative" style={{ height: 168 }}>
                    <div className="absolute inset-x-0 top-0 border-t border-dashed" style={{ borderColor: "#E9EEF6" }} />
                    <div className="absolute inset-x-0 border-t border-dashed" style={{ top: "50%", borderColor: "#E9EEF6" }} />
                    <div className="absolute inset-x-0 bottom-0 border-t" style={{ borderColor: "#EDF1F7" }} />
                    <div className="relative h-full grid grid-cols-4" style={{ gap: 6, alignItems: "end", padding: "0 3px" }}>
                      {chartBars.map((c, i) => (
                        <div key={c.key} className="flex flex-col items-center justify-end h-full min-w-0">
                          <span className="mb-1 text-[11px] font-extrabold tabular-nums"
                            style={{ color: c.value > 0 ? "#0F172A" : "#94A3B8" }}>{c.value}</span>
                          <div className="emp-bar-grow w-full"
                            style={{
                              maxWidth: 40,
                              height: c.height,
                              borderRadius: "12px 12px 7px 7px",
                              background: c.value > 0 ? BAR_GRAD[c.key] : "#E7EDF5",
                              boxShadow: c.value > 0 ? "0 10px 18px -12px rgba(15,23,42,0.5)" : "none",
                              animationDelay: `${i * 70}ms`,
                            }} />
                          <span className="mt-2 inline-flex items-center gap-1 text-[9.5px] font-extrabold whitespace-nowrap" style={{ color: "#475569" }}>
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.color }} />
                            {c.label}
                          </span>
                          <span className="text-[9px] font-bold tabular-nums" style={{ color: "#64748B" }}>{c.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 pt-3 flex items-center gap-2 border-t" style={{ borderColor: "#EDF1F7" }}>
                  <span className="w-5 h-5 rounded-[7px] flex items-center justify-center shrink-0" style={{ background: "#EEF6FF" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2F8BF8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></svg>
                  </span>
                  <p className="m-0 text-[10px] font-semibold leading-relaxed" style={{ color: "#64748B" }}>
                    Kehadiran dihitung dari hari kerja yang tercatat pada bulan berjalan.
                  </p>
                </div>
              </section>

              {/* STATISTIK TAMBAHAN */}
              <div className="mt-6">
                <div className="flex items-center gap-1.5 mb-2">
                  <h3 className="text-[14px] font-extrabold text-slate-900 tracking-tight">Statistik Tambahan</h3>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {/* Ikon di atas teks supaya judul tidak terpotong di layar sempit */}
                  <div className="rounded-[16px] px-3 py-3" style={{ background: "#EDF4FF" }}>
                    <span className="w-9 h-9 rounded-full flex items-center justify-center"
                      style={{ background: "#D8E7FF", color: "#2F8BF8" }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="13.5" r="7.5" /><path d="M12 10v3.5l2.3 1.4M9.5 2h5M12 2v2.5" />
                      </svg>
                    </span>
                    <p className="text-[11.5px] font-extrabold text-slate-900 mt-2.5 truncate">Tepat Waktu</p>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{hadir} dari {totalHadir} Kehadiran</p>
                    <p className="text-[12px] font-extrabold leading-tight mt-1" style={{ color: "#2F8BF8" }}>{onTimePct}%</p>
                  </div>

                  <div className="rounded-[16px] px-3 py-3" style={{ background: "#F2EEFF" }}>
                    <span className="w-9 h-9 rounded-full flex items-center justify-center"
                      style={{ background: "#E3D9FF", color: "#7C5CFA" }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 3h7v7M21 3l-8 8M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
                      </svg>
                    </span>
                    <p className="text-[11.5px] font-extrabold text-slate-900 mt-2.5 truncate">Pulang Cepat</p>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{earlyCount} Hari</p>
                  </div>
                </div>
              </div>

              {/* RIWAYAT */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-[14px] font-extrabold text-slate-900 tracking-tight">Riwayat Absensi Terbaru</h3>
                  <Link to="/employee/history/all" className="inline-flex items-center gap-0.5 text-[12px] font-bold shrink-0" style={{ color: "#2F8BF8" }}>
                    Lihat Semua
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>

                <div className="overflow-hidden" style={CARD}>
                  {rows.length === 0 ? (
                    <div className="px-4 py-7 text-center">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 opacity-70">
                        <rect x="3" y="4" width="18" height="18" rx="3" />
                        <path d="M16 2v4M8 2v4M3 10h18" />
                      </svg>
                      <p className="text-[13px] font-bold text-slate-700">Belum ada absensi</p>
                      <p className="text-[11px] text-slate-400 mt-1">Tidak ada catatan kehadiran di {periodLabel}</p>
                    </div>
                  ) : (
                    <div>
                      {rows.map((r, i) => {
                        const c = COLORS[r.styleKey] || COLORS.alpha;
                        return (
                          <Link key={r.key} to="/employee/history/all"
                            className={"flex items-center gap-2 px-3.5 py-2.5 active:bg-slate-50 transition" + (i > 0 ? " border-t border-slate-100" : "")}>
                            <span className="w-8 text-center leading-tight shrink-0">
                              <span className="block text-[9.5px] font-medium text-slate-400">{r.dayShort}</span>
                              <span className="block text-[16px] font-extrabold text-slate-900 my-0.5 tracking-tight">{r.dateNum}</span>
                              <span className="block text-[9.5px] font-medium text-slate-400">{r.monthShort}</span>
                            </span>

                            <span className="w-px self-stretch shrink-0" style={{ background: "#E9EEF6" }} />

                            <span className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center" style={{ background: c.bg, color: "#fff" }}>
                              <StatusIcon kind={c.icon} size={13} />
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-extrabold text-slate-900 leading-tight truncate">{r.label}</span>
                              <span className="block text-[11px] font-medium text-slate-400 mt-0.5 truncate">{r.time}</span>
                            </span>

                            <span className="px-2.5 py-1 rounded-full text-[10.5px] font-bold whitespace-nowrap shrink-0"
                              style={{ background: c.chip, color: c.text }}>
                              {r.badge}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
