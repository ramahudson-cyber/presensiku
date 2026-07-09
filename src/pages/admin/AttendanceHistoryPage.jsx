// src/pages/admin/AttendanceHistoryPage.jsx
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import {
  Search, Filter, Download, Calendar,
  ChevronLeft, ChevronRight, Loader2,
  CheckCircle2, XCircle, Clock, AlertTriangle,
  Users, RefreshCw, Inbox,
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
  const [records, setRecords]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [summary, setSummary]     = useState({ hadir: 0, izin: 0, sakit: 0, alpha: 0 });

  // Filter state
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatus] = useState("");
  const [dateFrom, setDateFrom]   = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return getWitaDateString(d);
  });
  const [dateTo, setDateTo]       = useState(getWitaDateString());

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchRecords = async (resetPage = false) => {
    setLoading(true);
    const currentPage = resetPage ? 1 : page;
    if (resetPage) setPage(1);

    try {
      // Base query dengan join profiles
      let query = supabase
        .from("attendance")
        .select("*, profiles(full_name, position)", { count: "exact" })
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date", { ascending: false })
        .order("clock_in_time", { ascending: false });

      if (statusFilter) query = query.eq("attendance_status", statusFilter);

      // Pagination
      const from = (currentPage - 1) * PAGE_SIZE;
      query = query.range(from, from + PAGE_SIZE - 1);

      const { data, count, error } = await query;
      if (error) throw error;

      // Filter search di client (nama pegawai / jabatan)
      const filtered = search.trim()
        ? (data || []).filter(r =>
            r.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
            (r.profiles?.position || '').toLowerCase().includes(search.toLowerCase())
          )
        : (data || []);

      setRecords(filtered);
      setTotal(count || 0);

      // Summary: ambil count per status di rentang tanggal
      const statuses = ["hadir", "izin", "sakit", "alpha"];
      const counts = await Promise.all(
        statuses.map(s => {
          let query = supabase
            .from("attendance")
            .select("*", { count: "exact", head: true })
            .gte("date", dateFrom)
            .lte("date", dateTo);

          query = s === "hadir"
            ? query.in("attendance_status", ["hadir", "terlambat"])
            : query.eq("attendance_status", s);

          return query.then(({ count }) => count || 0);
        })
      );
      setSummary({ hadir: counts[0], izin: counts[1], sakit: counts[2], alpha: counts[3] });
    } catch (err) {
      console.error("❌ fetchRecords:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(); }, [page]);
  useEffect(() => { fetchRecords(true); }, [dateFrom, dateTo, statusFilter]);

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportCSV = async () => {
    const { data, error } = await supabase
      .from("attendance")
      .select("*, profiles(full_name, position)")
      .gte("date", dateFrom)
      .lte("date", dateTo)
      .order("date", { ascending: false });

    if (error || !data) return;

    const header = ["Tanggal", "Nama", "Jabatan", "Absen Masuk", "Absen Pulang", "Status", "Terlambat (menit)"];
    const rows = data.map(r => [
      r.date,
      r.profiles?.full_name ?? "-",
      r.profiles?.position ?? "-",
      fmtTime(r.clock_in_time),
      fmtTime(r.clock_out_time),
      r.attendance_status ?? "-",
      r.late_minutes ?? 0,
    ]);

    const csv = [header, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `riwayat-absensi-${dateFrom}-sd-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold text-pure-white tracking-tight">Riwayat Absensi</h1>
          <p className="text-sm text-slate-mist mt-1">Data absensi seluruh pegawai</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2.5 px-4 py-2.5 bg-electric-violet text-pure-white rounded-full text-sm font-medium hover:brightness-110 active:brightness-90 transition-all duration-200 shrink-0"
        >
          <Download size={15} />
          <span className="hidden sm:inline">Export CSV</span>
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
              onChange={e => { setSearch(e.target.value); fetchRecords(true); }}
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
                          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGradient(r.profiles?.full_name)} flex items-center justify-center text-pure-white text-xs font-bold shadow shrink-0`}>
                            {initials(r.profiles?.full_name)}
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
            <div className="md:hidden divide-y divide-white/[0.06]">
              {records.map(r => (
                <div key={r.id} className="p-4 hover:bg-white/[0.03] transition-all">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarGradient(r.profiles?.full_name)} flex items-center justify-center text-white text-xs font-bold shadow shrink-0`}>
                      {initials(r.profiles?.full_name)}
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
                          <p className="text-slate-mist uppercase tracking-wider text-[10px]">Check In</p>
                          <p className="text-emerald-300 font-mono tabular-nums mt-0.5">{fmtTime(r.clock_in_time)}</p>
                        </div>
                        <div className="bg-onyx rounded-2xl p-2">
                          <p className="text-slate-mist uppercase tracking-wider text-[10px]">Check Out</p>
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

