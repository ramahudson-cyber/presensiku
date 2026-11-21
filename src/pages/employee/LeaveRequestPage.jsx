import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  createLeaveRequest,
  uploadLeaveAttachment,
  getMyLeaveRequests,
  cancelLeaveRequest,
  countLeaveDays,
} from "../../services/leaveService";
import usePullToRefresh from "../../hooks/usePullToRefresh";
import PullToRefreshIndicator from "../../components/PullToRefreshIndicator";
import { MonthMenu, monthOptions, currentMonthKey } from "./overtime/overtimeUi";

// ─── Token light mode — DESIGN.md ───
const T = {
  bg: "#F4F2FB",
  surface: "#FFFFFF",
  border: "rgba(31,41,55,0.08)",
  div: "#F1F5F9",
  text: "#0F172A",
  textSec: "#475569",
  textMuted: "#94A3B8",
  sub: "#6B7280",
  shadow: "0 4px 16px rgba(15,23,42,0.06)",
  shadowLg: "0 8px 24px rgba(15,23,42,0.08)",
  rowBg: "rgba(15,23,42,0.02)",
  iconBg: "#EEF6FF",
  blue: "#2F8BF8",
  blueDeep: "#1F74E0",
  hero: "linear-gradient(160deg,#39C0DF 0%,#32ACFB 30%,#3F93FD 62%,#4A7CFB 100%)",
  red: "#EF4444",
  amber: "#F59E0B",
  emerald: "#10B981",
  ease: "cubic-bezier(0.32,0.72,0,1)",
};

const MONTHS_S = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

// ─── Badge status riwayat (DESIGN.md) ───
const STATUS = {
  pending:  { label: "Menunggu",  color: "#3B82F6",  bg: "rgba(59,130,246,0.12)" },
  approved: { label: "Disetujui", color: T.emerald,  bg: "rgba(16,185,129,0.12)" },
  rejected: { label: "Ditolak",   color: T.red,      bg: "rgba(239,68,68,0.10)" },
};

const TYPE_LABEL = { izin: "Izin", sakit: "Sakit" };

// Info box berubah teks sesuai jenis (dari preview)
const HINTS = {
  sakit: "Sakit untuk kondisi tidak fit bekerja. Siapkan surat dokter bila ada — mempercepat persetujuan.",
  izin: "Izin untuk keperluan mendesak di luar sakit. Diajukan ke admin, biasanya diproses 1×24 jam.",
};

const QUICK_TAGS = [
  { label: "Demam / Flu", text: "Demam / flu berat, butuh istirahat di rumah." },
  { label: "Kontrol Dokter", text: "Jadwal kontrol kesehatan ke dokter / rumah sakit." },
  { label: "Istirahat", text: "Kondisi tubuh kurang fit untuk bekerja hari ini." },
];

function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function fmtShort(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.getDate() + " " + MONTHS_S[d.getMonth()] + " " + d.getFullYear();
}

// ─── Section header — judul + subteks saja (tanpa ikon) ───
function SectionHeader({ title, subtitle, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b style={{ display: "block", fontSize: 13.5, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.2, color: T.text }}>{title}</b>
        {subtitle && (
          <span style={{ display: "block", fontSize: 9.5, color: T.textMuted, fontWeight: 500, marginTop: 1 }}>{subtitle}</span>
        )}
      </div>
      {right}
    </div>
  );
}

