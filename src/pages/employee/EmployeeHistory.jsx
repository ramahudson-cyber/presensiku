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
    if (isSanggah) { label = "Sanggahan"; badge = "Sanggahan"; }
    else if (isLate) { label = "Terlambat"; badge = `Terlambat ${item.late_minutes || 0} menit`; }
    else if (isHadir) {
      const sched = schedList.find((s) => s.date === item.date);
      const def = getShiftDefinition(shiftDefs, { date: item.date, shift_code: item.shift_code || sched?.shift_code });
      const early = getEarlyLeaveInfo(item.clock_out_time, item.date, def, 0);
      label = early ? "Pulang Cepat" : "Hadir";
      badge = early ? `Pulang cepat ${formatDuration(early.earlyMinutes)}` : "Tepat waktu";
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

  const COLORS = {
    hadir:     { bg: "#2F8BF8", chip: "rgba(47,139,248,0.12)", text: "#2F8BF8", icon: "check" },
    terlambat: { bg: "#F59E0B", chip: "rgba(245,158,11,0.14)", text: "#D97706", icon: "clock" },
    izin:      { bg: "#F59E0B", chip: "rgba(245,158,11,0.14)", text: "#D97706", icon: "clock" },
    sakit:     { bg: "#10B981", chip: "rgba(16,185,129,0.14)", text: "#059669", icon: "check" },
    alpha:     { bg: "#EF4444", chip: "rgba(239,68,68,0.12)",  text: "#DC2626", icon: "close" },
  };



  const goThisMonth = () => {
    setMonth(nowParts.month - 1);
    setYear(nowParts.year);
    setMonthPicker(false);
  };

  // Segmen donat: hadir, izin, sakit, alpha
  const segments = [
    { key: "hadir", value: totalHadir, color: "#2F8BF8" },
    { key: "izin", value: izin, color: "#F59E0B" },
    { key: "sakit", value: sakit, color: "#10B981" },
    { key: "alpha", value: alphaCount, color: "#EF4444" },
  ].filter((s) => s.value > 0);

  const R = 44;
  const CIRC = 2 * Math.PI * R;
  let acc = 0;
  const donutSegs = segments.map((s) => {
    const len = totalRecorded > 0 ? (s.value / totalRecorded) * CIRC : 0;
    const el = { ...s, len: Math.max(0, len - 3), offset: -acc };
    acc += len;
    return el;
  });

  const cols = [
    { key: "hadir", label: "Hadir", value: totalHadir, color: "#2F8BF8", icon: "check" },
    { key: "izin", label: "Izin", value: izin, color: "#F59E0B", icon: "clock" },
    { key: "sakit", label: "Sakit", value: sakit, color: "#10B981", icon: "plus" },
    { key: "alpha", label: "Alpha", value: alphaCount, color: "#EF4444", icon: "close" },
  ];

  return (
    <div className="min-h-screen w-full absolute top-0 left-0 right-0 flex flex-col" style={{ background: "#F6F8FC" }}>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      {/* HEADER */}
      <header
        className="relative shrink-0 px-4 text-white"
        style={{
          background: "linear-gradient(155deg, #2F8BF8 0%, #3F93FD 55%, #4A7CFB 100%)",
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)",
          paddingBottom: 28,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
        }}
      >
        <svg className="absolute bottom-0 left-0 w-full pointer-events-none" style={{ height: 44, opacity: 0.15 }} viewBox="0 0 390 44" preserveAspectRatio="none">
          <path d="M0,26 C120,48 260,6 390,26 L390,44 L0,44 Z" fill="#FFFFFF" />
        </svg>

        <div className="relative flex items-center justify-between">
          <button type="button" onClick={() => navigate("/employee")} aria-label="Kembali"
            className="w-10 h-10 rounded-full active:scale-95 transition flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <h1 className="text-[18px] font-bold tracking-tight leading-tight" style={{ color: "#fff" }}>
              Riwayat Absensi
            </h1>
            <p className="text-[11px] font-medium mt-0.5" style={{ color: "rgba(255,255,255,0.85)" }}>
              {periodLabel}
            </p>
          </div>

          <button type="button" onClick={() => setMonthPicker((v) => !v)} aria-label="Pilih periode"
            className="w-10 h-10 rounded-full active:scale-95 transition flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="3" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </button>
        </div>

        {/* Pill bulan mengambang */}
        <div className="relative mt-3.5 flex justify-center">
          <button type="button" onClick={() => setMonthPicker((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-bold"
            style={{ background: "#fff", color: "#0F172A", boxShadow: "0 6px 18px -4px rgba(15,23,42,.28)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2F8BF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="3" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            {periodLabel}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: monthPicker ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {monthPicker && (
            <div className="absolute top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-40">
              <p className="px-3.5 py-1 text-[9.5px] font-bold uppercase tracking-widest text-slate-400">Bulan ini</p>
              <button type="button" onClick={goThisMonth}
                className="w-full px-3.5 py-2 text-left text-[12.5px] font-semibold text-[#2F8BF8] hover:bg-blue-50 transition">
                {MONTHS[nowParts.month - 1]} {nowParts.year}
              </button>
              <div className="my-1 h-px bg-slate-100" />
              <div className="grid grid-cols-1 max-h-56 overflow-y-auto">
                {MONTHS.map((nm, i) => (
                  <button key={nm} type="button" onClick={() => { setMonth(i); setMonthPicker(false); }}
                    className="w-full px-3.5 py-1.5 text-left text-[12px] hover:bg-slate-50 transition flex items-center justify-between"
                    style={{ color: month === i && year === nowParts.year ? "#2F8BF8" : "#475569", fontWeight: month === i && year === nowParts.year ? 800 : 500 }}>
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
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#2F8BF8] border-t-transparent rounded-full animate-spin" />
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
            {/* KARTU RINGKASAN KEHADIRAN */}
            <section className="bg-white rounded-[20px] p-4 border border-slate-100/90"
              style={{ boxShadow: "0 3px 14px -2px rgba(15,23,42,0.045)" }}>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "#EEF6FF", color: "#2F8BF8" }}>
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                      <rect x="2.5" y="10" width="3.3" height="7.5" rx="1.1" />
                      <rect x="8.35" y="4" width="3.3" height="13.5" rx="1.1" />
                      <rect x="14.2" y="7" width="3.3" height="10.5" rx="1.1" />
                    </svg>
                  </span>
                  <h2 className="text-[14.5px] font-extrabold text-slate-800">Ringkasan Kehadiran</h2>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                  style={{ background: predikat.bg, color: predikat.color, border: `1px solid ${predikat.border}` }}>
                  <span className="w-3.5 h-3.5 rounded-full text-white flex items-center justify-center" style={{ background: predikat.color }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                  </span>
                  {predikat.label}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 py-1">
                <div className="relative shrink-0" style={{ width: 118, height: 118 }}>
                  <svg viewBox="0 0 118 118" width="118" height="118" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="59" cy="59" r={R} fill="none" stroke="#EDF2F7" strokeWidth="12" />
                    {donutSegs.map((s) => (
                      <circle key={s.key} cx="59" cy="59" r={R} fill="none" stroke={s.color}
                        strokeWidth="12" strokeLinecap="round"
                        strokeDasharray={`${s.len} ${CIRC}`} strokeDashoffset={s.offset} />
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[23px] font-extrabold leading-none text-slate-900 tracking-tight">{pctHadir}%</span>
                    <span className="text-[10px] font-semibold text-slate-500 mt-1">Kehadiran</span>
                  </div>
                </div>

                <div className="h-[84px] w-px shrink-0" style={{ background: "#F1F5F9" }} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[26px] font-extrabold leading-none text-slate-900">{totalHadir}</span>
                    <span className="text-[20px] font-bold text-slate-300 leading-none">/</span>
                    <span className="text-[24px] font-extrabold leading-none text-slate-900">{totalRecorded}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug mt-1.5">
                    Hari hadir dari <span className="font-semibold text-slate-700">{totalRecorded} hari</span> tercatat
                  </p>
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-4 rounded-[14px] py-2.5 px-1 border border-slate-100"
                style={{ background: "#F8FAFC" }}>
                {cols.map((c, idx) => (
                  <div key={c.key} className="flex flex-col items-center text-center"
                    style={{ borderRight: idx < cols.length - 1 ? "1px solid #E2E8F0" : "none" }}>
                    <span className="w-5 h-5 rounded-full text-white flex items-center justify-center mb-1" style={{ background: c.color }}>
                      <StatusIcon kind={c.icon} size={11} stroke={3} />
                    </span>
                    <span className="text-[10.5px] font-semibold text-slate-500">{c.label}</span>
                    <span className="text-[11.5px] font-extrabold text-slate-800 mt-0.5">{c.value} Hari</span>
                    <span className="text-[10.5px] font-bold mt-0.5" style={{ color: c.text }}>{percent(c.value)}%</span>
                  </div>
                ))}
              </div>
            </section>

            {/* STATISTIK TAMBAHAN */}
            <div className="mt-4">
              <div className="flex items-center gap-1.5 mb-2 px-0.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 8v4l2.5 2.5M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />
                </svg>
                <h3 className="text-[13.5px] font-extrabold text-slate-800">Statistik Tambahan</h3>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-white rounded-2xl p-3 border border-slate-100 flex items-center justify-between"
                  style={{ boxShadow: "0 3px 14px -2px rgba(15,23,42,0.045)" }}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#EEF6FF", color: "#2F8BF8" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 1.5M10 2h4M12 2v3" />
                      </svg>
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-slate-700 truncate">Tepat waktu</p>
                      <p className="text-[9.5px] text-slate-400 truncate">{hadir} dari {totalHadir} kehadiran</p>
                      <p className="text-[13px] font-extrabold text-[#2F8BF8] leading-tight mt-0.5">
                        {totalHadir > 0 ? Math.round((hadir / totalHadir) * 100) : 0}%
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-3 border border-slate-100 flex items-center justify-between"
                  style={{ boxShadow: "0 3px 14px -2px rgba(15,23,42,0.045)" }}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#EEF6FF", color: "#2F8BF8" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="13" r="8" /><path d="M12 9v4l-2.5 1.5M10 2h4M12 2v3" />
                      </svg>
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-slate-700 truncate">Pulang cepat</p>
                      <p className="text-[13px] font-extrabold text-slate-900 leading-tight mt-1">{terlambat} hari</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* DAFTAR RIWAYAT */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2 px-0.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "#EEF6FF", color: "#2F8BF8" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                    </svg>
                  </span>
                  <h3 className="text-[14px] font-extrabold text-slate-800">Riwayat Absensi Terbaru</h3>
                </div>
                <Link to="/employee/history/all"
                  className="inline-flex items-center gap-0.5 text-[12px] font-bold text-[#2F8BF8]">
                  Lihat Semua
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>

              {rows.length === 0 ? (
                <div className="bg-white rounded-2xl p-7 text-center border border-slate-100">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 opacity-70">
                    <rect x="3" y="4" width="18" height="18" rx="3" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  <p className="text-[13px] font-bold text-slate-700">Belum ada absensi</p>
                  <p className="text-[11px] text-slate-400 mt-1">Tidak ada catatan kehadiran di {periodLabel}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rows.map((r) => {
                    const c = COLORS[r.styleKey] || COLORS.alpha;
                    return (
                      <Link key={r.key} to="/employee/history/all"
                        className="flex items-center justify-between gap-3 bg-white rounded-2xl px-3 py-2.5 border border-slate-100 active:scale-[0.99] transition"
                        style={{ boxShadow: "0 3px 14px -2px rgba(15,23,42,0.045)" }}>
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span className="w-9 text-center leading-tight shrink-0">
                            <span className="block text-[10px] font-medium text-slate-400">{r.dayShort}</span>
                            <span className="block text-[16px] font-extrabold text-slate-800 my-0.5">{r.dateNum}</span>
                            <span className="block text-[10px] font-medium text-slate-400">{r.monthShort}</span>
                          </span>

                          <span className="w-px h-8 shrink-0" style={{ background: "#E2E8F0" }} />

                          <span className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center" style={{ background: c.bg, color: "#fff" }}>
                            <StatusIcon kind={c.icon} size={13} />
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-extrabold text-slate-800 leading-tight truncate">{r.label}</span>
                            <span className="block text-[11px] font-semibold text-slate-400 mt-0.5 truncate">{r.time}</span>
                          </span>
                        </span>

                        <span className="flex items-center gap-1.5 shrink-0">
                          <span className="px-2.5 py-1 rounded-full text-[10.5px] font-bold whitespace-nowrap"
                            style={{ background: c.chip, color: c.text }}>
                            {r.badge}
                          </span>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}