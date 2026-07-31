import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { getLeaveRequests, approveLeaveRequest, rejectLeaveRequest, countLeaveDays } from "../../services/leaveService";

const TABS = [
  { id: "pending", label: "Pending", badge: "count" },
  { id: "all", label: "Semua" },
];

export default function LeaveManagementPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("pending");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState(null); // { id, name }
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      if (activeTab === "pending") {
        const data = await getLeaveRequests("pending");
        setItems(data);
      } else {
        const data = await getLeaveRequests(null);
        setItems(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [activeTab]);

  const handleApprove = async (id) => {
    if (!confirm("Setujui permohonan ini?")) return;
    try {
      setProcessing(true);
      const data = await approveLeaveRequest(id);
      alert(data.message || "Disetujui");
      await load();
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
      alert("Permohonan ditolak");
      setRejectModal(null);
      setRejectionReason("");
      await load();
    } catch (e) {
      alert(e.message || "Gagal menolak");
    } finally {
      setProcessing(false);
    }
  };

  const pendingCount = items.filter((i) => i.status === "pending").length;

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      {/* TABS */}
      <div className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === tab.id
                ? "bg-gradient-to-r from-electric-violet to-deep-indigo text-white shadow-lg"
                : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            {tab.label}
            {tab.badge === "count" && pendingCount > 0 && (
              <span className="ml-2 bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* LOADING */}
      {loading && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center text-sm text-slate-mist">
          Memuat data...
        </div>
      )}

      {/* LIST */}
      {!loading && (
        <>
          {items.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center text-sm text-slate-mist">
              {activeTab === "pending" ? "Tidak ada permohonan pending." : "Belum ada permohonan."}
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const profile = item.profiles;
                return (
                  <div key={item.id} className="bg-gradient-to-br from-electric-violet/[0.06] to-deep-indigo/[0.06] border border-white/10 rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* HEADER */}
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="font-semibold text-sm text-pure-white truncate">
                            {profile?.full_name || profile?.username || "Pegawai"}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            {
                              pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
                              approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
                              rejected: "bg-rose-500/15 text-rose-400 border-rose-500/30",
                            }[item.status]
                          }`}>
                            {
                              { pending: "Menunggu", approved: "Disetujui", rejected: "Ditolak" }[item.status]
                            }
                          </span>
                        </div>

                        {/* DETAILS */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-mist uppercase font-semibold">Jenis</span>
                            <span className="text-pure-white capitalize">{item.type}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-mist uppercase font-semibold">Tanggal</span>
                            <span className="text-pure-white text-xs">
                              {new Date(item.start_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                              {" "}–{" "}
                              {new Date(item.end_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                              {" "}({countLeaveDays(item.start_date, item.end_date)} hari)
                            </span>
                          </div>
                          <div className="col-span-2 flex flex-col">
                            <span className="text-[10px] text-slate-mist uppercase font-semibold">Alasan</span>
                            <span className="text-slate-300 text-sm">{item.reason}</span>
                          </div>
                          {item.status === "rejected" && item.rejection_reason && (
                            <div className="col-span-2 flex flex-col">
                              <span className="text-[10px] text-rose-400 uppercase font-semibold">Alasan Penolakan</span>
                              <span className="text-rose-300 text-sm bg-rose-500/10 px-3 py-2 rounded-lg border border-rose-500/20">
                                {item.rejection_reason}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ACTIONS */}
                      {item.status === "pending" && (
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleApprove(item.id)}
                            disabled={processing}
                            className="px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-50 transition"
                          >
                            Setujui
                          </button>
                          <button
                            onClick={() => { setRejectModal({ id: item.id, name: profile?.full_name || "Pegawai" }); setRejectionReason(""); }}
                            disabled={processing}
                            className="px-3 py-2 rounded-xl text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 disabled:opacity-50 transition"
                          >
                            Tolak
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* REJECT MODAL */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f0a1e] border border-white/15 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-pure-white mb-1">Tolak Permohonan</h3>
            <p className="text-xs text-slate-mist mb-4">
              Pegawai: <span className="text-pure-white font-semibold">{rejectModal.name}</span>
            </p>
            <label className="block text-xs font-semibold text-slate-mist mb-1.5">Alasan Penolakan</label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-pure-white text-sm focus:outline-none focus:border-electric-violet focus:ring-1 focus:ring-electric-violet resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setRejectModal(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white/5 text-slate-400 hover:bg-white/10 transition"
              >
                Batal
              </button>
              <button
                onClick={handleReject}
                disabled={processing}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 transition"
              >
                {processing ? "Menolak..." : "Tolak"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
