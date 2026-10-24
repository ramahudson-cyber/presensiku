// src/pages/admin/OvertimeManagementPage.jsx
// Kelola lembur instansi: setujui (jam dibayar bisa disesuaikan), tolak,
// buatkan lembur langsung untuk pegawai, rekap uang, export Excel.
// Pola UI mengikuti halaman admin lain (design-card, dark admin-light).
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import {
  getOvertimeRequests,
  reviewOvertimeRequest,
  adminCreateOvertime,
  adminCancelOvertime,
  getOvertimeConfig,
  saveOvertimeConfig,
} from "../../services/overtimeService";
import { exportExcelWorkbook, DATE_FMT } from "../../services/excelExport";
import usePullToRefresh from "../../hooks/usePullToRefresh";
import PullToRefreshIndicator from "../../components/PullToRefreshIndicator";
import BottomSheet from "../../components/BottomSheet";
import {
  Clock, Check, X, Plus, Download, Loader2, RefreshCw, Inbox, Search,
  Settings2, Banknote, Trash2,
} from "lucide-react";

const cardBase = "design-card";
const inputBase = "design-input";
const btnPrimary = "inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-electric-violet text-pure-white rounded-full text-sm font-medium hover:brightness-110 active:brightness-90 transition-all";

const STATUS_STYLE = {
  pending: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  rejected: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
};
const STATUS_LABEL = { pending: "Menunggu", approved: "Disetujui", rejected: "Ditolak" };

const rupiah = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");

const fmtDate = (dateStr) =>
  dateStr
    ? new Date(dateStr + "T00:00:00Z").toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Makassar" })
    : "–";

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
    "from-fuchsia-500 to-purple-700",
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return grads[sum % grads.length];
};

const todayStr = () => new Date().toISOString().split("T")[0];

