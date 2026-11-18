// src/pages/employee/overtime/OvertimeDetailPage.jsx
// Detail pengajuan/riwayat lembur: status, rincian, timeline persetujuan.
// Semua isi dari overtime_requests; tidak ada data contoh.
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  getMyOvertimeRequest, cancelOvertimeRequest,
} from "../../../services/overtimeService";
import {
  OT, Icon, StatusBadge, STATUS, LightAppBar, Loader, ErrorState,
  rupiah, durationLabel, fmtDate, fmtDateTime,
} from "./overtimeUi";

const HERO = {
  approved: { bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.25)", color: "#10B981" },
  pending: { bg: OT.iconBg, border: "rgba(47,139,248,0.15)", color: OT.brand },
  rejected: { bg: "rgba(239,68,68,0.07)", border: "rgba(239,68,68,0.20)", color: "#EF4444" },
};

function TimelineStep({ done, label, time, note, last }) {
  return (
    <div style={{ display: "flex", gap: 12, position: "relative", paddingBottom: last ? 0 : 18 }}>
      {!last && (
        <span style={{
          position: "absolute", left: 13, top: 30, bottom: 0, width: 2,
          background: done ? "#10B981" : OT.divider, borderRadius: 2,
        }} />
      )}
      <span className="flex items-center justify-center shrink-0" style={{
        width: 28, height: 28, borderRadius: "50%", position: "relative", zIndex: 1,
        background: done ? "#10B981" : OT.divider, color: done ? "#fff" : OT.textMuted,
      }}>
        {done ? <Icon.check size={13} sw={3.2} /> : <Icon.clock size={13} sw={2.4} />}
      </span>
      <span className="min-w-0">
        <b style={{ display: "block", fontSize: 13, fontWeight: 700 }}>{label}</b>
        {time && <span style={{ display: "block", fontSize: 11, color: OT.textSec, marginTop: 2 }}>{time}</span>}
        {note && <span style={{ display: "block", fontSize: 10.5, color: OT.textMuted, marginTop: 1 }}>{note}</span>}
      </span>
    </div>
  );
}

