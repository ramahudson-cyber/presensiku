import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import {
  MessageSquareWarning, Hourglass, CheckCircle2, XCircle, Search,
  Image as ImageIcon, ChevronRight, Loader2, Inbox, UserPlus, RotateCcw
} from "lucide-react";
import {
  getSanggahan, approveSanggahan, rejectSanggahan, cancelApprovedSanggahan,
  adminCreateSanggahan, uploadSanggahanEvidence,
} from "../../services/sanggahService";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import usePullToRefresh from "../../hooks/usePullToRefresh";
import PullToRefreshIndicator from "../../components/PullToRefreshIndicator";

// Identitas visual kartu — sama dengan AttendanceHistoryPage
const initials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};
const avatarGradient = (name = "") => {
  const grads = [
    "from-electric-violet to-deep-indigo",
    "from-sky-500 to-blue-700",
    "from-emerald-500 to-teal-700",
    "from-green-yellow to-electric-violet",
    "from-rose-500 to-pink-700",
  ];
  const hash = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return grads[hash % grads.length];
};

const fmtDate = (dateKey) => {
  if (!dateKey) return "-";
  return new Date(dateKey + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};
const OLD_STATUS_LABEL = { alpha: "Alpha", terlambat: "Terlambat", belum: "Belum", tanpa_pulang: "Tidak Absen Pulang" };

function StatusPill({ status }) {
  const meta = {
    pending:  { label: "MENUNGGU", cls: "bg-amber-500/15 text-amber-300 ring-amber-500/30", icon: Hourglass },
    approved: { label: "DISETUJUI", cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30", icon: CheckCircle2 },
    rejected: { label: "DITOLAK", cls: "bg-rose-500/15 text-rose-300 ring-rose-500/30", icon: XCircle },
    cancelled:{ label: "DIBATALKAN", cls: "bg-slate-500/15 text-slate-300 ring-slate-500/30", icon: RotateCcw },
  }[status] || { label: status, cls: "bg-white/5 text-slate-mist ring-white/10", icon: null };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2.5 py-1 rounded-full ring-1 ${meta.cls}`}>
      {Icon && <Icon size={9} />} {meta.label}
    </span>
  );
}

function SanggahanCard({ item, onApprove, onRejectClick, onCancelClick, processing }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-4 hover:bg-white/[0.06] transition-all">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarGradient(item.profiles?.full_name)} flex items-center justify-center text-white text-xs font-bold shadow shrink-0`}>
          {initials(item.profiles?.full_name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-pure-white truncate text-sm">{item.profiles?.full_name ?? "–"}</p>
          <p className="text-[10px] text-slate-mist mt-0.5">{fmtDate(item.tanggal)}</p>
        </div>
        <StatusPill status={item.status} />
      </div>

      <div className="mt-3 rounded-xl bg-onyx/60 border border-white/[0.05] p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-mist">Status yang disanggah</span>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300">
            {OLD_STATUS_LABEL[item.old_status] || item.old_status || "-"}
          </span>
        </div>
        <p className="text-xs text-slate-200 leading-relaxed">"{item.reason}"</p>
        {item.attachment_url && (
          <a href={item.attachment_url} target="_blank" rel="noreferrer"
            className="mt-2.5 flex items-center gap-2 rounded-lg overflow-hidden border border-white/[0.08] hover:border-electric-violet/50 transition-all group">
            <img src={item.attachment_url} alt="Bukti sanggahan" className="w-16 h-16 object-cover" loading="lazy" />
            <span className="text-[10px] text-slate-mist group-hover:text-pure-white inline-flex items-center gap-1">
              <ImageIcon size={10} /> Lihat foto bukti <ChevronRight size={10} />
            </span>
          </a>
        )}
      </div>

      {item.status === "rejected" && item.rejection_reason && (
        <div className="mt-2.5 rounded-xl px-3 py-2 border border-rose-500/20 bg-rose-500/[0.07]">
          <p className="text-[10px] text-rose-300"><b>Alasan ditolak:</b> {item.rejection_reason}</p>
        </div>
      )}

      {item.status === "cancelled" && item.cancel_reason && (
        <div className="mt-2.5 rounded-xl px-3 py-2 border border-slate-500/20 bg-slate-500/[0.07]">
          <p className="text-[10px] text-slate-300"><b>Alasan pembatalan:</b> {item.cancel_reason}</p>
        </div>
      )}

      {item.status === "pending" && (
        <div className="flex gap-3 mt-3.5">
          <button
            onClick={() => onApprove(item)} disabled={processing}
            className="flex-1 py-2.5 rounded-full text-xs font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
          >
            ✓ Setujui & Koreksi
          </button>
          <button
            onClick={() => onRejectClick(item)} disabled={processing}
            className="flex-1 py-2.5 rounded-full text-xs font-bold border border-white/15 text-slate-mist hover:bg-white/5 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            Tolak
          </button>
        </div>
      )}

      {item.status === "approved" && (
        <div className="mt-3.5">
          <button
            onClick={() => onCancelClick(item)} disabled={processing}
            className="w-full py-2.5 rounded-full text-xs font-bold border border-white/15 text-slate-mist hover:bg-white/5 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <RotateCcw size={12} /> Batalkan Persetujuan
          </button>
          {item.reviewed_at && (
            <p className="text-[9px] text-slate-mist mt-2">Diproses: {new Date(item.reviewed_at).toLocaleString("id-ID")}</p>
          )}
        </div>
      )}

      {item.status === "cancelled" && item.cancelled_at && (
        <p className="text-[9px] text-slate-mist mt-2">Dibatalkan: {new Date(item.cancelled_at).toLocaleString("id-ID")}</p>
      )}
    </div>
  );
}

export default function SanggahanPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("pending");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [search, setSearch] = useState("");

  // ── Admin sanggahkan pegawai (multi-hari, langsung disetujui) ──
  const [createModal, setCreateModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [empId, setEmpId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [createReason, setCreateReason] = useState("");
  const [createFile, setCreateFile] = useState(null);
  const [creating, setCreating] = useState(false);

  const loadEmployees = async () => {
    try {
      // RLS yang membatasi per peran/organisasi (pola AttendanceHistoryPage)
      let query = supabase.from("profiles").select("id, full_name, role").order("full_name");
      if (user?.role !== "super_admin") query = query.neq("role", "super_admin");
      const { data } = await query;
      setEmployees(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const openCreateModal = () => {
    setEmpId(""); setDateFrom(""); setDateTo("");
    setCreateReason(""); setCreateFile(null);
    setCreateModal(true);
    loadEmployees();
  };

  const handleCreateSanggahan = async () => {
    if (!empId) { toast.warning("Pilih pegawai dulu"); return; }
    if (!dateFrom || !dateTo) { toast.warning("Lengkapi rentang tanggal"); return; }
    if (dateFrom > dateTo) { toast.warning("Tanggal mulai melebihi tanggal selesai"); return; }
    if (!createReason.trim()) { toast.warning("Alasan wajib diisi"); return; }
    setCreating(true);
    try {
      let attachmentUrl = null;
      if (createFile) {
        attachmentUrl = await uploadSanggahanEvidence(empId, createFile);
      }
      const res = await adminCreateSanggahan({
        userId: empId, dateFrom, dateTo, reason: createReason, attachmentUrl,
      });
      const skipped = res.skipped || [];
      if (skipped.length > 0) {
        toast.info(
          `${res.created_count} hari berhasil disanggahkan. Dilewati: ` +
          skipped.map((s) => `${s.tanggal} (${s.alasan})`).join(", "),
          { autoClose: false, closeOnClick: true }
        );
      } else {
        toast.success(`${res.created_count} hari berhasil disanggahkan`);
      }
      setCreateModal(null); setCreateFile(null);
      setActiveTab("all");
      await load();
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan sanggahan");
    } finally {
      setCreating(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = activeTab === "pending" ? await getSanggahan("pending") : await getSanggahan(null);
      setRecords(data);
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat sanggahan: " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [activeTab]);
  const { pullDistance, isRefreshing } = usePullToRefresh(() => load());

  const handleApprove = async (item) => {
    // old_status = kondisi yang disanggahkan (Terlambat/Alpha/Belum)
    const oldLabel = OLD_STATUS_LABEL[item.old_status] || item.old_status || "-";
    if (!window.confirm(`Setujui sanggahan ${item.profiles?.full_name || ""} tanggal ${fmtDate(item.tanggal)}?\nStatus ${oldLabel} akan dikoreksi menjadi Sanggah — tanpa potongan gaji.`)) return;
    setProcessing(true);
    try {
      await approveSanggahan(item.id);
      toast.success("Sanggahan disetujui — status dikoreksi menjadi Sanggah");
      await load();
    } catch (err) {
      toast.error(err.message || "Gagal menyetujui sanggahan");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModal?.id) return;
    if (!rejectionReason.trim()) { toast.warning("Alasan penolakan wajib diisi"); return; }
    setProcessing(true);
    try {
      await rejectSanggahan(rejectModal.id, rejectionReason);
      toast.success("Sanggahan ditolak");
      setRejectModal(null); setRejectionReason("");
      await load();
    } catch (err) {
      toast.error(err.message || "Gagal menolak sanggahan");
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelApproval = async () => {
    if (!cancelModal?.id) return;
    if (!cancelReason.trim()) { toast.warning("Alasan pembatalan wajib diisi"); return; }
    setProcessing(true);
    try {
      const res = await cancelApprovedSanggahan(cancelModal.id, cancelReason);
      toast.success(res.message || "Persetujuan dibatalkan — absensi dikembalikan");
      setCancelModal(null); setCancelReason("");
      await load();
    } catch (err) {
      toast.error(err.message || "Gagal membatalkan persetujuan");
    } finally {
      setProcessing(false);
    }
  };

  const filtered = records.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${r.profiles?.full_name || ""} ${r.profiles?.username || ""}`.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      {/* Tombol: admin sanggahkan pegawai */}
      <div className="flex justify-end">
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white shadow-lg transition-all active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #BF00FF, #7B00E0)' }}
        >
          <UserPlus size={13} /> Sanggahkan Pegawai
        </button>
      </div>

      {/* Tabs + search */}
      <div className="flex items-center gap-2">
        {[
          { id: "pending", label: "Menunggu" },
          { id: "all", label: "Semua" },
        ].map((tab) => (
          <button
            key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
              activeTab === tab.id ? "bg-electric-violet text-pure-white shadow-lg" : "bg-white/5 text-slate-mist hover:bg-white/10"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="flex-1 relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-mist" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama..."
            className="w-full bg-white/5 border border-white/[0.08] rounded-full pl-9 pr-3 py-2 text-xs text-pure-white placeholder-slate-mist/60 outline-none focus:border-electric-violet/50"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-2xl bg-white/[0.04] animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] py-14 flex flex-col items-center gap-2">
          {activeTab === "pending"
            ? <><div className="p-3 rounded-2xl bg-emerald-500/10"><CheckCircle2 size={24} className="text-emerald-300" /></div>
                <p className="text-sm text-slate-mist">Tidak ada sanggahan menunggu review</p></>
            : <><div className="p-3 rounded-2xl bg-white/5"><Inbox size={24} className="text-slate-mist" /></div>
                <p className="text-sm text-slate-mist">Belum ada sanggahan</p></>}
        </div>
      ) : (
        <div className="space-y-3 pb-6">
          {filtered.map((item) => (
            <SanggahanCard
              key={item.id} item={item} processing={processing}
              onApprove={handleApprove} onRejectClick={(it) => { setRejectModal(it); setRejectionReason(""); }}
              onCancelClick={(it) => { setCancelModal(it); setCancelReason(""); }}
            />
          ))}
        </div>
      )}

      {/* Modal tolak + alasan — tema terang sesuai layout admin.
          Portal ke body: z-index modal tidak lagi bisa dikalahkan BottomNav,
          dan data-no-ptr mematikan pull-to-refresh di dalam modal. */}
      {rejectModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center animate-fade-in" onClick={() => !processing && setRejectModal(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div onClick={(e) => e.stopPropagation()} data-no-ptr
            className="relative z-10 w-full max-w-md bg-white border border-slate-200 shadow-2xl rounded-t-[28px] md:rounded-3xl p-6 animate-slide-up md:animate-fade-in mt-auto md:mt-0 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <MessageSquareWarning size={18} className="text-rose-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Tolak Sanggahan</h3>
                <p className="text-[10px] text-slate-500">Berikan alasan yang jelas untuk pegawai</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mb-2">
              Pegawai: <b className="text-slate-900">{rejectModal.profiles?.full_name || "–"}</b> · {fmtDate(rejectModal.tanggal)}
            </p>
            <textarea
              value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)}
              rows={3} maxLength={300} autoFocus
              placeholder="Contoh: Bukti tidak jelas / sudah dicek dan absen memang tercatat benar."
              className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-rose-400 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setRejectModal(null)} disabled={processing}
                className="flex-1 py-2.5 rounded-full border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-all disabled:opacity-50">
                Batal
              </button>
              <button onClick={handleReject} disabled={processing || !rejectionReason.trim()}
                className="flex-1 py-2.5 rounded-full bg-rose-500 text-white text-sm font-bold hover:bg-rose-600 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                {processing ? <Loader2 size={14} className="animate-spin" /> : null}
                Tolak
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal batalkan persetujuan — tema terang sesuai layout admin */}
      {cancelModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center animate-fade-in" onClick={() => !processing && setCancelModal(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div onClick={(e) => e.stopPropagation()} data-no-ptr
            className="relative z-10 w-full max-w-md bg-white border border-slate-200 shadow-2xl rounded-t-[28px] md:rounded-3xl p-6 animate-slide-up md:animate-fade-in mt-auto md:mt-0 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-slate-500/10 flex items-center justify-center">
                <RotateCcw size={18} className="text-slate-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Batalkan Persetujuan</h3>
                <p className="text-[10px] text-slate-500">Absensi dikembalikan ke keadaan semula</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mb-2">
              Pegawai: <b className="text-slate-900">{cancelModal.profiles?.full_name || "–"}</b> · {fmtDate(cancelModal.tanggal)}
            </p>
            <div className="rounded-xl px-3 py-2 border border-amber-200 bg-amber-50 mb-3">
              <p className="text-[10px] text-amber-800 leading-relaxed">
                Status absensi, jam masuk/pulang, dan catatan asli dipulihkan otomatis. Potongan gaji
                yang sempat hilang akan dihitung kembali.
              </p>
            </div>
            <textarea
              value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
              rows={3} maxLength={300} autoFocus
              placeholder="Contoh: Persetujuan keliru — bukti ternyata tidak sesuai."
              className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-slate-400 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setCancelModal(null)} disabled={processing}
                className="flex-1 py-2.5 rounded-full border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-all disabled:opacity-50">
                Kembali
              </button>
              <button onClick={handleCancelApproval} disabled={processing || !cancelReason.trim()}
                className="flex-1 py-2.5 rounded-full bg-slate-700 text-white text-sm font-bold hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                {processing ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                Batalkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: admin sanggahkan pegawai — tema terang sesuai layout admin */}
      {createModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center animate-fade-in" onClick={() => !creating && setCreateModal(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div onClick={(e) => e.stopPropagation()} data-no-ptr
            className="relative z-10 w-full max-w-md bg-white border border-slate-200 shadow-2xl rounded-t-[28px] md:rounded-3xl p-6 animate-slide-up md:animate-fade-in mt-auto md:mt-0 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-electric-violet/10 flex items-center justify-center">
                <UserPlus size={18} className="text-electric-violet" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Sanggahkan Pegawai</h3>
                <p className="text-[10px] text-slate-500">Koreksi absensi tanpa pengajuan pegawai</p>
              </div>
            </div>

            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Pegawai</label>
            <select
              value={empId} onChange={(e) => setEmpId(e.target.value)}
              className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-electric-violet mb-3"
            >
              <option value="">— Pilih pegawai —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Dari</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-electric-violet" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Sampai</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-electric-violet" />
              </div>
            </div>

            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Alasan</label>
            <textarea
              value={createReason} onChange={(e) => setCreateReason(e.target.value)}
              rows={3} maxLength={300}
              placeholder="Contoh: Hari libur nasional / kegiatan dinas di luar kantor."
              className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-electric-violet resize-none mb-3"
            />

            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Foto bukti (opsional)</label>
            <input type="file" accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setCreateFile(e.target.files?.[0] || null)}
              className="w-full text-[10px] text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-violet-100 file:text-violet-700 cursor-pointer mb-4" />

            <div className="rounded-xl px-3 py-2 border border-violet-100 bg-violet-50 mb-4">
              <p className="text-[10px] text-slate-600 leading-relaxed">
                Semua hari dalam rentang diproses langsung disetujui. Hari masa depan yang punya jadwal ditandai sebagai hari bebas (Sanggah). Hari yang sudah hadir, sudah disanggahkan, tanpa jadwal, atau lebih dari 62 hari ke depan dilewati otomatis.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setCreateModal(false)} disabled={creating}
                className="flex-1 py-2.5 rounded-full border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-all disabled:opacity-50">
                Batal
              </button>
              <button onClick={handleCreateSanggahan}
                disabled={creating || !empId || !dateFrom || !dateTo || !createReason.trim()}
                className="flex-1 py-2.5 rounded-full bg-electric-violet text-white text-sm font-bold hover:bg-[#a800d4] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                {creating ? <Loader2 size={14} className="animate-spin" /> : null}
                Kirim
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
