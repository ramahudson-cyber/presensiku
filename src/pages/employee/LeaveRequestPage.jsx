import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import {
  LEAVE_TYPES,
  createLeaveRequest,
  getMyLeaveRequests,
  cancelLeaveRequest,
  countLeaveDays,
} from "../../services/leaveService";

const DAY_NAMES = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

// ─── Premium badge config ───
const STATUS = {
  pending:   { label: "Menunggu", color: "#a5b4fc", bg: "rgba(165,180,252,0.10)", border: "rgba(165,180,252,0.15)" },
  approved:  { label: "Disetujui", color: "#2dd4bf", bg: "rgba(45,212,191,0.10)", border: "rgba(45,212,191,0.15)" },
  rejected:  { label: "Ditolak", color: "#fda4af", bg: "rgba(253,164,175,0.10)", border: "rgba(253,164,175,0.15)" },
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
        background: "transparent", color: active ? "#fff" : "rgba(255,255,255,0.5)",
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
    return <div style={{ padding: "80px 0", textAlign: "center", color: "#9ba1ae" }}>Memuat...</div>;
  }
  if (!user) {
    return <div style={{ padding: "80px 0", textAlign: "center", color: "#9ba1ae" }}>Silakan login terlebih dahulu.</div>;
  }

  // ─── Ambient background ───
  const bgStyle = {
    position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
    background: "radial-gradient(circle at 50% -20%, #1a0a35 0%, #050505 70%)",
  };
  const gridStyle = {
    position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
    background: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
    backgroundSize: "64px 64px",
    maskImage: "radial-gradient(circle at 30% 30%, rgba(0,0,0,0.5), transparent 75%)",
    WebkitMaskImage: "radial-gradient(circle at 30% 30%, rgba(0,0,0,0.5), transparent 75%)",
  };
  const glow1 = {
    position: "fixed", top: "-200px", left: "-200px", width: 600, height: 600,
    background: "radial-gradient(circle, rgba(191,0,255,0.12), transparent 60%)",
    borderRadius: "50%", filter: "blur(60px)", zIndex: 0, pointerEvents: "none",
  };
  const glow2 = {
    position: "fixed", bottom: "-200px", right: "-200px", width: 500, height: 500,
    background: "radial-gradient(circle, rgba(153,0,204,0.10), transparent 60%)",
    borderRadius: "50%", filter: "blur(60px)", zIndex: 0, pointerEvents: "none",
  };
  const glow3 = {
    position: "fixed", top: "40%", right: "-100px", width: 400, height: 400,
    background: "radial-gradient(circle, rgba(112,102,237,0.08), transparent 60%)",
    borderRadius: "50%", filter: "blur(50px)", zIndex: 0, pointerEvents: "none",
  };

  return (
    <div className="min-h-screen w-full bg-transparent text-white font-sans absolute top-0 left-0 right-0 pb-24">
      <div style={bgStyle} />
      <div style={gridStyle} />
      <div style={glow1} />
      <div style={glow2} />
      <div style={glow3} />

      {/* ─── HERO HEADER ─── */}
      <div className="w-full pt-12 pb-6 px-6 shadow-2xl border-b border-white/5 rounded-b-[40px]"
        style={{ background: "linear-gradient(160deg, #BF40FF 0%, #6600CC 35%, #2B0066 65%, #000000 100%)", zIndex: 50, position: "relative" }}>
        <h1 className="text-lg font-bold" style={{ fontFamily: "'Urbanist', sans-serif", color: "#FFFFFF" }}>Izin &amp; Sakit</h1>
        <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>Ajukan permohonan atau lihat riwayat</p>
      </div>

      <div className="w-full px-3 mt-5">

        {/* ─── STAT CARDS ROW ─── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 14 }}>
          {[
            { label: "Disetujui", value: approvedCount, statColor: "rgba(173,255,47,0.3)", valueColor: "#adff2f",
              icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#adff2f" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg> },
            { label: "Pending", value: pendingCount, statColor: "rgba(165,180,252,0.3)", valueColor: "#a5b4fc",
              icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="3"><circle cx="12" cy="12" r="3"/><path d="M12 5v2M12 17v2M5 12h2M17 12h2"/></svg> },
            { label: "Total Hari", value: totalDays, statColor: "rgba(153,0,204,0.3)", valueColor: "#c084fc",
              icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2.5"><path d="M3 12h18M12 3v18"/></svg> },
          ].map((st) => (
            <div key={st.label} style={{
              position: "relative", padding: 10,
              background: "linear-gradient(160deg, rgba(30,25,45,0.6), rgba(15,10,25,0.3))",
              backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 18, overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", top: -25, right: -25, width: 70, height: 70,
                background: st.statColor, borderRadius: "50%", filter: "blur(30px)", opacity: 0.5,
              }} />
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4, position: "relative", zIndex: 1 }}>
                <span style={{
                  width: 18, height: 18, borderRadius: 6,
                  background: st.statColor, display: "flex", alignItems: "center", justifyContent: "center",
                }}>{st.icon}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: st.valueColor, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                  {st.label}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 5, position: "relative", zIndex: 1 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
                  {st.value}
                </span>
                <span style={{ fontSize: 10, color: "#9ba1ae" }}>total</span>
              </div>
            </div>
          ))}
        </div>

        {/* ─── HERO FORM CARD ─── */}
        <div style={{
          position: "relative", marginTop: 14,
          background: "linear-gradient(160deg, #BF40FF 0%, #7020CC 25%, #2B0066 55%, #000000 100%)",
          borderRadius: 30, overflow: "hidden",
          boxShadow: "0 16px 60px rgba(0,0,0,0.5), 0 0 40px rgba(191,0,255,0.08)",
          border: "1px solid rgba(255,255,255,0.1)",
          padding: "28px 22px 22px 22px",
        }}>
          <div style={{ position: "absolute", top: -80, right: -80, width: 200, height: 200,
            background: "radial-gradient(circle, rgba(255,255,255,0.06), transparent 65%)", borderRadius: "50%" }} />

          <div style={{ position: "relative", zIndex: 2 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 14, marginBottom: 18,
              paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Ajukan Permohonan Izin/Sakit</span>
            </div>

            <form onSubmit={handleSubmit}>
              {/* PILL TAB Izin/Sakit */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                  Jenis Permohonan
                </div>
                <div style={{
                  position: "relative", display: "inline-flex", background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: 4, width: "100%",
                }}>
                  <span style={{
                    position: "absolute", top: 5, left: 5,
                    width: "calc(50% - 5px)", height: "calc(100% - 10px)",
                    background: "linear-gradient(135deg, #BF00FF, #9900CC)",
                    borderRadius: 14,
                    left: formType === "izin" ? 5 : "calc(50% - 0px)",
                    transition: "left .35s cubic-bezier(0.65,0,0.35,1)",
                    boxShadow: "0 4px 20px rgba(191,0,255,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
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
                  <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                    Tanggal Mulai
                  </div>
                  <input
                    type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    min={today}
                    style={{
                      width: "100%", background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14,
                      padding: "14px 14px", color: "#fff", fontSize: 14, outline: "none",
                      colorScheme: "dark", fontFamily: "inherit",
                    }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                    Tanggal Selesai
                  </div>
                  <input
                    type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || today}
                    style={{
                      width: "100%", background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14,
                      padding: "14px 14px", color: "#fff", fontSize: 14, outline: "none",
                      colorScheme: "dark", fontFamily: "inherit",
                    }}
                  />
                </div>
              </div>

              {/* DAY COUNT PILL */}
              {dayCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px",
                    background: "rgba(191,0,255,0.08)", border: "1px solid rgba(191,0,255,0.2)",
                    borderRadius: 9999, fontSize: 12, fontWeight: 600, color: "#c084fc",
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 800 }}>{dayCount}</span> hari
                  </span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Jumlah hari kalender</span>
                </div>
              )}

              {/* REASON */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                  Alasan Permohonan
                </div>
                <textarea
                  value={reason} onChange={(e) => setReason(e.target.value)}
                  rows="3" placeholder="Jelaskan alasan permohonan Anda..."
                  style={{
                    width: "100%", background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14,
                    padding: "14px 14px", color: "#fff", fontSize: 14, outline: "none",
                    resize: "vertical", fontFamily: "inherit",
                  }}
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
                  overflow: "hidden", transition: "all .2s",
                  boxShadow: "0 8px 24px rgba(191,0,255,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
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
        </div>

        {/* ─── HISTORY CARD ─── */}
        <div style={{
          position: "relative", marginTop: 14,
          background: "linear-gradient(140deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015) 60%, rgba(153,0,204,0.02) 100%)",
          backdropFilter: "blur(24px)",
          borderRadius: 28, overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
          padding: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 3, height: 18, borderRadius: 2, background: "linear-gradient(180deg, #BF00FF, #9900CC)" }} />
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.2, letterSpacing: "-0.01em" }}>Riwayat Permohonan</h2>
            </div>
            <div style={{ display: "inline-flex", gap: 2, background: "rgba(255,255,255,0.04)", borderRadius: 9, padding: 2, border: "1px solid rgba(255,255,255,0.05)" }}>
              <button
                onClick={() => setFilterTab("semua")}
                style={{
                  padding: "6px 12px", borderRadius: 7, border: "none", cursor: "pointer",
                  fontSize: 10, fontWeight: 600, fontFamily: "inherit",
                  background: filterTab === "semua" ? "rgba(191,0,255,0.18)" : "transparent",
                  color: filterTab === "semua" ? "#fff" : "rgba(155,161,174,0.7)",
                }}
              >Semua</button>
              <button
                onClick={() => setFilterTab("pending")}
                style={{
                  padding: "6px 12px", borderRadius: 7, border: "none", cursor: "pointer",
                  fontSize: 10, fontWeight: 600, fontFamily: "inherit",
                  background: filterTab === "pending" ? "rgba(191,0,255,0.18)" : "transparent",
                  color: filterTab === "pending" ? "#fff" : "rgba(155,161,174,0.7)",
                }}
              >Pending</button>
            </div>
          </div>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.32)", margin: "0 0 6px 0" }}>
            {filteredRequests.length} permohonan
          </p>

          {fetchError ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "#fda4af", fontSize: 13 }}>{fetchError}</div>
          ) : fetching ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "#9ba1ae", fontSize: 13 }}>Memuat...</div>
          ) : filteredRequests.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ fontSize: 28, opacity: 0.3, marginBottom: 6 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ba1ae" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div style={{ fontSize: 12, color: "#9ba1ae" }}>
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
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}>
                    {/* ICON */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 16,
                      background: s.bg, border: "1px solid " + s.border,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      {r.status === "approved" && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2.5">
                          <path d="M20 6L9 17l-5-5"/>
                        </svg>
                      )}
                      {r.status === "pending" && (
                        <span style={{
                          display: "block", width: 8, height: 8, borderRadius: "50%",
                          background: s.color, boxShadow: "0 0 8px " + s.color,
                        }} />
                      )}
                      {r.status === "rejected" && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fda4af" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="15" y1="9" x2="9" y2="15"/>
                          <line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                      )}
                    </div>

                    {/* CONTENT */}
                    <div style={{ flex: 1, minWidth: 0, padding: "0 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", textTransform: "capitalize" }}>
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
                        fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 2,
                        lineHeight: 1.4,
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                      }}>
                        {r.reason}
                      </p>
                      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", margin: 0 }}>
                        {r.start_date.substring(0,10).replace("-", "–")}–{r.end_date.substring(5)} · {days} hari
                      </p>
                    </div>

                    {/* CANCEL BUTTON */}
                    {r.status === "pending" && (
                      <button
                        onClick={() => handleCancel(r.id)}
                        style={{
                          width: 36, height: 36, borderRadius: 12,
                          border: "1px solid rgba(253,164,175,0.15)",
                          background: "rgba(251,114,133,0.06)", color: "#fda4af",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "pointer", flexShrink: 0,
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
          className="fixed inset-0 z-[9999] flex items-end justify-center px-4 pb-28"
          onClick={() => setShowSuccessPopup(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Popup Card */}
          <div
            style={{
              position: "relative", width: "100%", maxWidth: 360, zIndex: 10000,
              background: "linear-gradient(160deg, #0a2616 0%, #0f2d1f 100%)",
              border: "1px solid rgba(45,212,191,0.25)",
              borderRadius: 28, padding: "24px 22px 20px",
              boxShadow: "0 24px 80px rgba(0,0,0,0.5), 0 0 40px rgba(45,212,191,0.15)",
              animation: "slideUp .35s cubic-bezier(0.34,1.56,0.64,1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glow */}
            <div style={{
              position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)",
              width: 200, height: 200, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(45,212,191,0.25), transparent 65%)",
              filter: "blur(20px)", pointerEvents: "none",
            }} />

            {/* Icon Circle */}
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "rgba(45,212,191,0.12)", border: "2px solid rgba(45,212,191,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 12px", position: "relative",
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            {/* Title */}
            <div style={{
              textAlign: "center", marginBottom: 14, position: "relative",
            }}>
              <h3 style={{
                fontSize: 17, fontWeight: 800, color: "#FFFFFF", margin: "0 0 4px",
                fontFamily: "'Urbanist', sans-serif", letterSpacing: "-0.01em",
              }}>
                Permohonan Terkirim
              </h3>
              <p style={{
                fontSize: 12, color: "rgba(255,255,255,0.5)", margin: 0,
              }}>
                Status menunggu persetujuan admin
              </p>
            </div>

            {/* Summary Row */}
            <div style={{
              background: "rgba(45,212,191,0.06)",
              border: "1px solid rgba(45,212,191,0.12)",
              borderRadius: 16, padding: "10px 14px", marginBottom: 12, position: "relative",
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 6,
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, textTransform: "capitalize",
                  color: "#2dd4bf", letterSpacing: "0.04em",
                }}>
                  {popupData.type.toUpperCase()}
                </span>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "2px 9px", borderRadius: 9999,
                  fontSize: 9, fontWeight: 700, color: "#2dd4bf",
                  background: "rgba(45,212,191,0.1)", border: "1px solid rgba(45,212,191,0.2)",
                  textTransform: "uppercase", letterSpacing: "0.03em",
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#2dd4bf" }} />
                  PENDING
                </span>
              </div>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: "0 12px", fontSize: 11,
              }}>
                <div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Tanggal</div>
                  <div style={{ color: "#FFFFFF", marginTop: 1, fontSize: 12, fontWeight: 700, lineHeight: 1.3 }}>
                    {fmtDay(popupData.start)} — {fmtDay(popupData.end)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Durasi</div>
                  <div style={{ color: "#FFFFFF", marginTop: 1, fontSize: 12, fontWeight: 700 }}>
                    {popupData.days} hari
                  </div>
                </div>
              </div>
            </div>

            {/* Alasan */}
            <div style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14, padding: "8px 12px", marginBottom: 12,
            }}>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Alasan</div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", margin: 0, lineHeight: 1.4 }}>
                {popupData.reason}
              </p>
            </div>

            {/* OK Button */}
            <button
              onClick={() => setShowSuccessPopup(false)}
              style={{
                width: "100%", padding: "12px 0",
                background: "linear-gradient(135deg, #2dd4bf 0%, #14b8a6 100%)",
                color: "#062e1e", fontSize: 14, fontWeight: 800,
                borderRadius: 14, border: "none", cursor: "pointer",
                fontFamily: "inherit", letterSpacing: "0.02em",
                boxShadow: "0 8px 24px rgba(45,212,191,0.3)",
              }}
            >
              Kembali ke Beranda
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
