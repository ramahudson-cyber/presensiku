import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import {
  XCircle, CheckCircle2, Hourglass, RotateCcw, Image as ImageIcon, Loader2
} from "lucide-react";
import {
  getMyDisputableAttendance, getMySanggahan, createSanggahan, cancelMySanggahan,
  uploadSanggahanEvidence, getAttendanceByDate,
} from "../../services/sanggahService";
import usePullToRefresh from "../../hooks/usePullToRefresh";
import PullToRefreshIndicator from "../../components/PullToRefreshIndicator";
import EmployeeAppBar from "../../components/EmployeeAppBar";
import { getWitaDateKey } from "../../lib/shiftTime";

// Token light-mode per DESIGN.md (biru #2F8BF8, bg #F4F2FB, kartu putih)
const T = {
  blue: '#2F8BF8', blueDeep: '#1F74E0',
  bg: '#F4F2FB', surface: '#FFFFFF', border: 'rgba(31,41,55,0.08)', div: '#F1F5F9',
  text: '#0F172A', textSec: '#475569', textMuted: '#94A3B8', iconBg: '#EEF6FF',
  shadow: '0 4px 16px rgba(15,23,42,0.06)',
};

const STATUS_META = {
  pending:   { label: "Menunggu Review", color: "#F59E0B", icon: Hourglass },
  approved:  { label: "Disetujui",       color: "#10B981", icon: CheckCircle2 },
  rejected:  { label: "Ditolak",         color: "#EF4444", icon: XCircle },
  cancelled: { label: "Dibatalkan",      color: "#64748B", icon: RotateCcw },
};

const STATUS_LAMA_LABEL = { alpha: "Alpha", terlambat: "Terlambat", tanpa_pulang: "Tidak Absen Pulang" };

// Jenis sanggahan (snake_case — whitelist server), ikon persis preview
const JENIS_OPTIONS = [
  {
    key: "keterlambatan", label: "Keterlambatan", span: false,
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  },
  {
    key: "dinas_luar", label: "Dinas Luar", span: false,
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></svg>,
  },
  {
    key: "tidak_hadir", label: "Tidak Hadir", span: false,
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="17" rx="3" /><path d="M8 2.5v4M16 2.5v4M3 10h18" /><path d="M9.5 14.5l5 5M14.5 14.5l-5 5" /></svg>,
  },
  {
    key: "kendala_sistem", label: "Kendala Sistem", span: false,
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>,
  },
  {
    key: "tidak_absen_pulang", label: "Tidak Absen Pulang", span: true,
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v9m0 0 4-4m-4 4-4-4" /><path d="M4.3 14.3A8 8 0 1 0 20 13" /></svg>,
  },
];

