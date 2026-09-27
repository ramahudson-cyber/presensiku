// src/pages/admin/AttendanceHistoryPage.jsx
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { exportExcelWorkbook, DATE_FMT } from "../../services/excelExport";
import usePullToRefresh from "../../hooks/usePullToRefresh";
import PullToRefreshIndicator from "../../components/PullToRefreshIndicator";
import {
  Search, Filter, Download, Calendar,
  ChevronLeft, ChevronRight, Loader2,
  CheckCircle2, XCircle, Clock, AlertTriangle,
  RefreshCw, Inbox,
} from "lucide-react";

// ── Konstanta ────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: "", label: "Semua Status" },
  { value: "hadir",  label: "Hadir"  },
  { value: "terlambat", label: "Terlambat" },
  { value: "izin",   label: "Izin"   },
  { value: "sakit",  label: "Sakit"  },
  { value: "cuti",   label: "Cuti"   },
  { value: "alpha",  label: "Alpha"  },
];

const STATUS_STYLE = {
  hadir:  { bg: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30", icon: <CheckCircle2 size={11} /> },
  terlambat: { bg: "bg-green-yellow/15 text-green-yellow ring-green-yellow/30", icon: <Clock size={11} /> },
  izin:   { bg: "bg-green-yellow/15 text-green-yellow ring-green-yellow/30",       icon: <Clock size={11} />         },
  sakit:  { bg: "bg-green-yellow/15 text-green-yellow ring-green-yellow/30",    icon: <AlertTriangle size={11} /> },
  cuti:   { bg: "bg-sky-500/15 text-sky-300 ring-sky-500/30",             icon: <Calendar size={11} />      },
  alpha:  { bg: "bg-rose-500/15 text-rose-300 ring-rose-500/30",           icon: <XCircle size={11} />       },
};

const PAGE_SIZE = 10;

const getWitaDateString = (date = new Date()) => {
  const witaMs = date.getTime() + (8 * 60 * 60 * 1000);
  return new Date(witaMs).toISOString().split("T")[0];
};

const cardBase = "design-card";

const inputBase = "design-input";

// ── Helper ───────────────────────────────────────────────────────────────────
const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "–";

const fmtDate = (dateStr) =>
  dateStr
    ? new Date(dateStr).toLocaleDateString("id-ID", {
        weekday: "short", day: "numeric", month: "short", year: "numeric",
      })
    : "–";

const initials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const avatarGradient = (name = "") => {
  const grads = [
    "from-electric-violet to-deep-indigo",
    "from-sky-500 to-blue-700",
    "from-emerald-500 to-teal-700",
    "from-green-yellow to-electric-violet",
    "from-rose-500 to-pink-700",
    "from-fuchsia-500 to-purple-700",
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return grads[sum % grads.length];
};

// ── Sub-komponen ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] ?? { bg: "bg-white/5 text-slate-mist ring-white/10", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${s.bg}`}>
      {s.icon}
      {status?.toUpperCase() ?? "–"}
    </span>
  );
}

