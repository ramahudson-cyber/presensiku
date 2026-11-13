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
  pending:  { label: "Menunggu",  color: T.amber,    bg: "rgba(245,158,11,0.12)" },
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

// ─── Section header — pola DESIGN.md: kotak ikon 32px + judul + subteks ───
function SectionHeader({ icon, title, subtitle, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10, background: T.iconBg,
        display: "flex", alignItems: "center", justifyContent: "center", flex: "none",
      }}>{icon}</div>
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
  const [requests, setRequests] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState("");

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

  const toggleView = () => {
    setView((v) => (v === "form" ? "riwayat" : "form"));
    window.scrollTo(0, 0);
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
    width: 36, height: 36, marginLeft: -8, border: `1px solid ${T.border}`, background: T.surface,
    color: T.textSec, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", flex: "none", transition: `transform .25s ${T.ease}, background .25s`, fontFamily: "inherit",
  };
  const riwayatBtn = {
    border: "none", background: "transparent", fontFamily: "inherit", cursor: "pointer",
    fontSize: 11, fontWeight: 700, color: T.blue, padding: "7px 10px", borderRadius: 10,
    transition: "background .25s", flex: "none",
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
      style={{ background: T.bg, color: T.text }}
    >
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      {/* ── TOPBAR sticky: kembali + judul dinamis + toggle Riwayat ── */}
      <header
        style={{
          position: "sticky", top: 0, zIndex: 20, background: "rgba(244,242,251,0.9)",
          backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
          padding: "calc(env(safe-area-inset-top) + 10px) 16px 10px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        <button style={backBtn} aria-label="Kembali" onClick={() => navigate(-1)}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 19l-7-7m0 0 7-7m-7 7h18" />
          </svg>
        </button>
        <h1 style={{ fontSize: 14.5, fontWeight: 800, color: T.text, letterSpacing: "-0.01em", margin: 0 }}>
          {view === "form" ? "Pengajuan Izin & Sakit" : "Riwayat Pengajuan"}
        </h1>
        <button style={riwayatBtn} onClick={toggleView}>
          {view === "form" ? "Riwayat" : "Kembali"}
        </button>
      </header>

      {/* ═══ HALAMAN FORM ═══ */}
      <main
        style={{
          display: view === "form" ? "flex" : "none",
          flexDirection: "column", gap: 20,
          padding: "16px 16px calc(env(safe-area-inset-bottom) + 118px)",
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
          <div style={{ position: "relative", zIndex: 1 }}>
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
        </div>

        {/* ── 1. Jenis Pengajuan ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SectionHeader
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                <path d="M3.5 12h4l1.5-2.5 2.5 5 1.5-3h7.5" opacity="0.55" />
              </svg>
            }
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
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4.5" width="18" height="17" rx="3" />
                <path d="M8 2.5v4M16 2.5v4M3 10h18" />
              </svg>
            }
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
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V6a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
              </svg>
            }
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
                icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 16V4m0 0L7 9m5-5 5 5" />
                    <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
                  </svg>
                }
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

      {/* ═══ HALAMAN RIWAYAT ═══ */}
      <div
        style={{
          display: view === "riwayat" ? "flex" : "none",
          flexDirection: "column", gap: 14,
          padding: "16px 16px calc(env(safe-area-inset-bottom) + 26px)",
          maxWidth: 430, margin: "0 auto",
        }}
      >
        {fetchError ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", background: "#FEF2F2",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#DC2626", maxWidth: 200, margin: "0 auto 14px" }}>
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
        ) : requests.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: T.textMuted, fontSize: 12 }}>
            Belum ada pengajuan.
          </div>
        ) : (
          requests.map((r) => {
            const s = STATUS[r.status] || STATUS.pending;
            const days = r.total_days || countLeaveDays(r.start_date, r.end_date);
            const range =
              r.start_date === r.end_date
                ? fmtShort(r.start_date)
                : fmtShort(r.start_date) + " – " + fmtShort(r.end_date);
            return (
              <div
                key={r.id}
                style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: "14px 15px", boxShadow: T.shadow }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ display: "block", fontSize: 12.5, fontWeight: 800, color: T.text }}>
                      {TYPE_LABEL[r.leave_type] || "Izin"}
                    </b>
                    <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: T.textMuted, marginTop: 2 }}>
                      {range} · {days} hari
                    </span>
                  </div>
                  <span style={{
                    flex: "none", fontSize: 9, fontWeight: 800, padding: "4px 10px",
                    borderRadius: 9999, color: s.color, background: s.bg, whiteSpace: "nowrap",
                  }}>
                    {s.label}
                  </span>
                </div>
                <div style={{ marginTop: 9, fontSize: 10.5, lineHeight: 1.55, color: T.textSec }}>
                  <b style={{ color: T.text }}>Alasan:</b> {r.reason}
                </div>
                {r.status === "rejected" && r.rejection_reason && (
                  <div style={{
                    marginTop: 9, borderRadius: 11, padding: "8px 11px", fontSize: 10, lineHeight: 1.5,
                    background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.16)", color: "#B91C1C",
                  }}>
                    <b>Catatan admin:</b> {r.rejection_reason}
                  </div>
                )}
                {r.status === "pending" && (
                  <button
                    onClick={() => handleCancel(r.id)}
                    style={{
                      marginTop: 10, fontFamily: "inherit", fontSize: 10.5, fontWeight: 700,
                      padding: "6px 14px", borderRadius: 9999, cursor: "pointer",
                      border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)",
                      color: T.red, transition: "background .2s",
                    }}
                  >
                    Batalkan
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
