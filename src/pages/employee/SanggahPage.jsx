import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import { Hourglass, Loader2 } from "lucide-react";
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
    key: "tidak_absen_pulang", label: "Tidak Absen Pulang", span: false,
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v9m0 0 4-4m-4 4-4-4" /><path d="M4.3 14.3A8 8 0 1 0 20 13" /></svg>,
  },
];

// Label jenis untuk halaman riwayat (tanpa jenis → "Sanggahan")
const jenisRiwayatLabel = (jenis) =>
  JENIS_OPTIONS.find((o) => o.key === jenis)?.label || "Koreksi";

// Ikon tile kartu riwayat (20px, bentuk sama dengan ikon form); tanpa jenis → tiga titik
const RIWAYAT_ICONS = {
  keterlambatan: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  dinas_luar: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></svg>,
  tidak_hadir: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="17" rx="3" /><path d="M8 2.5v4M16 2.5v4M3 10h18" /><path d="M9.5 14.5l5 5M14.5 14.5l-5 5" /></svg>,
  kendala_sistem: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>,
  tidak_absen_pulang: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v9m0 0 4-4m-4 4-4-4" /><path d="M4.3 14.3A8 8 0 1 0 20 13" /></svg>,
  none: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="5" cy="12" r="1.6" fill="currentColor" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /><circle cx="19" cy="12" r="1.6" fill="currentColor" /></svg>,
};

// Badge status kartu riwayat (persis preview)
const R_STATUS = {
  pending: {
    label: "Diproses", bg: "rgba(47,139,248,0.12)", color: "#1D6FD0",
    icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  },
  approved: {
    label: "Disetujui", bg: "rgba(16,185,129,0.12)", color: "#059669",
    icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></svg>,
  },
  rejected: {
    label: "Ditolak", bg: "rgba(239,68,68,0.1)", color: "#DC2626",
    icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" /></svg>,
  },
  cancelled: {
    label: "Ditarik", bg: "rgba(100,116,139,0.12)", color: "#475569",
    icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></svg>,
  },
};

// Filter chips riwayat (persis preview)
const FILTERS = [
  { key: "semua", label: "Semua" },
  { key: "proses", label: "Diproses" },
  { key: "ok", label: "Disetujui" },
  { key: "no", label: "Ditolak" },
  { key: "tarik", label: "Ditarik" },
];
const FILTER_STATUS = { proses: "pending", ok: "approved", no: "rejected", tarik: "cancelled" };

const fmtDate = (dateKey) => {
  if (!dateKey) return "-";
  return new Date(dateKey + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};
// Tanggal meta kartu riwayat: "12 Nov 2026"
const fmtDateMeta = (dateKey) => {
  if (!dateKey) return "-";
  return new Date(dateKey + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};

// Jam absen WITA, format HH.MM (id-ID memakai pemisah titik)
const fmtTime = (timeStr) => {
  if (!timeStr) return "--:--";
  if (timeStr.includes("T")) {
    return new Date(timeStr).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" });
  }
  return timeStr.substring(0, 5).replace(":", ".");
};

// Tanggal + jam WITA untuk footer kartu: "12 Nov 2026, 09.15"
const fmtDateTime = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar",
  });
};

// Nama file dari URL lampiran (bagian terakhir path, tanpa query)
const attachmentFileName = (url) => {
  try {
    const path = String(url).split("?")[0].split("/").pop();
    return decodeURIComponent(path) || "Bukti";
  } catch {
    return "Bukti";
  }
};

