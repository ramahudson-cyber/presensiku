// src/pages/admin/SecurityAttendancePage.jsx
// Pantauan kecurangan absensi (fake GPS, akurasi mencurigakan, dll).
// Membaca dua sumber yang sudah ada di DB:
//   1. attendance_security_events — jejak percobaan yang DITOLAK
//   2. attendance dengan mock_flag = true — absen yang lolos tapi ditandai
// RLS yang membatasi per instansi; tidak ada filter org manual di client.
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import { exportExcelWorkbook, DATE_FMT } from "../../services/excelExport";
import usePullToRefresh from "../../hooks/usePullToRefresh";
import PullToRefreshIndicator from "../../components/PullToRefreshIndicator";
import BottomSheet from "../../components/BottomSheet";
import {
  ShieldAlert, ShieldCheck, Search, Download, Loader2, RefreshCw,
  AlertTriangle, XCircle, Smartphone, Clock, Inbox, Filter,
} from "lucide-react";

const cardBase = "design-card";
const inputBase = "design-input";
const sectionTitle = "design-section-title";
const sectionSub = "design-section-sub";

const PAGE_SIZE = 15;

const getWitaDateString = (date = new Date()) => {
  const witaMs = date.getTime() + 8 * 60 * 60 * 1000;
  return new Date(witaMs).toISOString().split("T")[0];
};

const daysAgoWita = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return getWitaDateString(d);
};

// Label manusiawi untuk event_type di DB.
const EVENT_LABEL = {
  MOCK_REJECTED: "Fake GPS terdeteksi",
  MOCK_FLAGGED: "Fake GPS (ditandai)",
  SUSPICIOUS_ACCURACY: "Akurasi GPS mencurigakan",
  FAKE_LOCATION_REJECTED: "Lokasi palsu (heuristik)",
  APP_INTEGRITY_MISSING: "Aplikasi perlu diperbarui",
  VELOCITY_FLAGGED: "Kecepatan tidak wajar",
  BINDING_REJECTED: "Perangkat tidak terdaftar",
};

const EVENT_OPTIONS = [
  { value: "", label: "Semua Jenis" },
  ...Object.entries(EVENT_LABEL).map(([value, label]) => ({ value, label })),
];

const SEVERITY_OPTIONS = [
  { value: "", label: "Semua Tingkat" },
  { value: "critical", label: "Kritis" },
  { value: "warning", label: "Peringatan" },
  { value: "info", label: "Info" },
];

const SEVERITY_STYLE = {
  critical: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  warning: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  info: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
};

const fmtDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString("id-ID", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar",
      })
    : "–";

const fmtDate = (dateStr) =>
  dateStr
    ? new Date(dateStr + "T00:00:00Z").toLocaleDateString("id-ID", {
        day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Makassar",
      })
    : "–";

