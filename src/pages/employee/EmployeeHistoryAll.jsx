import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { getAttendanceHistory } from "../../services/attendanceService";
import {
  getShiftDefinition, getWitaParts, isShiftEnded, formatDuration, getEarlyLeaveInfo,
} from "../../lib/shiftTime";
import { shiftLabel } from "../../lib/shiftName";
import usePullToRefresh from "../../hooks/usePullToRefresh";
import PullToRefreshIndicator from "../../components/PullToRefreshIndicator";
import Skeleton from "../../components/Skeleton";
import { Search } from "lucide-react";

/**
 * Halaman "Riwayat Absensi" lengkap — dibuka dari tombol "Lihat Semua"
 * pada ringkasan kehadiran. Desain mengikuti referensi: header gradien biru
 * dengan judul + periode, filter pill, daftar kartu per tanggal, dan sheet
 * detail saat kartu ditekan.
 *
 * Data & logika memakai sumber yang sama dengan EmployeeHistory
 * (getAttendanceHistory + employee_schedules + shift_schedules), jadi angka
 * dan statusnya konsisten dengan halaman ringkasan.
 */

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const FILTERS = ["Semua", "Hadir", "Izin", "Sakit", "Alpha"];

/** Turunkan baris alpha (jadwal kerja lewat tanpa absen) — sama dengan EmployeeHistory. */
function deriveAlphaRows(attRows, schedules, shiftDefinitions, serverNow, userId) {
  const attended = new Set((attRows || []).map((r) => r.date));
  return (schedules || [])
    .filter((s) => !attended.has(s.date) && isShiftEnded(s.date, getShiftDefinition(shiftDefinitions, s), serverNow))
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

/** Kelas & warna ikon per status. */
const STATUS_STYLE = {
  hadir:     { bg: "#2F8BF8", chip: "rgba(47,139,248,0.12)", text: "#2F8BF8", icon: "check" },
  terlambat: { bg: "#F59E0B", chip: "rgba(245,158,11,0.14)", text: "#D97706", icon: "clock" },
  izin:      { bg: "#F59E0B", chip: "rgba(245,158,11,0.14)", text: "#D97706", icon: "clock" },
  sakit:     { bg: "#10B981", chip: "rgba(16,185,129,0.14)", text: "#059669", icon: "plus" },
  alpha:     { bg: "#EF4444", chip: "rgba(239,68,68,0.12)",  text: "#DC2626", icon: "close" },
};

function StatusIcon({ kind, size = 15 }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.8, strokeLinecap: "round", strokeLinejoin: "round" };
  if (kind === "clock") return <svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></svg>;
  if (kind === "plus") return <svg {...p}><path d="M12 6v12M6 12h12" /></svg>;
  if (kind === "close") return <svg {...p}><path d="M6 18L18 6M6 6l12 12" /></svg>;
  return <svg {...p}><path d="M5 13l4 4L19 7" /></svg>;
}

function formatTime(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" }).replace(":", ".");
}

