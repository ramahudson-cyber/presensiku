import { useState, useEffect } from "react";
import { getLeaveRequests, approveLeaveRequest, rejectLeaveRequest, countLeaveDays } from "../../services/leaveService";
import { toast } from "react-toastify";

/* ═══ Premium badge config ═══ */
const STATUS = {
  pending:   { label: "Menunggu", color: "#a5b4fc", bg: "rgba(165,180,252,0.12)", border: "rgba(165,180,252,0.2)" },
  approved:  { label: "Disetujui", color: "#34d399", bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.2)" },
  rejected:  { label: "Ditolak",  color: "#fb7185", bg: "rgba(251,113,133,0.12)", border: "rgba(251,113,133,0.2)" },
};

/* ═══ Inline Phosphor-style SVG icons ═══ */
const IconClipboard = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="4" width="10" height="16" rx="2"/><path d="M10 9h4M10 13h4M10 17h4"/></svg>;
const IconChart = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5z"/><path d="M10 15l-2-2 2-2"/><path d="M14 13l2 2-2 2"/></svg>;
const IconClock = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>;
const IconCheck = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>;
const IconX = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconCalendar = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 2v4M16 2v4M4 10h16"/></svg>;
const IconArrowRight = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
const IconCheckCircle = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 0-9 9"/><path d="M9 12l2 2 4-4"/></svg>;
const IconWarning = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>;

/* ═══ LeaveItemCard (ledger row — wide, hairline-separated, no card box) ═══ */
function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

