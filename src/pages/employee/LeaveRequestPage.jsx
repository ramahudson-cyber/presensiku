import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  createLeaveRequest,
  getMyLeaveRequests,
  cancelLeaveRequest,
  countLeaveDays,
} from "../../services/leaveService";

// Light-mode tokens — per DESIGN.md
const T = {
  bg: '#F4F2FB',
  surface: '#FFFFFF',
  border: 'rgba(31,41,55,0.08)',
  div: '#F1F5F9',
  text: '#0F172A',
  textSec: '#475569',
  textMuted: '#94A3B8',
  sub: '#6B7280',
  shadow: '0 4px 16px rgba(15,23,42,0.06)',
  rowBg: 'rgba(15,23,42,0.02)',
  rowShadow: '0 1px 3px rgba(0,0,0,0.06)',
  iconBg: '#F5F3FF',
};

const DAY_NAMES = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

// ─── Status badge config (DESIGN.md colors) ───
const STATUS = {
  pending:   { label: "Menunggu", color: "#F59E0B", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.25)" },
  approved:  { label: "Disetujui", color: "#10B981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.25)" },
  rejected:  { label: "Ditolak", color: "#EF4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.25)" },
};

function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}

function fmtDay(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return DAY_NAMES[d.getDay()] + ", " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
}