export default function OvertimeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [req, setReq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getMyOvertimeRequest(id);
      if (!data) throw new Error("Pengajuan tidak ditemukan");
      setReq(data);
    } catch (e) {
      setError(e.message || "Gagal memuat detail pengajuan");
      setReq(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const kick = setTimeout(load, 0);
    return () => clearTimeout(kick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const cancel = async () => {
    if (!window.confirm("Batalkan pengajuan lembur ini?")) return;
    setCancelling(true);
    try {
      await cancelOvertimeRequest(req.id);
      toast.success("Pengajuan dibatalkan", { position: "bottom-center" });
      navigate("/employee/overtime", { replace: true });
    } catch (e) {
      toast.error(e.message || "Gagal membatalkan pengajuan", { position: "bottom-center" });
    } finally {
      setCancelling(false);
    }
  };

  const st = req ? (STATUS[req.status] || STATUS.pending) : STATUS.pending;
  const hero = HERO[req?.status] || HERO.pending;
  const rawTitle = req?.reason?.trim() ? req.reason.trim() : "Pengajuan lembur";
  const title = rawTitle.length > 70 ? `${rawTitle.slice(0, 70).trimEnd()}...` : rawTitle;

  return (
    <div className="absolute inset-x-0 top-0" style={{ minHeight: "100vh", background: OT.bg, color: OT.text }}>
      <div className="mx-auto w-full max-w-md">
        <LightAppBar title={req?.status === "pending" ? "Detail Pengajuan" : "Detail Riwayat"} onBack={() => navigate(-1)} />

        <div className="px-4 pb-10">
          {loading ? (
            <Loader label="Memuat detail..." />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : (
            <>
              {/* Banner status */}
              <div style={{
                background: hero.bg, border: `1px solid ${hero.border}`,
                borderRadius: 24, padding: 20,
              }}>
                <StatusBadge status={req.status} />
                <p style={{ fontSize: 16, fontWeight: 800, marginTop: 10, letterSpacing: "-0.01em", lineHeight: 1.35 }}>
                  {title}
                </p>
                <p style={{ fontSize: 11, color: OT.textSec, marginTop: 4 }}>
                  {fmtDate(req.date)} • {req.start_time} - {req.end_time}
                </p>
              </div>

              {/* Rincian */}
              <div style={{
                background: "#fff", border: `1px solid ${OT.border}`, borderRadius: 24,
                padding: "4px 16px", marginTop: 14, boxShadow: OT.shadow,
              }}>
                {[
                  { icon: <Icon.calendar size={16} />, label: "Tanggal", value: fmtDate(req.date) },
                  {
                    icon: <Icon.clock size={16} />, label: "Waktu",
                    value: `${req.start_time} - ${req.end_time} (${durationLabel(req.requested_hours)})`,
                  },
                  { icon: <Icon.doc size={16} />, label: "Alasan", value: req.reason || "-" },
                  ...(req.attachment_url
                    ? [{
                      icon: <Icon.doc size={16} />, label: "Dokumentasi",
                      value: (
                        <a href={req.attachment_url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-2"
                          style={{ color: OT.brand, textDecoration: "none" }}>
                          <img src={req.attachment_url} alt="Foto dokumentasi lembur"
                            style={{ width: 44, height: 36, objectFit: "cover", borderRadius: 8 }} />
                          <span style={{ fontSize: 12.5, fontWeight: 700 }}>Lihat foto</span>
                        </a>
                      ),
                    }]
                    : []),
                  ...(req.status === "approved"
                    ? [{
                      icon: <Icon.wallet size={16} />, label: "Uang lembur",
                      value: `${durationLabel(req.approved_hours)} × ${rupiah(req.pay_rate_per_hour)}/jam = ${rupiah(req.pay_amount)}`,
                    }]
                    : []),
                  ...(req.status === "rejected" && req.rejection_reason
                    ? [{ icon: <Icon.info size={16} style={{ flexShrink: 0 }} />, label: "Alasan penolakan", value: req.rejection_reason }]
                    : []),
                ].map((row) => (
                  <div key={row.label} style={{
                    display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 0",
                    borderTop: row.label === "Tanggal" ? "none" : `1px solid ${OT.divider}`,
                  }}>
                    <span className="flex items-center justify-center shrink-0" style={{
                      width: 36, height: 36, borderRadius: 12, background: OT.iconBg, color: OT.brand,
                    }}>{row.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span style={{ display: "block", fontSize: 10.5, fontWeight: 600, color: OT.textMuted }}>
                        {row.label}
                      </span>
                      <span style={{ display: "block", fontSize: 13, fontWeight: 700, marginTop: 2, lineHeight: 1.45 }}>
                        {row.value}
                      </span>
                    </span>
                  </div>
                ))}
              </div>

              {/* Timeline */}
              <p style={{ fontSize: 14, fontWeight: 800, margin: "20px 0 8px" }}>Timeline Persetujuan</p>
              <div style={{
                background: "#fff", border: `1px solid ${OT.border}`, borderRadius: 24,
                padding: 16, boxShadow: OT.shadow,
              }}>
                <TimelineStep done label="Diajukan" time={fmtDateTime(req.created_at)} />
                <TimelineStep
                  done={req.status !== "pending"}
                  label={req.status === "rejected" ? "Ditolak oleh atasan" : "Disetujui oleh atasan"}
                  time={req.approved_at ? fmtDateTime(req.approved_at) : "Menunggu keputusan atasan"}
                  last={req.status !== "approved"}
                />
                {req.status === "approved" && (
                  <TimelineStep done label="Selesai" time={fmtDateTime(req.approved_at)} last />
                )}
              </div>

              {req.status === "pending" && (
                <button type="button" onClick={cancel} disabled={cancelling}
                  className="w-full active:scale-[0.99] transition"
                  style={{
                    marginTop: 18, height: 48, borderRadius: 16, background: "#fff",
                    border: "1px solid rgba(239,68,68,0.30)", color: "#EF4444",
                    fontSize: 14, fontWeight: 700, cursor: cancelling ? "wait" : "pointer",
                    opacity: cancelling ? 0.7 : 1,
                  }}>
                  {cancelling ? "Membatalkan..." : "Batalkan Pengajuan"}
                </button>
              )}

              {req.status === "approved" && (
                <p style={{
                  marginTop: 14, fontSize: 11.5, lineHeight: 1.55, color: OT.textSec,
                  background: OT.iconBg, borderRadius: 14, padding: "12px 14px",
                }}>
                  Jam lembur yang disetujui akan masuk ke rekap kehadiran dan slip gaji bulanan.
                </p>
              )}

              <p style={{ fontSize: 10.5, color: OT.textMuted, marginTop: 14, textAlign: "center" }}>
                Status: {st.label} • diajukan {fmtDateTime(req.created_at)}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