// Header section: chip ikon biru + judul (pola DESIGN.md, sentence case)
const SecHead = ({ title }) => (
  <div className="flex items-center mx-0.5 mb-3">
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
  const [view, setView] = useState("form"); // "form" | "riwayat"
  const [filter, setFilter] = useState("semua");
  const [selectedDate, setSelectedDate] = useState(null);
  const [attendanceInfo, setAttendanceInfo] = useState(null);
  const [attLoading, setAttLoading] = useState(false);
  const [jenis, setJenis] = useState(null);
  const [reason, setReason] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const disputableRef = useRef([]);
  const rootRef = useRef(null);

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
      toast.error("Gagal memuat koreksi: " + (err.message || ""), { position: "bottom-center" });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const { pullDistance, isRefreshing } = usePullToRefresh(load);

  // Chips filter: fade tepi hanya tampil bila rail bisa digulir,
  // dan chip aktif otomatis digulir ke posisi terlihat (anti terpotong).
  const chipsRef = useRef(null);
  const fadeRef = useRef(null);
  const activeChipRef = useRef(null);

  useEffect(() => {
    const rail = chipsRef.current;
    const fade = fadeRef.current;
    if (!rail || !fade) return undefined;
    const sync = () => {
      const over = rail.scrollWidth > rail.clientWidth + 1;
      fade.style.display = over ? "block" : "none";
      rail.style.scrollSnapType = over ? "x proximity" : "none";
    };
    sync();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(sync);
    ro.observe(rail);
    return () => ro.disconnect();
  }, [view, filter]);

  useEffect(() => {
    activeChipRef.current?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [filter, view]);

  // Reset scroll container aktual (div halaman absolute, bukan window) ke paling
  // atas — dipakai saat toggle form ↔ riwayat karena tidak ganti pathname.
  const resetScroll = () => {
    let el = rootRef.current;
    while (el && el !== document.body && el !== document.documentElement) {
      const overflowY = window.getComputedStyle(el).overflowY;
      if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight + 1) {
        el.scrollTop = 0;
        return;
      }
      el = el.parentElement;
    }
    window.scrollTo(0, 0);
  };

  const toggleView = () => {
    setView((v) => (v === "form" ? "riwayat" : "form"));
    resetScroll();
  };

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
    if (hasPendingForSelected) { toast.warning("Sudah ada koreksi menunggu review untuk tanggal ini", { position: "bottom-center" }); return; }
    if (!jenis) { toast.warning("Pilih jenis koreksi", { position: "bottom-center" }); return; }
    if (!reason.trim()) { toast.warning("Alasan wajib diisi", { position: "bottom-center" }); return; }
    if (file && file.size > 2 * 1024 * 1024) { toast.warning("Ukuran foto melebihi 2MB", { position: "bottom-center" }); return; }
    setSubmitting(true);
    try {
      let attachmentUrl = null;
      if (file) attachmentUrl = await uploadSanggahanEvidence(user.id, file);
      await createSanggahan({ tanggal: selectedDate, reason, attachmentUrl, jenis });
      toast.success("Koreksi terkirim, menunggu review admin", { position: "bottom-center" });
      setReason(""); setFile(null); setJenis(null);
      await load();
    } catch (err) {
      toast.error(err.message || "Gagal mengirim koreksi", { position: "bottom-center" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm("Batalkan koreksi ini?")) return;
    try {
      await cancelMySanggahan(id);
      toast.success("Koreksi dibatalkan", { position: "bottom-center" });
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

  // Data riwayat sesuai filter aktif
  const filteredSanggahan = filter === "semua"
    ? sanggahan
    : sanggahan.filter((s) => s.status === FILTER_STATUS[filter]);

  return (
    <div ref={rootRef} className="min-h-screen w-full font-sans absolute top-0 left-0 right-0" style={{ background: T.bg, color: T.text }}>
      {/* Chip scroll horizontal disembunyikan (unique scope, hanya halaman ini) */}
      <style>{".sgg-chips::-webkit-scrollbar{height:0}.sgg-chips{scrollbar-width:none}"}</style>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      {/* Header — app bar biru: judul dinamis + pill Riwayat (hanya di form) */}
      <EmployeeAppBar
        title={view === "form" ? "Koreksi" : "Riwayat Koreksi"}
        onBack={view === "riwayat" ? toggleView : undefined}
        right={view === "form" ? (
          <button
            type="button" onClick={toggleView} aria-label="Riwayat"
            className="flex items-center gap-1.5 rounded-full transition-all duration-200 active:scale-95"
            style={{
              background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.22)",
              borderRadius: 999, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit",
              fontSize: 10.5, fontWeight: 800, color: "#FFFFFF",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
            Riwayat
          </button>
        ) : null}
      />

      <div className="max-w-md mx-auto px-4 pb-8">

        {/* ═══ HALAMAN FORM ═══ */}
        <div style={{ display: view === "form" ? "block" : "none" }}>

          {/* ── Hero ── */}
          <div className="flex items-start justify-between gap-3 pt-3 px-1 pb-6">
            <div>
              <h2 className="text-[21px] font-extrabold" style={{ letterSpacing: "-0.02em", lineHeight: 1.22 }}>
                Ajukan Koreksi Absensi <em className="not-italic" style={{ color: T.blue }}>dengan Mudah</em>
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
                title="Jenis Koreksi"
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
                title="Alasan Koreksi"
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
              {submitting ? "Mengirim..." : "Kirim Koreksi"}
            </button>
          </form>
        </div>

        {/* ═══ HALAMAN RIWAYAT ═══ */}
        <div style={{ display: view === "riwayat" ? "block" : "none" }}>

          {/* ── Filter chips ── */}
          <div className="relative">
            <div ref={chipsRef} className="sgg-chips flex gap-1.5 overflow-x-auto pt-4 pb-1 mb-4 px-4 -mx-4"
              style={{ scrollSnapAlign: "start", scrollPaddingLeft: 16 }}>
              {FILTERS.map((f) => {
                const on = filter === f.key;
                return (
                  <button
                    key={f.key} type="button" onClick={() => setFilter(f.key)}
                    ref={on ? activeChipRef : undefined}
                    className="flex-none rounded-full px-[14px] py-[8px] text-[12px] font-bold transition-all duration-200"
                    style={{
                      fontFamily: "inherit", cursor: "pointer",
                      scrollSnapAlign: "start",
                      border: `1px solid ${on ? T.blue : T.border}`,
                      background: on ? T.blue : T.surface,
                      color: on ? "#FFFFFF" : T.textSec,
                      boxShadow: on ? "0 6px 14px -5px rgba(47,139,248,0.5)" : "none",
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
            <div ref={fadeRef} className="pointer-events-none absolute"
              style={{
                display: "none", right: 0, top: 16, bottom: 4, width: 32,
                background: "linear-gradient(90deg, rgba(244,242,251,0) 0%, #F4F2FB 85%)",
              }} />
          </div>

          {/* ── Daftar riwayat ── */}
          {loading ? (
            <div className="flex flex-col items-center py-10">
              <Loader2 size={22} className="animate-spin" style={{ color: T.blue }} />
              <span className="text-[12px] mt-2.5" style={{ color: T.textMuted }}>Memuat...</span>
            </div>
          ) : sanggahan.length === 0 ? (
            <p className="text-[12px] text-center py-10" style={{ color: T.textMuted }}>Belum ada pengajuan.</p>
          ) : filteredSanggahan.length === 0 ? (
            /* Empty state filter tanpa hasil — persis preview */
            <div className="text-center pt-[46px] px-5 pb-2.5">
              <svg width="120" height="80" viewBox="0 0 120 80" fill="none" aria-hidden="true" className="mx-auto">
                <ellipse cx="60" cy="66" rx="34" ry="8" fill="#DCEDFB" />
                <rect x="34" y="10" width="46" height="52" rx="7" fill="#FFFFFF" stroke="#BBD9F5" strokeWidth="2" />
                <rect x="34" y="10" width="46" height="12" rx="6" fill="#BBD9F5" />
                <rect x="41" y="28" width="30" height="5" rx="2.5" fill="#DCEDFB" />
                <rect x="41" y="37" width="24" height="5" rx="2.5" fill="#DCEDFB" />
                <rect x="41" y="46" width="28" height="5" rx="2.5" fill="#DCEDFB" />
                <circle cx="78" cy="52" r="13" fill="#2F8BF8" stroke="#fff" strokeWidth="2.4" />
                <path d="M72 52h4.5l2.5-4 3 8 2.5-4h4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <b className="block text-[14px] font-extrabold mt-3.5" style={{ color: T.text }}>Tidak ada riwayat pada filter ini</b>
              <p className="text-[11.5px] mt-1.5 max-w-[250px] mx-auto" style={{ lineHeight: 1.6, color: T.textMuted }}>
                Pengajuan koreksi Anda akan muncul di sini setelah dikirim.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">
              {filteredSanggahan.map((s) => {
                const st = R_STATUS[s.status] || R_STATUS.pending;
                return (
                  <div
                    key={s.id}
                    className="rounded-[20px] px-[15px] py-[14px] transition-transform duration-200 active:scale-[0.985]"
                    style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow }}
                  >
                    {/* Baris atas: tile ikon + jenis + meta + badge + chevron */}
                    <div className="flex items-center gap-[11px]">
                      <div className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0" style={{ background: T.iconBg, color: T.blue }}>
                        {RIWAYAT_ICONS[s.jenis] || RIWAYAT_ICONS.none}
                      </div>
                      <div className="flex-1 min-w-0">
                        <b className="block text-[13px] font-extrabold truncate" style={{ letterSpacing: "-0.01em", color: T.text }}>
                          {jenisRiwayatLabel(s.jenis)}
                        </b>
                        <div className="flex items-center gap-3 mt-[5px]">
                          <span className="flex items-center gap-[5px] text-[10.5px] font-semibold" style={{ color: T.textSec }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="3" y="4.5" width="18" height="17" rx="3" /><path d="M8 2.5v4M16 2.5v4M3 10h18" /></svg>
                            {fmtDateMeta(s.tanggal)}
                          </span>
                          <span className="flex items-center gap-[5px] text-[10.5px] font-semibold" style={{ color: T.textSec }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                            {fmtTime(s.created_at)}
                          </span>
                        </div>
                      </div>
                      <span
                        className="inline-flex items-center gap-[5px] text-[10.5px] font-extrabold px-[11px] py-[5px] rounded-full shrink-0"
                        style={{ background: st.bg, color: st.color, whiteSpace: "nowrap" }}
                      >
                        {st.icon} {st.label}
                      </span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M9 18l6-6-6-6" /></svg>
                    </div>

                    {/* Alasan — excerpt 1 baris */}
                    <p className="mt-[9px] text-[11px] font-medium overflow-hidden text-ellipsis whitespace-nowrap" style={{ lineHeight: 1.5, color: T.textSec }}>
                      {s.reason}
                    </p>

                    {/* Catatan admin / aksi batal — di dalam kartu, di atas divider */}
                    {s.status === "rejected" && s.rejection_reason && (
                      <div className="mt-2 rounded-lg px-3 py-2 text-[10px]" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "#EF4444", lineHeight: 1.5 }}>
                        <b>Alasan ditolak:</b> {s.rejection_reason}
                      </div>
                    )}
                    {s.status === "cancelled" && s.cancel_reason && (
                      <div className="mt-2 rounded-lg px-3 py-2 text-[10px]" style={{ background: "rgba(100,116,139,0.08)", border: "1px solid rgba(100,116,139,0.2)", color: "#475569", lineHeight: 1.5 }}>
                        <b>Persetujuan dibatalkan admin:</b> {s.cancel_reason}
                      </div>
                    )}
                    {s.status === "pending" && (
                      <button
                        type="button" onClick={() => handleCancel(s.id)}
                        className="mt-2 text-[10px] font-bold rounded-full px-3 py-1.5 transition-colors duration-200"
                        style={{ fontFamily: "inherit", cursor: "pointer", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", color: "#DC2626" }}
                      >
                        Batalkan
                      </button>
                    )}

                    {/* Divider */}
                    <div style={{ borderTop: `1px solid ${T.div}`, margin: "11px 0 10px" }} />

                    {/* Footer: lampiran + waktu status */}
                    <div className="flex items-center gap-1.5 text-[10.5px] font-semibold" style={{ color: T.textSec }}>
                      {s.attachment_url && (
                        <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></svg>
                          <span className="truncate">Dilampirkan:&nbsp;
                            <a
                              href={s.attachment_url} target="_blank" rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="font-bold" style={{ color: T.blue, textDecoration: "none" }}
                            >
                              {attachmentFileName(s.attachment_url)}
                            </a>
                          </span>
                        </>
                      )}
                      <span className="ml-auto shrink-0" style={{ color: T.textMuted, fontWeight: 500 }}>
                        {s.status === "pending" && `Diajukan: ${fmtDateTime(s.created_at)}`}
                        {(s.status === "approved" || s.status === "rejected") && `Diputuskan: ${fmtDateTime(s.reviewed_at)}`}
                        {s.status === "cancelled" && `Ditarik pada: ${fmtDateTime(s.updated_at || s.reviewed_at)}`}
                      </span>
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
