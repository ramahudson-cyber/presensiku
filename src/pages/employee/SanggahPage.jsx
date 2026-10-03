import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import {
  MessageSquareWarning, Clock, XCircle, CheckCircle2, Hourglass,
  Image as ImageIcon, Paperclip, Info, ChevronLeft, Loader2
} from "lucide-react";
import { getMyDisputableAttendance, getMySanggahan, createSanggahan, cancelMySanggahan, uploadSanggahanEvidence } from "../../services/sanggahService";
import ProfileAvatarButton from "../../components/ProfileAvatarButton";

// Token light-mode, sama dengan halaman pegawai lain
const T = {
  bg: '#F4F2FB', surface: '#FFFFFF', border: 'rgba(31,41,55,0.08)', text: '#0F172A',
  textSec: '#475569', textMuted: '#94A3B8', sub: '#6B7280', iconBg: '#F5F3FF',
  shadow: '0 4px 16px rgba(15,23,42,0.06)',
};

const STATUS_META = {
  pending:   { label: "Menunggu Review", color: "#F59E0B", icon: Hourglass },
  approved:  { label: "Disetujui",       color: "#10B981", icon: CheckCircle2 },
  rejected:  { label: "Ditolak",         color: "#EF4444", icon: XCircle },
};

const OLD_STATUS_LABEL = { alpha: "Alpha", terlambat: "Terlambat", tanpa_pulang: "Tidak Absen Pulang" };