function SummaryCard({ label, value, accent, icon: Icon }) {
  return (
    <div className={`${cardBase} p-4 flex items-center gap-3 hover:scale-[1.02]`}>
      <div className={`p-2.5 rounded-2xl bg-gradient-to-br ${accent} text-pure-white shadow shrink-0`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl md:text-3xl font-bold text-pure-white tabular-nums leading-none">{value}</p>
        <p className="text-xs text-slate-mist uppercase tracking-wider mt-1.5 truncate">{label}</p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AttendanceHistoryPage() {
  const { user } = useAuth();
  const [loading, setLoading]     = useState(true);
  const [mergedRows, setMergedRows] = useState([]);
  const [page, setPage]           = useState(1);

  // Filter state
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatus] = useState("");
  const [dateFrom, setDateFrom]   = useState(() => {
    const now = new Date();
    return getWitaDateString(new Date(now.getFullYear(), now.getMonth(), 1)); // tanggal 1 bulan berjalan
  });
  const [dateTo, setDateTo]       = useState(getWitaDateString());
  const [exporting, setExporting] = useState(false);
  const organizationId = user?.active_org_override || user?.organization_id;

  // ── Fetch: attendance + alpha turunan (jadwal tanpa absen) ────────────────
  const fetchRecords = async () => {
    setLoading(true);
    try {
      const witaToday = getWitaDateString();

      // 1. Baris attendance asli (cap besar; dataset per org-bulan kecil)
      const { data: attRows, error: attErr } = await supabase
        .from("attendance")
        .select("*, profiles(full_name, position, avatar_url)")
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date", { ascending: false })
        .order("clock_in_time", { ascending: false })
        .range(0, 999);
      if (attErr) throw attErr;

      // 2. Anggota org (untuk nama baris turunan)
      const { data: members } = await supabase
        .from("profiles")
        .select("id, full_name, username, position, avatar_url")
        .eq("organization_id", organizationId);
      const memberMap = Object.fromEntries((members || []).map((m) => [m.id, m]));

      // 3. Jadwal pegawai + aturan shift (untuk alpha turunan)
      const [{ data: schedRows }, { data: shiftRules }] = await Promise.all([
        supabase
          .from("employee_schedules")
          .select("user_id, date, shift_code")
          .eq("organization_id", organizationId)
          .gte("date", dateFrom)
          .lte("date", dateTo),
        supabase
          .from("shift_schedules")
          .select("shift_code, day_of_week, is_working_day")
          .eq("organization_id", organizationId),
      ]);
      const workingDaySet = new Set(
        (shiftRules || []).filter((s) => s.is_working_day).map((s) => `${s.shift_code}|${s.day_of_week}`)
      );

      // 4. Baris attendance yang ADA: key "user_id|date"
      const attended = new Set((attRows || []).map((r) => `${r.user_id}|${r.date}`));

      // 5. Alpha turunan: jadwal kerja (tanggal ≤ hari ini) tanpa attendance
      const derived = (schedRows || [])
        .filter((s) =>
          s.date <= witaToday
          && workingDaySet.has(`${s.shift_code}|${(new Date(s.date + "T00:00:00").getDay() + 6) % 7}`)
          && !attended.has(`${s.user_id}|${s.date}`)
        )
        .map((s) => ({
          id: `derived-${s.user_id}-${s.date}`,
          user_id: s.user_id,
          date: s.date,
          attendance_status: "alpha",
          is_late: false,
          late_minutes: 0,
          clock_in_time: null,
          clock_out_time: null,
          derived: true,
          profiles: {
            full_name: memberMap[s.user_id]?.full_name,
            position: memberMap[s.user_id]?.position,
            avatar_url: memberMap[s.user_id]?.avatar_url,
          },
        }));

      // 6. Gabungkan & urutkan
      const merged = [...(attRows || []), ...derived].sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return (b.clock_in_time || "").localeCompare(a.clock_in_time || "");
      });

      setMergedRows(merged);
    } catch (err) {
      console.error("❌ fetchRecords:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(); }, [dateFrom, dateTo, organizationId]);

  const { pullDistance, isRefreshing } = usePullToRefresh(() => fetchRecords());

  // ── Filter + pagination client-side atas dataset gabungan ────────────────
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mergedRows.filter((r) => {
      if (statusFilter && r.attendance_status !== statusFilter) return false;
      if (q) {
        const hay = `${r.profiles?.full_name || ""} ${r.profiles?.position || ""} ${r.profiles?.username || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [mergedRows, statusFilter, search]);

  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const records = useMemo(
    () => filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredRows, page]
  );

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const summary = useMemo(() => {
    const acc = { hadir: 0, izin: 0, sakit: 0, alpha: 0 };
    filteredRows.forEach((r) => {
      if (r.attendance_status === "hadir" || r.attendance_status === "terlambat") acc.hadir++;
      else if (r.attendance_status === "izin") acc.izin++;
      else if (r.attendance_status === "sakit") acc.sakit++;
      else if (r.attendance_status === "alpha") acc.alpha++;
    });
    return acc;
  }, [filteredRows]);

  // ── Export Excel ──────────────────────────────────────────────────────────
  const exportExcel = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase
        .from("attendance")
        .select("*, profiles(full_name, position)")
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date", { ascending: false });

      if (error || !data) return;

      const fmtDay = (d) =>
        new Date(d + "T00:00:00").toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
      const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "-");

      await exportExcelWorkbook({
        filename: `riwayat-absensi-${dateFrom}-sd-${dateTo}.xlsx`,
        sheetName: "Riwayat Absensi",
        orgName: user?.override_org?.name || user?.organization?.name,
        docTitle: `Riwayat Absensi — ${fmtDay(dateFrom)} s.d. ${fmtDay(dateTo)}`,
        header: ["Tanggal", "Nama", "Jabatan", "Absen Masuk", "Absen Pulang", "Status", "Terlambat (menit)"],
        columnMeta: [
          { align: "center", numFmt: DATE_FMT }, { align: "left" }, { align: "left" },
          { align: "center" }, { align: "center" }, { align: "center" }, { align: "right" },
        ],
        rows: data.map((r) => [
          new Date(r.date + "T00:00:00"),
          r.profiles?.full_name ?? "-",
          r.profiles?.position ?? "-",
          fmtTime(r.clock_in_time),
          fmtTime(r.clock_out_time),
          cap(r.attendance_status),
          Number(r.late_minutes ?? 0),
        ]),
      });
    } finally {
      setExporting(false);
    }
  };


  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      {/* Header */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={exportExcel}
          disabled={exporting}
          className="flex items-center gap-2.5 px-4 py-2.5 bg-electric-violet text-pure-white rounded-full text-sm font-medium hover:brightness-110 active:brightness-90 disabled:opacity-50 transition-all duration-200 shrink-0"
        >
          <Download size={15} />
          <span className="hidden sm:inline">Export Excel</span>
          <span className="sm:hidden">Export</span>
        </button>
      </div>

      {/* Summary Cards - Responsive: 2 cols mobile, 3 cols tablet, 4 cols desktop */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        <SummaryCard label="Hadir"  value={summary.hadir}  accent="from-emerald-500 to-teal-700"  icon={CheckCircle2}   />
        <SummaryCard label="Izin"   value={summary.izin}   accent="from-green-yellow to-electric-violet" icon={Clock}          />
        <SummaryCard label="Sakit"  value={summary.sakit}  accent="from-green-yellow to-electric-violet"  icon={AlertTriangle}  />
        <SummaryCard label="Alpha"  value={summary.alpha}  accent="from-rose-500 to-pink-700"    icon={XCircle}        />
      </div>

      {/* Filter Bar */}
      <div className={`${cardBase} p-4`}>
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search - Full width on mobile, flex-1 on desktop */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-mist" />
            <input
              type="text"
              placeholder="Cari nama..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 ${inputBase}`}
            />
          </div>

          {/* Filters row - wraps on smaller screens */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Status filter */}
            <div className="relative">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-mist pointer-events-none" />
              <select
                value={statusFilter}
                onChange={e => setStatus(e.target.value)}
                className={`pl-9 pr-4 py-2 ${inputBase} appearance-none w-full sm:w-[140px]`}
              >
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value} className="bg-obsidian">{o.label}</option>
                ))}
              </select>
            </div>

            {/* Date filters grouped */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <span className="text-xs text-slate-mist uppercase tracking-wider whitespace-nowrap">Dari</span>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className={`${inputBase} [color-scheme:dark] w-full sm:w-auto`}
              />
              <span className="text-xs text-slate-mist uppercase tracking-wider whitespace-nowrap">Sampai</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className={`${inputBase} [color-scheme:dark] w-full sm:w-auto`}
              />
            </div>

            {/* Refresh */}
            <button
              onClick={() => fetchRecords(true)}
              className="bg-electric-violet text-pure-white p-2 rounded-full hover:brightness-110 active:brightness-90 transition-all duration-200 shrink-0"
              aria-label="Refresh"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabel / Cards */}
      <div className={`${cardBase} overflow-hidden`}>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-periwinkle-glow" />
          </div>
        ) : records.length === 0 ? (
          <div className="design-empty flex flex-col items-center gap-3">
            <div className="design-empty-icon">
              <Inbox size={32} />
            </div>
            <div>
              <p className="text-pure-white/60 font-medium">Tidak ada data pada rentang tanggal ini</p>
              <p className="design-empty-text text-xs mt-1">Coba ubah filter tanggal atau status</p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="design-table-header">
                    <th className="text-left py-3 px-4 font-semibold text-slate-mist text-xs uppercase tracking-wider">Tanggal</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-mist text-xs uppercase tracking-wider">Nama</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-mist text-xs uppercase tracking-wider">Absen Masuk</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-mist text-xs uppercase tracking-wider">Absen Pulang</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-mist text-xs uppercase tracking-wider">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-mist text-xs uppercase tracking-wider">Terlambat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {records.map(r => (
                    <tr key={r.id} className="hover:bg-white/[0.03] transition-all">
                      <td className="py-3 px-4 text-pure-white/70">
                        {fmtDate(r.date)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br ${avatarGradient(r.profiles?.full_name)} flex items-center justify-center text-pure-white text-xs font-bold shadow shrink-0`}>
                            {r.profiles?.avatar_url ? (
                              <img
                                src={r.profiles.avatar_url}
                                alt={r.profiles?.full_name || "Foto profil"}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              initials(r.profiles?.full_name)
                            )}
                          </div>
                          <span className="font-medium text-pure-white">
                            {r.profiles?.full_name ?? "–"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-emerald-300 tabular-nums">
                        {fmtTime(r.clock_in_time)}
                      </td>
                      <td className="py-3 px-4 font-mono text-rose-300 tabular-nums">
                        {fmtTime(r.clock_out_time)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={r.attendance_status} />
                      </td>
                      <td className="py-3 px-4">
                        {r.is_late ? (
                          <span className="text-xs text-green-yellow font-medium">
                            +{r.late_minutes} menit
                          </span>
                        ) : (
                          <span className="text-xs text-slate-mist">–</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-white/[0.06] pb-28">
              {records.map(r => (
                <div key={r.id} className="p-4 hover:bg-white/[0.03] transition-all">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br ${avatarGradient(r.profiles?.full_name)} flex items-center justify-center text-white text-xs font-bold shadow shrink-0`}>
                      {r.profiles?.avatar_url ? (
                        <img
                          src={r.profiles.avatar_url}
                          alt={r.profiles?.full_name || "Foto profil"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        initials(r.profiles?.full_name)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-pure-white truncate">{r.profiles?.full_name ?? "–"}</p>
                        </div>
                        <StatusBadge status={r.attendance_status} />
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-slate-mist">
                        <Calendar size={11} />
                        {fmtDate(r.date)}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                        <div className="bg-onyx rounded-2xl p-2">
                          <p className="text-slate-mist uppercase tracking-wider text-[10px]">Masuk</p>
                          <p className="text-emerald-300 font-mono tabular-nums mt-0.5">{fmtTime(r.clock_in_time)}</p>
                        </div>
                        <div className="bg-onyx rounded-2xl p-2">
                          <p className="text-slate-mist uppercase tracking-wider text-[10px]">Pulang</p>
                          <p className="text-rose-300 font-mono tabular-nums mt-0.5">{fmtTime(r.clock_out_time)}</p>
                        </div>
                      </div>
                      {r.is_late && (
                        <p className="text-xs text-green-yellow mt-2 font-medium">
                          ⚠ Terlambat +{r.late_minutes} menit
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06] gap-2">
            <p className="text-xs text-slate-mist">
              Halaman <span className="text-pure-white font-medium">{page}</span> dari {totalPages} · {total} data
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-full border border-white/10 border-gradient bg-transparent text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                aria-label="Halaman sebelumnya"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-full border border-white/10 border-gradient bg-transparent text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                aria-label="Halaman berikutnya"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

