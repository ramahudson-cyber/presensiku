// src/pages/employee/overtime/OvertimeHistoryPage.jsx
// Riwayat lembur dengan filter status dan periode. Data: overtime_requests milik user.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { getMyOvertimeRequests } from "../../../services/overtimeService";
import {
  OT, Icon, StatusBadge, LightAppBar, Loader, ErrorState, EmptyState,
  MonthMenu, monthOptions, currentMonthKey, monthKeyOf,
  durationLabel,
} from "./overtimeUi";

const FILTERS = [
  { key: "all", label: "Semua" },
  { key: "approved", label: "Disetujui" },
  { key: "pending", label: "Menunggu" },
  { key: "rejected", label: "Ditolak" },
];

export default function OvertimeHistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("all");
  const [month, setMonth] = useState(currentMonthKey());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError("");
    try {
      setRows(await getMyOvertimeRequests());
    } catch (e) {
      setError(e.message || "Gagal memuat riwayat lembur");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const kick = setTimeout(load, 0);
    return () => clearTimeout(kick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const filtered = useMemo(() => rows.filter((r) => (
    monthKeyOf(r.date) === month && (filter === "all" || r.status === filter)
  )), [rows, month, filter]);

  return (
    <div className="absolute inset-x-0 top-0" style={{ minHeight: "100vh", background: OT.bg, color: OT.text }}>
      <div className="mx-auto w-full max-w-md">
        <LightAppBar title="Riwayat Lembur" onBack={() => navigate("/employee/overtime")} />

        <div className="px-4">
          {/* Rail full-bleed: tepi scroll = tepi layar, chip menerus keluar tepi
              (ala referensi), padding tetap di dalam scroll */}
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1 -mx-4 pl-4 pr-6"
            style={{ scrollSnapType: "x proximity", scrollPaddingLeft: 16 }}>
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button key={f.key} type="button" onClick={() => setFilter(f.key)}
                  className="active:scale-[0.98] transition"
                  style={{
                    flexShrink: 0, padding: "9px 16px", borderRadius: 999, cursor: "pointer",
                    scrollSnapAlign: "start",
                    border: active ? "none" : `1px solid ${OT.border}`,
                    background: active ? OT.brand : "#fff",
                    color: active ? "#fff" : OT.textSec,
                    fontSize: 12, fontWeight: 700,
                  }}>{f.label}</button>
              );
            })}
          </div>

          <div className="flex items-center justify-between" style={{ marginTop: 14, marginBottom: 10 }}>
            <p style={{ fontSize: 13, fontWeight: 800 }}>
              {filtered.length} pengajuan
            </p>
            <MonthMenu value={month} onChange={setMonth} options={monthOptions(rows, currentMonthKey())} />
          </div>

          {loading ? (
            <Loader label="Memuat riwayat..." />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Belum ada riwayat"
              subtitle="Tidak ada pengajuan lembur pada periode dan status yang dipilih."
            />
          ) : (
            <div className="space-y-2 pb-10">
              {filtered.map((r) => (
                <Link key={r.id} to={`/employee/overtime/${r.id}`}
                  className="flex items-center gap-3 active:scale-[0.99] transition"
                  style={{
                    background: "#fff", border: `1px solid ${OT.border}`, borderRadius: 14,
                    padding: "10px 14px", boxShadow: OT.rowShadow, textDecoration: "none",
                  }}>
                  <span className="text-center shrink-0" style={{ width: 40, lineHeight: 1.1 }}>
                    <b style={{ display: "block", fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
                      {new Date(r.date + "T00:00:00").getDate()}
                    </b>
                    <span style={{ display: "block", fontSize: 10.5, fontWeight: 600, color: OT.textMuted, marginTop: 2 }}>
                      {new Date(r.date + "T00:00:00").toLocaleDateString("id-ID", { month: "short" })}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate" style={{ fontSize: 13, fontWeight: 700 }}>
                      {r.reason?.trim() ? r.reason.trim() : "Pengajuan lembur"}
                    </span>
                    <span className="block truncate" style={{ fontSize: 11, color: OT.textSec, marginTop: 2 }}>
                      {r.start_time} - {r.end_time} ({durationLabel(r.requested_hours)})
                    </span>
                  </span>
                  <StatusBadge status={r.status} />
                  <Icon.chevron size={15} sw={2.4} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
