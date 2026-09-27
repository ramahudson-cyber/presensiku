import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { isPayrollEnabled, getMyPayrollLines } from "../../services/payrollService";
import { getCurrentVersion } from "../../services/updateService";
import { Wallet, Loader2, Download, Info } from "lucide-react";
import usePullToRefresh from "../../hooks/usePullToRefresh";
import PullToRefreshIndicator from "../../components/PullToRefreshIndicator";

const rupiah = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");
const monthLabel = (period) => {
  const d = new Date(period + "T00:00:00");
  return d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
};
const statusEnum = {
  asn: "ASN",
  pppk_penuh_waktu: "PPPK Penuh Waktu",
  pppk_paruh_waktu: "PPPK Paruh Waktu",
  tpk: "TPK",
};

function EmployeeSalaryPage() {
  const { user } = useAuth();
  const [enabled, setEnabledState] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLines(await getMyPayrollLines());
    } catch {
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const on = await isPayrollEnabled();
        if (cancelled) return;
        setEnabledState(on);
        if (on) await load();
        else setLoading(false);
      } catch {
        if (!cancelled) {
          setEnabledState(false);
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [load]);

  const { pullDistance, isRefreshing } = usePullToRefresh(load);

  const downloadSlip = (line) => {
    const orgName = user?.organization?.name || "Presensiku";
    const win = window.open("", "_blank", "width=720,height=900");
    if (!win) return;
    const rows = [
      ["Gaji / Komponen", rupiah(line.base_component)],
      ["Hari Kerja", `${line.work_days} hari`],
      ["Hadir", `${line.hadir} hari`],
      ["Terlambat", `${line.terlambat} kali (${line.late_minutes_total} menit)`],
      ["Alpha", `${line.alpha_days} hari`],
      ["Izin / Sakit", `${line.izin_days} / ${line.sakit_days} hari`],
      ["Potongan Keterlambatan", "− " + rupiah(line.late_deduction)],
      ["Potongan Alpha", "− " + rupiah(line.alpha_deduction)],
    ];
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Slip Gaji ${monthLabel(line.period_month)}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #111; }
        .kop { text-align: center; border-bottom: 3px double #333; padding-bottom: 12px; margin-bottom: 24px; }
        .kop h1 { font-size: 18px; margin: 0; text-transform: uppercase; }
        .kop p { font-size: 11px; color: #555; margin: 4px 0 0; }
        h2 { font-size: 14px; text-align: center; margin: 18px 0; text-transform: uppercase; letter-spacing: 1px; }
        .id { font-size: 11px; margin-bottom: 14px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        td { padding: 7px 8px; border-bottom: 1px solid #eee; }
        td:first-child { width: 45%; color: #444; }
        td:last-child { text-align: right; font-weight: 600; }
        tr.total td { background: #f1f5f9; font-weight: 800; font-size: 13px; border-top: 2px solid #333; }
        .ttd { margin-top: 56px; display: flex; justify-content: space-between; font-size: 12px; text-align: center; }
        .ttd .box { width: 220px; }
        .ttd .line { margin-top: 64px; border-top: 1px solid #333; padding-top: 4px; }
        @media print { body { margin: 12mm; } }
      </style></head><body>
      <div class="kop"><h1>${orgName}</h1><p>Slip Gaji Berbasis Kehadiran</p></div>
      <h2>Slip Gaji — ${monthLabel(line.period_month)}</h2>
      <div class="id">
        <b>${line.user?.full_name || user?.full_name || ""}</b> (${line.user?.username || user?.username || ""})
        — ${statusEnum[line.user?.employee_status] || user?.employee_status || "Pegawai"}
      </div>
      <table>
        ${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}
        <tr class="total"><td>TOTAL DITERIMA</td><td>${rupiah(line.total_received)}</td></tr>
      </table>
      <div class="ttd">
        <div class="box"><div>Pegawai Ybs.</div><div class="line">${line.user?.full_name || ""}</div></div>
        <div class="box"><div>Kepala Unit ${orgName}</div><div class="line">&nbsp;</div></div>
      </div>
      <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
      </body></html>`);
    win.document.close();
  };

  if (enabled === null || loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> Memuat slip gaji...
        </div>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-3xl p-8 border text-center max-w-sm" style={{ borderColor: T_BORDER }}>
          <Info size={26} className="mx-auto mb-3 text-slate-400" />
          <p className="text-sm text-slate-600">Modul gaji belum diaktifkan untuk instansi Anda.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full absolute top-0 left-0 right-0 pb-24 bg-slate-50">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <div className="max-w-md mx-auto p-4 pt-12 space-y-4">
        <div className="text-center mb-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Slip Gaji</h1>
          <p className="text-xs text-slate-500 mt-0.5">Riwayat gaji berbasis kehadiran</p>
        </div>

        {lines.length === 0 ? (
          <div className="bg-white rounded-3xl border p-10 text-center space-y-2" style={{ borderColor: T_BORDER }}>
            <Wallet size={26} className="mx-auto text-slate-300" />
            <p className="text-sm text-slate-500">Belum ada data gaji.</p>
            <p className="text-[11px] text-slate-400">Slip muncul setelah admin menghitung rekap bulanan.</p>
          </div>
        ) : (
          lines.map((line) => (
            <div key={line.id} className="bg-white rounded-3xl border shadow-sm overflow-hidden" style={{ borderColor: T_BORDER }}>
              <div className="px-5 pt-4 pb-3 border-b flex items-center justify-between" style={{ borderColor: T_BORDER }}>
                <div>
                  <p className="font-bold text-slate-900">{monthLabel(line.period_month)}</p>
                  <p className="text-[10px] text-slate-400">
                    Status: {line.status === "final" ? "Final" : "Draft"}
                  </p>
                </div>
                <button
                  onClick={() => downloadSlip(line)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-electric-violet/10 text-electric-violet hover:bg-electric-violet/20 transition-colors"
                >
                  <Download size={12} /> Unduh PDF
                </button>
              </div>
              <div className="px-5 py-3 space-y-1.5 text-[13px]">
                <Row label="Gaji / Komponen" value={rupiah(line.base_component)} />
                <Row label={`Hadir ${line.hadir} dari ${line.work_days} hari`} value="" muted />
                <Row label={`Terlambat ${line.terlambat}× (${line.late_minutes_total} mnt)`} value={"− " + rupiah(line.late_deduction)} red />
                <Row label={`Alpha ${line.alpha_days} hari`} value={"− " + rupiah(line.alpha_deduction)} red />
                <Row label={`Izin ${line.izin_days} hari · Sakit ${line.sakit_days} hari`} value="tidak dipotong" muted />
                <div className="border-t pt-2.5 mt-2.5 flex items-center justify-between" style={{ borderColor: T_BORDER }}>
                  <span className="font-extrabold text-slate-900">DITERIMA</span>
                  <span className="font-extrabold text-emerald-600 text-base">{rupiah(line.total_received)}</span>
                </div>
              </div>
            </div>
          ))
        )}

        <p className="text-center text-[10px] text-slate-400 pt-2">v{getCurrentVersion().version} — Presensiku</p>
      </div>
    </div>
  );
}

const T_BORDER = "rgba(31,41,55,0.08)";

function Row({ label, value, red, muted }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={muted ? "text-slate-400" : "text-slate-600"}>{label}</span>
      <span className={`font-semibold whitespace-nowrap ${red ? "text-red-500" : muted ? "text-slate-400 italic text-[11px]" : "text-slate-800"}`}>
        {value}
      </span>
    </div>
  );
}

export default EmployeeSalaryPage;