export default function EmployeeHistoryAll() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const nowParts = getWitaParts(new Date());
  const [year, setYear] = useState(nowParts.year);
  const [month, setMonth] = useState(nowParts.month - 1);
  const [history, setHistory] = useState([]);
  const [schedList, setSchedList] = useState([]);
  const [shiftDefs, setShiftDefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("Semua");
  const [searchQ, setSearchQ] = useState("");
  const [detail, setDetail] = useState(null);

  const periodLabel = `${MONTHS[month]} ${year}`;
  const [monthPicker, setMonthPicker] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError("");
    const lastDay = new Date(year, month + 1, 0).getDate();
    const dateFrom = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const dateTo = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const todayKey = getWitaParts(new Date()).dateKey;

    try {
      const [{ data: timeData }, attRes, schedRes, shiftRes] = await Promise.all([
        supabase.rpc("get_server_time"),
        getAttendanceHistory(user.id, null, dateFrom, dateTo),
        supabase.from("employee_schedules").select("date, shift_code")
          .eq("user_id", user.id).gte("date", dateFrom)
          .lte("date", month === new Date().getMonth() && year === new Date().getFullYear() ? todayKey : dateTo),
        supabase.from("shift_schedules")
          .select("shift_code, day_of_week, end_time, crosses_midnight, is_working_day"),
      ]);

      const defs = shiftRes.data || [];
      const serverNow = new Date(timeData || Date.now());
      // getAttendanceHistory mengembalikan array langsung (bukan { data }).
      // Sebelumnya `attRes.data` selalu undefined → semua absensi asli hilang
      // dan halaman ini hanya menampilkan baris alpha turunan.
      const attRows = attRes || [];
      const rows = [
        ...attRows,
        ...deriveAlphaRows(attRows, schedRes.data || [], defs, serverNow, user.id),
      ].sort((a, b) => b.date.localeCompare(a.date));

      setHistory(rows);
      setSchedList(schedRes.data || []);
      setShiftDefs(defs);
    } catch (e) {
      setError(e.message || "Gagal memuat riwayat absensi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // setTimeout: muat lewat task terpisah — setState tidak sinkron di dalam
    // body effect (pola yang sama dipakai halaman pegawai lainnya).
    const kick = setTimeout(load, 0);
    return () => clearTimeout(kick);
  }, [user?.id, year, month]);

  const { pullDistance, isRefreshing } = usePullToRefresh(load);

  const chipsRef = useRef(null);
  const activeChipRef = useRef(null);

  // Chip aktif otomatis digulir ke posisi terlihat saat filter berubah.
  useEffect(() => {
    activeChipRef.current?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [filter]);

  /** Baris yang sudah siap render (status, jam, label, warna). */
  const rows = useMemo(() => {
    return history.map((item) => {
      const st = item.attendance_status || "alpha";
      const isSanggah = (item.notes || "").toLowerCase().includes("dikoreksi via sanggahan");
      const isLate = st === "terlambat" && !isSanggah;
      const isLeave = st === "izin" || st === "sakit";
      const isHadir = st === "hadir";
      const isAlpha = st === "alpha";

      const inStr = isLeave || isSanggah ? "-" : formatTime(item.clock_in_time);
      const outStr = isLeave || isSanggah || !item.clock_out_time ? "-" : formatTime(item.clock_out_time);

      const d = new Date(item.date + "T00:00:00");
      const dayShort = d.toLocaleDateString("id-ID", { weekday: "short" });
      const dateNum = String(d.getDate());
      const monthShort = d.toLocaleDateString("id-ID", { month: "short" });

      // Label status utama + badge
      let label = "Alpha";
      let badge = "Alpha";
      if (isSanggah) { label = "Koreksi"; badge = "Koreksi"; }
      else if (isLate) { label = "Terlambat"; badge = `Terlambat ${item.late_minutes || 0} menit`; }
      else if (isHadir) {
        const sched = schedList.find((s) => s.date === item.date);
        const def = getShiftDefinition(shiftDefs, { date: item.date, shift_code: item.shift_code || sched?.shift_code });
        const early = getEarlyLeaveInfo(item.clock_out_time, item.date, def, 0);
        label = early ? "Pulang Cepat" : "Hadir";
        badge = early ? `Pulang cepat ${formatDuration(early.earlyMinutes)}` : "Tepat waktu";
      } else if (st === "izin") { label = "Izin"; badge = "Izin"; }
      else if (st === "sakit") { label = "Sakit"; badge = "Sakit"; }
      else if (st === "terlambat") { label = "Terlambat"; badge = "Terlambat"; }

      const styleKey = isSanggah ? "hadir" : isLate ? "terlambat" : isHadir ? "hadir" : isAlpha ? "alpha" : st;

      return {
        key: item.id || `${item.date}-${label}`,
        date: item.date, dayShort, dateNum, monthShort, label, badge, key2: styleKey,
        time: `${inStr} – ${outStr}`,
        clockIn: inStr, clockOut: outStr,
        location: item.location_in?.matched_location_name || "—",
        shift: item.shift_code ? shiftLabel(item.shift_code, null) : "",
      };
    });
  }, [history, schedList, shiftDefs]);

  const filtered = useMemo(() => {
    const map = { Hadir: ["hadir", "terlambat"], Izin: ["izin"], Sakit: ["sakit"], Alpha: ["alpha"] };
    const keys = map[filter] || [];
    const q = searchQ.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "Semua" && !keys.includes(r.key2)) return false;
      if (!q) return true;
      // Cari fleksibel: tanggal (27, 22 nov), status, badge, jam, atau shift — satu kolom untuk semuanya
      return `${r.date} ${r.dayShort} ${r.dateNum} ${r.monthShort} ${r.label} ${r.badge} ${r.key2} ${r.time} ${r.shift}`
        .toLowerCase()
        .includes(q);
    });
  }, [rows, filter, searchQ]);

  return (
    <div className="min-h-screen w-full absolute top-0 left-0 right-0 flex flex-col" style={{ background: "#FFFFFF" }}>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      {/* HEADER — biru: judul, search, dan filter chip di dalamnya */}
      <header
        className="relative shrink-0 z-10 px-4 text-white"
        style={{
          background: "linear-gradient(155deg, #2F8BF8 0%, #3F93FD 55%, #4A7CFB 100%)",
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)",
          paddingBottom: 46,
        }}
      >
        <div className="relative flex items-center justify-between">
          <button type="button" onClick={() => navigate(-1)} aria-label="Kembali"
            className="w-10 h-10 rounded-full bg-white shadow-md active:scale-95 transition flex items-center justify-center"
            style={{ border: "none", cursor: "pointer" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2F8BF8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </button>

          <h1 className="text-[18px] font-bold tracking-tight leading-tight text-center" style={{ color: "#FFFFFF" }}>
            Riwayat Absensi
          </h1>

          <span className="w-10 shrink-0" />
        </div>

        {/* SEARCH — di dalam header, selalu terlihat */}
        <div className="relative mt-4">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Cari tanggal atau status…"
            className="w-full rounded-[16px] bg-white pl-10 pr-3.5 py-2.5 text-[13.5px] font-semibold text-slate-800 placeholder:text-slate-400 outline-none shadow-[0_8px_20px_-10px_rgba(15,23,42,.35)]"
          />
        </div>

        {/* FILTER CHIP — scroll tetap; -mx-4 menetralkan px-4 header agar tepi
            kontainer scroll = tepi layar: chip menerus melewati tepi (ala rail chat),
            bukan terpotong tegak di tengah udara. Padding tetap di dalam scroll. */}
        <div className="relative mt-3 -mx-4">
          <div ref={chipsRef}
            className="no-scrollbar flex items-center gap-2 w-full overflow-x-auto pb-1 pl-4 pr-6"
            style={{ scrollSnapType: "x proximity", scrollPaddingLeft: 16 }}>
            {FILTERS.map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)}
                ref={f === filter ? activeChipRef : undefined}
                className="shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition active:scale-[0.97]"
                style={{
                  scrollSnapAlign: "start",
                  background: filter === f ? "#FFFFFF" : "rgba(255,255,255,0.16)",
                  color: filter === f ? "#1F74E0" : "#FFFFFF",
                }}>
                {f}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* SHEET PUTIH — pembungkus tanpa overflow agar pill di tepi atas tidak terpotong */}
      <div className="relative flex-1 min-h-0 z-10 -mt-6">
        {/* PILL BULAN — desain sama dengan halaman Riwayat Kehadiran (EmployeeHistory) */}
        <div className="absolute inset-x-0 flex justify-center" style={{ top: -17, zIndex: 30 }}>
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
                <button type="button" onClick={() => { setMonth(nowParts.month - 1); setYear(nowParts.year); setMonthPicker(false); }}
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

        {/* Kontainer scroll di dalam sheet */}
        <div className="h-full bg-white rounded-t-[28px] shadow-[0_-10px_34px_rgba(15,23,42,0.14)] overflow-y-auto no-scrollbar">
        <div className="flex justify-center pt-3.5 pb-1">
          <span className="block rounded-full" style={{ width: 42, height: 5, background: "#E2E8F0" }} />
        </div>

        {searchQ.trim() && (
          <div className="px-4 pt-2" style={{ paddingBottom: 8 }}>
            <p className="text-[10.5px] text-slate-400 font-semibold text-center">
              {filtered.length} hasil untuk "{searchQ.trim()}"
            </p>
          </div>
        )}

      {/* DAFTAR - full-width tanpa kartu, hanya garis pemisah (di dalam sheet) */}
      <div className="pb-8">
        {loading ? (
          <div className="px-4 py-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-3"
                style={{ borderTop: i === 0 ? "none" : "1px solid #F1F5F9" }}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9" style={{ display: 'grid', gap: 4, justifyItems: 'center' }}>
                    <Skeleton width={26} height={8} />
                    <Skeleton width={18} height={16} />
                    <Skeleton width={26} height={8} />
                  </div>
                  <span className="w-px h-9 shrink-0" style={{ background: "#E2E8F0" }} />
                  <Skeleton width={28} height={28} radius={999} />
                  <div className="flex-1 min-w-0" style={{ display: 'grid', gap: 6 }}>
                    <Skeleton width="62%" height={12} />
                    <Skeleton width="45%" height={9} />
                  </div>
                </div>
                <Skeleton width={54} height={22} radius={999} />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-14 px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-xs text-red-600 font-medium">{error}</p>
            <button onClick={load} className="mt-4 px-6 py-2 rounded-full text-white text-xs font-semibold"
              style={{ background: "#2F8BF8" }}>
              Coba Lagi
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 px-6 text-center">
            <p className="text-sm font-bold text-slate-800">
              {searchQ.trim()
                ? `Tidak ada hasil untuk "${searchQ.trim()}"`
                : `Tidak ada data ${filter === "Semua" ? "" : filter} di bulan ini`}
            </p>
            {searchQ.trim() && (
              <p className="text-[11.5px] text-slate-400 mt-1">
                Coba kata kunci lain, mis. tanggal atau status.
              </p>
            )}
          </div>
        ) : (
          <div>
            {filtered.map((r, i) => {
              const st = STATUS_STYLE[r.key2] || STATUS_STYLE.alpha;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setDetail(r)}
                  className="w-full text-left flex items-center justify-between gap-3 px-4 py-2.5 transition active:scale-[0.99] active:bg-slate-50"
                  style={{ borderTop: i === 0 ? "none" : "1px solid #F1F5F9" }}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="w-9 text-center leading-tight shrink-0 block">
                      <span className="block text-[10px] text-slate-400 font-medium">{r.dayShort}</span>
                      <span className="block text-[16px] font-extrabold text-slate-800 my-0.5">{r.dateNum}</span>
                      <span className="block text-[10px] text-slate-400 font-medium">{r.monthShort}</span>
                    </span>

                    <span className="w-px h-9 shrink-0 block" style={{ background: "#E2E8F0" }} />

                    <span className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center" style={{ background: st.bg, color: "#fff" }}>
                      <StatusIcon kind={st.icon} size={14} />
                    </span>

                    <span className="min-w-0 flex-1 block">
                      <span className="block text-[13.5px] font-bold text-slate-800 leading-tight truncate">{r.label}</span>
                      <span className="block text-[11.5px] text-slate-400 font-medium mt-0.5 truncate">{r.time}</span>
                    </span>
                  </span>

                  <span className="flex items-center gap-2 shrink-0">
                    <span className="px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap"
                      style={{ background: st.chip, color: st.text }}>
                      {r.badge}
                    </span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </button>
              );
            })}
          </div>
        )}

      </div>

      {/* SHEET DETAIL */}
      {detail && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <div className="absolute inset-0" style={{ background: "rgba(15,23,42,0.35)" }} onClick={() => setDetail(null)} />
          <div className="relative w-full bg-white animate-slide-up" style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}>
            <div className="flex justify-center pt-2.5 pb-3">
              <span className="block rounded-full" style={{ width: 40, height: 5, background: "#CBD5E1" }} />
            </div>

            <div className="px-5 pb-5">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: (STATUS_STYLE[detail.key2] || STATUS_STYLE.alpha).bg, color: "#fff" }}>
                    <StatusIcon kind={(STATUS_STYLE[detail.key2] || STATUS_STYLE.alpha).icon} size={18} />
                  </div>
                  <div>
                    <p className="text-[15.5px] font-bold text-slate-800">Status: {detail.label}</p>
                    <p className="text-[11.5px] text-slate-500 font-medium">
                      {detail.dayShort}, {detail.dateNum} {MONTHS[month]} {year}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 my-4">
                <div className="rounded-2xl p-3 border border-slate-100" style={{ background: "#FFFFFF" }}>
                  <p className="text-[11px] text-slate-400 font-medium">Jam Masuk</p>
                  <p className="text-[15px] font-extrabold text-slate-800 mt-0.5">{detail.clockIn === "-" ? "—" : `${detail.clockIn} WITA`}</p>
                </div>
                <div className="rounded-2xl p-3 border border-slate-100" style={{ background: "#FFFFFF" }}>
                  <p className="text-[11px] text-slate-400 font-medium">Jam Pulang</p>
                  <p className="text-[15px] font-extrabold text-slate-800 mt-0.5">{detail.clockOut === "-" ? "—" : `${detail.clockOut} WITA`}</p>
                </div>
              </div>

              <div className="space-y-2.5 text-[12.5px]">
                <div className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-100">
                  <span className="text-slate-400 font-medium shrink-0">Lokasi absen</span>
                  <span className="text-slate-700 font-semibold text-right">{detail.location}</span>
                </div>
                {detail.shift && (
                  <div className="flex items-start justify-between gap-4 py-1.5">
                    <span className="text-slate-400 font-medium shrink-0">Shift</span>
                    <span className="text-slate-700 font-semibold text-right">{detail.shift}</span>
                  </div>
                )}
              </div>

              <button type="button" onClick={() => setDetail(null)}
                className="mt-5 w-full py-3 rounded-full text-white text-[13.5px] font-semibold"
                style={{ background: "#2F8BF8" }}>
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );

}