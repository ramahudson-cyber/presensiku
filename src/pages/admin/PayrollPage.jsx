import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import {
  isPayrollEnabled, setPayrollEnabled, getPayrollConfig, savePayrollConfig,
  getEmployeeConfigs, saveEmployeeConfigs, recalculatePayroll, getPayrollLines,
} from "../../services/payrollService";
import { exportExcelWorkbook, RUPIAH } from "../../services/excelExport";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import usePullToRefresh from "../../hooks/usePullToRefresh";
import PullToRefreshIndicator from "../../components/PullToRefreshIndicator";
import {
  Wallet, Calculator, Users, SlidersHorizontal, Loader2,
  Save, Download, Power, CheckCircle2, Info,
} from "lucide-react";

const T = {
  text: "#0F172A",
  textSec: "#475569",
  textMuted: "#94A3B8",
  border: "rgba(31,41,55,0.08)",
  surface: "#FFFFFF",
};

const rupiah = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");
const monthLabel = (period) => {
  const d = new Date(period + "T00:00:00");
  return d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
};
const currentPeriod = () => new Date().toISOString().slice(0, 7) + "-01";

export default function PayrollPage() {
  const { user } = useAuth();
  const [enabled, setEnabledState] = useState(null); // null = memuat
  const [tab, setTab] = useState("rekap");
  // Pull-to-refresh: naikkan refreshKey untuk me-remount tab aktif (re-fetch saat mount)
  const [refreshKey, setRefreshKey] = useState(0);
  const { pullDistance, isRefreshing } = usePullToRefresh(() => setRefreshKey((k) => k + 1));
  const [period, setPeriod] = useState(currentPeriod());
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recalcing, setRecalcing] = useState(false);
  // Saat super_admin switch instansi, flag dibaca ulang untuk org target
  const override = user?.active_org_override;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const on = await isPayrollEnabled();
        if (!cancelled) setEnabledState(on);
      } catch {
        if (!cancelled) setEnabledState(false);
      }
    })();
    return () => { cancelled = true; };
  }, [override]);

  // Aktifkan modul
  const handleEnable = async () => {
    const result = await Swal.fire({
      title: "Aktifkan modul Gaji?",
      html: "Menu <b>Gaji</b> akan muncul untuk admin instansi ini, dan pegawai mendapat menu <b>Slip Gaji</b>.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Aktifkan",
      cancelButtonText: "Batal",
      confirmButtonColor: "#BF00FF",
    });
    if (!result.isConfirmed) return;
    try {
      await setPayrollEnabled(true);
      setEnabledState(true);
      try { await recalculatePayroll(period); } catch { /* kosong saat belum ada config */ }
      toast.success("Modul Gaji diaktifkan");
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (enabled === null) {
    return (
      <div className="p-6 flex items-center justify-center gap-2 text-sm" style={{ color: T.textMuted }}>
        <Loader2 size={16} className="animate-spin" /> Memuat modul gaji...
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-3xl p-8 border text-center max-w-lg mx-auto" style={{ borderColor: T.border }}>
          <div className="w-14 h-14 rounded-full bg-electric-violet/10 flex items-center justify-center mx-auto mb-4">
            <Wallet size={26} className="text-electric-violet" />
          </div>
          <h2 className="font-bold text-lg" style={{ color: T.text }}>Modul Gaji Berbasis Kehadiran</h2>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: T.textSec }}>
            Hitung otomatis potongan keterlambatan (nominal per tingkatan) dan
            hari alpha berdasarkan data absensi, lalu dapatkan total gaji per
            pegawai setiap bulan.
          </p>
          <p className="text-[11px] mt-3" style={{ color: T.textMuted }}>
            Modul ini opsional dan saat ini <b>nonaktif</b> untuk instansi Anda.
          </p>
          <button
            onClick={handleEnable}
            className="mt-5 inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-electric-violet text-white text-sm font-semibold hover:brightness-110 active:scale-[0.98] transition-all"
          >
            <Power size={15} /> Aktifkan Modul
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: T.text }}>Gaji</h1>
        <p className="text-sm mt-0.5" style={{ color: T.textSec }}>
          Potongan keterlambatan & alpha dihitung otomatis dari absensi
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: "rekap", label: "Rekap Bulanan", icon: Calculator },
          { id: "gaji", label: "Gaji Pegawai", icon: Users },
          { id: "aturan", label: "Aturan Potongan", icon: SlidersHorizontal },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
              tab === id ? "bg-electric-violet text-white shadow-md" : "bg-white border hover:bg-gray-50"
            }`}
            style={tab === id ? {} : { borderColor: T.border, color: T.textSec }}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {tab === "rekap" && <TabRekap key={refreshKey} period={period} setPeriod={setPeriod} lines={lines} setLines={setLines} loading={loading} setLoading={setLoading} recalcing={recalcing} setRecalcing={setRecalcing} orgName={override ? user?.override_org?.name : user?.organization?.name} />}
      {tab === "gaji" && <TabGaji key={refreshKey} user={user} period={period} />}
      {tab === "aturan" && <TabAturan key={refreshKey} period={period} />}
    </div>
  );
}

/* ================= TAB REKAP ================= */
function TabRekap({ period, setPeriod, lines, setLines, loading, setLoading, recalcing, setRecalcing, orgName }) {
  const [exporting, setExporting] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLines(await getPayrollLines(period));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const handleRecalc = async () => {
    setRecalcing(true);
    try {
      const result = await recalculatePayroll(period);
      toast.success(result?.message || "Rekap dihitung ulang");
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRecalcing(false);
    }
  };

  const totals = lines.reduce(
    (acc, l) => ({
      base: acc.base + Number(l.base_component),
      cut: acc.cut + Number(l.total_deduction),
      received: acc.received + Number(l.total_received),
    }),
    { base: 0, cut: 0, received: 0 }
  );

  const exportExcel = async () => {
    setExporting(true);
    try {
      const sum = (k) => lines.reduce((a, l) => a + Number(l[k] || 0), 0);
      await exportExcelWorkbook({
        filename: `gaji-${period}.xlsx`,
        sheetName: "Rekap Gaji",
        orgName,
        docTitle: `Rekap Gaji — ${monthLabel(period)}`,
        header: [
          "Nama", "Username", "Hari Kerja", "Hadir", "Terlambat", "Menit Telat",
          "Alpha", "Izin", "Sakit", "Pot. Terlambat", "Pot. Alpha", "Total Potongan", "Diterima",
        ],
        columnMeta: [
          { align: "left" }, { align: "left" },
          ...Array.from({ length: 7 }, () => ({ align: "right" })),
          ...Array.from({ length: 4 }, () => ({ align: "right", numFmt: RUPIAH })),
        ],
        rows: lines.map((l) => [
          l.user?.full_name || "-", l.user?.username || "-",
          Number(l.work_days || 0), Number(l.hadir || 0), Number(l.terlambat || 0),
          Number(l.late_minutes_total || 0), Number(l.alpha_days || 0),
          Number(l.izin_days || 0), Number(l.sakit_days || 0),
          Number(l.late_deduction || 0), Number(l.alpha_deduction || 0),
          Number(l.total_deduction || 0), Number(l.total_received || 0),
        ]),
        totalRow: [
          "TOTAL", "", sum("work_days"), sum("hadir"), sum("terlambat"),
          sum("late_minutes_total"), sum("alpha_days"), sum("izin_days"), sum("sakit_days"),
          sum("late_deduction"), sum("alpha_deduction"), sum("total_deduction"), sum("total_received"),
        ],
      });
    } catch (e) {
      console.error(e);
      toast.error("Gagal mengekspor Excel");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Kontrol periode + hitung */}
      <div className="flex flex-wrap items-end gap-3 bg-white rounded-3xl border p-4" style={{ borderColor: T.border }}>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: T.textMuted }}>Periode</label>
          <input
            type="month" value={period.slice(0, 7)} onChange={(e) => setPeriod(e.target.value + "-01")}
            className="px-3 py-2 rounded-2xl border text-sm focus:outline-none focus:border-electric-violet"
            style={{ borderColor: T.border, color: T.text }}
          />
        </div>
        <button
          onClick={handleRecalc} disabled={recalcing}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-electric-violet text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition-all"
        >
          {recalcing ? <Loader2 size={15} className="animate-spin" /> : <Calculator size={15} />}
          {recalcing ? "Menghitung..." : "Hitung dari Absensi"}
        </button>
        {lines.length > 0 && (
          <button
            onClick={exportExcel}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 transition-all"
            style={{ borderColor: T.border, color: T.textSec }}
          >
            <Download size={15} /> Excel
          </button>
        )}
      </div>

      {/* Ringkasan */}
      {lines.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Total Komponen", value: totals.base, cls: "text-slate-800" },
            { label: "Total Potongan", value: totals.cut, cls: "text-red-500" },
            { label: "Total Dibayarkan", value: totals.received, cls: "text-emerald-600" },
          ].map(({ label, value, cls }) => (
            <div key={label} className="bg-white rounded-3xl border p-4" style={{ borderColor: T.border }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: T.textMuted }}>{label}</p>
              <p className={`text-xl font-extrabold mt-1 ${cls}`}>{rupiah(value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabel rekap */}
      <div className="bg-white rounded-3xl border overflow-x-auto" style={{ borderColor: T.border }}>
        {loading ? (
          <div className="p-10 flex items-center justify-center gap-2 text-sm" style={{ color: T.textMuted }}>
            <Loader2 size={16} className="animate-spin" /> Memuat rekap...
          </div>
        ) : lines.length === 0 ? (
          <div className="p-10 text-center text-sm space-y-2" style={{ color: T.textMuted }}>
            <Info size={22} className="mx-auto" />
            <p>Belum ada rekap untuk {monthLabel(period)}.</p>
            <p className="text-[11px]">Klik <b>Hitung dari Absensi</b> — pastikan gaji pegawai sudah diisi di tab "Gaji Pegawai".</p>
          </div>
        ) : (
          <table className="w-full text-[11px] min-w-[860px]">
            <thead>
              <tr className="text-left text-slate-500 border-b" style={{ borderColor: T.border }}>
                {[
                  { h: "Pegawai", align: "text-left" },
                  { h: "Hadir", align: "text-center" },
                  { h: "Telat", align: "text-center" },
                  { h: "Menit", align: "text-center" },
                  { h: "Alpha", align: "text-center" },
                  { h: "Izin/Sakit", align: "text-center" },
                  { h: "Harian", align: "text-right" },
                  { h: "Pot. Telat", align: "text-right" },
                  { h: "Pot. Alpha", align: "text-right" },
                  { h: "Diterima", align: "text-right" },
                ].map(({ h, align }) => (
                  <th key={h} className={`px-3 py-2.5 font-semibold whitespace-nowrap ${align}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-b last:border-0 hover:bg-gray-50" style={{ borderColor: T.border }}>
                  <td className="px-3 py-2.5">
                    <p className="font-bold text-slate-800">{l.user?.full_name || l.user?.username}</p>
                    <p className="text-[10px] text-slate-400">{l.user?.employee_status?.toUpperCase()}</p>
                  </td>
                  <td className="px-3 py-2.5 text-center">{l.hadir}</td>
                  <td className="px-3 py-2.5 text-center">{l.terlambat}</td>
                  <td className="px-3 py-2.5 text-center">{l.late_minutes_total} mnt</td>
                  <td className="px-3 py-2.5 text-center text-red-500 font-semibold">{l.alpha_days}</td>
                  <td className="px-3 py-2.5 text-center">{l.izin_days}/{l.sakit_days}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-right">{rupiah(l.daily_rate)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-right text-red-500">{rupiah(l.late_deduction)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-right text-red-500">{rupiah(l.alpha_deduction)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-right font-extrabold text-emerald-600">{rupiah(l.total_received)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ================= TAB GAJI PEGAWAI ================= */
function TabGaji({ user, period }) {
  const [employees, setEmployees] = useState([]);
  const [values, setValues] = useState({}); // user_id -> string nominal
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const organizationId = user?.active_org_override || user?.organization_id;

  useEffect(() => {
    (async () => {
      try {
        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("id, full_name, username, employee_status, role")
          .eq("organization_id", organizationId)
          .order("full_name", { ascending: true });
        if (error) throw error;
        setEmployees(profiles || []);
        const configs = await getEmployeeConfigs();
        const map = {};
        configs.forEach((c) => { map[c.user_id] = String(Number(c.base_component)); });
        setValues(map);
      } catch (err) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [organizationId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const rows = employees
        .filter((e) => values[e.id] !== undefined && values[e.id] !== "")
        .map((e) => ({ user_id: e.id, base_component: Number(values[e.id]) || 0 }));
      await saveEmployeeConfigs(organizationId, rows);
      let recalcMsg = "";
      try {
        const r = await recalculatePayroll(period);
        recalcMsg = r?.message || "Rekap dihitung ulang";
      } catch (recalcErr) {
        toast.warning("Gaji tersimpan, tapi gagal hitung ulang rekap: " + recalcErr.message);
      }
      toast.success(recalcMsg ? "Gaji pegawai disimpan — " + recalcMsg : "Gaji pegawai disimpan");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl border p-4 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: T.border }}>
        <p className="text-xs" style={{ color: T.textSec }}>
          Isi <b>gaji/komponen yang dipotong</b> untuk setiap pegawai. Kosong = pegawai tidak ikut perhitungan.
        </p>
        <button
          onClick={handleSave} disabled={saving || loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-electric-violet text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition-all"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan
        </button>
      </div>

      <div className="bg-white rounded-3xl border overflow-hidden" style={{ borderColor: T.border }}>
        {loading ? (
          <div className="p-10 flex items-center justify-center gap-2 text-sm" style={{ color: T.textMuted }}>
            <Loader2 size={16} className="animate-spin" /> Memuat pegawai...
          </div>
        ) : employees.length === 0 ? (
          <div className="p-10 text-center text-sm" style={{ color: T.textMuted }}>Belum ada pegawai di instansi ini.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: T.border }}>
            {employees.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: T.text }}>{e.full_name}</p>
                  <p className="text-[10px]" style={{ color: T.textMuted }}>
                    {e.username} · {(e.employee_status || "pegawai").toUpperCase()}
                  </p>
                </div>
                <div className="relative shrink-0 w-44">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">Rp</span>
                  <input
                    type="number" min="0" step="1000"
                    value={values[e.id] ?? ""}
                    onChange={(ev) => setValues((v) => ({ ...v, [e.id]: ev.target.value }))}
                    placeholder="0"
                    className="w-full pl-8 pr-3 py-2 rounded-2xl border text-sm focus:outline-none focus:border-electric-violet"
                    style={{ borderColor: T.border, color: T.text }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= TAB ATURAN POTONGAN ================= */
function TabAturan({ period }) {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await getPayrollConfig();
        if (!cancelled) setConfig(cfg);
      } catch {
        if (!cancelled) setConfig({ late_tiers: [], alpha_nominal_per_day: 0 });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!config) {
    return (
      <div className="p-10 flex items-center justify-center gap-2 text-sm bg-white rounded-3xl border" style={{ color: T.textMuted, borderColor: T.border }}>
        <Loader2 size={16} className="animate-spin" /> Memuat aturan...
      </div>
    );
  }

  const setTier = (idx, field, value) => {
    setConfig((c) => {
      const tiers = c.late_tiers.map((t, i) => (i === idx ? { ...t, [field]: value === "" ? null : Number(value) } : t));
      return { ...c, late_tiers: tiers };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await savePayrollConfig(config);
      try {
        const r = await recalculatePayroll(period);
        toast.success("Aturan disimpan — " + (r?.message || "rekap dihitung ulang"));
      } catch (recalcErr) {
        toast.warning("Aturan tersimpan, tapi gagal hitung ulang rekap: " + recalcErr.message);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl border p-4 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: T.border }}>
        <p className="text-xs" style={{ color: T.textSec }}>
          Atur <b>nominal potongan keterlambatan</b> per tingkatan menit dan <b>potongan alpha per hari</b>. Snapshot aturan disertakan di setiap rekap.
        </p>
        <button
          onClick={handleSave} disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-electric-violet text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition-all"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan Aturan
        </button>
      </div>

      <div className="bg-white rounded-3xl border p-4 space-y-3" style={{ borderColor: T.border }}>
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: T.textMuted }}>Potongan Keterlambatan (nominal per kejadian)</p>
        {config.late_tiers.map((t, i) => {
          const nextMin = config.late_tiers[i + 1]?.min;
          return (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                type="number" min="1" value={t.min ?? ""}
                onChange={(e) => setTier(i, "min", e.target.value)}
                className="w-20 px-3 py-2 rounded-2xl border text-sm focus:outline-none focus:border-electric-violet"
                style={{ borderColor: T.border, color: T.text }}
                title="Menit minimal"
              />
              <span className="text-xs" style={{ color: T.textMuted }}>s/d</span>
              <input
                type="number" min="1" value={t.max ?? ""}
                placeholder={nextMin ? nextMin - 1 : "∞"}
                onChange={(e) => setTier(i, "max", e.target.value)}
                className="w-20 px-3 py-2 rounded-2xl border text-sm focus:outline-none focus:border-electric-violet"
                style={{ borderColor: T.border, color: T.text }}
                title="Menit maksimal (kosong = ke atas)"
              />
              <span className="text-xs" style={{ color: T.textMuted }}>menit</span>
              <span className="text-xs font-bold" style={{ color: T.text }}>→</span>
              <div className="relative w-40">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">Rp</span>
                <input
                  type="number" min="0" step="500" value={t.nominal ?? 0}
                  onChange={(e) => setTier(i, "nominal", e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-2xl border text-sm font-semibold focus:outline-none focus:border-electric-violet"
                  style={{ borderColor: T.border, color: T.text }}
                  title="Nominal potongan per kejadian"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-3xl border p-4 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: T.border }}>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: T.textMuted }}>Potongan Alpha</p>
          <p className="text-xs mt-0.5" style={{ color: T.textSec }}>Nominal per hari tanpa keterangan</p>
        </div>
        <div className="relative w-44">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">Rp</span>
          <input
            type="number" min="0" step="1000" value={config.alpha_nominal_per_day ?? 0}
            onChange={(e) => setConfig((c) => ({ ...c, alpha_nominal_per_day: Number(e.target.value) }))}
            className="w-full pl-9 pr-3 py-2 rounded-2xl border text-sm font-semibold focus:outline-none focus:border-electric-violet"
            style={{ borderColor: T.border, color: T.text }}
            title="Nominal per hari alpha"
          />
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-[11px] text-sky-700">
        <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
        <span>Perubahan langsung dihitung ulang untuk bulan yang dipilih di tab Rekap Bulanan.</span>
      </div>
    </div>
  );
}
