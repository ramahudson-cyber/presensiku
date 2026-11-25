import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { Loader2 } from "lucide-react";
import {
  getMyDisputableAttendance, getMySanggahan, createSanggahan, cancelMySanggahan,
  uploadSanggahanEvidence, getAttendanceByDate,
} from "../../services/sanggahService";
import usePullToRefresh from "../../hooks/usePullToRefresh";
import PullToRefreshIndicator from "../../components/PullToRefreshIndicator";
import Skeleton from "../../components/Skeleton";

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

const BADGE_STYLE = {
  alpha: { bg: "rgba(239,68,68,0.10)", color: "#DC2626" },
  terlambat: { bg: "rgba(245,158,11,0.14)", color: "#B45309" },
  tanpa_pulang: { bg: "rgba(47,139,248,0.12)", color: "#1D6FD0" },
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
  const navigate = useNavigate();
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [shiftNames, setShiftNames] = useState({});
  const disputableRef = useRef([]);
  const rootRef = useRef(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [att, mySanggahan, shiftsMaster] = await Promise.all([
        getMyDisputableAttendance(user.id),
        getMySanggahan(),
        supabase.from("shifts").select("code, name"),
      ]);
      setDisputable(att);
      disputableRef.current = att;
      setSanggahan(mySanggahan);
      setShiftNames(Object.fromEntries((shiftsMaster.data || []).map((s) => [s.code, s.name])));
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



  const handleSubmit = async () => {
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
      setReason(""); setFile(null); setJenis(null);
      await load();
      setSuccessOpen(true);
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

  // Nama shift dari master DB (fallback kode)
  const shiftLabel = (code) => {
    if (!code) return "Tanpa shift";
    return shiftNames[code] ? `Shift ${shiftNames[code]}` : `Shift ${code}`;
  };

  // Badge & deskripto status absensi yang bisa dikoreksi
  const badgeFor = (item) => {
    const st = BADGE_STYLE[item.attendance_status] || BADGE_STYLE.alpha;
    const label = item.attendance_status === "terlambat"
      ? `Terlambat ${item.late_minutes || 0} menit`
      : item.attendance_status === "tanpa_pulang" ? "Tanpa Pulang" : "Alpha";
    return { ...st, label };
  };
  const metaFor = (item) => {
    if (item.attendance_status === "terlambat") return `Masuk terlambat ${item.late_minutes || 0} menit`;
    if (item.attendance_status === "tanpa_pulang") return "Tidak absen pulang";
    return "Tidak ada data absensi";
  };

  const openSheet = (item) => {
    setSelectedDate(item.date);
    setReason("");
    setFile(null);
    setJenis(null);
    setSuccessOpen(false);
    setSheetOpen(true);
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

      {/* ── TOPBAR: tinggi & gaya persis halaman Izin & Sakit ── */}
      <header
        style={{
          position: "sticky", top: 0, zIndex: 20, background: "#2F8BF8",
          padding: "calc(env(safe-area-inset-top) + 10px) 16px 12px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          boxShadow: "0 4px 16px rgba(47,139,248,0.25)",
        }}
      >
        <button
          style={{
            width: 36, height: 36, marginLeft: -8, border: "1px solid rgba(255,255,255,0.3)",
            background: "rgba(255,255,255,0.15)", color: "#fff", borderRadius: 12,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flex: "none", fontFamily: "inherit",
          }}
          aria-label="Kembali"
          onClick={() => (view === "riwayat" ? toggleView() : navigate(-1))}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 19l-7-7m0 0 7-7m-7 7h18" />
          </svg>
        </button>
        <h1 style={{ fontSize: 14.5, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em", margin: 0 }}>
          {view === "form" ? "Koreksi Absensi" : "Riwayat Koreksi"}
        </h1>
        <div style={{ width: 28, flex: "none" }} />
      </header>

      <div className="max-w-md mx-auto px-4 pb-8" style={{ paddingTop: 24 }}>

        {/* ═══ HALAMAN FORM: daftar absensi yang bisa dikoreksi ═══ */}
        <div style={{ display: view === "form" ? "block" : "none" }}>
          <div className="flex items-center justify-between gap-3 mb-3 px-0.5">
            <b className="text-sm font-extrabold" style={{ color: T.text, letterSpacing: "-0.01em" }}>Data koreksi</b>
            <button
              type="button" onClick={toggleView} aria-label="Riwayat"
              className="flex items-center gap-1.5 rounded-full transition-all duration-200 active:scale-95"
              style={{
                background: T.iconBg, border: "1px solid rgba(47,139,248,0.18)",
                borderRadius: 999, padding: "7px 13px", cursor: "pointer", fontFamily: "inherit",
                fontSize: 10.5, fontWeight: 800, color: T.blueDeep,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
              Riwayat
            </button>
          </div>

          {disputable.length === 0 ? (
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
              <b className="block text-[14px] font-extrabold mt-3.5" style={{ color: T.text }}>Semua absensi sudah sesuai</b>
              <p className="text-[11.5px] mt-1.5 max-w-[260px] mx-auto" style={{ lineHeight: 1.6, color: T.textMuted }}>
                Tidak ada data absensi yang perlu dikoreksi. Daftar ini terisi otomatis bila ada alpha, keterlambatan, atau absen tanpa pulang.
              </p>
            </div>
          ) : (
            <div>
              {disputable.map((item) => {
                const d = new Date(item.date + "T00:00:00");
                const hasPending = pendingByDate.has(item.date);
                const badge = badgeFor(item);
                return (
                  <div
                    key={item.id}
                    className="py-[13px] -mx-4 px-4"
                    style={{ borderTop: "1px solid #E2E8F0" }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-[52px] h-[54px] flex-none rounded-[14px] flex flex-col items-center justify-center text-center shrink-0"
                        style={{ background: T.iconBg, lineHeight: 1.1 }}>
                        <b className="text-[19px] font-extrabold" style={{ letterSpacing: "-0.02em" }}>{d.getDate()}</b>
                        <span className="text-[10px] font-bold mt-0.5" style={{ color: T.textMuted }}>
                          {d.toLocaleDateString("id-ID", { month: "short" })}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-extrabold m-0" style={{ letterSpacing: "-0.01em" }}>
                          {shiftLabel(item.shift_code)}
                        </p>
                        <p className="text-[10.5px] font-semibold mt-1 m-0" style={{ color: T.textMuted }}>
                          {metaFor(item)}
                        </p>
                      </div>
                      <span className="inline-flex items-center flex-none px-2.5 py-1 rounded-full text-[10px] font-extrabold whitespace-nowrap"
                        style={hasPending
                          ? { background: "rgba(245,158,11,0.14)", color: "#B45309" }
                          : { background: badge.bg, color: badge.color }}>
                        {hasPending ? "Diproses" : badge.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2.5 mt-2.5">
                      <span className="text-[10px] font-semibold" style={{ color: T.textMuted }}>
                        {hasPending ? "Menunggu review admin" : "Status perlu ditinjau admin"}
                      </span>
                      {!hasPending && (
                        <button type="button" onClick={() => openSheet(item)}
                          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-extrabold text-white transition-all duration-200 active:scale-[0.97]"
                          style={{ background: "linear-gradient(135deg, #2F8BF8, #1F74E0)" }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                          Koreksi
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
            <div className="flex flex-col gap-3.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-[20px] px-[15px] py-[14px]"
                  style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
                  <div className="flex items-center gap-[11px]">
                    <Skeleton width={44} height={44} radius={14} />
                    <div className="flex-1 min-w-0" style={{ display: "grid", gap: 7 }}>
                      <Skeleton width="58%" height={12} />
                      <div className="flex items-center gap-3">
                        <Skeleton width={78} height={9} />
                        <Skeleton width={52} height={9} />
                      </div>
                    </div>
                    <Skeleton width={74} height={24} radius={999} />
                  </div>
                  <Skeleton width="82%" height={9} style={{ marginTop: 10 }} />
                </div>
              ))}
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

      {/* ═══ BOTTOM SHEET: Ajukan Koreksi ═══ */}
      {sheetOpen && (
        <>
          <div className="fixed inset-0 z-50" style={{ background: "rgba(15,23,42,0.46)" }} onClick={() => setSheetOpen(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-labelledby="koreksi-sheet-title"
            className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md flex flex-col overflow-hidden"
            style={{
              height: "min(94dvh, 800px)", background: "#FFFFFF",
              borderRadius: "28px 28px 0 0", boxShadow: "0 -10px 34px rgba(15,23,42,0.14)",
            }}>
            <div className="flex justify-center pt-2.5 pb-1 cursor-pointer" onClick={() => setSheetOpen(false)} aria-hidden="true">
              <span className="rounded-full" style={{ width: 44, height: 5, background: "#E2E8F0" }} />
            </div>
            <header className="flex items-center gap-3 px-5" style={{ paddingTop: 6, paddingBottom: 14 }}>
              <div className="flex-1 min-w-0">
                <h2 id="koreksi-sheet-title" className="m-0 text-[17px] font-extrabold" style={{ letterSpacing: "-0.02em", color: T.text }}>Ajukan Koreksi</h2>
                <p className="text-[11.5px] mt-1 m-0" style={{ color: T.textMuted }}>
                  {selectedDate ? `${fmtDate(selectedDate)} · ${shiftLabel(disputable.find((d) => d.date === selectedDate)?.shift_code)}` : ""}
                </p>
              </div>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="Tutup formulir"
                className="w-[34px] h-[34px] flex-none rounded-full flex items-center justify-center border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] transition-colors"
                style={{ color: T.textSec }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6 6 18" /></svg>
              </button>
            </header>
            <div className="flex-none h-px" style={{ background: T.div }} />
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3.5" style={{ overscrollBehavior: "contain" }}>
              {/* Kartu data absensi (read-only, dari item yang dipilih) */}
              <div className="rounded-[20px] p-3.5" style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
                <div className="flex items-center gap-3">
                  <div className="w-[46px] h-[46px] rounded-[14px] flex items-center justify-center shrink-0" style={{ background: T.iconBg }}>
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="17" rx="3" /><path d="M8 2.5v4M16 2.5v4M3 10h18" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-[10px] font-semibold" style={{ color: T.textMuted }}>Data Absensi</span>
                    <b className="block text-[14.5px] font-extrabold mt-0.5" style={{ letterSpacing: "-0.01em" }}>
                      {selectedDate ? fmtDate(selectedDate) : "-"}
                    </b>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 mt-2.5 flex-wrap" style={{ borderTop: `1px solid ${T.div}`, paddingTop: 11 }}>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: T.textSec }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                    Masuk:&nbsp;<b className="font-extrabold" style={{ color: T.text }}>
                      {attLoading ? "Memuat..." : (attendanceInfo?.clock_in_time ? fmtTime(attendanceInfo.clock_in_time) : "--:--")}
                    </b>
                  </div>
                  <span style={{ color: T.div }}>|</span>
                  {(() => {
                    const item = disputable.find((d) => d.date === selectedDate);
                    if (!item) return null;
                    const badge = badgeFor(item);
                    return (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10.5px] font-extrabold"
                        style={{ background: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Jenis Koreksi */}
              <div className="mt-4 mb-5">
                <SecHead title="Jenis Koreksi" />
                <div className="grid grid-cols-2 gap-2.5">
                  {JENIS_OPTIONS.map((o) => (
                    <button key={o.key} type="button" onClick={() => setJenis(o.key)}
                      className="flex items-center gap-2.5 rounded-[16px] px-3 py-3 text-left transition-all duration-200 active:scale-[0.98]"
                      style={{
                        fontFamily: "inherit", cursor: "pointer",
                        border: `1.5px solid ${jenis === o.key ? "rgba(47,139,248,0.55)" : T.border}`,
                        background: jenis === o.key ? "rgba(47,139,248,0.07)" : T.surface,
                        boxShadow: T.shadow, color: jenis === o.key ? T.blueDeep : T.text,
                      }}>
                      <span className="w-[30px] h-[30px] flex-none rounded-[10px] flex items-center justify-center shrink-0" style={{ background: T.iconBg, color: T.blue }}>
                        {o.icon}
                      </span>
                      <span className="text-[11.5px] font-extrabold leading-tight">{o.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Alasan Koreksi */}
              <div className="mb-5">
                <SecHead title="Alasan Koreksi" />
                <div className="rounded-[18px] p-3.5 transition-colors duration-200 focus-within:border-[rgba(47,139,248,0.5)]"
                  style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={500}
                    rows={4}
                    placeholder="Jelaskan alasan Anda dengan jelas..."
                    className="w-full border-none outline-none resize-none bg-transparent text-[12.5px]"
                    style={{ fontFamily: "inherit", color: T.text, lineHeight: 1.6, minHeight: 84 }}
                  />
                  <div className="text-right text-[10px] font-bold" style={{ color: T.textMuted }}>{reason.length}/500</div>
                </div>
              </div>

              {/* Lampiran Bukti (Opsional) */}
              <div className="mb-5">
                <SecHead title="Lampiran Bukti (Opsional)" />
                <label
                  className="flex flex-col items-center text-center gap-1.5 w-full px-4 py-[22px] rounded-[18px] cursor-pointer transition-all duration-200 hover:opacity-90"
                  style={{ border: "2px dashed rgba(47,139,248,0.35)", background: "rgba(47,139,248,0.045)" }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24" /><path d="M12 12v9" /><path d="m16 16-4-4-4 4" /></svg>
                  <b className="text-xs font-extrabold max-w-full truncate" style={{ color: T.blue }}>{file ? file.name : "Tap untuk unggah file"}</b>
                  <span className="text-[10.5px] font-medium" style={{ color: T.textSec, lineHeight: 1.5 }}>
                    Foto, dokumen, atau bukti lainnya<br />(JPG, PNG · maks 2MB)
                  </span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPickFile} />
                </label>
              </div>

              {/* Informasi Penting */}
              <div className="flex items-start gap-2.5 rounded-2xl p-3.5" style={{ background: "rgba(47,139,248,0.07)", border: "1px solid rgba(47,139,248,0.16)", color: "#1D4E86" }}>
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
            </div>

            <footer className="flex-none px-5" style={{ paddingTop: 11, paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))", borderTop: `1px solid ${T.div}` }}>
              <button
                type="button" onClick={handleSubmit} disabled={submitting}
                className="w-full border-none rounded-full py-[15px] text-sm font-extrabold text-white flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #2F8BF8, #1F74E0)", boxShadow: "0 12px 28px -8px rgba(47,139,248,0.55)", fontFamily: "inherit" }}>
                {submitting ? <Loader2 size={16} className="animate-spin" /> : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2 15 22l-4-9-9-4Z" /></svg>
                )}
                {submitting ? "Mengirim..." : "Kirim Koreksi"}
              </button>
            </footer>

            {/* Sukses */}
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white px-7 text-center transition-opacity duration-200"
              style={{ opacity: successOpen ? 1 : 0, pointerEvents: successOpen ? "auto" : "none", transform: successOpen ? "translateY(0)" : "translateY(8px)" }}
              role="status" aria-live="polite">
              <span className="w-[66px] h-[66px] rounded-full flex items-center justify-center" style={{ background: "rgba(16,185,129,0.12)", color: "#10B981" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
              </span>
              <h3 className="m-0 mt-4 text-[18px] font-extrabold" style={{ letterSpacing: "-0.02em", color: T.text }}>Koreksi terkirim</h3>
              <p className="mt-2 mb-0 max-w-[250px] text-[12.5px] leading-relaxed" style={{ color: T.textSec }}>
                Pengajuan Anda menunggu review admin. Status dapat dilihat di halaman Riwayat.
              </p>
              <button type="button" onClick={() => { setSuccessOpen(false); setSheetOpen(false); toast.success("Koreksi terkirim, menunggu review admin", { position: "bottom-center" }); }}
                className="mt-5 w-full max-w-[250px] border-none rounded-full py-[15px] text-sm font-extrabold text-white flex items-center justify-center transition-all duration-200 active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, #2F8BF8, #1F74E0)", fontFamily: "inherit" }}>
                Selesai
              </button>
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
