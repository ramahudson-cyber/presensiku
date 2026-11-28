// src/pages/employee/overtime/OvertimeRequestSheet.jsx
// Bottom sheet pengajuan lembur dari dashboard. Validasi dan RPC memakai
// aturan yang sama dengan halaman /employee/overtime/request.
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../../../context/AuthContext";
import { createOvertimeRequest, getOvertimeConfig, uploadOvertimeEvidence } from "../../../services/overtimeService";
import { OT, Icon, durationLabel } from "./overtimeUi";

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function OvertimeRequestSheet({ open, onClose, onSubmitted }) {
  const { user } = useAuth();
  const [config, setConfig] = useState({ rate_per_hour: 15000, min_minutes: 30, max_hours_per_day: 4 });
  const [date, setDate] = useState(todayStr());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [photo, setPhoto] = useState(null);

  const dialogRef = useRef(null);
  const fileInputRef = useRef(null);
  const photoUrlRef = useRef(null);

  useEffect(() => {
    let alive = true;
    getOvertimeConfig().then((c) => { if (alive) setConfig(c); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus({ preventScroll: true }), 320);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  useEffect(() => () => {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
  }, []);

  const duration = useMemo(() => {
    if (!startTime || !endTime) return null;
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    let mins = eh * 60 + em - (sh * 60 + sm);
    if (!Number.isFinite(mins)) return null;
    if (mins === 0) return { error: "Jam selesai tidak boleh sama dengan jam mulai." };
    const crosses = mins < 0;
    if (crosses && eh * 60 + em > 6 * 60) {
      return { error: "Lembur lintas tengah malam maksimal sampai jam 06.00." };
    }
    if (crosses) mins += 24 * 60;
    return { mins, crosses };
  }, [startTime, endTime]);

  const durationText = !startTime || !endTime
    ? "Isi waktu mulai dan selesai untuk melihat estimasi durasi."
    : duration?.error || `Estimasi durasi ${durationLabel(duration.mins / 60)}${duration.crosses ? " (selesai besok)" : ""}`;
  const durationError = Boolean(startTime && endTime && (duration?.error || duration && (
    duration.mins < config.min_minutes || duration.mins / 60 > config.max_hours_per_day
  )));

  const clearPhoto = () => {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    photoUrlRef.current = null;
    setPhoto(null);
  };

  const onPickPhoto = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Format foto tidak didukung");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran foto maksimal 5MB");
      return;
    }
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    const url = URL.createObjectURL(file);
    photoUrlRef.current = url;
    setPhoto({ url, name: file.name, file });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!date) return toast.error("Tanggal wajib diisi");
    if (!startTime || !endTime) return toast.error("Jam mulai dan selesai wajib diisi");
    if (duration?.error) return toast.error(duration.error);
    if (!duration) return toast.error("Lengkapi jam lembur");
    if (duration.mins < config.min_minutes) return toast.error(`Durasi lembur minimal ${config.min_minutes} menit`);
    if (duration.mins / 60 > config.max_hours_per_day) return toast.error(`Lembur maksimal ${config.max_hours_per_day} jam per hari`);
    if (!reason.trim()) return toast.error("Alasan lembur wajib diisi");

    setSaving(true);
    try {
      let attachmentUrl = null;
      if (photo?.file) {
        attachmentUrl = await uploadOvertimeEvidence(user?.id, photo.file);
      }
      await createOvertimeRequest({
        date, start_time: startTime, end_time: endTime, reason: reason.trim(), attachmentUrl,
      });
      toast.success("Pengajuan lembur terkirim, menunggu persetujuan atasan");
      setSuccess(true);
    } catch (err) {
      toast.error(err.message || "Gagal mengirim pengajuan");
    } finally {
      setSaving(false);
    }
  };

  const finish = () => {
    setSuccess(false);
    setDate(todayStr());
    setStartTime("");
    setEndTime("");
    setReason("");
    clearPhoto();
    onClose();
    onSubmitted?.();
  };

  const fieldClass = "w-full h-11 mt-1.5 px-3.5 rounded-[13px] border border-[#E2E8F0] bg-white text-[13px] outline-none transition focus:border-[#2F8BF8] focus:ring-2 focus:ring-[#2F8BF8]/10";

  // Pola kartu pemilih tanggal/waktu mengikuti halaman Pengajuan Izin & Sakit:
  // label kecil di atas input transparan di dalam kartu lembut, bukan input kotak.
  const pickerCard = {
    background: "#F8FAFD", border: "1.5px solid rgba(31,41,55,0.08)",
    borderRadius: 16, padding: "10px 12px", boxShadow: OT.shadow,
  };
  const pickerInput = {
    width: "100%", border: "none", background: "transparent", fontFamily: "inherit",
    fontSize: 12, fontWeight: 700, color: OT.text, outline: "none", padding: 0,
  };
  const pickerLabel = { display: "block", fontSize: 9.5, fontWeight: 700, color: OT.textMuted, marginBottom: 3 };
  const durationReady = Boolean(duration && !duration.error
    && duration.mins >= config.min_minutes && duration.mins / 60 <= config.max_hours_per_day);
  const durationBadge = !startTime || !endTime
    ? "Isi waktu"
    : durationError ? "Periksa waktu" : durationLabel(duration.mins / 60);

  return (
    <div className={`fixed inset-0 z-50 flex items-end justify-center transition-opacity duration-200 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      aria-hidden={!open} inert={!open}>
      <div className="absolute inset-0" style={{ background: "rgba(15,23,42,0.46)" }} onClick={onClose} />

      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="ot-sheet-title" tabIndex={-1}
        className={`relative w-full max-w-md bg-white flex flex-col transition-transform duration-300 ${open ? "translate-y-0" : "translate-y-full"}`}
        style={{
          height: "min(92dvh, 790px)",
          borderRadius: "28px 28px 0 0",
          boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
          outline: "none",
        }}>
        <div className="flex justify-center pt-2.5 pb-1 cursor-pointer" onClick={onClose} aria-hidden="true">
          <span style={{ width: 44, height: 5, borderRadius: 999, background: "#E2E8F0" }} />
        </div>

        <header className="flex items-center gap-3 px-5 pb-3.5" style={{ paddingTop: 6 }}>
          <div className="flex-1 min-w-0">
            <h2 id="ot-sheet-title" style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", color: OT.text }}>
              Ajukan Lembur
            </h2>
            <p style={{ fontSize: 11.5, color: OT.textMuted, marginTop: 3 }}>Isi detail lembur Anda</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup formulir"
            className="flex items-center justify-center rounded-full border border-[#E2E8F0] bg-[#F8FAFC] active:scale-95 transition"
            style={{ width: 34, height: 34, color: OT.textSec, flex: "none" }}>
            <Icon.close size={16} sw={1.8} />
          </button>
        </header>
        <div style={{ height: 1, background: OT.divider, flex: "none" }} />

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3.5" style={{ overscrollBehavior: "contain" }}>
          <div className="flex gap-2 items-start rounded-[14px] px-3 py-2.5" style={{ background: OT.iconBg }}>
            <span style={{ color: "#0B3A66", flex: "none", marginTop: 1 }}><Icon.info /></span>
            <p style={{ fontSize: 11.5, lineHeight: 1.5, color: "#0B3A66" }}>
              <strong>Pengajuan Anda akan ditinjau atasan.</strong> Status dapat dilihat di halaman Riwayat setelah dikirim.
            </p>
          </div>

          <form id="ot-sheet-form" onSubmit={submit} noValidate>
            <div style={{ marginTop: 15 }}>
              <div className="flex items-center justify-between gap-2.5">
                <span style={{ fontSize: 12, fontWeight: 800, color: OT.text }}>Waktu lembur</span>
                <span style={{
                  flex: "none", fontSize: 10, fontWeight: 800, color: "#FFFFFF",
                  background: durationError ? "#EF4444" : durationReady ? "#10B981" : OT.brand,
                  borderRadius: 999, padding: "5px 11px", whiteSpace: "nowrap",
                  boxShadow: "0 1px 2px rgba(47,139,248,0.12)",
                }}>{durationBadge}</span>
              </div>

              <div style={{ ...pickerCard, marginTop: 9 }}>
                <label htmlFor="ot-sheet-date" style={pickerLabel}>Tanggal lembur</label>
                <input id="ot-sheet-date" type="date" value={date}
                  onChange={(e) => setDate(e.target.value)} style={pickerInput} />
              </div>

              <div className="grid grid-cols-2 gap-3" style={{ marginTop: 10 }}>
                <div style={pickerCard}>
                  <label htmlFor="ot-sheet-start" style={pickerLabel}>Mulai</label>
                  <input id="ot-sheet-start" type="time" value={startTime}
                    onChange={(e) => setStartTime(e.target.value)} style={pickerInput} />
                </div>
                <div style={pickerCard}>
                  <label htmlFor="ot-sheet-end" style={pickerLabel}>Selesai</label>
                  <input id="ot-sheet-end" type="time" value={endTime}
                    onChange={(e) => setEndTime(e.target.value)} style={pickerInput} />
                </div>
              </div>

              <div className="flex gap-2 items-start" style={{ marginTop: 9 }}>
                <span style={{ flex: "none", marginTop: 1, color: durationError ? "#DC2626" : OT.brand }}><Icon.clock size={15} sw={1.7} /></span>
                <p style={{
                  fontSize: 11, lineHeight: 1.5,
                  color: durationError ? "#DC2626" : durationReady ? "#0B3A66" : OT.textSec,
                }}>{durationText}</p>
              </div>
            </div>

            <div style={{ marginTop: 15 }}>
              <div className="flex items-center justify-between gap-2.5">
                <label htmlFor="ot-sheet-reason" style={{ fontSize: 12, fontWeight: 700, color: OT.text }}>Alasan lembur</label>
                <span style={{ fontSize: 10.5, color: OT.textMuted }}>{reason.length}/500</span>
              </div>
              <textarea id="ot-sheet-reason" rows={4} maxLength={500} value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Contoh: menyelesaikan laporan kegiatan pelayanan"
                className={`${fieldClass} h-[88px] min-h-[88px] py-2.5 leading-relaxed resize-none placeholder:text-[#94A3B8]`} />
            </div>

            <div style={{ marginTop: 15 }}>
              <span className="block" style={{ fontSize: 12, fontWeight: 700, color: OT.text }}>Dokumentasi Kegiatan</span>
              <span className="block" style={{ fontSize: 10.5, color: OT.textMuted, marginTop: 2 }}>(Opsional)</span>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={onPickPhoto} className="hidden" />
              <div className="grid grid-cols-2 gap-2.5" style={{ marginTop: 8 }}>
                {photo ? (
                  <div className="relative overflow-hidden" style={{ height: 88, border: `1px solid ${OT.border}`, borderRadius: 14, background: "#EEF2F8" }}>
                    <img src={photo.url} alt="Pratinjau dokumentasi kegiatan" className="w-full h-full object-cover" />
                    <button type="button" onClick={clearPhoto} aria-label="Hapus foto dokumentasi"
                      className="absolute flex items-center justify-center rounded-full text-white active:scale-95 transition"
                      style={{ top: 7, right: 7, width: 24, height: 24, background: "#29406C", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                      <Icon.close size={12} sw={2.2} />
                    </button>
                  </div>
                ) : null}
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-1 border border-dashed border-[#CBD5E1] rounded-[14px] bg-[#F8FAFD] text-[#64748B] active:scale-[0.99] transition ${photo ? "" : "col-span-2"}`}
                  style={{ height: 88 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 7h3l1.5-2h7L17 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
                    <circle cx="12" cy="13" r="3.5" />
                  </svg>
                  <span className="text-center" style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.25 }}>Tambah<br />Foto</span>
                </button>
              </div>
              <p style={{ fontSize: 10, color: OT.textMuted, marginTop: 6 }}>
                Format JPG, PNG, atau WebP, maksimal 5MB.
              </p>
            </div>
          </form>

          <div className="flex gap-2 items-start rounded-[14px] px-3 py-2.5" style={{ marginTop: 15, background: "#FFFBEB", border: "1px solid #FEF3C7" }}>
            <span style={{ flex: "none", marginTop: 1, color: "#92400E" }}><Icon.info size={16} sw={1.7} /></span>
            <div style={{ fontSize: 11, lineHeight: 1.5, color: "#92400E" }}>
              <p>Uang lembur hanya dibayar bila Anda tetap melakukan absen pulang pada hari lembur.</p>
            </div>
          </div>
        </div>

        <footer className="flex items-center gap-2.5 px-5" style={{ paddingTop: 11, paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))", borderTop: `1px solid ${OT.divider}`, flex: "none" }}>
          <button type="button" onClick={onClose}
            className="flex-none rounded-[13px] border border-[#E2E8F0] bg-white active:scale-[0.99] transition"
            style={{ height: 46, padding: "0 17px", fontSize: 13, fontWeight: 700, color: OT.textSec }}>
            Batal
          </button>
          <button type="submit" form="ot-sheet-form" disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 rounded-[13px] text-white active:scale-[0.99] transition disabled:opacity-60"
            style={{
              height: 46, border: "none", fontSize: 13.5, fontWeight: 700,
              background: "linear-gradient(135deg, #2F8BF8, #1F74E0)",
              boxShadow: "0 1px 2px rgba(47,139,248,0.12)", cursor: saving ? "wait" : "pointer",
            }}>
            <Icon.send size={16} sw={1.8} />
            {saving ? "Mengirim..." : "Kirim Pengajuan"}
          </button>
        </footer>

        <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center bg-white px-7 text-center transition-opacity duration-200 ${success ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
          role="status" aria-live="polite">
          <span className="flex items-center justify-center rounded-full" style={{ width: 66, height: 66, background: "rgba(16,185,129,0.12)", color: "#10B981" }}>
            <Icon.check size={32} sw={2} />
          </span>
          <h3 style={{ marginTop: 17, fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: OT.text }}>Pengajuan terkirim</h3>
          <p style={{ marginTop: 8, maxWidth: 240, fontSize: 12.5, lineHeight: 1.6, color: OT.textSec }}>
            Pengajuan lembur Anda menunggu persetujuan atasan.
          </p>
          <button type="button" onClick={finish}
            className="flex-none rounded-[13px] text-white active:scale-[0.99] transition"
            style={{
              marginTop: 22, width: "100%", maxWidth: 250, height: 46, border: "none",
              fontSize: 13.5, fontWeight: 700,
              background: "linear-gradient(135deg, #2F8BF8, #1F74E0)",
              boxShadow: "0 1px 2px rgba(47,139,248,0.12)",
            }}>
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}
