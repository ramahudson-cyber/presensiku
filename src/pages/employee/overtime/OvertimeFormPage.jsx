// src/pages/employee/overtime/OvertimeFormPage.jsx
// Form pengajuan lembur. Validasi mengikuti pengaturan server:
// minimal menit, maksimal jam/hari, dan lembur lintas tengah malam <= 06.00.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { createOvertimeRequest, getOvertimeConfig } from "../../../services/overtimeService";
import {
  OT, Icon, LightAppBar, rupiah, durationLabel, fmtDate,
} from "./overtimeUi";

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const fieldStyle = {
  width: "100%", background: "#fff", border: `1px solid ${OT.border}`,
  borderRadius: 14, padding: "12px 14px", color: OT.text, fontSize: 14,
  outline: "none", fontFamily: "inherit",
};

export default function OvertimeFormPage() {
  const navigate = useNavigate();

  const [config, setConfig] = useState({ rate_per_hour: 15000, min_minutes: 30, max_hours_per_day: 4 });
  const [date, setDate] = useState(todayStr());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    getOvertimeConfig().then((c) => { if (alive) setConfig(c); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const duration = useMemo(() => {
    if (!startTime || !endTime) return null;
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    let mins = eh * 60 + em - (sh * 60 + sm);
    if (!Number.isFinite(mins)) return null;
    if (mins === 0) return { error: "Jam selesai tidak boleh sama dengan jam mulai" };
    const crosses = mins < 0;
    if (crosses && eh * 60 + em > 6 * 60) {
      return { error: "Lembur lintas tengah malam maksimal sampai jam 06.00" };
    }
    if (crosses) mins += 24 * 60;
    return { mins, crosses };
  }, [startTime, endTime]);

  const submit = async (e) => {
    e.preventDefault();
    if (!date) return toast.error("Tanggal wajib diisi", { position: "bottom-center" });
    if (!startTime || !endTime) return toast.error("Jam mulai dan selesai wajib diisi", { position: "bottom-center" });
    if (duration?.error) return toast.error(duration.error, { position: "bottom-center" });
    if (!duration) return toast.error("Lengkapi jam lembur", { position: "bottom-center" });
    if (duration.mins < config.min_minutes) {
      return toast.error(`Durasi lembur minimal ${config.min_minutes} menit`, { position: "bottom-center" });
    }
    if (duration.mins / 60 > config.max_hours_per_day) {
      return toast.error(`Lembur maksimal ${config.max_hours_per_day} jam per hari`, { position: "bottom-center" });
    }
    if (!reason.trim()) return toast.error("Alasan lembur wajib diisi", { position: "bottom-center" });

    const ok = window.confirm(
      `Kirim pengajuan lembur ${fmtDate(date)} ${startTime} - ${endTime}?`
    );
    if (!ok) return;

    setSaving(true);
    try {
      await createOvertimeRequest({ date, start_time: startTime, end_time: endTime, reason: reason.trim() });
      toast.success("Pengajuan lembur terkirim, menunggu persetujuan atasan", { position: "bottom-center" });
      navigate("/employee/overtime", { replace: true });
    } catch (err) {
      toast.error(err.message || "Gagal mengirim pengajuan", { position: "bottom-center" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-x-0 top-0" style={{ minHeight: "100vh", background: OT.bg, color: OT.text }}>
      <div className="mx-auto w-full max-w-md">
        <LightAppBar title="Ajukan Lembur" onBack={() => navigate(-1)} />

        <form onSubmit={submit} className="px-4 pb-10">
          <div className="flex items-start gap-2.5" style={{
            background: OT.iconBg, borderRadius: 14, padding: "12px 14px",
          }}>
            <Icon.info style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, lineHeight: 1.5, color: "#1D4ED8", fontWeight: 600 }}>
              Pengajuan lembur akan diproses oleh atasan sesuai ketentuan yang berlaku.
            </p>
          </div>

          <div style={{ marginTop: 12 }}>
            <label htmlFor="ot-date" style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              Tanggal lembur
            </label>
            <input id="ot-date" type="date" value={date} onChange={(e) => setDate(e.target.value)}
              style={fieldStyle} required />
          </div>

          <div className="grid grid-cols-2 gap-3" style={{ marginTop: 12 }}>
            <div>
              <label htmlFor="ot-start" style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Waktu mulai
              </label>
              <input id="ot-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                style={fieldStyle} required />
            </div>
            <div>
              <label htmlFor="ot-end" style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Waktu selesai
              </label>
              <input id="ot-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                style={fieldStyle} required />
            </div>
          </div>

          {duration && (
            <div className="flex items-center gap-2" style={{
              marginTop: 12, background: duration.error ? "rgba(239,68,68,0.08)" : OT.iconBg,
              borderRadius: 14, padding: "10px 14px",
            }}>
              <span style={{ color: duration.error ? "#EF4444" : OT.brand, flexShrink: 0 }}>
                <Icon.clock size={15} sw={2.2} />
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: duration.error ? "#EF4444" : OT.brand }}>
                {duration.error
                  ? duration.error
                  : `Estimasi durasi: ${durationLabel(duration.mins / 60)}${duration.crosses ? " (selesai besok)" : ""}`}
              </span>
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <label htmlFor="ot-reason" style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              Alasan lembur
            </label>
            <textarea id="ot-reason" rows={4} maxLength={500} value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: menyelesaikan laporan kegiatan pelayanan"
              style={{ ...fieldStyle, resize: "none" }} required />
            <p style={{ textAlign: "right", fontSize: 10.5, color: OT.textMuted, marginTop: 4, fontWeight: 600 }}>
              {reason.length}/500
            </p>
          </div>

          <div style={{
            marginTop: 8, background: "#FFF7ED", border: "1px solid rgba(245,158,11,0.25)",
            borderRadius: 14, padding: "12px 14px",
          }}>
            <p style={{ fontSize: 11.5, lineHeight: 1.55, color: OT.textSec }}>
              <b style={{ color: OT.text }}>Penting:</b> uang lembur hanya dibayar bila Anda tetap
              melakukan absen pulang pada hari lembur. Lembur tanpa absen pulang tidak dibayarkan.
            </p>
            <p style={{ fontSize: 11.5, lineHeight: 1.55, color: OT.textSec, marginTop: 6 }}>
              Tarif saat ini {rupiah(config.rate_per_hour)} per jam, dihitung setelah pengajuan disetujui.
            </p>
          </div>

          <button type="submit" disabled={saving}
            className="w-full flex items-center justify-center gap-2 active:scale-[0.99] transition"
            style={{
              marginTop: 18, height: 48, borderRadius: 16, border: "none",
              background: "linear-gradient(135deg, #2F8BF8, #1F74E0)", color: "#fff",
              fontSize: 16, fontWeight: 700, boxShadow: OT.shadow,
              cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1,
            }}>
            <Icon.send size={17} />
            {saving ? "Mengirim..." : "Kirim Pengajuan"}
          </button>
        </form>
      </div>
    </div>
  );
}
