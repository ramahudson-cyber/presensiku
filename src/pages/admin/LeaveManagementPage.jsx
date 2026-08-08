import { useState, useEffect } from "react";
import { getLeaveRequests, approveLeaveRequest, rejectLeaveRequest, countLeaveDays } from "../../services/leaveService";
import { toast } from "react-toastify";

/* ═══ Premium badge config — light tokens ═══ */
const STATUS = {
  pending:   { label: "Menunggu", color: "#6d28d9", bg: "rgba(109,40,217,0.08)", border: "rgba(109,40,217,0.25)" },
  approved:  { label: "Disetujui", color: "#059669", bg: "rgba(5,150,105,0.08)", border: "rgba(5,150,105,0.22)" },
  rejected:  { label: "Ditolak",  color: "#e11d48", bg: "rgba(225,29,72,0.08)", border: "rgba(225,29,72,0.22)" },
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

/* ═══ Editor-style date label ═══ */
const monthLabel = new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" });

/* ═══ Decorative SVG — subtle slate rings, no glow ═══ */
const HeroOrb = () => (
  <svg width="260" height="260" viewBox="0 0 200 200" fill="none" stroke="currentColor"
    style={{ opacity: 0.35, color: "#94a3b8" }} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="100" cy="100" r="80" strokeWidth="0.6" />
    <circle cx="100" cy="100" r="58" strokeWidth="0.6" />
    <circle cx="100" cy="100" r="36" strokeWidth="0.6" />
    <path d="M 30 100 Q 60 70 100 100 Q 140 130 170 100" strokeWidth="0.8" />
    <path d="M 100 20 Q 130 60 100 100 Q 70 140 100 180" strokeWidth="0.8" />
    <circle cx="100" cy="100" r="3" fill="currentColor" strokeWidth="0" />
    <circle cx="158" cy="42" r="2.5" fill="currentColor" strokeWidth="0" />
    <circle cx="42" cy="158" r="2.5" fill="currentColor" strokeWidth="0" />
  </svg>
);

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
        borderBottom: "1px solid #eef2f7",
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
            background: "#f4f2fb", border: "1px solid #e2e8f0",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#0f172a", fontSize: 18, fontWeight: 800,
            flexShrink: 0, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)",
          }}
          aria-label={`Initial ${initial}`}
        >{initial}</div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <h4 style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em", color: "#0f172a", lineHeight: 1.2 }}>
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
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#94a3b8", flexShrink: 0 }}>
          Jenis Permohonan
        </span>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em", color: "#1e293b" }}>
          {type === "izin" ? "Izin" : type === "sakit" ? "Sakit" : type === "cuti" ? "Cuti" : type}
        </span>
      </div>

      {/* ═══ Tanggal Mulai — Berakhir + Jumlah Hari (eksplisit) ═══ */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#94a3b8", flexShrink: 0 }}>
          Periode
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 15.5, fontWeight: 600, color: "#334155", fontVariantNumeric: "tabular-nums" }}>
          <IconCalendar />
          <span>{fmtDate(item.start_date)}</span>
          <span style={{ color: "#94a3b8" }}>s/d</span>
          <span>{fmtDate(item.end_date)}</span>
        </span>
        <span
          style={{
            fontSize: 13.5, fontWeight: 800, letterSpacing: "0.02em", color: "#7c3aed",
            background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.22)",
            padding: "5px 14px", borderRadius: 9999, fontVariantNumeric: "tabular-nums",
            marginLeft: 8,
          }}
        >
          {days} hari
        </span>
      </div>

      {/* ═══ Alasan (eksplisit) ═══ */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginTop: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#94a3b8", flexShrink: 0, paddingTop: 4 }}>
          Alasan
        </span>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "#475569", flex: 1, maxWidth: "80ch", textWrap: "pretty" }}>
          {reason}
        </p>
      </div>

      {item.status === "rejected" && item.rejection_reason && (
        <div style={{ marginTop: 18, paddingLeft: 18, borderLeft: "2px solid rgba(225,29,72,0.35)", fontSize: 13.5, lineHeight: 1.6, color: "#be123c", maxWidth: "80ch" }}>
          <span style={{ fontWeight: 700, color: "#e11d48" }}><IconWarning /></span> <b style={{ color: "#64748b", letterSpacing: "0.1em", fontSize: 11 }}>Penolakan:</b> {item.rejection_reason}
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
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), 0 18px 36px -10px rgba(5,150,105,0.4)",
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
              border: "1px solid #e2e8f0", cursor: processing ? "wait" : "pointer",
              fontFamily: "inherit", fontSize: 14.5, fontWeight: 600,
              color: "#64748b", background: "#f8fafc",
              transition: "all .35s cubic-bezier(0.32,0.72,0,1)", opacity: processing ? 0.6 : 1,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#e11d48"; e.currentTarget.style.borderColor = "rgba(225,29,72,0.35)"; e.currentTarget.style.background = "#fef2f2"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#64748b"; e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#f8fafc"; }}
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

      {/* ═══ Hero — editorial, light ═══ */}
      <section style={{ padding: "32px 0 28px", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 48, alignItems: "end" }} aria-label="Hero">

        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", right: 0, top: -30, opacity: 0.5, pointerEvents: "none" }}><HeroOrb /></div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#94a3b8" }}>
            {monthLabel}
          </div>
          <h1
            style={{
              fontSize: "clamp(2.6rem,5.5vw,4.4rem)", lineHeight: 1.04,
              letterSpacing: "-0.045em", fontWeight: 800, color: "#0f172a",
              marginTop: 14, textWrap: "balance",
            }}
          >
            <span style={{ color: "#cbd5e1" }}>Permintaan</span>
            <span style={{ color: "#0f172a" }}> dari pegawai</span>
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 22, fontSize: 12.5, color: "#94a3b8", letterSpacing: "0.02em" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#059669", display: "inline-block" }} />
              {items.length} pengajuan masuk
            </span>
            <span style={{ width: 1, height: 10, background: "#e2e8f0", display: "inline-block" }} />
            <span>{pendingCount > 0 ? `${pendingCount} butuh keputusan` : "semua sudah diproses"}</span>
          </div>
        </div>

        {/* Right: single most-urgent pending preview card */}
        {items.length > 0 && (
          <div
            style={{
              padding: 22, background: "#ffffff",
              border: "1px solid #e2e8f0", borderRadius: 20,
              boxShadow: "0 16px 40px -20px rgba(15,23,42,0.18)",
              maxWidth: 440,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#94a3b8" }}>
              Paling Mendesak
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: "#f4f2fb", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", color: "#0f172a", fontSize: 13, fontWeight: 800, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)" }}>
                {(items[0].profiles?.full_name || items[0].profiles?.username || "P")[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>
                  {items[0].profiles?.full_name || items[0].profiles?.username || "Pegawai"}
                </div>
                <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 3, letterSpacing: "0.04em" }}>
                  {(items[0].leave_type || "izin") === "izin" ? "Izin" : (items[0].leave_type || "izin") === "sakit" ? "Sakit" : (items[0].leave_type || "izin")}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, fontSize: 12, color: "#64748b", fontVariantNumeric: "tabular-nums" }}>
              <span><IconCalendar /></span>
              <span>{fmtDate(items[0].start_date)} <span style={{ color: "#cbd5e1" }}>→</span> {fmtDate(items[0].end_date)}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", marginLeft: "auto", background: "rgba(124,58,237,0.08)", padding: "3px 10px", borderRadius: 9999 }}>{countLeaveDays(items[0].start_date, items[0].end_date)} hari</span>
            </div>
            <a
              href="#workbench"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18, padding: "12px 18px", borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", textDecoration: "none", color: "#475569", fontSize: 12.5, fontWeight: 600, transition: "all .35s cubic-bezier(0.32,0.72,0,1)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#f4f0ff"; e.currentTarget.style.borderColor = "rgba(124,58,237,0.3)"; e.currentTarget.style.color = "#6d28d9"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#475569"; }}
            >
              <span>Lihat &amp; Proses</span>
              <span style={{ fontSize: 13, color: "#94a3b8" }}><IconArrowRight /></span>
            </a>
          </div>
        )}
      </section>

      {/* ═══ Bento Stats — gapless, white ═══ */}
      <section id="stats" aria-label="Status overview" style={{ marginBottom: 36 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "14px" }}>
          <article
            style={{ padding: "32px 26px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 20, gridColumn: "span 2", boxShadow: "0 4px 16px rgba(15,23,42,0.06)", transition: "all .4s cubic-bezier(0.32,0.72,0,1)" }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = "rgba(124,58,237,0.3)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
          >
            <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: "#6d28d9" }}>{pendingCount}</div>
            <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.14em", color: "#64748b", fontWeight: 700, marginTop: 14, display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ color: "#c7d2fe" }}><IconClock /></span> Menunggu
            </div>
            <div style={{ fontSize: 13.5, color: "#94a3b8", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>butuh keputusan</div>
          </article>

          <article style={{ padding: "32px 26px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 20, boxShadow: "0 4px 16px rgba(15,23,42,0.06)", transition: "all .4s cubic-bezier(0.32,0.72,0,1)" }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = "rgba(5,150,105,0.3)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "#e2e8f0"; }}>
            <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: "#059669" }}>{approvedCount}</div>
            <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.14em", color: "#64748b", fontWeight: 700, marginTop: 14, display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ color: "#a7f3d0" }}><IconCheck /></span> Disetujui
            </div>
            <div style={{ fontSize: 13.5, color: "#94a3b8", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>bulan ini</div>
          </article>

          <article style={{ padding: "32px 26px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 20, boxShadow: "0 4px 16px rgba(15,23,42,0.06)", transition: "all .4s cubic-bezier(0.32,0.72,0,1)" }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = "rgba(225,29,72,0.3)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "#e2e8f0"; }}>
            <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: "#e11d48" }}>{rejectedCount}</div>
            <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.14em", color: "#64748b", fontWeight: 700, marginTop: 14, display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ color: "#fecdd3" }}><IconX /></span> Ditolak
            </div>
            <div style={{ fontSize: 13.5, color: "#94a3b8", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>bulan ini</div>
          </article>

          <article style={{ padding: "32px 26px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 20, boxShadow: "0 4px 16px rgba(15,23,42,0.06)", transition: "all .4s cubic-bezier(0.32,0.72,0,1)" }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = "rgba(245,158,11,0.35)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "#e2e8f0"; }}>
            <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: "#d97706" }}>{totalDays}</div>
            <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.14em", color: "#64748b", fontWeight: 700, marginTop: 14, display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ color: "#fde68a" }}><IconCalendar /></span> Total Hari
            </div>
            <div style={{ fontSize: 13.5, color: "#94a3b8", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>terpakai semua</div>
          </article>
        </div>
      </section>

      {/* ═══ Ledger Workbench (laptop-split: wide list + summary) ═══ */}
      <div id="workbench" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.7fr) 480px", gap: 32, alignItems: "start" }}>

        {/* LEFT: Ledger list */}
        <section aria-label="Permohonan menunggu" style={{
          background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 32,
          padding: 20, boxShadow: "0 16px 44px -24px rgba(15,23,42,0.1)", overflow: "hidden",
        }}>
          <div style={{
            background: "#fbfaff",
            borderRadius: 24, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)", overflow: "hidden",
          }}>
            <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "28px 32px 22px", borderBottom: "1px solid #eef2f7" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#f4f2fb", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#0f172a", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)" }}>
                <IconClipboard />
              </div>
              <div>
                <b style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.2, color: "#0f172a" }}>
                  {activeTab === "pending" ? "Permohonan Menunggu" : "Semua Permohonan"}
                </b>
                <p style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500, marginTop: 4 }}>{items.length} permohonan</p>
              </div>
              <span style={{ marginLeft: "auto", fontSize: 14, fontWeight: 700, color: "#64748b", fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>
                {pendingCount > 0 ? `${pendingCount} / ${items.length}` : items.length}
              </span>
            </header>

            <div style={{ padding: "4px 32px 16px" }}>
              {loading ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8", fontSize: 15 }}>Memuat data...</div>
              ) : items.length === 0 ? (
                <div style={{ textAlign: "center", padding: "72px 24px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 100, height: 100, borderRadius: "50%", background: "#f8fafc", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, color: "#94a3b8", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)", marginBottom: 24 }}>
                    <IconClipboard />
                  </div>
                  <b style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.01em" }}>Tidak ada permohonan</b>
                  <p style={{ fontSize: 14, color: "#94a3b8", marginTop: 8, maxWidth: "32ch", lineHeight: 1.55 }}>
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
          background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 32, padding: 14,
          boxShadow: "0 16px 44px -24px rgba(15,23,42,0.1)", overflow: "hidden",
        }}>
          <div style={{ background: "#fbfcfe", borderRadius: 24, padding: 28, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)" }}>
            <header style={{ display: "flex", alignItems: "center", gap: 16, paddingBottom: 22, borderBottom: "1px solid #eef2f7" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#f4f2fb", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#0f172a", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)" }}>
                <IconChart />
              </div>
              <div>
                <b style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.2, color: "#0f172a" }}>Ringkasan</b>
                <p style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500, marginTop: 4 }}>Status bulan ini</p>
              </div>
            </header>

            <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 18 }}>
              <div
                style={{ width: 130, height: 130, borderRadius: "50%", flexShrink: 0,
                  background: "conic-gradient(#f59e0b 0 22%,#7c3aed 22% 43%,#e2e8f0 43% 73%,#e2e8f0 73% 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center", position: "relative", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)" }}
                aria-label={`Total ${items.length} permohonan: ${pendingCount} menunggu, ${approvedCount} disetujui, ${rejectedCount} ditolak`}
                role="img"
              >
                <div style={{ position: "absolute", inset: 12, borderRadius: "50%", background: "#ffffff", boxShadow: "inset 0 1px 3px rgba(15,23,42,0.08)" }} />
                <b style={{ position: "relative", zIndex: 1, fontSize: 28, fontWeight: 800, letterSpacing: "-0.025em", color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>{items.length}</b>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 16, color: "#475569" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: "#7c3aed" }} />
                  Menunggu <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: 20, color: "#0f172a", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{pendingCount}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 16, color: "#475569" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: "#059669" }} />
                  Disetujui <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: 20, color: "#0f172a", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{approvedCount}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 16, color: "#475569" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: "#e11d48" }} />
                  Ditolak <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: 20, color: "#0f172a", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{rejectedCount}</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 26, paddingTop: 20, borderTop: "1px solid #eef2f7", display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12.5, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>Total hari cuti terpakai</span>
              <span style={{ fontSize: 34, fontWeight: 800, color: "#d97706", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em" }}>{totalDays}</span>
            </div>
            {pendingCount === 0 && activeTab === "pending" && (
              <div style={{ marginTop: 22, padding: "16px 18px", borderRadius: 18, fontSize: 14, fontWeight: 600, color: "#059669", background: "rgba(5,150,105,0.06)", border: "1px solid rgba(5,150,105,0.18)", display: "flex", alignItems: "center", gap: 12 }}>
                <IconCheck /> Semua permohonan sudah diproses
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ═══ Reject Modal (light) ═══ */}
      {rejectModal && (
        <div
          onClick={() => { setRejectModal(null); setRejectionReason(""); }}
          style={{
            position: "fixed", inset: 0, zIndex: 40,
            background: "rgba(15,23,42,0.45)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 28,
          }}
          role="dialog" aria-modal="true" aria-label="Tolak permohonan"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 500,
              background: "#ffffff", border: "1px solid #e2e8f0",
              borderRadius: 34, padding: 12, boxShadow: "0 40px 90px -30px rgba(15,23,42,0.35)",
              animation: "rise .45s cubic-bezier(0.32,0.72,0,1) both",
            }}
          >
            <div style={{ background: "#fbfcfe", borderRadius: 26, padding: 30, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)" }}>
              <h3 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.15, color: "#0f172a" }}>Tolak Permohonan</h3>
              <p style={{ fontSize: 14, color: "#64748b", marginTop: 8 }}>
                Pegawai: <b style={{ color: "#0f172a", fontWeight: 700 }}>{rejectModal.name}</b>
              </p>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#94a3b8", margin: "26px 0 12px" }}>
                Alasan Penolakan
              </div>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                placeholder="Jelaskan alasan penolakan secara lengkap..."
                style={{
                  width: "100%", minHeight: 110, resize: "none",
                  fontFamily: "inherit", fontSize: 15, color: "#0f172a", lineHeight: 1.55,
                  background: "#ffffff", border: "1px solid #e2e8f0",
                  borderRadius: 18, padding: "18px 22px", outline: "none",
                  boxShadow: "inset 0 1px 2px rgba(15,23,42,0.05)", transition: "border-color .35s cubic-bezier(0.32,0.72,0,1)",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(225,29,72,0.5)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; }}
              />
              <div style={{ display: "flex", gap: 14, marginTop: 26 }}>
                <button
                  onClick={() => { setRejectModal(null); setRejectionReason(""); }}
                  style={{
                    flex: 1, padding: "14px 20px", borderRadius: 9999, border: "none",
                    cursor: "pointer", fontSize: 14.5, fontWeight: 600,
                    background: "#f8fafc", color: "#64748b",
                    transition: "all .35s cubic-bezier(0.32,0.72,0,1)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#0f172a"; e.currentTarget.style.background = "#f1f5f9"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#64748b"; e.currentTarget.style.background = "#f8fafc"; }}
                >Batal</button>
                <button
                  onClick={handleReject}
                  disabled={processing}
                  style={{
                    flex: 1, padding: "14px 20px", borderRadius: 9999, border: "none",
                    cursor: processing ? "wait" : "pointer", fontSize: 14.5, fontWeight: 600,
                    background: "linear-gradient(180deg,#fb7185,#e11d48)", color: "#fff",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), 0 18px 36px -10px rgba(225,29,72,0.4)",
                    opacity: processing ? 0.6 : 1, transition: "all .35s cubic-bezier(0.32,0.72,0,1)",
                  }}
                  onMouseEnter={(e) => { if (!processing) { e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.35), 0 28px 50px -10px rgba(225,29,72,0.5)"; e.currentTarget.style.transform = "translateY(-2px)"; } }}
                  onMouseLeave={(e) => { if (!processing) { e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.35), 0 18px 36px -10px rgba(225,29,72,0.4)"; e.currentTarget.style.transform = "translateY(0)"; } }}
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
          background: "rgba(5,150,105,0.08)", border: "1px solid rgba(5,150,105,0.22)",
          color: "#059669", fontSize: 14, fontWeight: 600,
          boxShadow: "0 8px 32px rgba(15,23,42,0.15)",
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