function PillTab({ active, label, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "relative", zIndex: 1, flex: 1, padding: "11px 18px", border: "none",
        background: "transparent", color: active ? "#fff" : T.textSec,
        fontSize: 13, fontWeight: 600, cursor: "pointer", borderRadius: 14,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "inherit",
        transition: "color .3s",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export default function LeaveRequestPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // ─── HOOKS (before early return — React #310) ───
  const [formType, setFormType] = useState("izin");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [popupData, setPopupData] = useState({ type: "", start: "", end: "", reason: "", days: 0 });
  const [requests, setRequests] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [filterTab, setFilterTab] = useState("semua");

  // Stats
  const approvedCount = useMemo(() => requests.filter(r => r.status === "approved").length, [requests]);
  const pendingCount   = useMemo(() => requests.filter(r => r.status === "pending").length, [requests]);
  const rejectedCount  = useMemo(() => requests.filter(r => r.status === "rejected").length, [requests]);
  const totalDays      = useMemo(() => requests.reduce((sum, r) => sum + (r.total_days || countLeaveDays(r.start_date, r.end_date)), 0), [requests]);

  const dayCount = useMemo(() => {
    if (startDate && endDate && endDate >= startDate) return countLeaveDays(startDate, endDate);
    return 0;
  }, [startDate, endDate]);

  const filteredRequests = useMemo(() => {
    if (filterTab === "pending") return requests.filter(r => r.status === "pending");
    return requests;
  }, [requests, filterTab]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSuccessMsg("");

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
      await createLeaveRequest({ userId: user.id, type: formType, startDate, endDate, reason });
      setPopupData({ type: formType, start: startDate, end: endDate, reason, days: dayCount });
      setShowSuccessPopup(true);
      setStartDate(""); setEndDate(""); setReason("");
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

  // ─── Guard (after hooks) ───
  if (authLoading) {
    return <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, background: T.bg }}>Memuat...</div>;
  }
  if (!user) {
    return <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, background: T.bg }}>Silakan login terlebih dahulu.</div>;
  }

  const initials = user?.full_name?.charAt(0)?.toUpperCase() || "P";

  const inputStyle = {
    width: "100%", background: T.surface,
    border: `1px solid ${T.border}`, borderRadius: 14,
    padding: "14px 14px", color: T.text, fontSize: 14, outline: "none",
    fontFamily: "inherit", boxShadow: T.shadow,
  };

  const statCards = [
    { label: "Disetujui", value: approvedCount, color: "#10B981",
      icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg> },
    { label: "Pending", value: pendingCount, color: "#F59E0B",
      icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="3"><circle cx="12" cy="12" r="3"/><path d="M12 5v2M12 17v2M5 12h2M17 12h2"/></svg> },
    { label: "Total Hari", value: totalDays, color: "#BF00FF",
      icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#BF00FF" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  ];

  return (
    <div className="min-h-screen w-full font-sans absolute top-0 left-0 right-0 pb-24" style={{ background: T.bg, color: T.text }}>
      {/* ── HEADER — simple elegant (sama dengan Riwayat) ── */}
      <div className="pt-14 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-[17px] font-bold tracking-tight" style={{ color: T.text }}>Izin &amp; Sakit</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover border" style={{ borderColor: 'rgba(191,0,255,0.15)' }} />
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold"
                style={{ background: T.iconBg, color: '#BF00FF', border: '1px solid rgba(191,0,255,0.15)' }}>
                {initials}
              </div>
            )}
            <span className="text-[9px] font-medium leading-none max-w-[72px] truncate text-center" style={{ color: T.sub }}>
              {user?.position || user?.role || "Pegawai"}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 mt-6 space-y-4">

        {/* ─── STAT CARDS ROW ─── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {statCards.map((st) => (
            <div key={st.label} className="rounded-2xl p-3"
              style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{
                  width: 18, height: 18, borderRadius: 6, flexShrink: 0,
                  background: T.iconBg, display: "flex", alignItems: "center", justifyContent: "center",
                }}>{st.icon}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                  {st.label}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: T.text, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
                  {st.value}
                </span>
                <span style={{ fontSize: 10, color: T.sub }}>total</span>
              </div>
            </div>
          ))}
        </div>

        {/* ─── FORM CARD ─── */}
        <div className="rounded-3xl p-6"
          style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, paddingBottom: 14, borderBottom: `1px solid ${T.div}` }}>
            <div style={{ width: 3, height: 18, borderRadius: 2, background: "linear-gradient(180deg, #BF00FF, #9900CC)" }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Ajukan Permohonan Izin/Sakit</span>
          </div>

          <form onSubmit={handleSubmit}>
            {/* PILL TAB Izin/Sakit */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                Jenis Permohonan
              </div>
              <div style={{
                position: "relative", display: "inline-flex", background: T.rowBg,
                border: `1px solid ${T.border}`, borderRadius: 18, padding: 4, width: "100%",
              }}>
                <span style={{
                  position: "absolute", top: 5, left: 5,
                  width: "calc(50% - 5px)", height: "calc(100% - 10px)",
                  background: "linear-gradient(135deg, #BF00FF, #9900CC)",
                  borderRadius: 14,
                  left: formType === "izin" ? 5 : "calc(50% - 0px)",
                  transition: "left .35s cubic-bezier(0.65,0,0.35,1)",
                  boxShadow: "0 4px 20px rgba(191,0,255,0.3)",
                  zIndex: 0,
                }} />
                <PillTab
                  active={formType === "izin"}
                  label="Izin"
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>}
                  onClick={() => setFormType("izin")}
                />
                <PillTab
                  active={formType === "sakit"}
                  label="Sakit"
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M8 6h8M12 2v4M6 12h12M4 18h16"/></svg>}
                  onClick={() => setFormType("sakit")}
                />
              </div>
            </div>

            {/* DATE INPUTS */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                  Tanggal Mulai
                </div>
                <input
                  type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  min={today}
                  style={inputStyle}
                />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                  Tanggal Selesai
                </div>
                <input
                  type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || today}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* DAY COUNT PILL */}
            {dayCount > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px",
                  background: T.iconBg, border: "1px solid rgba(191,0,255,0.2)",
                  borderRadius: 9999, fontSize: 12, fontWeight: 600, color: '#BF00FF',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{dayCount}</span> hari
                </span>
                <span style={{ fontSize: 11, color: T.sub }}>Jumlah hari kalender</span>
              </div>
            )}

            {/* REASON */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                Alasan Permohonan
              </div>
              <textarea
                value={reason} onChange={(e) => setReason(e.target.value)}
                rows="3" placeholder="Jelaskan alasan permohonan Anda..."
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            {/* SUBMIT BUTTON */}
            <button
              type="submit" disabled={loading}
              style={{
                position: "relative", width: "100%", padding: "16px 24px", border: "none",
                borderRadius: 16,
                background: "linear-gradient(135deg, #BF00FF 0%, #9900CC 50%, #7020CC 100%)",
                color: "#fff", fontSize: 15, fontWeight: 700, cursor: loading ? "wait" : "pointer",
                transition: "all .2s",
                boxShadow: "0 8px 24px rgba(191,0,255,0.3)",
                fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                opacity: loading ? 0.6 : 1,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4z"/>
              </svg>
              {loading ? "Mengirim..." : "Kirim Permohonan"}
            </button>
          </form>
        </div>

        {/* ─── HISTORY CARD ─── */}
        <div className="rounded-3xl p-5"
          style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 3, height: 18, borderRadius: 2, background: "linear-gradient(180deg, #BF00FF, #3B82F6)" }} />
              <h2 style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: 0, lineHeight: 1.2, letterSpacing: "-0.01em" }}>Riwayat Permohonan</h2>
            </div>
            <div style={{ display: "inline-flex", gap: 2, background: T.rowBg, borderRadius: 9, padding: 2, border: `1px solid ${T.border}` }}>
              <button
                onClick={() => setFilterTab("semua")}
                style={{
                  padding: "6px 12px", borderRadius: 7, border: "none", cursor: "pointer",
                  fontSize: 10, fontWeight: 600, fontFamily: "inherit",
                  background: filterTab === "semua" ? '#BF00FF' : "transparent",
                  color: filterTab === "semua" ? "#fff" : T.sub,
                }}
              >Semua</button>
              <button
                onClick={() => setFilterTab("pending")}
                style={{
                  padding: "6px 12px", borderRadius: 7, border: "none", cursor: "pointer",
                  fontSize: 10, fontWeight: 600, fontFamily: "inherit",
                  background: filterTab === "pending" ? '#BF00FF' : "transparent",
                  color: filterTab === "pending" ? "#fff" : T.sub,
                }}
              >Pending</button>
            </div>
          </div>
          <p style={{ fontSize: 10, color: T.sub, margin: "0 0 6px 0" }}>
            {filteredRequests.length} permohonan
          </p>

          {fetchError ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "#DC2626", fontSize: 13 }}>{fetchError}</div>
          ) : fetching ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div className="mx-auto w-7 h-7 border-2 border-[#BF00FF] border-t-transparent rounded-full animate-spin" />
              <div style={{ fontSize: 13, color: T.textMuted, marginTop: 10 }}>Memuat...</div>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ marginBottom: 6 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="1.5" className="mx-auto">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div style={{ fontSize: 12, color: T.textMuted }}>
                {filterTab === "pending" ? "Tidak ada permohonan pending." : "Belum ada permohonan."}
              </div>
            </div>
          ) : (
            <div>
              {filteredRequests.map((r) => {
                const s = STATUS[r.status] || STATUS.pending;
                const days = r.total_days || countLeaveDays(r.start_date, r.end_date);
                return (
                  <div key={r.id} style={{
                    display: "flex", alignItems: "center", padding: "14px 8px",
                    borderBottom: `1px solid ${T.div}`,
                  }}>
                    {/* ICON */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 16, flexShrink: 0,
                      background: s.bg, border: "1px solid " + s.border,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {r.status === "approved" && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5">
                          <path d="M20 6L9 17l-5-5"/>
                        </svg>
                      )}
                      {r.status === "pending" && (
                        <span style={{
                          display: "block", width: 8, height: 8, borderRadius: "50%",
                          background: s.color,
                        }} />
                      )}
                      {r.status === "rejected" && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="15" y1="9" x2="9" y2="15"/>
                          <line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                      )}
                    </div>

                    {/* CONTENT */}
                    <div style={{ flex: 1, minWidth: 0, padding: "0 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: T.text, textTransform: "capitalize" }}>
                          {r.leave_type}
                        </span>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "2px 9px", borderRadius: 9999, fontSize: 10, fontWeight: 700,
                          color: s.color, background: s.bg, border: "1px solid " + s.border,
                          letterSpacing: "0.02em", textTransform: "uppercase", whiteSpace: "nowrap",
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.color }} />
                          {s.label}
                        </span>
                      </div>
                      <p style={{
                        fontSize: 11, color: T.textSec, marginBottom: 2,
                        lineHeight: 1.4,
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                      }}>
                        {r.reason}
                      </p>
                      <p style={{ fontSize: 10, color: T.sub, margin: 0 }}>
                        {fmtDay(r.start_date)} — {fmtDay(r.end_date)} · {days} hari
                      </p>
                    </div>

                    {/* CANCEL BUTTON */}
                    {r.status === "pending" && (
                      <button
                        onClick={() => handleCancel(r.id)}
                        style={{
                          width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                          border: "1px solid rgba(239,68,68,0.2)",
                          background: "rgba(239,68,68,0.06)", color: "#EF4444",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── SUCCESS POPUP ─── */}
      {showSuccessPopup && (
        <div
          className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center px-4 animate-fade-in"
          onClick={() => setShowSuccessPopup(false)}
        >
          {/* Backdrop */}
          <div className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm" onClick={() => setShowSuccessPopup(false)} />

          {/* Popup Card */}
          <div
            style={{
              maxHeight: "93vh", width: "100%", maxWidth: 400,
              borderRadius: "28px 28px 0 0",
              background: T.surface,
              border: `1px solid ${T.border}`,
              boxShadow: "0 20px 60px rgba(15,23,42,0.25)",
              position: "relative", overflow: "hidden", zIndex: 9999,
            }}
            className="md:rounded-3xl mx-auto flex flex-col animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Content */}
            <div style={{ position: "relative", zIndex: 2, padding: "10px 22px 0px", display: "flex", flexDirection: "column", alignItems: "center", overflowY: "auto", flex: "1 1 auto", minHeight: 0, paddingBottom: "calc(120px + env(safe-area-inset-bottom, 0px))" }}>
              {/* Handle */}
              <div style={{ display: "flex", justifyContent: "center", paddingBottom: 10 }}>
                <div style={{ width: 40, height: 4, borderRadius: 2, background: T.div }} />
              </div>

              {/* 3D Badge — violet gradient */}
              <div style={{
                width: 76, height: 76, borderRadius: 18,
                background: "linear-gradient(145deg, #BF00FF 0%, #7B00E0 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 16, position: "relative",
                boxShadow: "0 10px 24px rgba(191,0,255,0.35)",
              }}>
                <div style={{ position: "absolute", inset: -4, borderRadius: 22, background: "linear-gradient(145deg, #FF0099 0%, #BF00FF 50%, #7B00E0 100%)", zIndex: -1, opacity: 0.35, filter: "blur(6px)" }} />
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 12 2 2 4-4" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
              </div>

              {/* Title */}
              <h2 style={{ fontSize: 20, fontWeight: 800, color: T.text, textAlign: "center", marginBottom: 4 }}>
                Permohonan Terkirim
              </h2>
              <p style={{ fontSize: 12, color: T.textSec, textAlign: "center", marginBottom: 16 }}>
                {popupData.type === "sakit" ? "Permohonan sakit sedang diproses admin" : "Permohonan izin sedang diproses admin"}
              </p>

              {/* Status badge */}
              <span style={{
                fontSize: 10, fontWeight: 700, color: "#F59E0B",
                background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.3)",
                borderRadius: 20, padding: "3px 12px", marginBottom: 16,
                display: "inline-flex", alignItems: "center", gap: 6, letterSpacing: "0.04em", textTransform: "uppercase",
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#F59E0B" }} />
                Menunggu Persetujuan
              </span>

              {/* Summary */}
              <div style={{
                background: T.rowBg, border: `1px solid ${T.border}`,
                borderRadius: 16, padding: "12px 14px", marginBottom: 12, width: "100%",
              }}>
                {/* Type + Duration row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: T.text, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {popupData.type === "sakit" ? "SAKIT" : "IZIN"}
                  </span>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "3px 10px", borderRadius: 9999,
                    fontSize: 11, fontWeight: 700, color: '#BF00FF',
                    background: T.iconBg, border: "1px solid rgba(191,0,255,0.2)",
                  }}>
                    {popupData.days} hari
                  </span>
                </div>

                {/* Mulai / Berakhir grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
                  <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 12px" }}>
                    <div style={{ fontSize: 9, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Mulai</div>
                    <div style={{ color: T.text, fontSize: 12, fontWeight: 700, lineHeight: 1.35 }}>
                      {fmtDay(popupData.start)}
                    </div>
                  </div>
                  <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 12px" }}>
                    <div style={{ fontSize: 9, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Berakhir</div>
                    <div style={{ color: T.text, fontSize: 12, fontWeight: 700, lineHeight: 1.35 }}>
                      {fmtDay(popupData.end)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Alasan */}
              <div style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: 14, padding: "10px 12px", marginBottom: 16, width: "100%",
              }}>
                <div style={{ fontSize: 9, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Alasan</div>
                <p style={{ fontSize: 12, color: T.textSec, margin: 0, lineHeight: 1.5 }}>
                  {popupData.reason}
                </p>
              </div>

              {/* Button */}
              <button
                onClick={() => setShowSuccessPopup(false)}
                style={{
                  width: "100%", padding: "14px 0",
                  background: "linear-gradient(135deg, #BF00FF 0%, #9900CC 50%, #7B00E0 100%)",
                  border: "none", borderRadius: 16, color: "white",
                  fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: 0.3,
                  fontFamily: "inherit",
                  boxShadow: "0 8px 24px rgba(191,0,255,0.3)",
                }}
                className="active:scale-[0.98]"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
