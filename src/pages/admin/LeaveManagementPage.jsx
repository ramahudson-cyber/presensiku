import { useState, useEffect } from "react";
import { getLeaveRequests, approveLeaveRequest, rejectLeaveRequest, countLeaveDays } from "../../services/leaveService";
import { toast } from "react-toastify";

/* ═══ Premium badge config ═══ */
const STATUS = {
  pending:   { label: "Menunggu", color: "#a5b4fc", bg: "rgba(165,180,252,0.12)", border: "rgba(165,180,252,0.2)" },
  approved:  { label: "Disetujui", color: "#34d399", bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.2)" },
  rejected:  { label: "Ditolak",  color: "#fb7185", bg: "rgba(251,113,133,0.12)", border: "rgba(251,113,133,0.2)" },
};

const TABS = [
  { id: "pending", label: "Menunggu", badge: true },
  { id: "all",     label: "Semua" },
];

/* ═══ Inline Phosphor-style SVG icons ═══ */
const IconClipboard = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="4" width="10" height="16" rx="2"/><path d="M10 9h4M10 13h4M10 17h4"/></svg>;
const IconChart = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5z"/><path d="M10 15l-2-2 2-2"/><path d="M14 13l2 2-2 2"/></svg>;
const IconClock = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>;
const IconCheck = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>;
const IconX = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconCalendar = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 2v4M16 2v4M4 10h16"/></svg>;
const IconArrowRight = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
const IconCheckCircle = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 0-9 9"/><path d="M9 12l2 2 4-4"/></svg>;
const IconWarning = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>;

/* ═══ LeaveItemCard (ledger row, hairline, double-bezel inner card) ═══ */
function LeaveItemCard({ item, profile, onApprove, onRejectClick, processing }) {
  const s = STATUS[item.status] || STATUS.pending;
  const initial = (profile?.full_name || profile?.username || "P")[0].toUpperCase();

  return (
    <div
      style={{
        padding: "22px 0",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        transition: "background .35s cubic-bezier(0.32,0.72,0,1)",
        borderRadius: 14,
        margin: "0 -14px",
        paddingLeft: 14,
        paddingRight: 14,
      }}
    >
      {/* Row top: avatar + name + status pill */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 42, height: 42, borderRadius: 13,
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "rgba(255,255,255,0.88)", fontSize: 14, fontWeight: 800,
            flexShrink: 0, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
          aria-label={`Initial ${initial}`}
        >{initial}</div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <h4 style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em", color: "rgba(255,255,255,0.92)", lineHeight: 1.22 }}>
            {profile?.full_name || profile?.username || "Pegawai"}
          </h4>
          <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.38)", marginTop: 3, letterSpacing: "0.02em" }}>
            {item.leave_type}
          </p>
        </div>

        <span
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "5px 11px", borderRadius: 9999, fontSize: 10.5,
            fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
            color: s.color, background: s.bg, border: `1px solid ${s.border}`,
            whiteSpace: "nowrap", flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 6, height: 6, borderRadius: "50%", background: s.color,
              ...(item.status === "pending" ? { animation: "pulse 1.8s ease-in-out infinite" } : {}),
            }}
          />
          {s.label}
        </span>
      </div>

      {/* Dates */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, fontSize: 12.5, color: "rgba(255,255,255,0.42)", fontVariantNumeric: "tabular-nums" }}>
        <span><IconCalendar /></span>
        <span>
          {new Date(item.start_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
          {" — "}
          {new Date(item.end_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "#c4b5fd", letterSpacing: "0.02em" }}>
          {countLeaveDays(item.start_date, item.end_date)} hari
        </span>
      </div>

      {/* Reason */}
      <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "rgba(255,255,255,0.5)", marginTop: 12, maxWidth: "64ch", textWrap: "pretty" }}>
        {item.reason}
      </p>

      {/* Rejected note */}
      {item.status === "rejected" && item.rejection_reason && (
        <div
          style={{
            marginTop: 14, paddingLeft: 14, borderLeft: "2px solid rgba(251,113,133,0.45)",
            fontSize: 12, lineHeight: 1.55, color: "rgba(253,164,175,0.75)", maxWidth: "64ch",
          }}
        >
          <span style={{ fontWeight: 700, color: "rgba(232,92,92,0.7)" }}><IconWarning /></span> {item.rejection_reason}
        </div>
      )}

      {/* Actions */}
      {item.status === "pending" && (
        <div style={{ display: "flex", gap: 14, marginTop: 20 }}>
          <button
            onClick={() => onApprove(item.id)}
            disabled={processing}
            style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "11px 22px 11px 16px", borderRadius: 9999,
              border: "none", cursor: processing ? "wait" : "pointer",
              fontFamily: "inherit", fontSize: 13, fontWeight: 700,
              color: "#052e1b", background: "linear-gradient(180deg,#34d399,#0ea872)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), 0 14px 30px -10px rgba(70,203,138,0.45)",
              transition: "all .35s cubic-bezier(0.32,0.72,0,1)", opacity: processing ? 0.6 : 1,
            }}
          >
            Setujui <span style={{ width: 26, height: 26, borderRadius: 9999, background: "rgba(5,46,27,0.14)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, transition: "all .35s cubic-bezier(0.32,0.72,0,1)" }}><IconCheckCircle /></span>
          </button>
          <button
            onClick={() => onRejectClick(item.id)}
            disabled={processing}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "11px 22px", borderRadius: 9999,
              border: "1px solid rgba(255,255,255,0.1)", cursor: processing ? "wait" : "pointer",
              fontFamily: "inherit", fontSize: 13, fontWeight: 600,
              color: "rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.02)",
              transition: "all .35s cubic-bezier(0.32,0.72,0,1)", opacity: processing ? 0.6 : 1,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.55)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
          >
            Tolak
          </button>
        </div>
      )}
    </div>
  );
}

