import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import {
  MessageSquareWarning, Hourglass, CheckCircle2, XCircle, Search,
  Image as ImageIcon, ChevronRight, Loader2, Inbox
} from "lucide-react";
import { getSanggahan, approveSanggahan, rejectSanggahan } from "../../services/sanggahService";
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
const OLD_STATUS_LABEL = { alpha: "Alpha", terlambat: "Terlambat" };

function StatusPill({ status }) {
  const meta = {
    pending:  { label: "MENUNGGU", cls: "bg-amber-500/15 text-amber-300 ring-amber-500/30", icon: Hourglass },
    approved: { label: "DISETUJUI", cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30", icon: CheckCircle2 },
    rejected: { label: "DITOLAK", cls: "bg-rose-500/15 text-rose-300 ring-rose-500/30", icon: XCircle },
  }[status] || { label: status, cls: "bg-white/5 text-slate-mist ring-white/10", icon: null };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2.5 py-1 rounded-full ring-1 ${meta.cls}`}>
      {Icon && <Icon size={9} />} {meta.label}
    </span>
  );
}

function SanggahanCard({ item, onApprove, onRejectClick, processing }) {
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

      {item.status === "approved" && item.reviewed_at && (
        <p className="text-[9px] text-slate-mist mt-2">Diproses: {new Date(item.reviewed_at).toLocaleString("id-ID")}</p>
      )}
    </div>
  );
}

export default function SanggahanPage() {
  const [activeTab, setActiveTab] = useState("pending");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [search, setSearch] = useState("");

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
    if (!window.confirm(`Setujui sanggahan ${item.profiles?.full_name || ""} tanggal ${fmtDate(item.tanggal)}?\nAbsensi akan dikoreksi menjadi Hadir.`)) return;
    setProcessing(true);
    try {
      const res = await approveSanggahan(item.id);
      toast.success(res.message || "Sanggahan disetujui");
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

  const filtered = records.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${r.profiles?.full_name || ""} ${r.profiles?.username || ""}`.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

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
            />
          ))}
        </div>
      )}

      {/* Modal tolak + alasan */}
      {rejectModal && (
        <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center animate-fade-in" onClick={() => !processing && setRejectModal(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-full max-w-md bg-[#17123a] border border-white/10 rounded-t-[28px] md:rounded-3xl p-6 animate-slide-up md:animate-fade-in mt-auto md:mt-0">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center">
                <MessageSquareWarning size={18} className="text-rose-300" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-pure-white">Tolak Sanggahan</h3>
                <p className="text-[10px] text-slate-mist">Berikan alasan yang jelas untuk pegawai</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-mist mb-2">
              Pegawai: <b className="text-pure-white">{rejectModal.profiles?.full_name || "–"}</b> · {fmtDate(rejectModal.tanggal)}
            </p>
            <textarea
              value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)}
              rows={3} maxLength={300} autoFocus
              placeholder="Contoh: Bukti tidak jelas / sudah dicek dan absen memang tercatat benar."
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3.5 py-2.5 text-xs text-pure-white placeholder-slate-mist/50 outline-none focus:border-electric-violet/60 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setRejectModal(null)} disabled={processing}
                className="flex-1 py-2.5 rounded-full border border-white/15 text-slate-mist text-sm hover:bg-white/5 transition-all disabled:opacity-50">
                Batal
              </button>
              <button onClick={handleReject} disabled={processing || !rejectionReason.trim()}
                className="flex-1 py-2.5 rounded-full bg-rose-500 text-white text-sm font-bold hover:bg-rose-600 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                {processing ? <Loader2 size={14} className="animate-spin" /> : null}
                Tolak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
