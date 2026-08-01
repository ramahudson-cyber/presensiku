import { useState, useEffect } from "react";
import { getLeaveRequests, approveLeaveRequest, rejectLeaveRequest, countLeaveDays } from "../../services/leaveService";

// Premium badge config
const STATUS = {
  pending:   { label: "Menunggu", color: "#a5b4fc", bg: "rgba(165,180,252,0.12)", border: "rgba(165,180,252,0.2)" },
  approved:  { label: "Disetujui", color: "#2dd4bf", bg: "rgba(45,212,191,0.12)", border: "rgba(45,212,191,0.2)" },
  rejected:  { label: "Ditolak",  color: "#fda4af", bg: "rgba(253,164,175,0.12)", border: "rgba(253,164,175,0.2)" },
};

const TABS = [
  { id: "pending", label: "Menunggu", badge: true },
  { id: "all",     label: "Semua" },
];
function LeaveItemCard({ item, profile, onApprove, onRejectClick, processing }) {
  const s = STATUS[item.status] || STATUS.pending;
  const initial = (profile?.full_name || profile?.username || "P")[0].toUpperCase();

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 16, padding: 14, marginBottom: 10,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg,#5800fd,#2415c6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 14, fontWeight: 700, flexShrink: 0,
            border: "1px solid rgba(255,255,255,0.15)",
          }}>{initial}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
              {profile?.full_name || profile?.username || "Pegawai"}
            </div>
            <div style={{ fontSize: 10, color: "#9ba1ae", marginTop: 1 }}>
              {new Date(item.start_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
              {" — "}
              {new Date(item.end_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
              {" (" + countLeaveDays(item.start_date, item.end_date) + " hari)"}
            </div>
          </div>
        </div>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "3px 10px", borderRadius: 9999, fontSize: 10, fontWeight: 700,
          color: s.color, background: s.bg, border: "1px solid " + s.border,
          textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap",
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%", background: s.color,
            ...(item.status === "pending" ? { animation: "pulse 1.5s ease-in-out infinite" } : {}),
          }}/>
          {s.label}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#c5c5d2" }}>{item.leave_type}</span>
      </div>
      <div style={{ fontSize: 12, color: "#9ba1ae", lineHeight: 1.5, marginBottom: 8 }}>
        {item.reason}
      </div>
      {item.status === "rejected" && item.rejection_reason && (
        <div style={{
          fontSize: 11, color: "#fda4af", marginTop: 6, padding: "8px 12px",
          background: "rgba(253,164,175,0.08)", borderRadius: 10,
          border: "1px solid rgba(253,164,175,0.15)",
        }}>Alasan penolakan: {item.rejection_reason}</div>
      )}
      {item.status === "pending" && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            onClick={() => onApprove(item.id)}
            disabled={processing}
            style={{
              flex: 1, padding: "9px 14px", borderRadius: 12, border: "none",
              cursor: processing ? "wait" : "pointer",
              background: "linear-gradient(135deg,#059669,#10b981)",
              color: "#fff", fontSize: 12, fontWeight: 700,
              boxShadow: "0 4px 14px rgba(16,185,129,0.3)",
              transition: "all .2s", opacity: processing ? 0.6 : 1,
            }}
          >Setujui</button>
          <button
            onClick={() => onRejectClick(item.id)}
            disabled={processing}
            style={{
              flex: 1, padding: "9px 14px", borderRadius: 12, border: "none",
              cursor: processing ? "wait" : "pointer",
              background: "linear-gradient(135deg,#e11d48,#fb7185)",
              color: "#fff", fontSize: 12, fontWeight: 700,
              boxShadow: "0 4px 14px rgba(244,63,94,0.3)",
              transition: "all .2s", opacity: processing ? 0.6 : 1,
            }}
          >Tolak</button>
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
      const data = activeTab === "pending"
        ? await getLeaveRequests("pending")
        : await getLeaveRequests(null);
      setItems(data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => { load(); }, [activeTab]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

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
      setSuccessToast((data.message || "Disetujui") + extra);
      await load();
      setTimeout(() => setSuccessToast(""), 4000);
    } catch (e) {
      alert(e.message || "Gagal menyetujui");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) { alert("Alasan penolakan wajib diisi"); return; }
    try {
      setProcessing(true);
      await rejectLeaveRequest(rejectModal.id, rejectionReason.trim());
      setSuccessToast("Permohonan ditolak");
      setRejectModal(null);
      setRejectionReason("");
      await load();
      setTimeout(() => setSuccessToast(""), 4000);
    } catch (e) {
      alert(e.message || "Gagal menolak");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16, padding: 16 }}>

      {/* TOAST */}
      {successToast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          zIndex: 200, display: "flex", alignItems: "center", gap: 8,
          padding: "10px 20px", borderRadius: 16,
          background: "rgba(45,212,191,0.12)",
          border: "1px solid rgba(45,212,191,0.25)",
          color: "#2dd4bf", fontSize: 13, fontWeight: 600,
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          {successToast}
        </div>
      )}

      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Cuti & Izin</h1>
          <p style={{ fontSize: 11, color: "#9ba1ae", marginTop: 2 }}>Kelola permohonan cuti, izin, dan sakit</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "8px 18px", borderRadius: 9999, fontSize: 13, fontWeight: 600,
                border: "none", cursor: "pointer", transition: "all .2s",
                background: activeTab === tab.id ? "#5800fd" : "rgba(255,255,255,0.06)",
                color: activeTab === tab.id ? "#fff" : "#9ba1ae",
                boxShadow: activeTab === tab.id ? "0 4px 15px rgba(88,0,253,0.35)" : "none",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              {tab.label}
              {tab.badge && pendingCount > 0 && (
                <span style={{
                  background: "rgba(255,255,255,0.2)", padding: "1px 8px",
                  borderRadius: 9999, fontSize: 11,
                }}>{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* GRID: LIST (left) | STATS (right) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

        {/* LEFT: Request list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{
            background: "#161320", borderRadius: 20, padding: 18,
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 12,
                background: "rgba(88,0,253,0.15)", color: "#7066ed",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
              }}>📋</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                  {activeTab === "pending" ? "Permohonan Menunggu" : "Semua Permohonan"}
                </div>
                <div style={{ fontSize: 11, color: "#9ba1ae", marginTop: 1 }}>
                  {items.length} permohonan
                </div>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "#9ba1ae", fontSize: 13 }}>
                Memuat data...
              </div>
            ) : items.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div style={{ fontSize: 28, opacity: 0.3, marginBottom: 8 }}>📭</div>
                <div style={{ fontSize: 12, color: "#9ba1ae" }}>
                  {activeTab === "pending" ? "Tidak ada permohonan pending." : "Belum ada permohonan."}
                </div>
              </div>
            ) : (
              <div>
                {items.map((item) => {
                  const profile = item.profiles;
                  return (
                    <LeaveItemCard
                      key={item.id} item={item} profile={profile}
                      onApprove={handleApprove}
                      onRejectClick={(id) => { setRejectModal({ id, name: profile?.full_name || "Pegawai" }); setRejectionReason(""); }}
                      processing={processing}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Stats */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{
            background: "#161320", borderRadius: 20, padding: 18,
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 12,
                background: "rgba(88,0,253,0.15)", color: "#7066ed",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
              }}>📊</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Ringkasan</div>
                <div style={{ fontSize: 11, color: "#9ba1ae", marginTop: 1 }}>Total permohonan bulan ini</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Menunggu", value: pendingCount, icon: "⏳", color: "#a5b4fc" },
                { label: "Disetujui", value: approvedCount, icon: "✅", color: "#2dd4bf" },
                { label: "Ditolak",  value: rejectedCount, icon: "❌", color: "#fda4af" },
                { label: "Total Hari", value: totalDays, icon: "📅", color: "#c084fc" },
              ].map((st) => (
                <div key={st.label} style={{
                  textAlign: "center", padding: 14,
                  background: "#161320", borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{st.icon}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: st.color }}>{st.value}</div>
                  <div style={{ fontSize: 10, color: "#9ba1ae", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.5px" }}>{st.label}</div>
                </div>
              ))}
            </div>
          </div>

          {pendingCount === 0 && activeTab === "pending" && (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <div style={{ fontSize: 24, opacity: 0.3, marginBottom: 6 }}>✅</div>
              <div style={{ fontSize: 12, color: "#9ba1ae" }}>Semua permohonan sudah diproses</div>
            </div>
          )}
        </div>
      </div>

      {/* REJECT MODAL */}
      {rejectModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div style={{
            background: "#1a1528", borderRadius: 24, padding: 24,
            width: "100%", maxWidth: 420,
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Tolak Permohonan</div>
            <div style={{ fontSize: 12, color: "#9ba1ae", marginBottom: 14 }}>
              Pegawai: <span style={{ color: "#fff", fontWeight: 600 }}>{rejectModal.name}</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: "#9ba1ae",
                textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6,
              }}>Alasan Penolakan</div>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows="3" placeholder="Berikan alasan penolakan..."
                style={{
                  width: "100%", background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14,
                  padding: "12px 14px", color: "#fff", fontSize: 14,
                  outline: "none", resize: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                onClick={() => { setRejectModal(null); setRejectionReason(""); }}
                style={{
                  flex: 1, padding: 12, borderRadius: 14, border: "none",
                  cursor: "pointer", fontSize: 13, fontWeight: 600,
                  background: "rgba(255,255,255,0.06)", color: "#9ba1ae",
                }}
              >Batal</button>
              <button
                onClick={handleReject}
                disabled={processing}
                style={{
                  flex: 1, padding: 12, borderRadius: 14, border: "none",
                  cursor: processing ? "wait" : "pointer",
                  fontSize: 13, fontWeight: 600,
                  background: "linear-gradient(135deg,#e11d48,#fb7185)",
                  color: "#fff", opacity: processing ? 0.6 : 1,
                }}
              >{processing ? "Menolak..." : "Tolak"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