export default function LeaveManagementPage() {
  const [activeTab, setActiveTab] = useState("pending");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [successToast, setSuccessToast] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const data = activeTab === "pending" ? await getLeaveRequests("pending") : await getLeaveRequests(null);
      setItems(data || []);
    } catch {
      // silent — keep existing state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [activeTab]);

  const pendingCount = items.filter(i => i.status === "pending").length;
  const approvedCount = items.filter(i => i.status === "approved").length;
  const rejectedCount = items.filter(i => i.status === "rejected").length;
  const totalDays = items.reduce((sum, i) => sum + countLeaveDays(i.start_date, i.end_date), 0);

  const handleApprove = async (id) => {
    if (!confirm("Setujui permohonan ini?")) return;
    try {
      setProcessing(true);
      const data = await approveLeaveRequest(id);
      const extra = data.created > 0 ? ` (${data.created} absen dibuat, ${data.skipped} dilewati)` : data.skipped > 0 ? ` (${data.skipped} tanggal sudah ada absen)` : "";
      const msg = (data.message || "Disetujui") + extra;
      setSuccessToast(msg);
      toast.success(msg, { position: "bottom-center" });
      await load();
      setTimeout(() => setSuccessToast(""), 4000);
    } catch (e) {
      toast.error(e.message || "Gagal menyetujui", { position: "bottom-center" });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModal?.id) { toast.error("ID permohonan tidak valid", { position: "bottom-center" }); return; }
    if (!rejectionReason.trim()) { toast.warning("Alasan penolakan wajib diisi", { position: "bottom-center" }); return; }
    try {
      setProcessing(true);
      await rejectLeaveRequest(rejectModal.id, rejectionReason.trim());
      toast.success("Permohonan ditolak", { position: "bottom-center" });
      setRejectModal(null);
      setRejectionReason("");
      await load();
    } catch (e) {
      toast.error(e.message || "Gagal menolak", { position: "bottom-center" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 1600, margin: "0 auto", padding: "36px 56px 80px",
        minHeight: "100vh", position: "relative",
      }}
    >
      {/* ═══ AIDA: Attention — Editorial Hero (no meta-labels) ═══ */}
      <section style={{ padding: "44px 0 36px" }} aria-label="Hero">
        <h1
          style={{
            fontSize: "clamp(2.8rem,6vw,4.4rem)", lineHeight: 1.05,
            letterSpacing: "-0.04em", fontWeight: 800, maxWidth: "72rem",
            textWrap: "balance", color: "#fff",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.2)", display: "block", letterSpacing: "-0.03em" }}>Kelola semua</span>
          <span style={{ display: "block" }}>permohonan cuti</span>
        </h1>
        <p style={{ marginTop: 18, fontSize: 15, lineHeight: 1.55, color: "#9a9692", maxWidth: "48ch", textWrap: "pretty" }}>
          Admin melihat, menyetujui, atau menolak setiap permohonan izin, cuti, dan sakit secara real-time dari seluruh pegawai.
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 32 }}>
          <a
            href="#workbench"
            style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "14px 30px", borderRadius: 9999,
              fontFamily: "inherit", fontSize: 14, fontWeight: 700,
              color: "#052e1b", background: "linear-gradient(180deg,#34d399,#0ea872)",
              border: "none", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), 0 18px 40px -14px rgba(70,203,138,0.35)",
              textDecoration: "none", transition: "all .35s cubic-bezier(0.32,0.72,0,1)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.35), 0 26px 48px -12px rgba(70,203,138,0.55)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.35), 0 18px 40px -14px rgba(70,203,138,0.35)"; }}
          >
            Proses Menunggu <span style={{ width: 28, height: 28, borderRadius: 9999, background: "rgba(5,46,27,0.12)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}><IconArrowRight /></span>
          </a>
          <a
            href="#summary"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "14px 24px", borderRadius: 9999,
              fontFamily: "inherit", fontSize: 13.5, fontWeight: 600,
              color: "rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.1)", textDecoration: "none",
              transition: "all .35s cubic-bezier(0.32,0.72,0,1)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.55)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
          >
            Lihat Ringkasan
          </a>
        </div>
      </section>

      {/* ═══ AIDA: Interest — Gapless Bento Stats ═══ */}
      <section id="stats" aria-label="Status overview" style={{ marginBottom: 28 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "2px" }}>
          <article
            style={{
              padding: 28, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16,
              gridColumn: "span 2", transition: "all .4s cubic-bezier(0.32,0.72,0,1)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.background = "rgba(255,255,255,0.015)"; }}
          >
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: "#a5b4fc" }}>{pendingCount}</div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,0.35)", fontWeight: 700, marginTop: 8, display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ color: "rgba(255,255,255,0.5)" }}><IconClock /></span> Menunggu
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>butuh keputusan</div>
          </article>

          <article style={{ padding: 28, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, transition: "all .4s cubic-bezier(0.32,0.72,0,1)" }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: "#34d399" }}>{approvedCount}</div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,0.35)", fontWeight: 700, marginTop: 8, display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ color: "rgba(255,255,255,0.5)" }}><IconCheck /></span> Disetujui
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>bulan ini</div>
          </article>

          <article style={{ padding: 28, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, transition: "all .4s cubic-bezier(0.32,0.72,0,1)" }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: "#fb7185" }}>{rejectedCount}</div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,0.35)", fontWeight: 700, marginTop: 8, display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ color: "rgba(255,255,255,0.5)" }}><IconX /></span> Ditolak
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>bulan ini</div>
          </article>

          <article style={{ padding: 28, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, transition: "all .4s cubic-bezier(0.32,0.72,0,1)" }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: "#f2a93b" }}>{totalDays}</div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,0.35)", fontWeight: 700, marginTop: 8, display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ color: "rgba(255,255,255,0.5)" }}><IconCalendar /></span> Total Hari
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>terpakai semua</div>
          </article>
        </div>
      </section>

      {/* ═══ AIDA: Desire — Ledger Workbench (split layout) ═══ */}
      <div id="workbench" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.55fr) 400px", gap: 28, alignItems: "start" }}>

        {/* LEFT: Ledger list */}
        <section aria-label="Permohonan menunggu" className="shell" style={{
          background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 28,
          padding: 16, boxShadow: "0 40px 80px -40px rgba(0,0,0,0.9)", overflow: "hidden",
        }}>
          <div style={{
            background: "linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.005) 40%),rgba(10,10,14,0.92)",
            borderRadius: 20, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)", overflow: "hidden",
          }}>
            {/* Header */}
            <header style={{ display: "flex", alignItems: "center", gap: 14, padding: "24px 28px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "rgba(255,255,255,0.75)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)" }}>
                <IconClipboard />
              </div>
              <div>
                <b style={{ fontSize: 15, fontWeight: 800, letterTracking: "-0.01em", lineHeight: 1.2, color: "#fff" }}>
                  {activeTab === "pending" ? "Permohonan Menunggu" : "Semua Permohonan"}
                </b>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>{items.length} permohonan</p>
              </div>
              <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.35)", fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>
                {pendingCount > 0 ? `${pendingCount} / ${items.length}` : items.length}
              </span>
            </header>

            {/* List */}
            <div style={{ padding: "6px 28px 10px" }}>
              {loading ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "#9a9692", fontSize: 13 }}>
                  Memuat data...
                </div>
              ) : items.length === 0 ? (
                <div style={{ textAlign: "center", padding: "64px 24px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, color: "rgba(255,255,255,0.3)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)", marginBottom: 22 }}>
                    <IconClipboard />
                  </div>
                  <b style={{ fontSize: 15, fontWeight: 800, color: "rgba(255,255,255,0.88)", letterSpacing: "-0.01em" }}>Tidak ada permohonan</b>
                  <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.35)", marginTop: 6, maxWidth: "30ch", lineHeight: 1.55 }}>
                    {activeTab === "pending" ? "Tidak ada permohonan pending saat ini." : "Belum ada permohonan."}
                  </p>
                </div>
              ) : (
                <>
                  {items.map((item) => {
                    const profile = item.profiles;
                    return (
                      <LeaveItemCard
                        key={item.id}
                        item={item}
                        profile={profile}
                        onApprove={handleApprove}
                        onRejectClick={(id) => { setRejectModal({ id, name: profile?.full_name || "Pegawai" }); setRejectionReason(""); }}
                        processing={processing}
                      />
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT: Sticky summary (AIDA: Action anchor) */}
        <aside id="summary" aria-label="Ringkasan panel" style={{ position: "sticky", top: 28 }} className="shell" style={{
          background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 28, padding: 10,
          boxShadow: "0 40px 80px -40px rgba(0,0,0,0.9)", overflow: "hidden",
        }}>
          <div style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.006)),#0b0b12", borderRadius: 22, padding: 24, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }}>
            <header style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "rgba(255,255,255,0.75)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }}>
                <IconChart />
              </div>
              <div>
                <b style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.2, color: "#fff" }}>Ringkasan</b>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 500, marginTop: 2 }}>Status bulan ini</p>
              </div>
            </header>

            <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 10 }}>
              <div
                style={{ width: 100, height: 100, borderRadius: "50%", flexShrink: 0,
                  background: "conic-gradient(#f2a93b 0 22%,#c4b5fd 22% 43%,rgba(255,255,255,0.06) 43% 73%,rgba(255,255,255,0.06) 73% 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center", position: "relative", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }}
                aria-label={`Total ${items.length} permohonan: ${pendingCount} menunggu, ${approvedCount} disetujui, ${rejectedCount} ditolak`}
                role="img"
              >
                <div style={{ position: "absolute", inset: 10, borderRadius: "50%", background: "#0a0a10", boxShadow: "inset 0 1px 3px rgba(255,255,255,0.06)" }} />
                <b style={{ position: "relative", zIndex: 1, fontSize: 22, fontWeight: 800, letterSpacing: "-0.025em", color: "#fff", fontVariantNumeric: "tabular-nums" }}>{items.length}</b>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 13, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "rgba(255,255,255,0.6)" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: "#a5b4fc" }} />
                  Menunggu <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: 15, color: "#fff", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{pendingCount}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "rgba(255,255,255,0.6)" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: "#34d399" }} />
                  Disetujui <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: 15, color: "#fff", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{approvedCount}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "rgba(255,255,255,0.6)" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: "#fb7185" }} />
                  Ditolak <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: 15, color: "#fff", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{rejectedCount}</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>Total hari cuti terpakai</span>
              <span style={{ fontSize: 26, fontWeight: 800, color: "#f2a93b", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em" }}>{totalDays}</span>
            </div>
            {pendingCount === 0 && activeTab === "pending" && (
              <div style={{ marginTop: 22, padding: "14px 16px", borderRadius: 16, fontSize: 12.5, fontWeight: 600, color: "#6ee7b7", background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.14)", display: "flex", alignItems: "center", gap: 10 }}>
                <IconCheck /> Semua permohonan sudah diproses
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ═══ AIDA: Action — Reject Modal (glass) ═══ */}
      {rejectModal && (
        <div
          onClick={() => { setRejectModal(null); setRejectionReason(""); }}
          style={{
            position: "fixed", inset: 0, zIndex: 40,
            background: "rgba(3,3,6,0.82)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
          }}
          role="dialog" aria-modal="true" aria-label="Tolak permohonan"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 440,
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 30, padding: 10, boxShadow: "0 60px 120px -40px rgba(0,0,0,0.95)",
              animation: "rise .45s cubic-bezier(0.32,0.72,0,1) both",
            }}
          >
            <div style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.006)),#0b0b12", borderRadius: 22, padding: 28, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }}>
              <h3 style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.15, color: "#fff" }}>Tolak Permohonan</h3>
              <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.45)", marginTop: 6 }}>
                Pegawai: <b style={{ color: "#fff", fontWeight: 700 }} id="m-who-name">{rejectModal.name}</b>
              </p>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", margin: "24px 0 10px" }}>
                Alasan Penolakan
              </div>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                placeholder="Jelaskan alasan penolakan secara lengkap..."
                style={{
                  width: "100%", minHeight: 100, resize: "none",
                  fontFamily: "inherit", fontSize: 13.5, color: "#fff", lineHeight: 1.55,
                  background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 16, padding: "15px 18px", outline: "none",
                  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.35)", transition: "border-color .35s cubic-bezier(0.32,0.72,0,1)",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(251,113,133,0.5)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
              />
              <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
                <button
                  onClick={() => { setRejectModal(null); setRejectionReason(""); }}
                  style={{
                    flex: 1, padding: "12px 16px", borderRadius: 9999, border: "none",
                    cursor: "pointer", fontSize: 13.5, fontWeight: 600,
                    background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)",
                    transition: "all .35s cubic-bezier(0.32,0.72,0,1)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.6)"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                >Batal</button>
                <button
                  onClick={handleReject}
                  disabled={processing}
                  style={{
                    flex: 1, padding: "12px 16px", borderRadius: 9999, border: "none",
                    cursor: processing ? "wait" : "pointer", fontSize: 13.5, fontWeight: 600,
                    background: "linear-gradient(180deg,#fb7185,#e11d48)", color: "#fff",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), 0 14px 30px -10px rgba(232,92,92,0.55)",
                    opacity: processing ? 0.6 : 1, transition: "all .35s cubic-bezier(0.32,0.72,0,1)",
                  }}
                  onMouseEnter={(e) => { if (!processing) { e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.35), 0 20px 40px -10px rgba(232,92,92,0.7)"; e.currentTarget.style.transform = "translateY(-2px)"; } }}
                  onMouseLeave={(e) => { if (!processing) { e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.35), 0 14px 30px -10px rgba(232,92,92,0.55)"; e.currentTarget.style.transform = "translateY(0)"; } }}
                >{processing ? "Menolak..." : "Tolak Permohonan"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Toast ═══ */}
      {successToast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          zIndex: 200, display: "flex", alignItems: "center", gap: 8,
          padding: "10px 20px", borderRadius: 16,
          background: "rgba(45,212,191,0.12)", border: "1px solid rgba(45,212,191,0.25)",
          color: "#2dd4bf", fontSize: 13, fontWeight: 600,
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          animation: "rise .45s cubic-bezier(0.32,0.72,0,1) both",
        }}>
          <IconCheck /> {successToast}
        </div>
      )}

      {/* ═══ Keyframes ═══ */}
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1);} 50%{opacity:0.45;transform:scale(1.3);} }
        @keyframes rise { from{opacity:0;transform:translateY(16px) scale(0.985);filter:blur(8px);} to{opacity:1;transform:translateY(0) scale(1);filter:blur(0);} }
        @media(prefers-reduced-motion:reduce){ *,*::before,*::after{animation:none!important;transition:none!important;} }
      `}</style>
    </div>
  );
}
