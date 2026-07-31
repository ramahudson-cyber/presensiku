import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  LEAVE_TYPES,
  createLeaveRequest,
  getMyLeaveRequests,
  cancelLeaveRequest,
  countLeaveDays,
} from "../../services/leaveService";

export default function LeaveRequestPage() {
  const { user, loading: authLoading } = useAuth();

  // Hooks HARUS sebelum early return (React #310: hook count mismatch)
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

  const loadRequests = async () => {
    try {
      setFetchError("");
      const data = await getMyLeaveRequests(user.id);
      setRequests(data);
    } catch (e) {
      setFetchError(e.message || "Gagal memuat riwayat");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (user?.id) loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Guard: tunggu auth load selesai (setelah hooks)
  if (authLoading) {
    return (
      <div className="max-w-2xl mx-auto flex items-center justify-center py-20">
        <p className="text-sm text-slate-mist">Memuat...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto flex items-center justify-center py-20">
        <p className="text-sm text-slate-mist">Silakan login untuk mengakses halaman ini.</p>
      </div>
    );
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

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
      setSuccessMsg(`Permohonan ${formType} berhasil dikirim (pending)`);
      setFormType("izin");
      setStartDate("");
      setEndDate("");
      setReason("");
      await loadRequests();
    } catch (e) {
      setFormError(e.message || "Gagal mengirim permohonan");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id) => {
    if (!confirm("Batalkan permohonan ini?")) return;
    try {
      await cancelLeaveRequest(id);
      await loadRequests();
    } catch (e) {
      alert(e.message || "Gagal membatalkan");
    }
  };

  const statusConfig = {
    pending: { label: "Menunggu", class: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
    approved: { label: "Disetujui", class: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    rejected: { label: "Ditolak", class: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4">
      {/* FORM */}
      <div className="bg-gradient-to-br from-electric-violet/[0.08] to-deep-indigo/[0.08] border border-white/10 rounded-2xl p-5 shadow-xl">
        <h2 className="text-lg font-bold text-pure-white mb-4 flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-electric-violet to-deep-indigo flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </span>
          Ajukan Izin / Sakit
        </h2>

        {successMsg && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm">
            {successMsg}
          </div>
        )}
        {formError && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-mist mb-1.5">Jenis Permohonan</label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-pure-white text-sm focus:outline-none focus:border-electric-violet focus:ring-1 focus:ring-electric-violet"
            >
              {LEAVE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-mist mb-1.5">Tanggal Mulai</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={todayStr}
                className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-pure-white text-sm focus:outline-none focus:border-electric-violet focus:ring-1 focus:ring-electric-violet [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-mist mb-1.5">Tanggal Selesai</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || todayStr}
                className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-pure-white text-sm focus:outline-none focus:border-electric-violet focus:ring-1 focus:ring-electric-violet [color-scheme:dark]"
              />
            </div>
          </div>

          {startDate && endDate && endDate >= startDate && (
            <p className="text-xs text-slate-mist">
              {countLeaveDays(startDate, endDate)} hari
            </p>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-mist mb-1.5">Alasan</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Contoh: Keperluan keluarga yang tidak bisa ditunda"
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-pure-white text-sm focus:outline-none focus:border-electric-violet focus:ring-1 focus:ring-electric-violet resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-electric-violet to-deep-indigo text-white hover:opacity-90 disabled:opacity-50 transition shadow-lg shadow-electric-violet/25"
          >
            {loading ? "Mengirim..." : "Kirim Permohonan"}
          </button>
        </form>
      </div>

      {/* RIWAYAT */}
      <div className="bg-gradient-to-br from-electric-violet/[0.08] to-deep-indigo/[0.08] border border-white/10 rounded-2xl p-5 shadow-xl">
        <h2 className="text-lg font-bold text-pure-white mb-4">Riwayat Permohonan</h2>

        {fetchError && (
          <p className="text-sm text-rose-400 bg-rose-500/10 px-4 py-3 rounded-xl border border-rose-500/20 text-center">
            {fetchError}
          </p>
        )}

        {fetching && requests.length === 0 ? (
          <p className="text-sm text-slate-mist text-center py-6">Memuat...</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-slate-mist text-center py-6">Belum ada permohonan.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => {
              const sc = statusConfig[r.status];
              return (
                <div key={r.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-pure-white capitalize">{r.leave_type}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sc.class}`}>
                        {sc.label}
                      </span>
                    </div>
                    {r.status === "pending" && (
                      <button onClick={() => handleCancel(r.id)} className="text-xs text-rose-400 hover:text-rose-300">
                        Batal
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-mist mb-1">
                    {new Date(r.start_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                    {" "}–{" "}
                    {new Date(r.end_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                    {" "}({countLeaveDays(r.start_date, r.end_date)} hari)
                  </p>
                  <p className="text-sm text-slate-300">{r.reason}</p>
                  {r.status === "rejected" && r.rejection_reason && (
                    <p className="mt-2 text-xs text-rose-400 bg-rose-500/10 px-3 py-2 rounded-lg border border-rose-500/20">
                      Alasan penolakan: {r.rejection_reason}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
