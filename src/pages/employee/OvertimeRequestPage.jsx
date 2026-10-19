// src/pages/employee/OvertimeRequestPage.jsx
// Halaman lembur pegawai: ajukan lembur + riwayat + status pembayaran.
// Pola UI mengikuti LeaveRequestPage (token T light-mode per DESIGN.md).
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import {
  createOvertimeRequest,
  getMyOvertimeRequests,
  cancelOvertimeRequest,
  getOvertimeConfig,
} from "../../services/overtimeService";
import usePullToRefresh from "../../hooks/usePullToRefresh";
import PullToRefreshIndicator from "../../components/PullToRefreshIndicator";
import ProfileAvatarButton from "../../components/ProfileAvatarButton";

// Light-mode tokens — per DESIGN.md (pola LeaveRequestPage)
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
  iconBg: '#F5F3FF',
};

const STATUS = {
  pending: { label: "Menunggu", color: "#F59E0B", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.25)" },
  approved: { label: "Disetujui", color: "#10B981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.25)" },
  rejected: { label: "Ditolak", color: "#EF4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.25)" },
};

const DAY_NAMES = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

const fmtDay = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  return DAY_NAMES[d.getDay()] + ", " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
};

const rupiah = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");

const todayStr = () => {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};

export default function OvertimeRequestPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [config, setConfig] = useState({ rate_per_hour: 15000, min_minutes: 30, max_hours_per_day: 4 });
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [loading, setLoading] = useState(false);

  const [date, setDate] = useState(todayStr());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");

  const loadRequests = async () => {
    try {
      setFetchError("");
      const data = await getMyOvertimeRequests();
      setRequests(data || []);
    } catch (e) {
      setFetchError(e.message || "Gagal memuat data");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    // setTimeout: muat lewat task terpisah — setState sinkron di body effect
    // memicu cascading render (pola AttendanceHistoryPage).
    const kick = setTimeout(loadRequests, 0);
    const kickCfg = setTimeout(() => getOvertimeConfig().then(setConfig).catch(() => {}), 0);
    return () => { clearTimeout(kick); clearTimeout(kickCfg); };
  }, [user?.id]);

  const { pullDistance, isRefreshing } = usePullToRefresh(loadRequests);

  const durationLabel = useMemo(() => {
    if (!startTime || !endTime) return null;
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const mins = eh * 60 + em - (sh * 60 + sm);
    if (!Number.isFinite(mins)) return null;
    if (mins <= 0) return { error: "Jam selesai harus setelah jam mulai" };
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    return { label: (hours ? hours + " jam " : "") + (rem ? rem + " menit" : ""), mins };
  }, [startTime, endTime]);

  const stats = useMemo(() => {
    const approved = requests.filter(r => r.status === "approved");
    return {
      pending: requests.filter(r => r.status === "pending").length,
      approved: approved.length,
      totalPay: approved.reduce((s, r) => s + Number(r.pay_amount || 0), 0),
    };
  }, [requests]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date) return toast.error("Tanggal wajib diisi", { position: "bottom-center" });
    if (!startTime || !endTime) return toast.error("Jam mulai & selesai wajib diisi", { position: "bottom-center" });
    if (durationLabel?.error) return toast.error(durationLabel.error, { position: "bottom-center" });
    if (durationLabel.mins < config.min_minutes) {
      return toast.error(`Durasi lembur minimal ${config.min_minutes} menit`, { position: "bottom-center" });
    }
    if (durationLabel.mins / 60 > config.max_hours_per_day) {
      return toast.error(`Lembur maksimal ${config.max_hours_per_day} jam per hari`, { position: "bottom-center" });
    }
    if (!reason.trim()) return toast.error("Alasan wajib diisi", { position: "bottom-center" });

    setLoading(true);
    try {
      await createOvertimeRequest({ date, start_time: startTime, end_time: endTime, reason });
      toast.success("Pengajuan lembur terkirim, menunggu persetujuan admin", { position: "bottom-center" });
      setStartTime(""); setEndTime(""); setReason("");
      await loadRequests();
    } catch (err) {
      toast.error(err.message || "Gagal mengirim pengajuan", { position: "bottom-center" });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm("Batalkan pengajuan lembur ini?")) return;
    try {
      await cancelOvertimeRequest(id);
      toast.success("Pengajuan dibatalkan", { position: "bottom-center" });
      await loadRequests();
    } catch (err) {
      toast.error(err.message || "Gagal membatalkan", { position: "bottom-center" });
    }
  };

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
    { label: "Menunggu", value: stats.pending, color: "#F59E0B" },
    { label: "Disetujui", value: stats.approved, color: "#10B981" },
    { label: "Total Uang", value: rupiah(stats.totalPay), color: "#BF00FF", small: true },
  ];

  return (
    <div className="min-h-screen w-full font-sans absolute top-0 left-0 right-0 pb-24" style={{ background: T.bg, color: T.text }}>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      {/* ── HEADER ── */}
      <div className="pt-14 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-[17px] font-bold tracking-tight" style={{ color: T.text }}>Lembur</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ProfileAvatarButton user={user} initials={initials} />
            <span className="text-[9px] font-medium leading-none max-w-[72px] truncate text-center" style={{ color: T.sub }}>
              {user?.position || user?.role || "Pegawai"}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 mt-6 space-y-4">
        {/* ─── STAT CARDS ─── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {statCards.map((st) => (
            <div key={st.label} className="rounded-2xl p-3"
              style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                {st.label}
              </span>
              <div style={{ fontSize: st.small ? 13 : 22, fontWeight: 800, color: st.color, lineHeight: 1.2, fontVariantNumeric: "tabular-nums", marginTop: 4 }}>
                {st.value}
              </div>
            </div>
          ))}
        </div>

        {/* ─── FORM AJUKAN ─── */}
        <div className="rounded-3xl p-6" style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, paddingBottom: 14, borderBottom: `1px solid ${T.div}` }}>
            <div style={{ width: 3, height: 18, borderRadius: 2, background: "linear-gradient(180deg, #BF00FF, #9900CC)" }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Ajukan Lembur</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: T.textSec, display: "block", marginBottom: 6 }}>Tanggal</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} required />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: T.textSec, display: "block", marginBottom: 6 }}>Jam Mulai</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={inputStyle} required />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: T.textSec, display: "block", marginBottom: 6 }}>Jam Selesai</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={inputStyle} required />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: T.textSec, display: "block", marginBottom: 6 }}>Alasan</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                placeholder="Contoh: menyelesaikan laporan rekam medis"
                style={{ ...inputStyle, resize: "none" }} required />
            </div>

            {durationLabel && !durationLabel.error && (
              <div className="rounded-2xl px-4 py-3" style={{ background: T.iconBg, border: "1px solid rgba(191,0,255,0.15)" }}>
                <p style={{ fontSize: 12, color: T.text }}>
                  <b>Durasi:</b> {durationLabel.label}
                </p>
                <p style={{ fontSize: 11, color: T.sub, marginTop: 2 }}>
                  Uang lembur dihitung setelah admin menyetujui (tarif saat ini {rupiah(config.rate_per_hour)}/jam).
                </p>
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{
                width: "100%", padding: "14px", border: "none", borderRadius: 14,
                background: "linear-gradient(135deg, #BF00FF, #9900CC)", color: "#fff",
                fontSize: 14, fontWeight: 700, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1,
              }}>
              {loading ? "Mengirim…" : "Kirim Pengajuan"}
            </button>
          </form>
        </div>

        {/* ─── RIWAYAT ─── */}
        <div className="rounded-3xl p-6" style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${T.div}` }}>
            <div style={{ width: 3, height: 18, borderRadius: 2, background: "linear-gradient(180deg, #BF00FF, #9900CC)" }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Riwayat Lembur</span>
          </div>

          {fetchError && <p style={{ fontSize: 12, color: "#EF4444", marginBottom: 10 }}>{fetchError}</p>}
          {fetching ? (
            <p style={{ fontSize: 12, color: T.textMuted, textAlign: "center", padding: "20px 0" }}>Memuat…</p>
          ) : requests.length === 0 ? (
            <p style={{ fontSize: 12, color: T.textMuted, textAlign: "center", padding: "20px 0" }}>
              Belum ada pengajuan lembur.
            </p>
          ) : (
            <div className="space-y-2.5">
              {requests.map((r) => {
                const st = STATUS[r.status] || STATUS.pending;
                return (
                  <div key={r.id} className="rounded-2xl p-3.5"
                    style={{ background: T.rowBg || "rgba(15,23,42,0.02)", border: `1px solid ${T.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>{fmtDay(r.date)}</p>
                        <p style={{ fontSize: 11.5, color: T.textSec, marginTop: 2 }}>
                          {r.start_time} – {r.end_time} · {Number(r.requested_hours).toLocaleString("id-ID")} jam
                        </p>
                      </div>
                      <span style={{
                        fontSize: 9.5, fontWeight: 700, padding: "4px 10px", borderRadius: 99,
                        color: st.color, background: st.bg, border: `1px solid ${st.border}`, flexShrink: 0,
                      }}>{st.label}</span>
                    </div>

                    {r.reason && (
                      <p style={{ fontSize: 11, color: T.sub, marginTop: 6, fontStyle: "italic" }}>"{r.reason}"</p>
                    )}
                    {r.status === "approved" && (
                      <p style={{ fontSize: 11, color: "#10B981", fontWeight: 700, marginTop: 6 }}>
                        Dibayar: {Number(r.approved_hours).toLocaleString("id-ID")} jam × {rupiah(r.pay_rate_per_hour)}/jam = <b>{rupiah(r.pay_amount)}</b>
                      </p>
                    )}
                    {r.status === "rejected" && r.rejection_reason && (
                      <p style={{ fontSize: 11, color: "#EF4444", marginTop: 6 }}>Alasan: {r.rejection_reason}</p>
                    )}

                    {r.status === "pending" && (
                      <button onClick={() => handleCancel(r.id)}
                        style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: "#EF4444", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                        Batalkan pengajuan
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
