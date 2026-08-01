import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  LEAVE_TYPES,
  createLeaveRequest,
  getMyLeaveRequests,
  cancelLeaveRequest,
  countLeaveDays,
} from "../../services/leaveService";

// ─── Premium badge config ───
const STATUS = {
  pending:   { label: "Menunggu", color: "#a5b4fc", bg: "rgba(165,180,252,0.12)", border: "rgba(165,180,252,0.2)" },
  approved:  { label: "Disetujui", color: "#2dd4bf", bg: "rgba(45,212,191,0.12)", border: "rgba(45,212,191,0.2)" },
  rejected:  { label: "Ditolak",  color: "#fda4af", bg: "rgba(253,164,175,0.12)", border: "rgba(253,164,175,0.2)" },
};

// ─── Helper: initials ───
function getInitial(name) {
  return (name || "?").charAt(0).toUpperCase();
}

export default function LeaveRequestPage() {
  const { user, loading: authLoading } = useAuth();

  // ==== HOOKS (before early return — React #310) ====
  const [formType, setFormType] = useState("izin");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [requests, setRequests] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [cancelId, setCancelId] = useState(null);
  const [filterTab, setFilterTab] = useState("semua");

  // Stats from real data
  const approvedCount = useMemo(() => requests.filter(r => r.status === "approved").length, [requests]);
  const pendingCount   = useMemo(() => requests.filter(r => r.status === "pending").length, [requests]);
  const rejectedCount  = useMemo(() => requests.filter(r => r.status === "rejected").length, [requests]);
  const totalDays      = useMemo(() => requests.reduce((sum, r) => sum + (r.total_days || countLeaveDays(r.start_date, r.end_date)), 0), [requests]);

  // Computed day count for form
  const dayCount = useMemo(() => {
    if (startDate && endDate && endDate >= startDate) return countLeaveDays(startDate, endDate);
    return 0;
  }, [startDate, endDate]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    if (filterTab === "pending") return requests.filter(r => r.status === "pending");
    return requests;
  }, [requests, filterTab]);

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
    if (!startDate || !endDate) { setFormError("Tanggal wajib diisi"); return; }
    if (endDate < startDate) { setFormError("Tanggal selesai tidak boleh sebelum tanggal mulai"); return; }
    if (!reason.trim()) { setFormError("Alasan wajib diisi"); return; }
    setLoading(true);
    try {
      await createLeaveRequest({ userId: user.id, type: formType, startDate, endDate, reason });
      setSuccessMsg("Permohonan berhasil dikirim (pending)");
      setFormType("izin"); setStartDate(""); setEndDate(""); setReason("");
      await loadRequests();
    } catch (err) {
      setFormError(err.message || "Gagal mengirim permohonan");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Batalkan permohonan ini?")) { setCancelId(null); return; }
    try {
      await cancelLeaveRequest(cancelId);
      setSuccessMsg("Permohonan berhasil dibatalkan");
      await loadRequests();
    } catch (err) {
      setFormError(err.message || "Gagal membatalkan");
    }
    setCancelId(null);
  };

  // Guard: after hooks
  if (authLoading) {
    return (
      <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
        <p style={{ fontSize: 14, color: "#9ba1ae" }}>Memuat...</p>
      </div>
    );
  }
  if (!user) {
    return (
      <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
        <p style={{ fontSize: 14, color: "#9ba1ae" }}>Silakan login untuk mengakses halaman ini.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16, padding: 16 }}>

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

      {/* GRID: FORM+RIWAYAT (left) | STATS (right) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* FORM CARD */}
          <div style={{
            background: "#161320", borderRadius: 20, padding: 18,
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 12,
                background: "rgba(88,0,253,0.15)", color: "#7066ed",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
              }}>📝</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Ajukan Permohonan</div>
                <div style={{ fontSize: 11, color: "#9ba1ae", marginTop: 1 }}>Izin, sakit, atau cuti</div>
              </div>
            </div>

            {successMsg && (
              <div style={{
                marginBottom: 12, padding: "10px 14px", borderRadius: 12,
                background: "rgba(45,212,191,0.1)", border: "1px solid rgba(45,212,191,0.2)",
                color: "#2dd4bf", fontSize: 13,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                {successMsg}
              </div>
            )}
            {formError && (
              <div style={{
                marginBottom: 12, padding: "10px 14px", borderRadius: 12,
                background: "rgba(253,164,175,0.1)", border: "1px solid rgba(253,164,175,0.2)",
                color: "#fda4af", fontSize: 13,
              }}>{formError}</div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 12 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: "#9ba1ae",
                  textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6,
                }}>Jenis Permohonan</div>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  style={{
                    width: "100%", background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14,
                    padding: "11px 14px", color: "#fff", fontSize: 14, outline: "none",
                    appearance: "none",
                    backgroundImage: "url('data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ba1ae' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E')",
                    backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
                    paddingRight: 36,
                  }}
                >
                  {LEAVE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: "#9ba1ae",
                    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6,
                  }}>Tanggal Mulai</div>
                  <input
                    type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    min={todayStr}
                    style={{
                      width: "100%", background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14,
                      padding: "11px 14px", color: "#fff", fontSize: 14, outline: "none",
                      colorScheme: "dark",
                    }}
                  />
                </div>
                <div>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: "#9ba1ae",
                    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6,
                  }}>Tanggal Selesai</div>
                  <input
                    type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || todayStr}
                    style={{
                      width: "100%", background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14,
                      padding: "11px 14px", color: "#fff", fontSize: 14, outline: "none",
                      colorScheme: "dark",
                    }}
                  />
                </div>
              </div>

              {dayCount > 0 && (
                <div style={{ fontSize: 10, color: "#7066ed", fontWeight: 600, marginBottom: 12 }}>
                  Total: {dayCount} hari
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: "#9ba1ae",
                  textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6,
                }}>Alasan</div>
                <textarea
                  value={reason} onChange={(e) => setReason(e.target.value)}
                  rows="3" placeholder="Contoh: Keperluan keluarga..."
                  style={{
                    width: "100%", background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14,
                    padding: "11px 14px", color: "#fff", fontSize: 14, outline: "none",
                    resize: "none",
                  }}
                />
              </div>

              <button
                type="submit" disabled={loading}
                style={{
                  width: "100%", padding: 13,
                  background: "linear-gradient(135deg,#5800fd,#2415c6)",
                  color: "#fff", border: "none", borderRadius: 9999,
                  fontSize: 14, fontWeight: 700, cursor: loading ? "wait" : "pointer",
                  boxShadow: "0 4px 20px rgba(88,0,253,0.3)", transition: "all .2s",
                  opacity: loading ? 0.6 : 1,
                }}
              >{loading ? "Mengirim..." : "Kirim Permohonan"}</button>
            </form>
          </div>

          {/* RIWAYAT CARD */}
          <div style={{
            background: "rgba(88,0,253,0.03)",
            border: "1px solid rgba(88,0,253,0.15)",
            borderRadius: 20, padding: 18,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 12,
                  background: "rgba(88,0,253,0.15)", color: "#7066ed",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
                }}>📋</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Riwayat Permohonan</div>
                  <div style={{ fontSize: 11, color: "#9ba1ae", marginTop: 1 }}>{requests.length} permohonan bulan ini</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 3, border: "1px solid rgba(255,255,255,0.05)" }}>
                <button
                  onClick={() => setFilterTab("semua")}
                  style={{
                    padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontSize: 11, fontWeight: 600,
                    background: filterTab === "semua" ? "rgba(88,0,253,0.15)" : "transparent",
                    color: filterTab === "semua" ? "#fff" : "#9ba1ae",
                  }}
                >Semua</button>
                <button
                  onClick={() => setFilterTab("pending")}
                  style={{
                    padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontSize: 11, fontWeight: 600,
                    background: filterTab === "pending" ? "rgba(88,0,253,0.15)" : "transparent",
                    color: filterTab === "pending" ? "#fff" : "#9ba1ae",
                  }}
                >Pending</button>
              </div>
            </div>

            {fetchError ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: "#fda4af", fontSize: 13 }}>{fetchError}</div>
            ) : fetching ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: "#9ba1ae", fontSize: 13 }}>Memuat...</div>
            ) : filteredRequests.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 24, opacity: 0.3, marginBottom: 6 }}>📭</div>
                <div style={{ fontSize: 12, color: "#9ba1ae" }}>
                  {filterTab === "pending" ? "Tidak ada permohonan pending." : "Belum ada permohonan."}
                </div>
              </div>
            ) : (
              <div>
                {filteredRequests.map((r) => {
                  const s = STATUS[r.status] || STATUS.pending;
                  return (
                    <div key={r.id} style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 14, padding: 12, marginBottom: 8,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{
                            width: 8, height: 8, borderRadius: "50%",
                            background: s.color, flexShrink: 0,
                            ...(r.status === "pending" ? { boxShadow: "0 0 8px " + s.color } : {}),
                          }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{r.leave_type}</span>
                          <span style={{
                            padding: "2px 8px", borderRadius: 9999, fontSize: 10, fontWeight: 700,
                            color: s.color, background: s.bg, border: "1px solid " + s.border,
                            textTransform: "uppercase",
                          }}>{s.label}</span>
                        </div>
                        {r.status === "pending" && (
                          <button
                            onClick={() => { setCancelId(r.id); handleCancel(); }}
                            style={{
                              padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(253,164,175,0.2)",
                              background: "rgba(253,164,175,0.06)", color: "#fda4af",
                              fontSize: 10, fontWeight: 600, cursor: "pointer",
                            }}
                          >Batal</button>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "#9ba1ae", marginBottom: 2 }}>
                        {new Date(r.start_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                        {" — "}
                        {new Date(r.end_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                        {" (" + countLeaveDays(r.start_date, r.end_date) + " hari)"}
                      </div>
                      <div style={{ fontSize: 12, color: "#c5c5d2", lineHeight: 1.5 }}>{r.reason}</div>
                      {r.status === "rejected" && r.rejection_reason && (
                        <div style={{
                          fontSize: 11, color: "#fda4af", marginTop: 6, padding: "6px 10px",
                          background: "rgba(253,164,175,0.08)", borderRadius: 8,
                          border: "1px solid rgba(253,164,175,0.15)",
                        }}>Alasan penolakan: {r.rejection_reason}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Stats */}
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
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Statistik Bulan Ini</div>
                <div style={{ fontSize: 11, color: "#9ba1ae", marginTop: 1 }}>Ringkasan kehadiran</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Disetujui", value: approvedCount, icon: "✅", color: "#2dd4bf", glow: "rgba(45,212,191,0.15)" },
                { label: "Menunggu",  value: pendingCount,  icon: "⏳", color: "#a5b4fc", glow: "rgba(165,180,252,0.15)" },
                { label: "Ditolak",   value: rejectedCount, icon: "❌", color: "#fda4af", glow: "rgba(253,164,175,0.15)" },
                { label: "Total Hari", value: totalDays,     icon: "📅", color: "#c084fc", glow: "rgba(192,132,252,0.15)" },
              ].map((st) => (
                <div key={st.label} style={{
                  textAlign: "center", padding: 14,
                  background: "#161320", borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{st.icon}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: st.color }}>{st.value}</div>
                  <div style={{
                    fontSize: 10, color: "#9ba1ae", marginTop: 2,
                    textTransform: "uppercase", letterSpacing: "0.5px",
                  }}>{st.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