const fmtTime = (iso) =>
  iso
    ? new Date(iso).toLocaleTimeString("id-ID", {
        hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar",
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

function SummaryCard({ label, value, accent, icon: Icon }) {
  return (
    <div className={`${cardBase} p-4 flex items-center gap-3`}>
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

function SeverityBadge({ severity }) {
  const cls = SEVERITY_STYLE[severity] || SEVERITY_STYLE.info;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold ring-1 ${cls}`}>
      {severity === "critical" ? <XCircle size={10} /> : <AlertTriangle size={10} />}
      {(severity || "info").toUpperCase()}
    </span>
  );
}

export default function SecurityAttendancePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState([]);
  const [flagged, setFlagged] = useState([]);
  const [memberMap, setMemberMap] = useState({});

  const [dateFrom, setDateFrom] = useState(daysAgoWita(29));
  const [dateTo, setDateTo] = useState(getWitaDateString());
  const [eventType, setEventType] = useState("");
  const [severity, setSeverity] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      // Rentang tanggal kosong (input dikosongkan) → fallback ke default.
      const fromDate = dateFrom || daysAgoWita(29);
      const toDate = dateTo || getWitaDateString();
      const fromIso = `${fromDate}T00:00:00+08:00`;
      const toIso = `${toDate}T23:59:59+08:00`;

      const [evRes, flagRes, profRes] = await Promise.all([
        supabase
          .from("attendance_security_events")
          .select("*")
          .gte("created_at", fromIso)
          .lte("created_at", toIso)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("attendance")
          .select("*")
          .eq("mock_flag", true)
          .gte("date", dateFrom)
          .lte("date", dateTo)
          .order("date", { ascending: false })
          .limit(1000),
        supabase.from("profiles").select("id, full_name, position, username"),
      ]);

      if (evRes.error) throw evRes.error;
      if (flagRes.error) throw flagRes.error;

      setEvents(evRes.data || []);
      setFlagged(flagRes.data || []);
      setMemberMap(Object.fromEntries((profRes.data || []).map((p) => [p.id, p])));
    } catch (e) {
      console.error("❌ Gagal memuat data keamanan absensi:", e);
      toast.error("Gagal memuat data keamanan absensi");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    // setTimeout: hindari setState sinkron di body effect (pola halaman lain).
    // Polling 60 detik memakai mode silent agar panel tidak berkedip "Memuat…".
    const kick = setTimeout(load, 0);
    const id = setInterval(() => load(true), 60000);
    return () => { clearTimeout(kick); clearInterval(id); };
  }, [load]);

  const { pullDistance, isRefreshing } = usePullToRefresh(() => load(true));

  const nameOf = (userId) => memberMap[userId]?.full_name || "–";
  const positionOf = (userId) => memberMap[userId]?.position || "";

  // Filter client-side: jenis, severity, pencarian nama.
  // Lookup nama di-inline (bukan lewat nameOf) agar dependency useMemo akurat.
  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (eventType && e.event_type !== eventType) return false;
      if (severity && e.severity !== severity) return false;
      if (!q) return true;
      const name = (memberMap[e.user_id]?.full_name || "").toLowerCase();
      return name.includes(q) || (e.device_visitor_id || "").toLowerCase().includes(q);
    });
  }, [events, eventType, severity, search, memberMap]);

  const filteredFlagged = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return flagged;
    return flagged.filter((a) => (memberMap[a.user_id]?.full_name || "").toLowerCase().includes(q));
  }, [flagged, search, memberMap]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedEvents = filteredEvents.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Ringkasan
  const today = getWitaDateString();
  const todayCount = events.filter((e) => getWitaDateString(new Date(e.created_at)) === today).length;
  const uniquePeople = new Set([
    ...events.map((e) => e.user_id).filter(Boolean),
    ...flagged.map((a) => a.user_id).filter(Boolean),
  ]).size;
  const highestSeverity = events.some((e) => e.severity === "critical")
    ? "critical"
    : events.some((e) => e.severity === "warning")
      ? "warning"
      : events.length
        ? "info"
        : "–";

  const handleExport = async (kind) => {
    setExporting(true);
    try {
      const orgName = user?.override_org?.name || user?.organization?.name || "Presensiku";

      if (kind === "events") {
        if (!filteredEvents.length) {
          toast.info("Tidak ada data pelanggaran untuk diekspor");
          return;
        }
        await exportExcelWorkbook({
          filename: `keamanan-absensi-${dateFrom}-sd-${dateTo}.xlsx`,
          sheetName: "Pelanggaran",
          orgName,
          docTitle: "Laporan Keamanan Absensi",
          header: ["Waktu", "Nama", "Jabatan", "Jenis", "Tingkat", "Akurasi (m)", "Device", "Versi App", "Runtime", "Platform", "Pelanggaran"],
          columnMeta: [
            {}, {}, {}, {}, {}, { align: "right" }, {}, { align: "right" }, {}, {}, { wrap: true },
          ],
          rows: filteredEvents.map((e) => [
            new Date(e.created_at),
            nameOf(e.user_id),
            positionOf(e.user_id),
            EVENT_LABEL[e.event_type] || e.event_type,
            e.severity || "info",
            e.accuracy ?? null,
            e.device_visitor_id || "–",
            e.app_version_code ?? null,
            e.runtime || "–",
            e.platform || "–",
            (e.violations || []).join(", "),
          ]),
        });
        toast.success(`${filteredEvents.length} baris pelanggaran diekspor`);
      } else {
        if (!filteredFlagged.length) {
          toast.info("Tidak ada absen berflag untuk diekspor");
          return;
        }
        await exportExcelWorkbook({
          filename: `absen-berflag-${dateFrom}-sd-${dateTo}.xlsx`,
          sheetName: "Absen Berflag",
          orgName,
          docTitle: "Laporan Absen Berflag",
          header: ["Tanggal", "Nama", "Jabatan", "Masuk", "Pulang", "Lokasi", "Jarak (m)", "Akurasi (m)", "Mock", "Emulator", "Rooted", "Verdict", "Kecepatan (km/jam)"],
          columnMeta: [
            { numFmt: DATE_FMT }, {}, {}, {}, {}, {}, { align: "right" }, { align: "right" },
            { align: "center" }, { align: "center" }, { align: "center" }, {}, { align: "right" },
          ],
          rows: filteredFlagged.map((a) => [
            new Date(a.date + "T00:00:00Z"),
            nameOf(a.user_id),
            positionOf(a.user_id),
            fmtTime(a.clock_in_time),
            fmtTime(a.clock_out_time),
            a.location_in?.matched_location_name || "–",
            a.location_in?.distance_from_location ?? a.location_in?.distance_from_puskesmas ?? null,
            a.location_in?.accuracy ?? null,
            a.client_integrity?.mock_detected ? "Ya" : "Tidak",
            a.client_integrity?.emulator ? "Ya" : "Tidak",
            a.client_integrity?.rooted ? "Ya" : "Tidak",
            a.integrity_verdict || "–",
            a.client_integrity?.velocity?.speed_kmh ?? null,
          ]),
        });
        toast.success(`${filteredFlagged.length} baris absen berflag diekspor`);
      }
    } catch (err) {
      toast.error("Gagal mengekspor: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5 pb-24">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className={`${sectionTitle} flex items-center gap-2`}>
            <ShieldAlert size={18} className="text-electric-violet" /> Keamanan Absensi
          </h2>
          <p className={sectionSub}>
            Jejak percobaan fake GPS, akurasi mencurigakan, dan absen yang ditandai
          </p>
        </div>
        <button
          onClick={() => load()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-electric-violet text-pure-white rounded-full text-sm font-medium hover:brightness-110 disabled:opacity-60"
        >
          <RefreshCw size={15} className={loading || refreshing ? "animate-spin" : ""} />
          <span className="hidden sm:inline">Muat ulang</span>
        </button>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Penolakan Hari Ini" value={todayCount} accent="from-rose-500 to-pink-700" icon={ShieldAlert} />
        <SummaryCard label="Absen Berflag" value={flagged.length} accent="from-amber-500 to-orange-700" icon={AlertTriangle} />
        <SummaryCard label="Pegawai Terlibat" value={uniquePeople} accent="from-electric-violet to-deep-indigo" icon={Smartphone} />
        <SummaryCard label="Tingkat Tertinggi" value={highestSeverity === "critical" ? "Kritis" : highestSeverity === "warning" ? "Waspada" : highestSeverity === "info" ? "Info" : "–"} accent="from-sky-500 to-blue-700" icon={ShieldCheck} />
      </div>

      {/* Filter */}
      <div className={`${cardBase} p-4`}>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-mist" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Cari nama pegawai atau device…"
              className={`${inputBase} pl-10`}
            />
          </div>
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-mist pointer-events-none" />
            <select
              value={eventType}
              onChange={(e) => { setEventType(e.target.value); setPage(1); }}
              className={`${inputBase} pl-9 appearance-none w-full sm:w-[220px]`}
            >
              {EVENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <select
            value={severity}
            onChange={(e) => { setSeverity(e.target.value); setPage(1); }}
            className={`${inputBase} appearance-none w-full sm:w-[150px]`}
            title="Tingkat keparahan"
          >
            {SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={`${inputBase} w-full sm:w-[150px] `}
            title="Dari tanggal"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={`${inputBase} w-full sm:w-[150px] `}
            title="Sampai tanggal"
          />
        </div>
      </div>

      {/* Panel A — Riwayat pelanggaran */}
      <div className={`${cardBase} overflow-hidden`}>
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-1 h-4 rounded-full bg-rose-500 shrink-0" />
            <h3 className="text-sm font-bold text-pure-white truncate">Riwayat Pelanggaran</h3>
            <span className="text-[10px] text-slate-mist shrink-0">{filteredEvents.length} kejadian</span>
          </div>
          <button
            onClick={() => handleExport("events")}
            disabled={exporting || !filteredEvents.length}
            className="inline-flex items-center gap-2 px-3 py-2 bg-electric-violet text-pure-white rounded-full text-xs font-medium hover:brightness-110 disabled:opacity-50 shrink-0"
          >
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>

        {loading ? (
          <div className="p-8 flex items-center justify-center gap-2 text-sm text-slate-mist">
            <Loader2 size={16} className="animate-spin" /> Memuat…
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-mist">
            <Inbox size={26} className="mx-auto mb-2 opacity-50" />
            Belum ada percobaan pelanggaran pada rentang tanggal ini.
          </div>
        ) : (
          <>
            <div className="divide-y divide-white/[0.06]">
              {pagedEvents.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setDetail({ kind: "event", data: e })}
                  className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors"
                >
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGradient(nameOf(e.user_id))} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                    {initials(nameOf(e.user_id))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-semibold text-pure-white truncate">{nameOf(e.user_id)}</p>
                      <SeverityBadge severity={e.severity} />
                    </div>
                    <p className="text-[11px] text-slate-mist mt-0.5 truncate">
                      {EVENT_LABEL[e.event_type] || e.event_type}
                      {e.accuracy != null ? ` · akurasi ${Math.round(e.accuracy)} m` : ""}
                      {(e.violations || []).length ? ` · ${(e.violations || []).join(", ")}` : ""}
                    </p>
                    <p className="text-[10px] text-slate-mist/70 mt-0.5 flex items-center gap-1">
                      <Clock size={9} /> {fmtDateTime(e.created_at)}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-mist/60 shrink-0">Detail</span>
                </button>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
                <span className="text-[10px] text-slate-mist">
                  Halaman {safePage} dari {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="px-3 py-1.5 rounded-full border border-white/10 text-xs text-slate-mist disabled:opacity-40"
                  >
                    Sebelumnya
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="px-3 py-1.5 rounded-full border border-white/10 text-xs text-slate-mist disabled:opacity-40"
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Panel B — Absen berflag */}
      <div className={`${cardBase} overflow-hidden`}>
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-1 h-4 rounded-full bg-amber-500 shrink-0" />
            <h3 className="text-sm font-bold text-pure-white truncate">Absen Berflag</h3>
            <span className="text-[10px] text-slate-mist shrink-0">{filteredFlagged.length} baris</span>
          </div>
          <button
            onClick={() => handleExport("flagged")}
            disabled={exporting || !filteredFlagged.length}
            className="inline-flex items-center gap-2 px-3 py-2 bg-electric-violet text-pure-white rounded-full text-xs font-medium hover:brightness-110 disabled:opacity-50 shrink-0"
          >
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>

        {loading ? (
          <div className="p-8 flex items-center justify-center gap-2 text-sm text-slate-mist">
            <Loader2 size={16} className="animate-spin" /> Memuat…
          </div>
        ) : filteredFlagged.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-mist">
            <ShieldCheck size={26} className="mx-auto mb-2 opacity-50" />
            Tidak ada absen yang ditandai pada rentang tanggal ini.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {filteredFlagged.slice(0, 100).map((a) => {
              const ci = a.client_integrity || {};
              const loc = a.location_in || {};
              return (
                <button
                  key={a.id}
                  onClick={() => setDetail({ kind: "attendance", data: a })}
                  className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors"
                >
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGradient(nameOf(a.user_id))} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                    {initials(nameOf(a.user_id))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-semibold text-pure-white truncate">{nameOf(a.user_id)}</p>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30">
                        <AlertTriangle size={9} /> DITANDAI
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-mist mt-0.5 truncate">
                      {fmtDate(a.date)} · {fmtTime(a.clock_in_time)}–{fmtTime(a.clock_out_time)}
                      {loc.matched_location_name ? ` · ${loc.matched_location_name}` : ""}
                      {loc.distance_from_location != null ? ` · ${Math.round(loc.distance_from_location)} m` : ""}
                    </p>
                    <p className="text-[10px] text-slate-mist/70 mt-0.5 truncate">
                      {[
                        ci.mock_detected ? "mock GPS" : null,
                        ci.emulator ? "emulator" : null,
                        ci.rooted ? "rooted" : null,
                        ci.velocity && ci.velocity.ok === false ? `kecepatan ${Math.round(ci.velocity.speed_kmh || 0)} km/jam` : null,
                      ].filter(Boolean).join(" · ") || "sinyal mencurigakan"}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-mist/60 shrink-0">Detail</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail */}
      <BottomSheet
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.kind === "event" ? "Detail Pelanggaran" : "Detail Absen Berflag"}
        subtitle={detail ? nameOf(detail.data.user_id) : ""}
      >
        {detail && (
          <div className="space-y-3 pb-2">
            {detail.kind === "event" ? (
              <>
                <DetailRow label="Waktu" value={fmtDateTime(detail.data.created_at)} />
                <DetailRow label="Jenis" value={EVENT_LABEL[detail.data.event_type] || detail.data.event_type} />
                <DetailRow label="Tingkat" value={(detail.data.severity || "info").toUpperCase()} />
                <DetailRow label="Pegawai" value={nameOf(detail.data.user_id)} />
                <DetailRow label="Jabatan" value={positionOf(detail.data.user_id) || "–"} />
                <DetailRow label="Akurasi GPS" value={detail.data.accuracy != null ? `${Math.round(detail.data.accuracy)} m` : "–"} />
                <DetailRow label="Koordinat" value={detail.data.latitude != null && detail.data.longitude != null ? `${detail.data.latitude}, ${detail.data.longitude}` : "–"} />
                <DetailRow label="Pelanggaran" value={(detail.data.violations || []).join(", ") || "–"} />
                <DetailRow label="Device ID" value={detail.data.device_visitor_id || "–"} />
                <DetailRow label="Versi App" value={detail.data.app_version_code != null ? String(detail.data.app_version_code) : "–"} />
                <DetailRow label="Runtime / Platform" value={`${detail.data.runtime || "–"} / ${detail.data.platform || "–"}`} />
                {detail.data.signal && (
                  <div className="rounded-2xl bg-white/5 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-mist mb-1.5">Sinyal Mentah</p>
                    <pre className="text-[10px] text-slate-mist whitespace-pre-wrap break-all font-mono">
                      {JSON.stringify(detail.data.signal, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            ) : (
              <>
                <DetailRow label="Tanggal" value={fmtDate(detail.data.date)} />
                <DetailRow label="Pegawai" value={nameOf(detail.data.user_id)} />
                <DetailRow label="Jabatan" value={positionOf(detail.data.user_id) || "–"} />
                <DetailRow label="Jam Masuk / Pulang" value={`${fmtTime(detail.data.clock_in_time)} – ${fmtTime(detail.data.clock_out_time)}`} />
                <DetailRow label="Status" value={(detail.data.attendance_status || "–").toUpperCase()} />
                <DetailRow label="Lokasi Cocok" value={detail.data.location_in?.matched_location_name || "–"} />
                <DetailRow label="Jarak" value={detail.data.location_in?.distance_from_location != null ? `${Math.round(detail.data.location_in.distance_from_location)} m` : "–"} />
                <DetailRow label="Akurasi" value={detail.data.location_in?.accuracy != null ? `${Math.round(detail.data.location_in.accuracy)} m` : "–"} />
                <DetailRow label="Altitude" value={detail.data.location_in?.altitude != null ? `${detail.data.location_in.altitude} m` : "–"} />
                <DetailRow label="Koordinat Masuk" value={detail.data.location_in?.latitude != null ? `${detail.data.location_in.latitude}, ${detail.data.location_in.longitude}` : "–"} />
                <DetailRow label="Verdict Integritas" value={detail.data.integrity_verdict || "–"} />
                <DetailRow label="Mock / Emulator / Rooted" value={[
                  detail.data.client_integrity?.mock_detected ? "Mock GPS" : null,
                  detail.data.client_integrity?.emulator ? "Emulator" : null,
                  detail.data.client_integrity?.rooted ? "Rooted" : null,
                ].filter(Boolean).join(", ") || "Tidak ada"} />
                <DetailRow label="Aplikasi Mock" value={detail.data.client_integrity?.mock_apps || "–"} />
                <DetailRow label="Kecepatan" value={detail.data.client_integrity?.velocity ? `${Math.round(detail.data.client_integrity.velocity.speed_kmh || 0)} km/jam (maks ${detail.data.client_integrity.velocity.max_kmh || "–"})` : "–"} />
                <DetailRow label="Device" value={detail.data.device_name || detail.data.device_visitor_id || "–"} />
                <div className="rounded-2xl bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-mist mb-1.5">Sinyal Integritas</p>
                  <pre className="text-[10px] text-slate-mist whitespace-pre-wrap break-all font-mono">
                    {JSON.stringify(detail.data.client_integrity || {}, null, 2)}
                  </pre>
                </div>
              </>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl bg-white/5 px-3 py-2.5">
      <span className="text-[11px] text-slate-mist shrink-0">{label}</span>
      <span className="text-[11px] font-semibold text-pure-white text-right break-all">{value}</span>
    </div>
  );
}