const fmtDate = (dateKey) => {
  if (!dateKey) return "-";
  return new Date(dateKey + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};
const fmtDateShort = (dateKey) => {
  if (!dateKey) return "-";
  return new Date(dateKey + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" });
};

export default function SanggahPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [disputable, setDisputable] = useState([]);
  const [sanggahan, setSanggahan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [reason, setReason] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const initials = user?.full_name?.charAt(0)?.toUpperCase() || "P";

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [att, mySanggahan] = await Promise.all([
        getMyDisputableAttendance(user.id),
        getMySanggahan(),
      ]);
      setDisputable(att);
      setSanggahan(mySanggahan);
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat sanggahan: " + (err.message || ""), { position: "bottom-center" });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const pendingByDate = new Map(
    sanggahan.filter((s) => s.status === "pending").map((s) => [s.tanggal, s])
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDate) { toast.warning("Pilih tanggal absensi terlebih dahulu", { position: "bottom-center" }); return; }
    if (!reason.trim()) { toast.warning("Alasan wajib diisi", { position: "bottom-center" }); return; }
    if (file && file.size > 2 * 1024 * 1024) { toast.warning("Ukuran foto melebihi 2MB", { position: "bottom-center" }); return; }
    setSubmitting(true);
    try {
      let attachmentUrl = null;
      if (file) attachmentUrl = await uploadSanggahanEvidence(user.id, file);
      await createSanggahan({ tanggal: selectedDate, reason, attachmentUrl });
      toast.success("Sanggahan terkirim, menunggu review admin", { position: "bottom-center" });
      setSelectedDate(null); setReason(""); setFile(null);
      await load();
    } catch (err) {
      toast.error(err.message || "Gagal mengirim sanggahan", { position: "bottom-center" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm("Batalkan sanggahan ini?")) return;
    try {
      await cancelMySanggahan(id);
      toast.success("Sanggahan dibatalkan", { position: "bottom-center" });
      await load();
    } catch (err) {
      toast.error(err.message || "Gagal membatalkan", { position: "bottom-center" });
    }
  };

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast.warning("Ukuran foto melebihi 2MB", { position: "bottom-center" }); e.target.value = ""; return; }
    setFile(f);
  };

  return (
    <div className="min-h-screen w-full font-sans absolute top-0 left-0 right-0 pb-28" style={{ background: T.bg, color: T.text }}>
      {/* Header */}
      <div className="pt-14 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-lg hover:bg-black/5 transition" aria-label="Kembali">
              <ChevronLeft size={20} style={{ color: T.text }} />
            </button>
            <span className="text-[17px] font-bold tracking-tight" style={{ color: T.text }}>Sanggahan</span>
          </div>
          <ProfileAvatarButton user={user} initials={initials} />
        </div>
      </div>

      <div className="max-w-md mx-auto space-y-4 px-4 mt-5">
        {/* Info */}
        <div className="flex items-start gap-3 rounded-2xl p-3.5" style={{ background: 'rgba(191,0,255,0.05)', border: '1px solid rgba(191,0,255,0.15)' }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: T.iconBg }}>
            <Info size={14} style={{ color: '#BF00FF' }} />
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: T.textSec }}>
            Ada catatan absen yang salah (Alpha/Terlambat) atau lupa absen pulang? Ajukan sanggah
            beserta alasan dan foto bukti. Admin akan meninjau — bila disetujui, status absen
            otomatis dikoreksi menjadi Hadir.
          </p>
        </div>

        {/* ── Form pengajuan ── */}
        <div className="rounded-3xl p-5" style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-1 h-4 rounded-full" style={{ background: "linear-gradient(180deg, #BF00FF, #3B82F6)" }} />
            <span className="text-xs font-bold" style={{ color: T.text }}>Ajukan Sanggahan</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={22} className="animate-spin text-[#BF00FF]" />
            </div>
          ) : disputable.length === 0 ? (
            <p className="text-[11px] text-center py-6" style={{ color: T.textMuted }}>
              Tidak ada absensi yang bisa disanggah dalam 60 hari terakhir 🎉
            </p>
          ) : (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: T.textMuted }}>
                1. Pilih tanggal absensi yang salah
              </p>
              <div className="space-y-2 mb-4">
                {disputable.map((item) => {
                  const hasPending = pendingByDate.has(item.date);
                  const selected = selectedDate === item.date;
                  return (
                    <button
                      key={item.id} type="button" disabled={hasPending}
                      onClick={() => { setSelectedDate(selected ? null : item.date); setFile(null); }}
                      className={`w-full text-left rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 transition-all duration-200 disabled:opacity-60
                        ${selected ? "ring-2 ring-[#BF00FF] bg-[#F5F3FF]" : "hover:bg-slate-50"}`}
                      style={{ border: `1px solid ${selected ? '#BF00FF' : T.border}` }}
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold">{fmtDateShort(item.date)}</div>
                        <div className="text-[9px] uppercase tracking-wider" style={{ color: T.textMuted }}>
                          {OLD_STATUS_LABEL[item.attendance_status] || item.attendance_status}
                          {item.attendance_status === "terlambat" && item.late_minutes > 0 ? ` · ${item.late_minutes} menit` : ""}
                        </div>
                      </div>
                      {hasPending ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>
                          <Hourglass size={9} /> Menunggu review
                        </span>
                      ) : (
                        <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${selected ? "bg-[#BF00FF] text-white" : "text-[#BF00FF]"}`}
                          style={selected ? {} : { background: T.iconBg }}>
                          {selected ? "Dipilih" : "Pilih"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedDate && (
                <form onSubmit={handleSubmit}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: T.textMuted }}>
                    2. Alasan sanggahan
                  </p>
                  <textarea
                    value={reason} onChange={(e) => setReason(e.target.value)}
                    rows={3} maxLength={500}
                    placeholder="Contoh: Aplikasi error saat absen masuk, sudah hadir tepat waktu."
                    className="w-full rounded-xl px-3.5 py-2.5 text-[12px] outline-none resize-none"
                    style={{ background: '#FAFAFC', border: `1px solid ${T.border}`, color: T.text }}
                  />
                  <p className="text-[10px] font-semibold uppercase tracking-wider mt-3 mb-2" style={{ color: T.textMuted }}>
                    3. Foto bukti (opsional)
                  </p>
                  <label className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 cursor-pointer text-[11px] transition-all"
                    style={{ background: '#FAFAFC', border: `1px dashed ${T.border}`, color: T.textSec }}>
                    <Paperclip size={14} />
                    {file ? file.name : "Lampirkan screenshot / foto lokasi (maks 2MB)"}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPickFile} />
                  </label>

                  <button
                    type="submit" disabled={submitting}
                    className="w-full mt-4 py-3 rounded-full text-sm font-bold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #BF00FF, #7B00E0)', boxShadow: '0 6px 18px rgba(191,0,255,0.3)' }}
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <MessageSquareWarning size={16} />}
                    {submitting ? "Mengirim..." : "Kirim Sanggahan"}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        {/* ── Riwayat sanggahan ── */}
        <div className="rounded-3xl p-5" style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-1 h-4 rounded-full" style={{ background: "linear-gradient(180deg, #BF00FF, #3B82F6)" }} />
            <span className="text-xs font-bold" style={{ color: T.text }}>Sanggahan Saya</span>
          </div>
          {!loading && sanggahan.length === 0 ? (
            <p className="text-[11px] text-center py-6" style={{ color: T.textMuted }}>Belum ada sanggahan.</p>
          ) : (
            <div className="space-y-2.5">
              {sanggahan.map((s) => {
                const meta = STATUS_META[s.status] || STATUS_META.pending;
                const MetaIcon = meta.icon;
                return (
                  <div key={s.id} className="rounded-xl p-3.5" style={{ background: 'rgba(15,23,42,0.02)', border: `1px solid ${T.border}` }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold">{fmtDateShort(s.tanggal)}</div>
                        <div className="text-[9px] uppercase tracking-wider" style={{ color: T.textMuted }}>
                          Status lama: {OLD_STATUS_LABEL[s.old_status] || s.old_status || "-"}
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-full shrink-0"
                        style={{ background: `${meta.color}1A`, color: meta.color }}>
                        <MetaIcon size={9} /> {meta.label}
                      </span>
                    </div>
                    <p className="text-[11px] mt-2 leading-relaxed" style={{ color: T.textSec }}>"{s.reason}"</p>
                    {s.status === "rejected" && s.rejection_reason && (
                      <div className="mt-2 rounded-lg px-3 py-2 text-[10px]" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#EF4444' }}>
                        <b>Alasan ditolak:</b> {s.rejection_reason}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2.5">
                      {s.attachment_url ? (
                        <a href={s.attachment_url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-medium underline" style={{ color: '#BF00FF' }}>
                          <ImageIcon size={10} /> Lihat bukti
                        </a>
                      ) : <span />}
                      {s.status === "pending" && (
                        <button onClick={() => handleCancel(s.id)} className="text-[10px] font-medium text-red-400 hover:text-red-500 transition">
                          Batalkan
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-start gap-2 p-3.5 rounded-xl bg-white border text-[11px]"
          style={{ background: T.surface, borderColor: T.border, color: T.textSec, boxShadow: T.shadow }}>
          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: T.iconBg }}>
            <Clock size={13} style={{ color: '#BF00FF' }} />
          </div>
          <p>Sanggahan ditinjau oleh admin. Pastikan alasan dan bukti jelas agar cepat diproses.</p>
        </div>
      </div>
    </div>
  );
}