export default function OvertimeManagementPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [config, setConfig] = useState({ rate_per_hour: 15000, min_minutes: 30, max_hours_per_day: 4 });
  const [statusFilter, setStatusFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState(todayStr().slice(0, 7));
  const [search, setSearch] = useState("");
  const [processing, setProcessing] = useState(null);
  const [exporting, setExporting] = useState(false);

  // BottomSheet keputusan
  const [decide, setDecide] = useState(null); // { row, action }
  const [hoursInput, setHoursInput] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  // Mode bayar saat menyetujui: 'hourly' (tarif × jam) atau 'fixed' (borongan)
  const [decideMode, setDecideMode] = useState("hourly");
  const [decideAmount, setDecideAmount] = useState("");
  // Lembur approved yang akan dibatalkan (row object)
  const [cancelRow, setCancelRow] = useState(null);

  // BottomSheet pengaturan tarif (langsung dari halaman ini)
  const [showRate, setShowRate] = useState(false);
  const [rateForm, setRateForm] = useState({ rate_per_hour: "15000", min_minutes: "30", max_hours_per_day: "4" });
  const [savingRate, setSavingRate] = useState(false);

  // BottomSheet buat lembur
  const [showCreate, setShowCreate] = useState(false);
  const [members, setMembers] = useState([]);
  // Multi-pilih: satu lembur bisa dibuat untuk banyak pegawai sekaligus.
  const [createUsers, setCreateUsers] = useState([]);
  const [createForm, setCreateForm] = useState({ date: todayStr(), start_time: "", end_time: "", reason: "", pay_mode: "hourly", fixed_amount: "" });
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [data, cfg] = await Promise.all([
        getOvertimeRequests({}),
        getOvertimeConfig(),
      ]);
      setRequests(data);
      setConfig(cfg);
    } catch (e) {
      console.error("❌ Gagal memuat lembur:", e);
      toast.error("Gagal memuat data lembur");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // setTimeout: hindari setState sinkron di body effect (pola halaman lain).
    const kick = setTimeout(load, 0);
    const kickMembers = setTimeout(() => {
      supabase
        .from("profiles")
        .select("id, full_name, username, position")
        .neq("role", "super_admin")
        .order("full_name")
        .then(({ data }) => setMembers(data || []));
    }, 0);
    return () => { clearTimeout(kick); clearTimeout(kickMembers); };
  }, []);

  const { pullDistance, isRefreshing } = usePullToRefresh(load);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (monthFilter && !(r.date || "").startsWith(monthFilter)) return false;
      if (!q) return true;
      const name = (r.user?.full_name || "").toLowerCase();
      return name.includes(q) || (r.user?.username || "").toLowerCase().includes(q);
    });
  }, [requests, statusFilter, monthFilter, search]);

  const stats = useMemo(() => {
    const inMonth = monthFilter
      ? requests.filter((r) => (r.date || "").startsWith(monthFilter))
      : requests;
    const approved = inMonth.filter((r) => r.status === "approved");
    return {
      pending: requests.filter((r) => r.status === "pending").length,
      totalHours: approved.reduce((s, r) => s + Number(r.approved_hours || 0), 0),
      totalPay: approved.reduce((s, r) => s + Number(r.pay_amount || 0), 0),
    };
  }, [requests, monthFilter]);

  const openDecide = (row, action) => {
    setDecide({ row, action });
    setHoursInput(action === "approve" ? String(Number(row.requested_hours)) : "");
    setRejectReason("");
    // Default mengikuti mode pengajuan; admin boleh mengganti ke borongan.
    setDecideMode(row.pay_mode === "fixed" ? "fixed" : "hourly");
    setDecideAmount(row.fixed_amount != null ? String(Number(row.fixed_amount)) : "");
  };

  const submitDecide = async () => {
    if (!decide) return;
    const { row, action } = decide;
    if (action === "approve") {
      const h = Number(hoursInput);
      if (!Number.isFinite(h) || h <= 0) {
        toast.error("Jam dibayar tidak valid");
        return;
      }
      if (decideMode === "hourly" && h > config.max_hours_per_day) {
        toast.error(`Melebihi batas ${config.max_hours_per_day} jam/hari — ubah Pengaturan lembur dulu`);
        return;
      }
      if (decideMode === "fixed") {
        const amt = Number(decideAmount);
        if (!Number.isFinite(amt) || amt <= 0) {
          toast.error("Nominal lembur harus lebih dari 0");
          return;
        }
      }
    }
    setProcessing(row.id);
    try {
      const res = await reviewOvertimeRequest(row.id, action, {
        hours: action === "approve" ? Number(hoursInput) : null,
        rejectionReason: action === "reject" ? rejectReason : null,
        payMode: action === "approve" ? decideMode : null,
        fixedAmount: action === "approve" && decideMode === "fixed" ? Number(decideAmount) : null,
      });
      toast.success(res.message || "Berhasil");
      setDecide(null);
      await load();
    } catch (err) {
      toast.error(err.message || "Gagal memproses");
    } finally {
      setProcessing(null);
    }
  };

  const submitCancel = async () => {
    if (!cancelRow) return;
    setProcessing(cancelRow.id);
    try {
      const res = await adminCancelOvertime(cancelRow.id);
      toast.success(res.message || "Lembur dibatalkan");
      setCancelRow(null);
      await load();
    } catch (err) {
      toast.error(err.message || "Gagal membatalkan lembur");
    } finally {
      setProcessing(null);
    }
  };

  const submitCreate = async () => {
    const { date, start_time, end_time, reason, pay_mode, fixed_amount } = createForm;
    if (!createUsers.length) return toast.error("Pilih pegawai dulu — bisa centang lebih dari satu");
    if (!date || !start_time || !end_time) return toast.error("Tanggal & jam wajib diisi");
    // Lintas tengah malam (selesai < mulai) diizinkan s/d 06:00 (mirror guard
    // server di admin_create_overtime); selesai == mulai selalu ditolak.
    if (end_time === start_time) return toast.error("Jam selesai tidak boleh sama dengan jam mulai");
    if (end_time < start_time && end_time > "06:00") {
      return toast.error("Lembur lintas tengah malam maksimal sampai jam 06:00");
    }
    if (pay_mode === "fixed") {
      const amt = Number(fixed_amount);
      if (!Number.isFinite(amt) || amt <= 0) return toast.error("Nominal lembur harus lebih dari 0");
    }
    setCreating(true);
    try {
      let ok = 0;
      const failed = [];
      for (const uid of createUsers) {
        try {
          await adminCreateOvertime({
            user_id: uid, date, start_time, end_time, reason,
            pay_mode,
            fixed_amount: pay_mode === "fixed" ? Number(fixed_amount) : null,
          });
          ok++;
        } catch (err) {
          const name = members.find((m) => m.id === uid)?.full_name || "pegawai";
          failed.push(`${name}: ${err.message || "gagal"}`);
        }
      }
      if (ok) toast.success(`✅ Lembur tercatat untuk ${ok} pegawai`);
      if (failed.length) {
        toast.error(`Gagal ${failed.length}: ${failed.slice(0, 3).join("; ")}${failed.length > 3 ? " …" : ""}`);
      }
      if (ok) {
        setShowCreate(false);
        setCreateForm({ date: todayStr(), start_time: "", end_time: "", reason: "", pay_mode: "hourly", fixed_amount: "" });
        setCreateUsers([]);
        await load();
      }
    } catch (err) {
      toast.error(err.message || "Gagal membuat lembur");
    } finally {
      setCreating(false);
    }
  };

  // Buka sheet tarif dengan nilai yang sedang berlaku.
  const openRate = () => {
    setRateForm({
      rate_per_hour: String(config.rate_per_hour ?? 15000),
      min_minutes: String(config.min_minutes ?? 30),
      max_hours_per_day: String(config.max_hours_per_day ?? 4),
    });
    setShowRate(true);
  };

  const submitRate = async () => {
    const rate = Number(rateForm.rate_per_hour);
    const minMin = Number(rateForm.min_minutes);
    const maxH = Number(rateForm.max_hours_per_day);
    if (!Number.isFinite(rate) || rate <= 0) return toast.error("Tarif per jam harus lebih dari 0");
    if (!Number.isInteger(minMin) || minMin < 0) return toast.error("Minimal menit tidak valid");
    if (!Number.isFinite(maxH) || maxH <= 0 || maxH > 24) return toast.error("Maksimal jam per hari harus 1–24");

    setSavingRate(true);
    try {
      await saveOvertimeConfig({ rate_per_hour: rate, min_minutes: minMin, max_hours_per_day: maxH });
      setConfig({ rate_per_hour: rate, min_minutes: minMin, max_hours_per_day: maxH });
      setShowRate(false);
      toast.success("Tarif lembur tersimpan — berlaku untuk persetujuan berikutnya");
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan tarif");
    } finally {
      setSavingRate(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      if (!filtered.length) {
        toast.info("Tidak ada data untuk diekspor");
        return;
      }
      const orgName = user?.override_org?.name || user?.organization?.name || "Presensiku";
      await exportExcelWorkbook({
        filename: `lembur-${monthFilter || "semua"}.xlsx`,
        sheetName: "Lembur",
        orgName,
        docTitle: "Rekap Lembur",
        header: ["Tanggal", "Nama", "Username", "Jabatan", "Jam Mulai", "Jam Selesai", "Jam Diajukan", "Jam Dibayar", "Mode Bayar", "Tarif/Jam", "Nominal Tetap", "Uang Lembur", "Status", "Alasan"],
        columnMeta: [
          { numFmt: DATE_FMT }, {}, {}, {}, {}, {}, { align: "right" }, { align: "right" }, {},
          { align: "right", numFmt: '"Rp"#,##0' }, { align: "right", numFmt: '"Rp"#,##0' },
          { align: "right", numFmt: '"Rp"#,##0' }, {}, { wrap: true },
        ],
        rows: filtered.map((r) => [
          new Date(r.date + "T00:00:00Z"),
          r.user?.full_name || "–",
          r.user?.username || "–",
          r.user?.position || "–",
          r.start_time,
          r.end_time,
          Number(r.requested_hours),
          r.approved_hours != null ? Number(r.approved_hours) : null,
          r.pay_mode === "fixed" ? "Nominal tetap" : "Per jam",
          r.pay_rate_per_hour != null ? Number(r.pay_rate_per_hour) : null,
          r.fixed_amount != null ? Number(r.fixed_amount) : null,
          r.pay_amount != null ? Number(r.pay_amount) : null,
          STATUS_LABEL[r.status] || r.status,
          r.status === "rejected" ? (r.rejection_reason || "") : (r.reason || ""),
        ]),
      });
      toast.success(`${filtered.length} baris diekspor`);
    } catch (err) {
      toast.error("Gagal mengekspor: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5 pb-24">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      {/* Header — judul halaman ada di banner ungu atas (Header.jsx);
          di sini hanya tombol aksi */}
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <button onClick={load} disabled={loading} className={btnPrimary + " !px-3"}>
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
        <button onClick={() => setShowCreate(true)} className={btnPrimary}>
          <Plus size={15} /> <span className="hidden sm:inline">Buat Lembur</span>
        </button>
      </div>

      {/* Tarif lembur — terlihat & bisa diubah langsung dari halaman ini */}
      <div className={`${cardBase} p-4 flex items-center justify-between gap-4 flex-wrap`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
            <Banknote size={18} className="text-emerald-300" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-slate-mist">Tarif Lembur Saat Ini</p>
            <p className="text-xl md:text-2xl font-bold text-green-yellow tabular-nums leading-tight">
              {rupiah(config.rate_per_hour)} <span className="text-xs font-medium text-slate-mist">/ jam</span>
            </p>
            <p className="text-[10px] text-slate-mist/70 mt-0.5">
              Minimal {config.min_minutes} menit · maksimal {config.max_hours_per_day} jam/hari
            </p>
          </div>
        </div>
        <button onClick={openRate} className={btnPrimary + " shrink-0"}>
          <Settings2 size={15} /> Ubah Tarif
        </button>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`${cardBase} p-4`}>
          <p className="text-xs text-slate-mist uppercase tracking-wider">Menunggu</p>
          <p className="text-2xl md:text-3xl font-bold text-amber-300 tabular-nums mt-1">{stats.pending}</p>
        </div>
        <div className={`${cardBase} p-4`}>
          <p className="text-xs text-slate-mist uppercase tracking-wider">Total Jam (bulan ini)</p>
          <p className="text-2xl md:text-3xl font-bold text-pure-white tabular-nums mt-1">{stats.totalHours.toLocaleString("id-ID")}</p>
        </div>
        <div className={`${cardBase} p-4`}>
          <p className="text-xs text-slate-mist uppercase tracking-wider">Total Uang (bulan ini)</p>
          <p className="text-lg md:text-2xl font-bold text-green-yellow mt-1">{rupiah(stats.totalPay)}</p>
        </div>
      </div>

      {/* Catatan aturan pembayaran lembur */}
      <div className={`${cardBase} p-4 border border-amber-500/25`}>
        <p className="text-xs text-slate-mist leading-relaxed">
          <span className="font-semibold text-amber-300">Catatan:</span> Lembur hanya dibayarkan bila pegawai melakukan absen pulang pada tanggal lembur.
        </p>
      </div>

      {/* Filter + Export */}
      <div className={`${cardBase} p-4`}>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-mist" />
            <input
              type="text" value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama pegawai…"
              className={`${inputBase} pl-10`}
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputBase} w-full sm:w-[150px]`}>
            <option value="">Semua Status</option>
            <option value="pending">Menunggu</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
          </select>
          <input
            type="month" value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className={`${inputBase} w-full sm:w-[160px]`}
          />
          <button onClick={handleExport} disabled={exporting || !filtered.length} className={btnPrimary + " shrink-0"}>
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Daftar */}
      <div className={`${cardBase} overflow-hidden`}>
        {loading ? (
          <div className="p-8 flex items-center justify-center gap-2 text-sm text-slate-mist">
            <Loader2 size={16} className="animate-spin" /> Memuat…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-mist">
            <Inbox size={26} className="mx-auto mb-2 opacity-50" />
            Tidak ada pengajuan lembur pada filter ini.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {filtered.map((r) => (
              <div key={r.id} className="px-4 py-3 hover:bg-white/[0.03] transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGradient(r.user?.full_name)} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                    {initials(r.user?.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-semibold text-pure-white truncate">{r.user?.full_name || "–"}</p>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${STATUS_STYLE[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-mist mt-0.5">
                      {fmtDate(r.date)} · {r.start_time}–{r.end_time} · {Number(r.requested_hours).toLocaleString("id-ID")} jam
                      {r.status === "approved" && r.pay_amount != null && (
                        r.pay_mode === "fixed"
                          ? <> · nominal tetap = <b className="text-green-yellow">{rupiah(r.pay_amount)}</b></>
                          : <> · dibayar {Number(r.approved_hours)} jam = <b className="text-green-yellow">{rupiah(r.pay_amount)}</b></>
                      )}
                    </p>
                    {r.reason && <p className="text-[10px] text-slate-mist/70 mt-0.5 italic truncate">"{r.reason}"</p>}
                    {r.status === "rejected" && r.rejection_reason && (
                      <p className="text-[10px] text-rose-300/80 mt-0.5">Alasan tolak: {r.rejection_reason}</p>
                    )}
                  </div>
                  {r.status === "pending" && (
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => openDecide(r, "approve")} disabled={processing === r.id}
                        className="p-2 rounded-xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-50"
                        title="Setujui">
                        <Check size={14} />
                      </button>
                      <button onClick={() => openDecide(r, "reject")} disabled={processing === r.id}
                        className="p-2 rounded-xl bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30 hover:bg-rose-500/25 disabled:opacity-50"
                        title="Tolak">
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  {r.status === "approved" && (
                    <button onClick={() => setCancelRow(r)} disabled={processing === r.id}
                      className="p-2 rounded-xl bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/25 hover:bg-rose-500/20 disabled:opacity-50 shrink-0"
                      title="Batalkan lembur">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sheet: setujui / tolak */}
      <BottomSheet
        open={!!decide}
        onClose={() => setDecide(null)}
        title={decide?.action === "approve" ? "Setujui Lembur" : "Tolak Pengajuan"}
        subtitle={decide ? `${decide.row.user?.full_name} · ${fmtDate(decide.row.date)} · ${decide.row.start_time}–${decide.row.end_time}` : ""}
      >
        {decide && (
          <div className="space-y-4 pb-2">
            <div className="rounded-2xl bg-white/5 p-3 text-xs text-slate-mist space-y-1">
              <p>Diajukan: <b className="text-pure-white">{Number(decide.row.requested_hours).toLocaleString("id-ID")} jam</b>
                {" "}({decide.row.start_time}–{decide.row.end_time})</p>
              <p>Tarif per jam: <b className="text-pure-white">{rupiah(config.rate_per_hour)}/jam</b></p>
              {decide.action === "approve" && (
                <p>Uang dibayar: <b className="text-green-yellow">
                  {decideMode === "fixed"
                    ? rupiah(Number(decideAmount) || 0) + " (nominal tetap)"
                    : rupiah((Number(hoursInput) || 0) * config.rate_per_hour)}
                </b></p>
              )}
            </div>

            {decide.action === "approve" ? (
              <>
                {/* Pilih cara bayar: per jam atau nominal tetap (borongan) */}
                <div>
                  <label className="text-xs font-semibold text-slate-mist block mb-1.5">Cara bayar</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { v: "hourly", label: "Per jam" },
                      { v: "fixed", label: "Nominal tetap" },
                    ].map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => setDecideMode(o.v)}
                        className={`py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                          decideMode === o.v
                            ? "bg-electric-violet text-pure-white border-electric-violet"
                            : "border-white/10 text-slate-mist hover:bg-white/5"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-mist block mb-1.5">
                    {decideMode === "fixed" ? "Nominal dibayar (Rp)" : "Jam yang dibayar"}
                  </label>
                  {decideMode === "fixed" ? (
                    <>
                      <input
                        type="number" step="1000" min="0"
                        value={decideAmount}
                        onChange={(e) => setDecideAmount(e.target.value)}
                        className={inputBase}
                        placeholder="500000"
                      />
                      <p className="text-[10px] text-slate-mist/70 mt-1">
                        Total uang untuk lembur ini, berapa pun jamnya (mis. jaga hari libur 07.00–23.00).
                      </p>
                    </>
                  ) : (
                    <>
                      <input
                        type="number" step="0.25" min="0" max={config.max_hours_per_day}
                        value={hoursInput}
                        onChange={(e) => setHoursInput(e.target.value)}
                        className={inputBase}
                      />
                      <p className="text-[10px] text-slate-mist/70 mt-1">
                        Boleh dikurangi dari pengajuan. Angka ini yang masuk slip gaji.
                      </p>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div>
                <label className="text-xs font-semibold text-slate-mist block mb-1.5">Alasan penolakan (opsional)</label>
                <textarea
                  rows={2} value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className={inputBase} style={{ resize: "none" }}
                />
              </div>
            )}

            <button
              onClick={submitDecide}
              disabled={processing === decide.row.id}
              className={btnPrimary + " w-full"}
            >
              {processing === decide.row.id ? <Loader2 size={15} className="animate-spin" /> : decide.action === "approve" ? <Check size={15} /> : <X size={15} />}
              {decide.action === "approve" ? "Setujui & Kunci Uang" : "Tolak Pengajuan"}
            </button>
          </div>
        )}
      </BottomSheet>

      {/* Sheet: batalkan lembur yang sudah disetujui */}
      <BottomSheet
        open={!!cancelRow}
        onClose={() => setCancelRow(null)}
        title="Batalkan Lembur"
        subtitle={cancelRow ? `${cancelRow.user?.full_name} · ${fmtDate(cancelRow.date)} · ${cancelRow.start_time}–${cancelRow.end_time}` : ""}
      >
        {cancelRow && (
          <div className="space-y-4 pb-2">
            <div className="rounded-2xl bg-rose-500/10 ring-1 ring-rose-500/20 p-3.5 text-xs text-slate-mist space-y-1.5">
              <p>Slot lembur ini <b className="text-pure-white">dihapus permanen</b>. Efeknya:</p>
              <p>· Uang lembur <b className="text-pure-white">{rupiah(cancelRow.pay_amount)}</b> tidak dibayarkan — slip gaji <i>draft</i> bulan lembur dihitung ulang otomatis.</p>
              <p>· Batas absen pulang pegawai kembali mengikuti jam shift (tidak lagi diperpanjang lembur ini).</p>
              <p className="text-slate-mist/70 pt-0.5">Pegawai dapat mengajukan ulang bila lembur masih diperlukan. Slip yang sudah <i>final</i> tidak diubah otomatis.</p>
            </div>
            <button
              onClick={submitCancel}
              disabled={processing === cancelRow.id}
              className="w-full py-3 rounded-full text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {processing === cancelRow.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              Ya, Batalkan Lembur
            </button>
            <button
              onClick={() => setCancelRow(null)}
              className="w-full py-2.5 rounded-full text-xs font-semibold text-slate-mist hover:bg-white/5 border border-white/10"
            >
              Jangan, Biarkan
            </button>
          </div>
        )}
      </BottomSheet>

      {/* Sheet: buat lembur */}
      <BottomSheet open={showCreate} onClose={() => setShowCreate(false)} title="Buat Lembur untuk Pegawai" subtitle="Langsung tercatat & disetujui">
        <div className="space-y-4 pb-2">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-mist">
                Pegawai {createUsers.length ? `(${createUsers.length} dipilih)` : ""}
              </label>
              <button
                type="button"
                onClick={() => setCreateUsers((p) => (p.length === members.length && members.length ? [] : members.map((m) => m.id)))}
                className="text-[10px] font-semibold text-electric-violet hover:underline"
              >
                {createUsers.length === members.length && members.length ? "Hapus semua" : "Pilih semua"}
              </button>
            </div>
            <div className="max-h-44 overflow-y-auto space-y-1 rounded-xl border border-white/10 bg-white/[0.03] p-1.5">
              {members.map((m) => (
                <label
                  key={m.id}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer text-xs transition-colors ${
                    createUsers.includes(m.id)
                      ? "bg-electric-violet/15 text-pure-white"
                      : "text-slate-mist hover:bg-white/5"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={createUsers.includes(m.id)}
                    onChange={() => setCreateUsers((p) => (p.includes(m.id) ? p.filter((x) => x !== m.id) : [...p, m.id]))}
                    className="accent-[#BF00FF] w-3.5 h-3.5 shrink-0"
                  />
                  <span className="flex-1 min-w-0 truncate font-medium">{m.full_name}</span>
                  {m.position && <span className="text-[9px] text-slate-mist/70 truncate max-w-[45%]">{m.position}</span>}
                </label>
              ))}
              {!members.length && (
                <p className="text-[10px] text-slate-mist/60 text-center py-4">Tidak ada pegawai</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-mist block mb-1.5">Tanggal</label>
              <input type="date" value={createForm.date}
                onChange={(e) => setCreateForm({ ...createForm, date: e.target.value })}
                className={inputBase} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-mist block mb-1.5">Mulai</label>
              <input type="time" value={createForm.start_time}
                onChange={(e) => setCreateForm({ ...createForm, start_time: e.target.value })}
                className={inputBase} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-mist block mb-1.5">Selesai</label>
              <input type="time" value={createForm.end_time}
                onChange={(e) => setCreateForm({ ...createForm, end_time: e.target.value })}
                className={inputBase} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-mist block mb-1.5">Alasan (opsional)</label>
            <input type="text" value={createForm.reason}
              onChange={(e) => setCreateForm({ ...createForm, reason: e.target.value })}
              placeholder="Contoh: penambahan jaga sore"
              className={inputBase} />
          </div>

          {/* Cara bayar: per jam atau nominal tetap (borongan) */}
          <div>
            <label className="text-xs font-semibold text-slate-mist block mb-1.5">Cara bayar</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: "hourly", label: "Per jam" },
                { v: "fixed", label: "Nominal tetap" },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setCreateForm({ ...createForm, pay_mode: o.v })}
                  className={`py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                    createForm.pay_mode === o.v
                      ? "bg-electric-violet text-pure-white border-electric-violet"
                      : "border-white/10 text-slate-mist hover:bg-white/5"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {createForm.pay_mode === "fixed" ? (
            <div>
              <label className="text-xs font-semibold text-slate-mist block mb-1.5">Nominal dibayar (Rp)</label>
              <input type="number" step="1000" min="0"
                value={createForm.fixed_amount}
                onChange={(e) => setCreateForm({ ...createForm, fixed_amount: e.target.value })}
                placeholder="500000"
                className={inputBase} />
              <p className="text-[10px] text-slate-mist/70 mt-1">
                Total uang untuk lembur ini, berapa pun jamnya — mis. jaga hari libur 07.00–23.00 = Rp500.000.
                Tidak dibatasi maksimal jam/hari.
              </p>
            </div>
          ) : (
            <p className="text-[10px] text-slate-mist/70">
              Uang = jam × tarif {rupiah(config.rate_per_hour)}/jam, dihitung otomatis oleh server.
            </p>
          )}

          <button onClick={submitCreate} disabled={creating} className={btnPrimary + " w-full"}>
            {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Catat Lembur
          </button>
        </div>
      </BottomSheet>

      {/* Sheet: pengaturan tarif lembur */}
      <BottomSheet
        open={showRate}
        onClose={() => setShowRate(false)}
        title="Pengaturan Tarif Lembur"
        subtitle="Berlaku untuk persetujuan berikutnya — lembur lama tidak berubah"
      >
        <div className="space-y-4 pb-2">
          <div>
            <label className="text-xs font-semibold text-slate-mist block mb-1.5">Tarif per jam (Rp)</label>
            <input
              type="number" min="1" step="500"
              value={rateForm.rate_per_hour}
              onChange={(e) => setRateForm({ ...rateForm, rate_per_hour: e.target.value })}
              className={inputBase}
              placeholder="15000"
            />
            <div className="flex gap-2 mt-2 flex-wrap">
              {[10000, 15000, 20000, 25000].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setRateForm({ ...rateForm, rate_per_hour: String(v) })}
                  className="px-3 py-1.5 rounded-full text-[11px] font-semibold border border-white/10 text-slate-mist hover:bg-white/5"
                >
                  {rupiah(v)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-mist block mb-1.5">Minimal menit</label>
              <input
                type="number" min="0" step="5"
                value={rateForm.min_minutes}
                onChange={(e) => setRateForm({ ...rateForm, min_minutes: e.target.value })}
                className={inputBase}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-mist block mb-1.5">Maks jam/hari</label>
              <input
                type="number" min="1" max="24" step="0.5"
                value={rateForm.max_hours_per_day}
                onChange={(e) => setRateForm({ ...rateForm, max_hours_per_day: e.target.value })}
                className={inputBase}
              />
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 p-3 text-[11px] text-slate-mist">
            Contoh: 2 jam lembur × {rupiah(Number(rateForm.rate_per_hour) || 0)} ={" "}
            <b className="text-green-yellow">
              {rupiah((Number(rateForm.rate_per_hour) || 0) * 2)}
            </b>
          </div>

          <button onClick={submitRate} disabled={savingRate} className={btnPrimary + " w-full"}>
            {savingRate ? <Loader2 size={15} className="animate-spin" /> : <Settings2 size={15} />}
            Simpan Tarif
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