const fmtDate = (dateKey) => {
  if (!dateKey) return "-";
  return new Date(dateKey + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};
const fmtDateShort = (dateKey) => {
  if (!dateKey) return "-";
  return new Date(dateKey + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" });
};

// Jam absen WITA, format HH.MM (id-ID memakai pemisah titik)
const fmtTime = (timeStr) => {
  if (!timeStr) return "--:--";
  if (timeStr.includes("T")) {
    return new Date(timeStr).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" });
  }
  return timeStr.substring(0, 5).replace(":", ".");
};

// Header section: chip ikon biru + judul (pola DESIGN.md, sentence case)
const SecHead = ({ icon, title }) => (
  <div className="flex items-center gap-2.5 mx-0.5 mb-3">
    <div className="w-[30px] h-[30px] rounded-[10px] flex items-center justify-center shrink-0" style={{ background: T.iconBg }}>
      {icon}
    </div>
    <b className="text-sm font-extrabold" style={{ color: T.text, letterSpacing: "-0.01em" }}>{title}</b>
  </div>
);

// Preselect jenis otomatis dari data absensi tanggal terpilih:
// terlambat → keterlambatan; hadir tanpa pulang (sudah bisa disanggah) →
// tidak_absen_pulang; alpha → user memilih sendiri.
const autoJenis = (row, date, disputable) => {
  if (!date) return null;
  if (row?.is_late || row?.attendance_status === "terlambat") return "keterlambatan";
  if (
    row && row.attendance_status === "hadir" && row.clock_in_time && !row.clock_out_time
    && disputable.some((d) => d.date === date && d.attendance_status === "tanpa_pulang")
  ) return "tidak_absen_pulang";
  return null;
};

export default function SanggahPage() {
  const { user } = useAuth();
  const [disputable, setDisputable] = useState([]);
  const [sanggahan, setSanggahan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [attendanceInfo, setAttendanceInfo] = useState(null);
  const [attLoading, setAttLoading] = useState(false);
  const [jenis, setJenis] = useState(null);
  const [reason, setReason] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const disputableRef = useRef([]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [att, mySanggahan] = await Promise.all([
        getMyDisputableAttendance(user.id),
        getMySanggahan(),
      ]);
      setDisputable(att);
      disputableRef.current = att;
      setSanggahan(mySanggahan);
      // Default: tanggal disputable terbaru supaya kartu data terisi riil
      setSelectedDate((prev) => prev ?? (att[0]?.date || null));
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat sanggahan: " + (err.message || ""), { position: "bottom-center" });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const { pullDistance, isRefreshing } = usePullToRefresh(load);

  // Fetch data absensi tanggal terpilih (riil dari tabel attendance) +
  // preselect jenis otomatis. Hanya jalan saat tanggal berubah.
  useEffect(() => {
    if (!user?.id || !selectedDate) {
      setAttendanceInfo(null);
      setJenis(null);
      return undefined;
    }
    let cancelled = false;
    setAttLoading(true);
    setFile(null);
    getAttendanceByDate(user.id, selectedDate)
      .then((row) => {
        if (cancelled) return;
        setAttendanceInfo(row);
        setJenis(autoJenis(row, selectedDate, disputableRef.current));
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) { setAttendanceInfo(null); setJenis(null); }
      })
      .finally(() => { if (!cancelled) setAttLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id, selectedDate]);

  const pendingByDate = new Map(
    sanggahan.filter((s) => s.status === "pending").map((s) => [s.tanggal, s])
  );
  const hasPendingForSelected = selectedDate ? pendingByDate.has(selectedDate) : false;

  // Batas pilihan tanggal: 60 hari terakhir s/d hari ini (WITA)
  const todayWita = getWitaDateKey();
  const minDate = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);

  // Badge status absensi dari data riil
  const attStatus = (() => {
    if (!attendanceInfo) return { kind: "none", label: "Tidak ada data absensi" };
    if (attendanceInfo.is_late || attendanceInfo.attendance_status === "terlambat") {
      const m = attendanceInfo.late_minutes > 0 ? ` (${attendanceInfo.late_minutes} mnt)` : "";
      return { kind: "late", label: `Terlambat${m}` };
    }
    if (attendanceInfo.clock_in_time) return { kind: "ontime", label: "Tepat Waktu" };
    const st = attendanceInfo.attendance_status;
    if (st === "izin" || st === "sakit") return { kind: "none", label: st === "izin" ? "Izin" : "Sakit" };
    return { kind: "none", label: "Tidak ada absen masuk" };
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDate) { toast.warning("Pilih tanggal absensi terlebih dahulu", { position: "bottom-center" }); return; }
    if (hasPendingForSelected) { toast.warning("Sudah ada sanggahan menunggu review untuk tanggal ini", { position: "bottom-center" }); return; }
    if (!jenis) { toast.warning("Pilih jenis sanggahan", { position: "bottom-center" }); return; }
    if (!reason.trim()) { toast.warning("Alasan wajib diisi", { position: "bottom-center" }); return; }
    if (file && file.size > 2 * 1024 * 1024) { toast.warning("Ukuran foto melebihi 2MB", { position: "bottom-center" }); return; }
    setSubmitting(true);
    try {
      let attachmentUrl = null;
      if (file) attachmentUrl = await uploadSanggahanEvidence(user.id, file);
      await createSanggahan({ tanggal: selectedDate, reason, attachmentUrl, jenis });
      toast.success("Sanggahan terkirim, menunggu review admin", { position: "bottom-center" });
      setReason(""); setFile(null); setJenis(null);
      await load();
    } catch (err) {
      toast.error(err.message || "Gagal mengirim sanggahan", { position: "bottom-center" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm("Batalkan sanggahan ini?")) return;
    try {
      await cancelMySanggahan(id);
      toast.success("Sanggahan dibatalkan", { position: "bottom-center" });
      await load();
    } catch (err) {
      toast.error(err.message || "Gagal membatalkan", { position: "bottom-center" });
    }
  };

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast.warning("Ukuran foto melebihi 2MB", { position: "bottom-center" }); e.target.value = ""; return; }
    setFile(f);
  };

  return (
    <div className="min-h-screen w-full font-sans absolute top-0 left-0 right-0 pb-28" style={{ background: T.bg, color: T.text }}>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      {/* Header — app bar biru (panah kembali + judul di tengah), tidak diubah */}
      <EmployeeAppBar title="Sanggahan" />

      <div className="max-w-md mx-auto px-4 pb-10">

        {/* ── Hero ── */}
        <div className="flex items-start justify-between gap-3 pt-3 px-1 pb-6">
          <div>
            <h2 className="text-[21px] font-extrabold" style={{ letterSpacing: "-0.02em", lineHeight: 1.22 }}>
              Ajukan Sanggahan Absensi <em className="not-italic" style={{ color: T.blue }}>dengan Mudah</em>
            </h2>
            <p className="text-[11.5px] mt-1.5 max-w-[230px]" style={{ lineHeight: 1.6, color: T.textSec }}>
              Sampaikan alasan jika terdapat ketidaksesuaian data absensi Anda.
            </p>
          </div>
          <div className="relative w-[120px] h-[104px] shrink-0" aria-hidden="true">
            <div className="absolute" style={{ inset: "-8px -6px 0 auto", width: 104, height: 92, background: "#DCEDFB", borderRadius: "46% 54% 52% 48% / 55% 45% 55% 45%" }} />
            <svg className="relative" width="120" height="104" viewBox="0 0 120 104" fill="none">
              <defs>
                <linearGradient id="gCalSanggah" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4A9BFF" />
                  <stop offset="100%" stopColor="#2F8BF8" />
                </linearGradient>
                <linearGradient id="gBadgeSanggah" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#32ACFB" />
                  <stop offset="100%" stopColor="#1F74E0" />
                </linearGradient>
              </defs>
              {/* kilau kuning */}
              <path d="M22 20l-7-7" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" />
              <path d="M14 32l-9-3" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" />
              <path d="M28 10l-3-9" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" />
              {/* bayangan lembut */}
              <ellipse cx="62" cy="86" rx="33" ry="6.5" fill="#2F8BF8" opacity="0.12" />
              {/* badan kalender */}
              <rect x="32" y="26" width="60" height="52" rx="9" fill="#FFFFFF" />
              <rect x="32" y="26" width="60" height="16" rx="8" fill="url(#gCalSanggah)" />
              <rect x="32" y="34" width="60" height="8" fill="url(#gCalSanggah)" />
              {/* ring pengikat */}
              <rect x="45" y="18" width="7" height="15" rx="3.5" fill="#8FC1F3" />
              <rect x="72" y="18" width="7" height="15" rx="3.5" fill="#8FC1F3" />
              {/* grid tanggal */}
              <rect x="41" y="48" width="11" height="9" rx="3" fill="#DCEDFB" />
              <rect x="56" y="48" width="11" height="9" rx="3" fill="#DCEDFB" />
              <rect x="71" y="48" width="11" height="9" rx="3" fill="#DCEDFB" />
              <rect x="41" y="61" width="11" height="9" rx="3" fill="#DCEDFB" />
              <rect x="56" y="61" width="11" height="9" rx="3" fill="#DCEDFB" />
              {/* badge centang */}
              <circle cx="92" cy="72" r="15" fill="url(#gBadgeSanggah)" />
              <circle cx="92" cy="72" r="15" stroke="#fff" strokeWidth="2" />
              <path d="M85.5 72.5l4.5 4.5 8-9" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* ── Kartu Data Absensi ── */}
          <div className="rounded-[20px] p-3.5 mb-6" style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
            <div className="flex items-center gap-2 mb-3">
              <svg className="shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="17" rx="3" /><path d="M8 2.5v4M16 2.5v4M3 10h18" /></svg>
              <input
                type="date"
                value={selectedDate || ""}
                min={minDate}
                max={todayWita}
                onChange={(e) => setSelectedDate(e.target.value || null)}
                className="flex-1 min-w-0 border-none outline-none bg-transparent font-bold text-xs"
                style={{ fontFamily: "inherit", color: T.text }}
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-[46px] h-[46px] rounded-[14px] flex items-center justify-center shrink-0" style={{ background: T.iconBg }}>
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="17" rx="3" /><path d="M8 2.5v4M16 2.5v4M3 10h18" /></svg>
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-[10px] font-semibold" style={{ color: T.textMuted }}>Data Absensi</span>
                <b className="block text-[14.5px] font-extrabold mt-0.5" style={{ letterSpacing: "-0.01em" }}>
                  {selectedDate ? fmtDate(selectedDate) : "Pilih tanggal"}
                </b>
              </div>
            </div>
            <div className="flex items-center gap-2.5 mt-2.5 flex-wrap" style={{ borderTop: `1px solid ${T.div}`, paddingTop: 11 }}>
              {attLoading ? (
                <span className="text-[10.5px] font-semibold inline-flex items-center gap-1.5" style={{ color: T.textMuted }}>
                  <Loader2 size={11} className="animate-spin" /> Memuat data absensi
                </span>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: T.textSec }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                    Masuk: <b className="font-extrabold" style={{ color: T.text }}>{attendanceInfo?.clock_in_time ? fmtTime(attendanceInfo.clock_in_time) : "--:--"}</b>
                  </div>
                  <span style={{ color: T.div }}>|</span>
                  {attStatus.kind === "late" && (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold rounded-full px-2.5 py-1" style={{ background: "rgba(239,68,68,0.1)", color: "#DC2626" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
                      {attStatus.label}
                    </span>
                  )}
                  {attStatus.kind === "ontime" && (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold rounded-full px-2.5 py-1" style={{ background: "rgba(16,185,129,0.1)", color: "#059669" }}>
                      {attStatus.label}
                    </span>
                  )}
                  {attStatus.kind === "none" && (
                    <span className="text-[10.5px] font-semibold" style={{ color: T.textMuted }}>{attStatus.label}</span>
                  )}
                  {hasPendingForSelected && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: "rgba(245,158,11,0.12)", color: "#F59E0B" }}>
                      <Hourglass size={10} /> Menunggu review
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Jenis Sanggahan ── */}
          <div className="mb-6">
            <SecHead
              title="Jenis Sanggahan"
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5Z" /><path d="m2 17 10 5 10-5M2 12l10 5 10-5" /></svg>}
            />
            <div className="grid grid-cols-2 gap-2.5">
              {JENIS_OPTIONS.map((opt) => {
                const on = jenis === opt.key;
                return (
                  <button
                    key={opt.key} type="button" onClick={() => setJenis(opt.key)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all duration-200 text-left ${opt.span ? "col-span-2" : ""}`}
                    style={{
                      border: `1.5px solid ${on ? "rgba(47,139,248,0.9)" : T.border}`,
                      background: on ? "linear-gradient(135deg, #2F8BF8, #1F74E0)" : T.surface,
                      boxShadow: on ? "0 6px 16px -6px rgba(47,139,248,0.5)" : "none",
                    }}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-[26px] h-[26px] rounded-lg flex items-center justify-center shrink-0" style={{ background: on ? "rgba(255,255,255,0.22)" : T.iconBg, color: on ? "#fff" : T.blue }}>
                        {opt.icon}
                      </div>
                      <b className="text-[11.5px] font-extrabold truncate" style={{ color: on ? "#fff" : T.text }}>{opt.label}</b>
                    </div>
                    {on && (
                      <span className="w-[17px] h-[17px] rounded-full flex items-center justify-center shrink-0" style={{ background: "#fff", color: T.blue, boxShadow: "0 2px 6px rgba(47,139,248,0.4)" }}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Alasan Sanggahan ── */}
          <div className="mb-6">
            <SecHead
              title="Alasan Sanggahan"
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>}
            />
            <div
              className="rounded-[18px] p-3.5 transition-colors duration-200 focus-within:border-[rgba(47,139,248,0.5)]"
              style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow }}
            >
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Jelaskan alasan Anda dengan jelas..."
                className="w-full border-none outline-none resize-none bg-transparent text-[12.5px]"
                style={{ fontFamily: "inherit", color: T.text, lineHeight: 1.6, minHeight: 88 }}
              />
              <div className="text-right text-[10px] font-bold" style={{ color: T.textMuted }}>{reason.length}/500</div>
            </div>
          </div>

          {/* ── Lampiran Bukti (Opsional) ── */}
          <div className="mb-6">
            <SecHead
              title="Lampiran Bukti (Opsional)"
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>}
            />
            <label
              className="flex flex-col items-center text-center gap-1.5 w-full px-4 py-[22px] rounded-[18px] cursor-pointer transition-all duration-200 hover:opacity-90"
              style={{ border: "2px dashed rgba(47,139,248,0.35)", background: "rgba(47,139,248,0.045)" }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24" /><path d="M12 12v9" /><path d="m16 16-4-4-4 4" /></svg>
              <b className="text-xs font-extrabold max-w-full truncate" style={{ color: T.blue }}>{file ? file.name : "Tap untuk unggah file"}</b>
              <span className="text-[10.5px] font-medium" style={{ color: T.textSec, lineHeight: 1.5 }}>
                Foto, dokumen, atau bukti lainnya<br />(JPG, PNG · maks 2MB)
              </span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPickFile} />
            </label>
          </div>

          {/* ── Informasi Penting ── */}
          <div className="flex items-start gap-2.5 rounded-2xl p-3.5 mb-6" style={{ background: "rgba(47,139,248,0.07)", border: "1px solid rgba(47,139,248,0.16)", color: "#1D4E86" }}>
            <div className="shrink-0 w-[26px] h-[26px] rounded-full flex items-center justify-center mt-0.5" style={{ background: T.blue, color: "#fff" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M12 11.5V16" /></svg>
            </div>
            <div>
              <b className="block text-[11.5px] font-extrabold mb-0.5">Informasi Penting</b>
              <p className="text-[10.5px] font-medium" style={{ lineHeight: 1.55, color: "#3E5C82" }}>
                Pastikan data dan bukti yang Anda unggah sudah benar agar proses verifikasi berjalan lancar.
              </p>
            </div>
          </div>

          {/* ── Kirim ── */}
          <button
            type="submit" disabled={submitting || !selectedDate || hasPendingForSelected}
            className="w-full border-none rounded-full py-[15px] text-sm font-extrabold text-white flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #2F8BF8, #1F74E0)", boxShadow: "0 12px 28px -8px rgba(47,139,248,0.55)" }}
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2 15 22l-4-9-9-4Z" /></svg>
            )}
            {submitting ? "Mengirim..." : "Kirim Sanggahan"}
          </button>
        </form>

        {/* ── Riwayat sanggahan ── */}
        <div className="rounded-3xl p-5 mt-6" style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-1 h-4 rounded-full" style={{ background: "linear-gradient(180deg, #2F8BF8, #3B82F6)" }} />
            <span className="text-xs font-bold" style={{ color: T.text }}>Sanggahan Saya</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={22} className="animate-spin" style={{ color: T.blue }} />
            </div>
          ) : sanggahan.length === 0 ? (
            <p className="text-[11px] text-center py-6" style={{ color: T.textMuted }}>Belum ada sanggahan.</p>
          ) : (
            <div className="space-y-2.5">
              {sanggahan.map((s) => {
                const meta = STATUS_META[s.status] || STATUS_META.pending;
                const MetaIcon = meta.icon;
                return (
                  <div key={s.id} className="rounded-xl p-3.5" style={{ background: "rgba(15,23,42,0.02)", border: `1px solid ${T.border}` }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold">{fmtDateShort(s.tanggal)}</div>
                        <div className="text-[9px] font-semibold" style={{ color: T.textMuted }}>
                          Status lama: {STATUS_LAMA_LABEL[s.old_status] || s.old_status || "-"}
                          {s.jenis ? ` · Jenis: ${JENIS_OPTIONS.find((o) => o.key === s.jenis)?.label || s.jenis}` : ""}
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-full shrink-0"
                        style={{ background: `${meta.color}1A`, color: meta.color }}>
                        <MetaIcon size={9} /> {meta.label}
                      </span>
                    </div>
                    <p className="text-[11px] mt-2 leading-relaxed" style={{ color: T.textSec }}>"{s.reason}"</p>
                    {s.status === "rejected" && s.rejection_reason && (
                      <div className="mt-2 rounded-lg px-3 py-2 text-[10px]" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "#EF4444" }}>
                        <b>Alasan ditolak:</b> {s.rejection_reason}
                      </div>
                    )}
                    {s.status === "cancelled" && s.cancel_reason && (
                      <div className="mt-2 rounded-lg px-3 py-2 text-[10px]" style={{ background: "rgba(100,116,139,0.08)", border: "1px solid rgba(100,116,139,0.2)", color: "#475569" }}>
                        <b>Persetujuan dibatalkan admin:</b> {s.cancel_reason}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2.5">
                      {s.attachment_url ? (
                        <a href={s.attachment_url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-medium underline" style={{ color: T.blue }}>
                          <ImageIcon size={10} /> Lihat bukti
                        </a>
                      ) : <span />}
                      {s.status === "pending" && (
                        <button onClick={() => handleCancel(s.id)} className="text-[10px] font-medium text-red-400 hover:text-red-500 transition">
                          Batalkan
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