export default function LeaveRequestPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // ─── HOOKS (sebelum early return — React #310) ───
  const [view, setView] = useState("form"); // "form" | "riwayat"
  const [formType, setFormType] = useState("izin");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [activeTag, setActiveTag] = useState(null);
  const [loading, setLoading] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const fileInputRef = useRef(null);
  const rootRef = useRef(null);
  const [requests, setRequests] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [riwayatMonthKey, setRiwayatMonthKey] = useState(currentMonthKey());
  const [riwayatFilter, setRiwayatFilter] = useState("all");

  // Statistik dari data riil (getMyLeaveRequests)
  const approvedCount = useMemo(() => requests.filter((r) => r.status === "approved").length, [requests]);
  const pendingCount = useMemo(() => requests.filter((r) => r.status === "pending").length, [requests]);
  const totalDays = useMemo(
    () => requests.reduce((sum, r) => sum + (r.total_days || countLeaveDays(r.start_date, r.end_date)), 0),
    [requests]
  );

  // Badge durasi: "Pilih tanggal" → "Periksa tanggal" → "N Hari"
  const durInvalid = Boolean(startDate && endDate && endDate < startDate);
  const dayCount = useMemo(() => {
    if (startDate && endDate && endDate >= startDate) return countLeaveDays(startDate, endDate);
    return 0;
  }, [startDate, endDate]);
  const durBadgeText = durInvalid ? "Periksa tanggal" : dayCount > 0 ? dayCount + " Hari" : "Pilih tanggal";

  const today = todayStr();

  const loadRequests = async () => {
    try {
      setFetchError("");
      const data = await getMyLeaveRequests(user.id);
      setRequests(data || []);
    } catch (e) {
      setFetchError(e.message || "Gagal memuat data");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (user?.id) loadRequests();
  }, [user?.id]);

  const { pullDistance, isRefreshing } = usePullToRefresh(loadRequests);

  // ─── Riwayat pengajuan: bulan + filter status (data real leave_requests) ───
  const monthKeyOf = (dateStr) => (dateStr || "").slice(0, 7);
  const monthOpts = monthOptions(requests.map((r) => ({ date: r.start_date })), currentMonthKey());
  const monthRows = useMemo(
    () => requests.filter((r) => monthKeyOf(r.start_date) === riwayatMonthKey),
    [requests, riwayatMonthKey]
  );
  const riwayatCounts = useMemo(
    () => ({
      total: monthRows.length,
      approved: monthRows.filter((r) => r.status === "approved").length,
      pending: monthRows.filter((r) => r.status === "pending").length,
      rejected: monthRows.filter((r) => r.status === "rejected").length,
    }),
    [monthRows]
  );
  const riwayatRows = useMemo(
    () =>
      monthRows
        .filter((r) => riwayatFilter === "all" || r.status === riwayatFilter)
        .sort((a, b) => (b.start_date || "").localeCompare(a.start_date || "")),
    [monthRows, riwayatFilter]
  );

  // Reset scroll container aktual (div AdminLayout, bukan window) ke paling
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

  const handleTypeChange = (t) => {
    setFormType(t);
    setActiveTag(null);
  };

  const handleReasonChange = (e) => {
    setReason(e.target.value);
    setActiveTag(null); // mengedit manual me-nonaktifkan chip
  };

  const handleTagClick = (i) => {
    setReason(QUICK_TAGS[i].text);
    setActiveTag(i);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!startDate || !endDate) {
      toast.warning("Tanggal wajib diisi", { position: "bottom-center" });
      return;
    }
    if (endDate < startDate) {
      toast.error("Tanggal selesai tidak boleh sebelum tanggal mulai", { position: "bottom-center" });
      return;
    }
    if (!reason.trim()) {
      toast.error("Alasan wajib diisi terlebih dahulu", { position: "bottom-center" });
      return;
    }

    setLoading(true);
    try {
      let attachmentUrl = null;
      if (attachment) {
        attachmentUrl = await uploadLeaveAttachment(user.id, attachment);
      }
      await createLeaveRequest({ userId: user.id, type: formType, startDate, endDate, reason, attachmentUrl });
      toast.success("Permohonan terkirim — menunggu persetujuan admin.", { position: "bottom-center" });
      setStartDate("");
      setEndDate("");
      setReason("");
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setActiveTag(null);
      await loadRequests();
    } catch (err) {
      toast.error(err.message || "Gagal mengirim permohonan", { position: "bottom-center" });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (requestId) => {
    if (!confirm("Batalkan permohonan ini?")) return;
    if (!requestId) {
      toast.error("ID permohonan tidak valid", { position: "bottom-center" });
      return;
    }
    try {
      await cancelLeaveRequest(requestId);
      toast.success("Permohonan berhasil dibatalkan", { position: "bottom-center" });
      await loadRequests();
    } catch (err) {
      toast.error(err.message || "Gagal membatalkan", { position: "bottom-center" });
    }
  };

  // ─── Guard (setelah hooks) ───
  if (authLoading) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, background: T.bg }}>
        Memuat...
      </div>
    );
  }
  if (!user) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, background: T.bg }}>
        Silakan login terlebih dahulu.
      </div>
    );
  }

  const backBtn = {
    width: 36, height: 36, marginLeft: -8, border: `1px solid rgba(255,255,255,0.3)`,
    background: "rgba(255,255,255,0.15)", color: "#fff", borderRadius: 12,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", flex: "none", transition: `transform .25s ${T.ease}, background .25s`, fontFamily: "inherit",
  };
  const typeCardBase = {
    position: "relative", textAlign: "left", padding: 14, borderRadius: 20, cursor: "pointer",
    fontFamily: "inherit", border: "1.5px solid " + T.border, background: "#F8FAFD",
    boxShadow: T.shadow, transition: `all .25s ${T.ease}`,
  };
  const tagBase = {
    fontFamily: "inherit", fontSize: 10.5, fontWeight: 700, padding: "7px 13px", borderRadius: 9999,
    border: `1px solid ${T.border}`, background: T.surface, color: T.textSec, cursor: "pointer",
    transition: `all .25s ${T.ease}`, boxShadow: T.shadow,
  };
  const dateInput = {
    width: "100%", border: "none", background: "transparent", fontFamily: "inherit",
    fontSize: 12, fontWeight: 700, color: T.text, outline: "none", padding: 0,
  };

  return (
    <div
      className="min-h-screen w-full font-sans absolute top-0 left-0 right-0"
      ref={rootRef}
      style={{ background: T.bg, color: T.text }}
    >
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      {/* ── TOPBAR sticky: kembali + judul dinamis + toggle Riwayat ── */}
      <header
        style={{
          position: "sticky", top: 0, zIndex: 20, background: "#2F8BF8",
          padding: "calc(env(safe-area-inset-top) + 10px) 16px 12px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          boxShadow: "0 4px 16px rgba(47,139,248,0.25)",
        }}
      >
        <button style={backBtn} aria-label="Kembali" onClick={() => navigate(-1)}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 19l-7-7m0 0 7-7m-7 7h18" />
          </svg>
        </button>
        <h1 style={{ fontSize: 14.5, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em", margin: 0 }}>
          {view === "form" ? "Pengajuan Izin & Sakit" : "Riwayat Pengajuan"}
        </h1>
        <div style={{ width: 28, flex: "none" }} />
      </header>

      {/* ═══ HALAMAN FORM ═══ */}
      <main
        style={{
          display: view === "form" ? "flex" : "none",
          flexDirection: "column", gap: 20,
          padding: "16px 16px calc(env(safe-area-inset-bottom) + 32px)",
          maxWidth: 430, margin: "0 auto",
        }}
      >
        {/* ── Kartu ringkasan — gradient hero resmi DESIGN.md ── */}
        <div style={{
          position: "relative", overflow: "hidden", borderRadius: 24, padding: 16,
          background: T.hero, color: "#fff", boxShadow: T.shadowLg,
          display: "flex", alignItems: "center", gap: 13,
        }}>
          <div style={{
            position: "absolute", right: -18, bottom: -26, width: 104, height: 104,
            borderRadius: "50%", background: "rgba(255,255,255,0.12)", pointerEvents: "none",
          }} />
          <div style={{
            width: 42, height: 42, borderRadius: 14, background: "rgba(255,255,255,0.18)",
            border: "1px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center",
            justifyContent: "center", flex: "none",
          }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <div style={{ position: "relative", zIndex: 1, flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.82)", letterSpacing: "0.03em" }}>
              Ringkasan pengajuan
            </span>
            <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
              <div>
                <b style={{ display: "block", fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.05 }}>{approvedCount}</b>
                <span style={{ display: "block", fontSize: 8.5, fontWeight: 600, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>Disetujui</span>
              </div>
              <div>
                <b style={{ display: "block", fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.05 }}>{pendingCount}</b>
                <span style={{ display: "block", fontSize: 8.5, fontWeight: 600, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>Pending</span>
              </div>
              <div>
                <b style={{ display: "block", fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.05 }}>{totalDays}</b>
                <span style={{ display: "block", fontSize: 8.5, fontWeight: 600, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>Total hari</span>
              </div>
            </div>
          </div>
          <button
            onClick={toggleView}
            aria-label="Riwayat"
            style={{
              position: "relative", zIndex: 1, flex: "none", display: "flex", alignItems: "center", gap: 6,
              background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.22)",
              borderRadius: 999, padding: "8px 13px", cursor: "pointer", fontFamily: "inherit",
              fontSize: 10.5, fontWeight: 800, color: "#fff",
              transition: `background .25s ${T.ease}, transform .25s ${T.ease}`,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
            </svg>
            Riwayat
          </button>
        </div>

        {/* ── 1. Jenis Pengajuan ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SectionHeader
            title="Jenis Pengajuan"
            subtitle="Pilih salah satu"
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Kartu Sakit */}
            <button
              type="button"
              onClick={() => handleTypeChange("sakit")}
              style={{
                ...typeCardBase,
                ...(formType === "sakit"
                  ? { borderColor: "rgba(239,68,68,0.55)", background: "#FEF2F2", boxShadow: "0 6px 16px -6px rgba(239,68,68,0.25)" }
                  : {}),
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(239,68,68,0.10)", color: T.red,
                }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <span style={{
                  width: 20, height: 20, borderRadius: "50%", color: "#fff",
                  boxShadow: "0 2px 6px rgba(15,23,42,0.2)", background: T.red,
                  display: formType === "sakit" ? "flex" : "none", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              </div>
              <b style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.text }}>Sakit</b>
              <small style={{ display: "block", fontSize: 10.5, color: T.textSec, marginTop: 2, lineHeight: 1.4 }}>
                Dengan / tanpa surat dokter
              </small>
            </button>
            {/* Kartu Izin */}
            <button
              type="button"
              onClick={() => handleTypeChange("izin")}
              style={{
                ...typeCardBase,
                ...(formType === "izin"
                  ? { borderColor: "rgba(47,139,248,0.55)", background: "#EFF6FF", boxShadow: "0 6px 16px -6px rgba(47,139,248,0.28)" }
                  : {}),
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
                  background: T.iconBg, color: T.blue,
                }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span style={{
                  width: 20, height: 20, borderRadius: "50%", color: "#fff",
                  boxShadow: "0 2px 6px rgba(15,23,42,0.2)", background: T.blue,
                  display: formType === "izin" ? "flex" : "none", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              </div>
              <b style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.text }}>Izin</b>
              <small style={{ display: "block", fontSize: 10.5, color: T.textSec, marginTop: 2, lineHeight: 1.4 }}>
                Keperluan mendesak
              </small>
            </button>
          </div>
          {/* Info box — teks berubah sesuai jenis */}
          <div style={{
            display: "flex", gap: 9, alignItems: "flex-start", borderRadius: 14, padding: "11px 12px",
            background: "rgba(47,139,248,0.06)", border: "1px solid rgba(47,139,248,0.18)",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 1 }}>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8h.01M12 11.5V16" />
            </svg>
            <p style={{ fontSize: 10, lineHeight: 1.55, color: "#3E5C82", fontWeight: 500, margin: 0 }}>
              <b style={{ color: "#1D4E86", fontWeight: 800 }}>{formType === "sakit" ? "Sakit" : "Izin"}</b>{" "}
              {formType === "sakit"
                ? "untuk kondisi tidak fit bekerja. Siapkan surat dokter bila ada — mempercepat persetujuan."
                : "untuk keperluan mendesak di luar sakit. Diajukan ke admin, biasanya diproses 1×24 jam."}
            </p>
          </div>
        </div>

        {/* ── 2. Durasi ketidakhadiran ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SectionHeader
            title="Durasi ketidakhadiran"
            right={
              <span style={{
                flex: "none", fontSize: 10, fontWeight: 800, color: "#FFFFFF",
                background: durInvalid ? T.red : T.blue, borderRadius: 9999, padding: "5px 11px",
                boxShadow: durInvalid ? "0 4px 10px -3px rgba(239,68,68,0.45)" : "0 4px 10px -3px rgba(47,139,248,0.45)",
                whiteSpace: "nowrap",
              }}>
                {durBadgeText}
              </span>
            }
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{
              background: "#F8FAFD", border: "1.5px solid " + T.border, borderRadius: 16,
              padding: "10px 12px", transition: `all .25s ${T.ease}`, boxShadow: T.shadow,
            }}>
              <label htmlFor="tgl-mulai" style={{ display: "block", fontSize: 9.5, fontWeight: 700, color: T.textMuted, marginBottom: 3 }}>
                Mulai tanggal
              </label>
              <input
                id="tgl-mulai" type="date" value={startDate} min={today}
                onChange={(e) => setStartDate(e.target.value)} style={dateInput}
              />
            </div>
            <div style={{
              background: "#F8FAFD", border: "1.5px solid " + T.border, borderRadius: 16,
              padding: "10px 12px", transition: `all .25s ${T.ease}`, boxShadow: T.shadow,
            }}>
              <label htmlFor="tgl-selesai" style={{ display: "block", fontSize: 9.5, fontWeight: 700, color: T.textMuted, marginBottom: 3 }}>
                Sampai tanggal
              </label>
              <input
                id="tgl-selesai" type="date" value={endDate} min={startDate || today}
                onChange={(e) => setEndDate(e.target.value)} style={dateInput}
              />
            </div>
          </div>
        </div>

        {/* ── 3. Alasan / keterangan ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SectionHeader
            title="Alasan / keterangan"
            subtitle="Wajib diisi"
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {QUICK_TAGS.map((tag, i) => (
              <button
                key={tag.label} type="button" onClick={() => handleTagClick(i)}
                style={{
                  ...tagBase,
                  ...(activeTag === i
                    ? { borderColor: "rgba(47,139,248,0.55)", background: "rgba(47,139,248,0.10)", color: "#1D6FD0" }
                    : {}),
                }}
              >
                {tag.label}
              </button>
            ))}
          </div>
          <form id="leave-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <textarea
              value={reason} onChange={handleReasonChange} rows="3"
              placeholder="Tuliskan detail kondisi atau alasan Anda..."
              style={{
                width: "100%", border: "1.5px solid " + T.border, background: "#F8FAFD", borderRadius: 16,
                padding: 13, fontFamily: "inherit", fontSize: 12.5, color: T.text, lineHeight: 1.6,
                outline: "none", resize: "none", minHeight: 84, transition: `all .25s ${T.ease}`,
                boxShadow: T.shadow,
              }}
            />

            {/* ── 4. Lampiran (opsional): foto / scan surat dokter ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
              <SectionHeader
                title="Lampiran (opsional)"
                subtitle="Foto / scan surat dokter"
              />
              <button
                type="button" onClick={() => fileInputRef.current?.click()}
                style={{
                  display: "flex", alignItems: "center", gap: 13, width: "100%", padding: 15,
                  border: "2px dashed rgba(31,41,55,0.16)", borderRadius: 18, cursor: "pointer",
                  background: "rgba(248,250,253,0.6)", fontFamily: "inherit", textAlign: "left",
                  transition: `all .25s ${T.ease}`,
                }}
              >
                <span style={{
                  width: 42, height: 42, borderRadius: 13, background: "#fff", border: `1px solid ${T.border}`,
                  boxShadow: T.shadow, display: "flex", alignItems: "center", justifyContent: "center",
                  color: T.blue, flexShrink: 0,
                }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 16V4m0 0L7 9m5-5 5 5" />
                    <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
                  </svg>
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: "block", fontSize: 11.5, fontWeight: 800, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {attachment ? attachment.name : "Lampirkan foto / scan"}
                  </b>
                  <span style={{ display: "block", fontSize: 9.5, color: T.textMuted, marginTop: 2 }}>
                    JPG, PNG · otomatis dikompres
                  </span>
                </span>
                <span style={{
                  flexShrink: 0, fontSize: 9, fontWeight: 800, color: T.blue, background: T.iconBg,
                  borderRadius: 999, padding: "5px 10px",
                }}>
                  {attachment ? "Siap" : "Pilih"}
                </span>
              </button>
              <input
                ref={fileInputRef} type="file" accept="image/jpeg,image/png"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && !["image/jpeg", "image/png"].includes(f.type)) {
                    toast.error("Format harus JPG atau PNG", { position: "bottom-center" });
                    e.target.value = "";
                    return;
                  }
                  setAttachment(f || null);
                }}
              />

              {/* ── Tombol kirim: aliran paling bawah (bukan sticky) ── */}
              <button
                type="submit" disabled={loading}
                style={{
                  width: "100%", border: "none", borderRadius: 16, padding: 14, marginTop: 12,
                  cursor: loading ? "wait" : "pointer", fontFamily: "inherit", fontSize: 13,
                  fontWeight: 800, color: "#fff",
                  background: `linear-gradient(135deg,${T.blue},${T.blueDeep})`,
                  boxShadow: "0 10px 24px -8px rgba(47,139,248,0.5)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition: `transform .25s ${T.ease}, box-shadow .25s`, opacity: loading ? 0.7 : 1,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2 11 13M22 2 15 22l-4-9-9-4Z" />
                </svg>
                {loading ? "Mengirim..." : "Kirim Permohonan"}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* ═══ HALAMAN RIWAYAT ═══ — card biru ringkasan + periode,
          chips filter status, daftar lengkap flat full-width (tanpa kartu,
          tanpa pindah halaman) — semua data real leave_requests ═══ */}
      <div
        style={{
          display: view === "riwayat" ? "flex" : "none",
          flexDirection: "column",
          padding: "14px 16px calc(env(safe-area-inset-bottom) + 26px)",
          maxWidth: 430, margin: "0 auto", width: "100%",
        }}
      >
        {/* CARD BIRU: ringkasan + periode di dalamnya */}
        <div style={{
          position: "relative", overflow: "hidden", borderRadius: 24, padding: 16,
          background: T.hero, color: "#fff",
          boxShadow: "0 10px 26px -12px rgba(47,139,248,0.55)",
        }}>
          <div style={{
            position: "absolute", right: -20, bottom: -30, width: 110, height: 110,
            borderRadius: "50%", background: "rgba(255,255,255,0.12)", pointerEvents: "none",
          }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, position: "relative" }}>
            <b style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.01em" }}>Ringkasan Pengajuan</b>
            <MonthMenu value={riwayatMonthKey} onChange={setRiwayatMonthKey} options={monthOpts} tone="onBrand" />
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
            background: "#F5F9FF", borderRadius: 16, padding: "12px 4px",
            marginTop: 14, position: "relative",
          }}>
            {[
              { label: "Pengajuan", value: riwayatCounts.total, bg: "#2F8BF8", icon: "list" },
              { label: "Disetujui", value: riwayatCounts.approved, bg: "#10B981", icon: "check" },
              { label: "Menunggu", value: riwayatCounts.pending, bg: "#F59E0B", icon: "clock" },
              { label: "Ditolak", value: riwayatCounts.rejected, bg: "#EF4444", icon: "close" },
            ].map((c, i) => (
              <div key={c.label} style={{ textAlign: "center", padding: "0 4px", borderRight: i < 3 ? "1px solid #DCE7F8" : "none" }}>
                <span style={{
                  display: "inline-flex", width: 20, height: 20, borderRadius: "50%",
                  background: c.bg, color: "#fff", alignItems: "center", justifyContent: "center", marginBottom: 6,
                }}>
                  {c.icon === "list" && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
                  )}
                  {c.icon === "check" && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                  )}
                  {c.icon === "clock" && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></svg>
                  )}
                  {c.icon === "close" && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round"><path d="M6 18L18 6M6 6l12 12" /></svg>
                  )}
                </span>
                <b style={{ display: "block", fontSize: 15, fontWeight: 800, color: T.text }}>{c.value}</b>
                <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: T.textSec, marginTop: 1 }}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* chips filter status */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", marginTop: 14 }}>
          {[
            { key: "all", label: "Semua" },
            { key: "approved", label: "Disetujui" },
            { key: "pending", label: "Menunggu" },
            { key: "rejected", label: "Ditolak" },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setRiwayatFilter(f.key)}
              className="shrink-0"
              style={{
                padding: "9px 16px", borderRadius: 9999, cursor: "pointer", fontFamily: "inherit",
                border: riwayatFilter === f.key ? "none" : `1px solid ${T.border}`,
                background: riwayatFilter === f.key ? T.blue : "#FFFFFF",
                color: riwayatFilter === f.key ? "#fff" : "#334155",
                fontSize: 12, fontWeight: riwayatFilter === f.key ? 700 : 600,
                transition: `all .2s ${T.ease}`,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* daftar pengajuan — flat full-width, pemisah underline */}
        {fetchError ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%", background: "rgba(239,68,68,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px",
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#DC2626", maxWidth: 220, margin: "0 auto 14px" }}>
              {fetchError}
            </div>
            <button
              onClick={loadRequests}
              style={{
                background: T.blue, border: "none", color: "#fff", fontSize: 12, fontWeight: 600,
                fontFamily: "inherit", borderRadius: 9999, padding: "8px 24px", cursor: "pointer",
                boxShadow: "0 4px 12px rgba(47,139,248,0.35)",
              }}
            >
              Coba Lagi
            </button>
          </div>
        ) : fetching ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div className="mx-auto w-7 h-7 border-2 border-[#2F8BF8] border-t-transparent rounded-full animate-spin" />
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 10 }}>Memuat...</div>
          </div>
        ) : riwayatRows.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "56px 28px 0" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", background: T.iconBg, color: T.blue,
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6M9 13h6M9 17h6" />
              </svg>
            </div>
            <b style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Belum ada pengajuan</b>
            <p style={{ fontSize: 11.5, color: T.textMuted, lineHeight: 1.55, marginTop: 6 }}>
              Permohonan izin atau sakit yang sudah dikirim akan tampil di sini.
            </p>
            <button
              type="button"
              onClick={() => setView("form")}
              style={{
                marginTop: 18, display: "inline-flex", alignItems: "center", gap: 7,
                background: `linear-gradient(135deg,${T.blue},${T.blueDeep})`, color: "#fff",
                border: "none", borderRadius: 9999, padding: "11px 22px",
                fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
                boxShadow: "0 10px 24px -8px rgba(47,139,248,0.5)",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Ajukan Sekarang
            </button>
          </div>
        ) : (
          <div>
            {riwayatRows.map((r, i) => {
              const st = STATUS[r.status] || STATUS.pending;
              const days = r.total_days || countLeaveDays(r.start_date, r.end_date);
              const range = r.start_date === r.end_date
                ? fmtShort(r.start_date)
                : fmtShort(r.start_date) + " - " + fmtShort(r.end_date);
              const d = new Date(r.start_date + "T00:00:00");
              const iconBg = r.status === "approved" ? "#10B981" : r.status === "rejected" ? "#EF4444" : "#3B82F6";
              return (
                <div key={r.id} style={{ padding: "11px 4px", borderBottom: i < riwayatRows.length - 1 ? "1px solid #EEF2F8" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, textAlign: "center", flexShrink: 0, lineHeight: 1.1 }}>
                      <span style={{ display: "block", fontSize: 9.5, fontWeight: 500, color: T.textMuted }}>
                        {d.toLocaleDateString("id-ID", { weekday: "short" })}
                      </span>
                      <b style={{ display: "block", fontSize: 16, fontWeight: 800, color: T.text, margin: "2px 0" }}>{d.getDate()}</b>
                      <span style={{ display: "block", fontSize: 9.5, fontWeight: 500, color: T.textMuted }}>
                        {d.toLocaleDateString("id-ID", { month: "short" })}
                      </span>
                    </div>
                    <div style={{ width: 1, alignSelf: "stretch", background: "#E9EEF6", flexShrink: 0 }} />
                    <div style={{
                      width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: iconBg, color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {r.status === "approved" && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                      )}
                      {r.status === "pending" && (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></svg>
                      )}
                      {r.status === "rejected" && (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round"><path d="M6 18L18 6M6 6l12 12" /></svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ display: "block", fontSize: 12.5, fontWeight: 800, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {TYPE_LABEL[r.leave_type] || "Izin"}
                      </b>
                      <span style={{ display: "block", fontSize: 10.5, fontWeight: 500, color: T.textMuted, marginTop: 2 }}>
                        {range} · {days} hari
                      </span>
                      {r.status === "rejected" && r.rejection_reason && (
                        <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#DC2626", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          Catatan admin: {r.rejection_reason}
                        </span>
                      )}
                    </div>
                    <span style={{
                      flex: "none", fontSize: 9, fontWeight: 800, padding: "4px 10px",
                      borderRadius: 9999, color: st.color, background: st.bg, whiteSpace: "nowrap",
                    }}>
                      {st.label}
                    </span>
                  </div>
                  {r.status === "pending" && (
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                      <button
                        onClick={() => handleCancel(r.id)}
                        style={{
                          fontFamily: "inherit", fontSize: 10.5, fontWeight: 700,
                          padding: "5px 14px", borderRadius: 9999, cursor: "pointer",
                          border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)",
                          color: T.red, transition: "background .2s",
                        }}
                      >
                        Batalkan
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <p style={{ fontSize: 11, color: T.textMuted, textAlign: "center", marginTop: 14 }}>
              Semua pengajuan periode ini tampil di halaman ini.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