function LeaveItemCard({ item, profile, onApprove, onRejectClick, processing }) {
  const s = STATUS[item.status] || STATUS.pending;
  const initial = (profile?.full_name || profile?.username || "P")[0].toUpperCase();
  const days = countLeaveDays(item.start_date, item.end_date);
  const name = profile?.full_name || profile?.username || "Pegawai";
  const type = item.leave_type || "izin";
  const reason = item.reason || "Tidak ada keterangan";

  return (
    <div
      style={{
        padding: "34px 0",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        transition: "background .35s cubic-bezier(0.32,0.72,0,1)",
        borderRadius: 16,
        margin: "0 -20px",
        paddingLeft: 20,
        paddingRight: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 56, height: 56, borderRadius: 16,
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "rgba(255,255,255,0.92)", fontSize: 18, fontWeight: 800,
            flexShrink: 0, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
          aria-label={`Initial ${initial}`}
        >{initial}</div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <h4 style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em", color: "rgba(255,255,255,0.92)", lineHeight: 1.2 }}>
            {name}
          </h4>
        </div>

        <span
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 16px", borderRadius: 9999, fontSize: 12,
            fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
            color: s.color, background: s.bg, border: `1px solid ${s.border}`,
            whiteSpace: "nowrap", flexShrink: 0,
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color,
            ...(item.status === "pending" ? { animation: "pulse 1.8s ease-in-out infinite" } : {}),
          }} />
          {s.label}
        </span>
      </div>

      {/* ═══ Jenis Permohonan (eksplisit) ═══ */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 20 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", flexShrink: 0 }}>
          Jenis Permohonan
        </span>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em", color: "#e8e4df" }}>
          {type === "izin" ? "Izin" : type === "sakit" ? "Sakit" : type === "cuti" ? "Cuti" : type}
        </span>
      </div>

      {/* ═══ Tanggal Mulai — Berakhir + Jumlah Hari (eksplisit) ═══ */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", flexShrink: 0 }}>
          Periode
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 15.5, fontWeight: 600, color: "rgba(255,255,255,0.9)", fontVariantNumeric: "tabular-nums" }}>
          <IconCalendar />
          <span>{fmtDate(item.start_date)}</span>
          <span style={{ color: "rgba(255,255,255,0.35)" }}>s/d</span>
          <span>{fmtDate(item.end_date)}</span>
        </span>
        <span
          style={{
            fontSize: 13.5, fontWeight: 800, letterSpacing: "0.02em", color: "#c4b5fd",
            background: "rgba(196,181,253,0.1)", border: "1px solid rgba(196,181,253,0.25)",
            padding: "5px 14px", borderRadius: 9999, fontVariantNumeric: "tabular-nums",
            marginLeft: 8,
          }}
        >
          {days} hari
        </span>
      </div>

      {/* ═══ Alasan (eksplisit) ═══ */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginTop: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", flexShrink: 0, paddingTop: 4 }}>
          Alasan
        </span>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "rgba(255,255,255,0.7)", flex: 1, maxWidth: "80ch", textWrap: "pretty" }}>
          {reason}
        </p>
      </div>

      {item.status === "rejected" && item.rejection_reason && (
        <div style={{ marginTop: 18, paddingLeft: 18, borderLeft: "2px solid rgba(251,113,133,0.45)", fontSize: 13.5, lineHeight: 1.6, color: "rgba(253,164,175,0.75)", maxWidth: "80ch" }}>
          <span style={{ fontWeight: 700, color: "rgba(232,92,92,0.7)" }}><IconWarning /></span> <b style={{ color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em", fontSize: 11 }}>Penolakan:</b> {item.rejection_reason}
        </div>
      )}

      {item.status === "pending" && (
        <div style={{ display: "flex", gap: 18, marginTop: 28 }}>
          <button
            onClick={() => onApprove(item.id)}
            disabled={processing}
            style={{
              display: "inline-flex", alignItems: "center", gap: 12,
              padding: "14px 30px 14px 22px", borderRadius: 9999,
              border: "none", cursor: processing ? "wait" : "pointer",
              fontFamily: "inherit", fontSize: 15, fontWeight: 700,
              color: "#052e1b", background: "linear-gradient(180deg,#34d399,#0ea872)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), 0 18px 36px -10px rgba(70,203,138,0.55)",
              transition: "all .35s cubic-bezier(0.32,0.72,0,1)", opacity: processing ? 0.6 : 1,
            }}
          >
            Setujui <span style={{ width: 30, height: 30, borderRadius: 9999, background: "rgba(5,46,27,0.14)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, transition: "all .35s cubic-bezier(0.32,0.72,0,1)" }}><IconCheckCircle /></span>
          </button>
          <button
            onClick={() => onRejectClick(item.id)}
            disabled={processing}
            style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "14px 30px", borderRadius: 9999,
              border: "1px solid rgba(255,255,255,0.12)", cursor: processing ? "wait" : "pointer",
              fontFamily: "inherit", fontSize: 14.5, fontWeight: 600,
              color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.02)",
              transition: "all .35s cubic-bezier(0.32,0.72,0,1)", opacity: processing ? 0.6 : 1,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.6)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
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
        width: "100%", padding: "16px 0 60px", position: "relative",
      }}
    >

      {/* ═══ AIDA: Attention — Editorial Hero (laptop-wide, no meta-labels) ═══ */}
      <section style={{ padding: "40px 0 28px" }} aria-label="Hero">
        <h1
          style={{
            fontSize: "clamp(4.2rem,8vw,7.5rem)", lineHeight: 1.02,
            letterSpacing: "-0.05em", fontWeight: 800, maxWidth: "80rem",
            textWrap: "balance", color: "#fff",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.2)", display: "block", letterSpacing: "-0.04em" }}>Kelola semua</span>
          <span style={{ display: "block" }}>permohonan cuti</span>
        </h1>
        <p style={{ marginTop: 24, fontSize: 18, lineHeight: 1.55, color: "#9a9692", maxWidth: "60ch", textWrap: "pretty" }}>
          Admin melihat, menyetujui, atau menolak setiap permohonan izin, cuti, dan sakit secara real-time dari seluruh pegawai.
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 44 }}>
          <a
            href="#workbench"
            style={{
              display: "inline-flex", alignItems: "center", gap: 14,
              padding: "20px 40px", borderRadius: 9999,
              fontFamily: "inherit", fontSize: 16, fontWeight: 700,
              color: "#052e1b", background: "linear-gradient(180deg,#34d399,#0ea872)",
              border: "none", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), 0 24px 52px -14px rgba(70,203,138,0.55)",
              textDecoration: "none", transition: "all .35s cubic-bezier(0.32,0.72,0,1)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.35), 0 32px 64px -12px rgba(70,203,138,0.65)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.35), 0 24px 52px -14px rgba(70,203,138,0.55)"; }}
          >
            Proses Menunggu <span style={{ width: 32, height: 32, borderRadius: 9999, background: "rgba(5,46,27,0.14)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}><IconArrowRight /></span>
          </a>
          <a
            href="#summary"
            style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "20px 34px", borderRadius: 9999,
              fontFamily: "inherit", fontSize: 15, fontWeight: 600,
              color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.12)", textDecoration: "none",
              transition: "all .35s cubic-bezier(0.32,0.72,0,1)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.6)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
          >
            Lihat Ringkasan
          </a>
        </div>
      </section>

      {/* ═══ AIDA: Interest — Gapless Bento Stats (wide, big numbers) ═══ */}
      <section id="stats" aria-label="Status overview" style={{ marginBottom: 36 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "2px" }}>
          <article
            style={{ padding: "40px 32px", background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, gridColumn: "span 2", transition: "all .4s cubic-bezier(0.32,0.72,0,1)" }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.background = "rgba(255,255,255,0.015)"; }}
          >
            <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: "#a5b4fc" }}>{pendingCount}</div>
            <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,0.4)", fontWeight: 700, marginTop: 14, display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ color: "rgba(255,255,255,0.5)" }}><IconClock /></span> Menunggu
            </div>
            <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.3)", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>butuh keputusan</div>
          </article>

          <article style={{ padding: "40px 32px", background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, transition: "all .4s cubic-bezier(0.32,0.72,0,1)" }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: "#34d399" }}>{approvedCount}</div>
            <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,0.4)", fontWeight: 700, marginTop: 14, display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ color: "rgba(255,255,255,0.5)" }}><IconCheck /></span> Disetujui
            </div>
            <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.3)", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>bulan ini</div>
          </article>

          <article style={{ padding: "40px 32px", background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, transition: "all .4s cubic-bezier(0.32,0.72,0,1)" }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: "#fb7185" }}>{rejectedCount}</div>
            <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,0.4)", fontWeight: 700, marginTop: 14, display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ color: "rgba(255,255,255,0.5)" }}><IconX /></span> Ditolak
            </div>
            <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.3)", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>bulan ini</div>
          </article>

          <article style={{ padding: "40px 32px", background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, transition: "all .4s cubic-bezier(0.32,0.72,0,1)" }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: "#f2a93b" }}>{totalDays}</div>
            <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,0.4)", fontWeight: 700, marginTop: 14, display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ color: "rgba(255,255,255,0.5)" }}><IconCalendar /></span> Total Hari
            </div>
            <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.3)", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>terpakai semua</div>
          </article>
        </div>
      </section>

      {/* ═══ AIDA: Desire — Ledger Workbench (laptop-split: wide list + summary) ═══ */}
      <div id="workbench" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.7fr) 480px", gap: 32, alignItems: "start" }}>

        {/* LEFT: Ledger list */}
        <section aria-label="Permohonan menunggu" style={{
          background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 32,
          padding: 20, boxShadow: "0 50px 100px -40px rgba(0,0,0,0.9)", overflow: "hidden",
        }}>
          <div style={{
            background: "linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.005) 40%),rgba(10,10,14,0.92)",
            borderRadius: 24, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)", overflow: "hidden",
          }}>
            <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "32px 36px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "rgba(255,255,255,0.8)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)" }}>
                <IconClipboard />
              </div>
              <div>
                <b style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.2, color: "#fff" }}>
                  {activeTab === "pending" ? "Permohonan Menunggu" : "Semua Permohonan"}
                </b>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontWeight: 500, marginTop: 4 }}>{items.length} permohonan</p>
              </div>
              <span style={{ marginLeft: "auto", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.4)", fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>
                {pendingCount > 0 ? `${pendingCount} / ${items.length}` : items.length}
              </span>
            </header>

            <div style={{ padding: "4px 36px 16px" }}>
              {loading ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#9a9692", fontSize: 15 }}>Memuat data...</div>
              ) : items.length === 0 ? (
                <div style={{ textAlign: "center", padding: "72px 24px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, color: "rgba(255,255,255,0.3)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)", marginBottom: 24 }}>
                    <IconClipboard />
                  </div>
                  <b style={{ fontSize: 17, fontWeight: 800, color: "rgba(255,255,255,0.88)", letterSpacing: "-0.01em" }}>Tidak ada permohonan</b>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginTop: 8, maxWidth: "32ch", lineHeight: 1.55 }}>
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

        {/* RIGHT: Sticky summary */}
        <aside id="summary" aria-label="Ringkasan panel" style={{
          position: "sticky", top: 28,
          background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 32, padding: 14,
          boxShadow: "0 50px 100px -40px rgba(0,0,0,0.9)", overflow: "hidden",
        }}>
          <div style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.006)),#0b0b12", borderRadius: 24, padding: 32, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }}>
            <header style={{ display: "flex", alignItems: "center", gap: 16, paddingBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "rgba(255,255,255,0.8)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }}>
                <IconChart />
              </div>
              <div>
                <b style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.2, color: "#fff" }}>Ringkasan</b>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontWeight: 500, marginTop: 4 }}>Status bulan ini</p>
              </div>
            </header>

            <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 18 }}>
              <div
                style={{ width: 130, height: 130, borderRadius: "50%", flexShrink: 0,
                  background: "conic-gradient(#f2a93b 0 22%,#c4b5fd 22% 43%,rgba(255,255,255,0.06) 43% 73%,rgba(255,255,255,0.06) 73% 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center", position: "relative", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }}
                aria-label={`Total ${items.length} permohonan: ${pendingCount} menunggu, ${approvedCount} disetujui, ${rejectedCount} ditolak`}
                role="img"
              >
                <div style={{ position: "absolute", inset: 12, borderRadius: "50%", background: "#0a0a10", boxShadow: "inset 0 1px 3px rgba(255,255,255,0.06)" }} />
                <b style={{ position: "relative", zIndex: 1, fontSize: 28, fontWeight: 800, letterSpacing: "-0.025em", color: "#fff", fontVariantNumeric: "tabular-nums" }}>{items.length}</b>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 16, color: "rgba(255,255,255,0.6)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: "#a5b4fc" }} />
                  Menunggu <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: 20, color: "#fff", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{pendingCount}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 16, color: "rgba(255,255,255,0.6)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: "#34d399" }} />
                  Disetujui <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: 20, color: "#fff", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{approvedCount}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 16, color: "rgba(255,255,255,0.6)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: "#fb7185" }} />
                  Ditolak <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: 20, color: "#fff", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{rejectedCount}</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 28, paddingTop: 22, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>Total hari cuti terpakai</span>
              <span style={{ fontSize: 34, fontWeight: 800, color: "#f2a93b", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em" }}>{totalDays}</span>
            </div>
            {pendingCount === 0 && activeTab === "pending" && (
              <div style={{ marginTop: 24, padding: "16px 18px", borderRadius: 18, fontSize: 14, fontWeight: 600, color: "#6ee7b7", background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.14)", display: "flex", alignItems: "center", gap: 12 }}>
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
            display: "flex", alignItems: "center", justifyContent: "center", padding: 28,
          }}
          role="dialog" aria-modal="true" aria-label="Tolak permohonan"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 500,
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 34, padding: 12, boxShadow: "0 70px 140px -40px rgba(0,0,0,0.95)",
              animation: "rise .45s cubic-bezier(0.32,0.72,0,1) both",
            }}
          >
            <div style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.006)),#0b0b12", borderRadius: 26, padding: 32, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }}>
              <h3 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.15, color: "#fff" }}>Tolak Permohonan</h3>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginTop: 8 }}>
                Pegawai: <b style={{ color: "#fff", fontWeight: 700 }} id="m-who-name">{rejectModal.name}</b>
              </p>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", margin: "28px 0 12px" }}>
                Alasan Penolakan
              </div>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                placeholder="Jelaskan alasan penolakan secara lengkap..."
                style={{
                  width: "100%", minHeight: 110, resize: "none",
                  fontFamily: "inherit", fontSize: 15, color: "#fff", lineHeight: 1.55,
                  background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: 18, padding: "18px 22px", outline: "none",
                  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)", transition: "border-color .35s cubic-bezier(0.32,0.72,0,1)",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(251,113,133,0.5)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)"; }}
              />
              <div style={{ display: "flex", gap: 14, marginTop: 28 }}>
                <button
                  onClick={() => { setRejectModal(null); setRejectionReason(""); }}
                  style={{
                    flex: 1, padding: "14px 20px", borderRadius: 9999, border: "none",
                    cursor: "pointer", fontSize: 14.5, fontWeight: 600,
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
                    flex: 1, padding: "14px 20px", borderRadius: 9999, border: "none",
                    cursor: processing ? "wait" : "pointer", fontSize: 14.5, fontWeight: 600,
                    background: "linear-gradient(180deg,#fb7185,#e11d48)", color: "#fff",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), 0 18px 36px -10px rgba(232,92,92,0.6)",
                    opacity: processing ? 0.6 : 1, transition: "all .35s cubic-bezier(0.32,0.72,0,1)",
                  }}
                  onMouseEnter={(e) => { if (!processing) { e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.35), 0 28px 50px -10px rgba(232,92,92,0.8)"; e.currentTarget.style.transform = "translateY(-2px)"; } }}
                  onMouseLeave={(e) => { if (!processing) { e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.35), 0 18px 36px -10px rgba(232,92,92,0.6)"; e.currentTarget.style.transform = "translateY(0)"; } }}
                >{processing ? "Menolak..." : "Tolak Permohonan"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {successToast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          zIndex: 200, display: "flex", alignItems: "center", gap: 10,
          padding: "12px 24px", borderRadius: 18,
          background: "rgba(45,212,191,0.12)", border: "1px solid rgba(45,212,191,0.25)",
          color: "#2dd4bf", fontSize: 14, fontWeight: 600,
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          animation: "rise .45s cubic-bezier(0.32,0.72,0,1) both",
        }}>
          <IconCheck /> {successToast}
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1);} 50%{opacity:0.45;transform:scale(1.3);} }
        @keyframes rise { from{opacity:0;transform:translateY(16px) scale(0.985);filter:blur(8px);} to{opacity:1;transform:translateY(0) scale(1);filter:blur(0);} }
        @media(prefers-reduced-motion:reduce){ *,*::before,*::after{animation:none!important;transition:none!important;} }
      `}</style>
    </div>
  );
}
