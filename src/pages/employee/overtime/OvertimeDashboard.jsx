// src/pages/employee/overtime/OvertimeDashboard.jsx
// Dashboard modul Lembur: ringkasan uang lembur + hitungan status + riwayat terbaru.
// Semua angka berasal dari tabel overtime_requests (RLS: hanya milik sendiri).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { getMyOvertimeRequests } from "../../../services/overtimeService";
import OvertimeRequestSheet from "./OvertimeRequestSheet";
import {
  OT, Icon, StatusBadge, Loader, ErrorState, EmptyState,
  MonthMenu, monthOptions, currentMonthKey, monthKeyOf,
  rupiah, durationLabel, fmtDate,
} from "./overtimeUi";

export default function OvertimeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [month, setMonth] = useState(currentMonthKey());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError("");
    try {
      setRows(await getMyOvertimeRequests());
    } catch (e) {
      setError(e.message || "Gagal memuat data lembur");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Muat lewat task terpisah agar tidak setState sinkron di body effect.
    const kick = setTimeout(load, 0);
    return () => clearTimeout(kick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const monthRows = useMemo(
    () => rows.filter((r) => monthKeyOf(r.date) === month),
    [rows, month]
  );

  const summary = useMemo(() => {
    const approved = monthRows.filter((r) => r.status === "approved");
    return {
      totalPay: approved.reduce((s, r) => s + Number(r.pay_amount || 0), 0),
      totalHours: approved.reduce((s, r) => s + Number(r.approved_hours || 0), 0),
      count: monthRows.length,
      approved: approved.length,
      pending: monthRows.filter((r) => r.status === "pending").length,
    };
  }, [monthRows]);

  const recent = monthRows.slice(0, 3);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  return (
    <div className="absolute inset-x-0 top-0" style={{ minHeight: "100vh", background: OT.bg, color: OT.text }}>
      {/* HERO */}
      <header
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #39C0DF 0%, #32ACFB 30%, #3F93FD 62%, #4A7CFB 100%)",
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)",
          paddingBottom: 44,
        }}
      >
        <span className="pointer-events-none absolute" style={{
          inset: 0,
          background: "linear-gradient(118deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 34%, rgba(255,255,255,0) 58%)",
        }} />
        <span className="pointer-events-none absolute rounded-full" style={{
          width: 240, height: 240, right: -84, top: -104, background: "rgba(255,255,255,0.10)",
        }} />
        <span className="pointer-events-none absolute rounded-full" style={{
          width: 170, height: 170, left: -70, bottom: -84, background: "rgba(255,255,255,0.07)",
        }} />

        <div className="relative mx-auto w-full max-w-md px-4">
          <div className="grid items-center gap-2" style={{ gridTemplateColumns: "34px 1fr 34px" }}>
            <button type="button" onClick={() => navigate("/employee")} aria-label="Kembali"
              className="flex items-center justify-center active:scale-95 transition"
              style={{ width: 34, height: 34, background: "none", border: "none", color: "#fff", cursor: "pointer" }}>
              <Icon.back size={18} sw={2.6} />
            </button>
            <h1 className="text-center" style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>
              Lembur
            </h1>
            <span />
          </div>

          <div className="relative mt-3.5">
            <p className="text-[20px] font-extrabold leading-[1.32] tracking-tight" style={{ color: "#fff", maxWidth: 238 }}>
              Kerja lebih produktif, semua lembur tercatat.
            </p>
            <p className="text-[13px] leading-snug mt-2" style={{ color: "rgba(255,255,255,0.82)", maxWidth: 210 }}>
              Ajukan lembur dengan mudah dan pantau statusnya di sini.
            </p>
          </div>

          <svg className="pointer-events-none absolute" width="132" height="104" viewBox="0 0 132 104" fill="none"
            style={{ right: -2, bottom: 10 }} aria-hidden="true">
            <circle cx="38" cy="40" r="27" fill="rgba(255,255,255,0.18)" />
            <circle cx="38" cy="40" r="21" fill="#FFFFFF" />
            <path d="M38 29v11l7 4" stroke="#2F8BF8" strokeWidth="3" strokeLinecap="round" />
            <rect x="66" y="46" width="38" height="26" rx="6" fill="#1E5FB8" />
            <path d="M77 46v-5a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v5" stroke="#1E5FB8" strokeWidth="4" />
            <path d="M66 57h38" stroke="#2F8BF8" strokeWidth="2" opacity="0.55" />
            <path d="M108 78h18l-2.5 12h-13z" fill="#8FE9CC" />
            <path d="M117 78c0-7 3-11 8-13" stroke="#8FE9CC" strokeWidth="2.6" strokeLinecap="round" />
            <ellipse cx="123" cy="65" rx="5.5" ry="3.6" transform="rotate(-25 123 65)" fill="#8FE9CC" />
            <ellipse cx="112" cy="68" rx="5" ry="3.4" transform="rotate(25 112 68)" fill="#8FE9CC" />
          </svg>
        </div>
      </header>

      {/* SHEET */}
      <main className="mx-auto w-full max-w-md relative" style={{
        background: "#fff", marginTop: -28, borderTopLeftRadius: 32, borderTopRightRadius: 32,
        padding: "20px 16px 32px", minHeight: "60vh",
      }}>
        {loading ? (
          <Loader label="Memuat data lembur..." variant="dashboard" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: OT.text }}>Total uang lembur</p>
                <p style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, marginTop: 10 }}>
                  {rupiah(summary.totalPay)}
                </p>
                <p style={{ fontSize: 11, fontWeight: 600, color: OT.textSec, marginTop: 6 }}>
                  dari {durationLabel(summary.totalHours)} lembur yang disetujui
                </p>
              </div>
              <div style={{ paddingTop: 2 }}>
                <MonthMenu value={month} onChange={setMonth} options={monthOptions(rows, currentMonthKey())} />
              </div>
            </div>

            <div style={{ height: 1, background: OT.divider, margin: "16px 0 12px" }} />

            <div className="grid grid-cols-3">
              {[
                { label: "Pengajuan", value: summary.count },
                { label: "Disetujui", value: summary.approved },
                { label: "Menunggu", value: summary.pending },
              ].map((c, i) => (
                <div key={c.label} className="text-center" style={{ borderLeft: i > 0 ? `1px solid ${OT.divider}` : "none" }}>
                  <p style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.1 }}>{c.value}</p>
                  <p style={{ fontSize: 10, fontWeight: 600, color: OT.textSec, marginTop: 3 }}>{c.label}</p>
                </div>
              ))}
            </div>

            <button type="button" onClick={() => setSheetOpen(true)}
              className="w-full flex items-center justify-center gap-2 active:scale-[0.99] transition"
              style={{
                marginTop: 16, height: 48, borderRadius: 16, border: "none",
                background: "linear-gradient(135deg, #2F8BF8, #1F74E0)", color: "#fff",
                fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: OT.shadow,
              }}>
              <Icon.send size={17} />
              Ajukan Lembur
            </button>

            <div className="flex items-center justify-between" style={{ marginTop: 20, marginBottom: 8 }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: OT.text, letterSpacing: "-0.01em" }}>Riwayat Terbaru</p>
              <Link to="/employee/overtime/history"
                className="inline-flex items-center gap-0.5"
                style={{ fontSize: 12, fontWeight: 700, color: OT.brand, textDecoration: "none" }}>
                Lihat Semua <Icon.chevron size={12} sw={2.6} />
              </Link>
            </div>

            {recent.length === 0 ? (
              <EmptyState
                title="Belum ada pengajuan lembur"
                subtitle="Pengajuan lembur bulan ini akan muncul di sini setelah dikirim."
              />
            ) : (
              <div className="space-y-2">
                {recent.map((r) => (
                  <Link key={r.id} to={`/employee/overtime/${r.id}`}
                    className="flex items-center gap-3 active:scale-[0.99] transition"
                    style={{
                      background: "#fff", border: `1px solid ${OT.border}`, borderRadius: 14,
                      padding: "9px 16px", boxShadow: OT.rowShadow, textDecoration: "none",
                    }}>
                    <span className="flex items-center justify-center shrink-0" style={{
                      width: 38, height: 38, borderRadius: "50%",
                      background: r.status === "approved" ? "#10B981" : r.status === "rejected" ? "#EF4444" : "#3B82F6",
                      color: "#fff",
                    }}>
                      {r.status === "approved" ? <Icon.check size={16} sw={3} />
                        : r.status === "rejected" ? <Icon.close size={15} sw={3} />
                          : <Icon.clock size={15} sw={2.6} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate" style={{ fontSize: 13, fontWeight: 700, color: OT.text }}>
                        {r.reason?.trim() ? r.reason.trim() : "Pengajuan lembur"}
                      </span>
                      <span className="block truncate" style={{ fontSize: 11, color: OT.textSec, marginTop: 2 }}>
                        {fmtDate(r.date)} • {r.start_time} - {r.end_time} ({durationLabel(r.requested_hours)})
                      </span>
                    </span>
                    <StatusBadge status={r.status} />
                    <Icon.chevron size={15} sw={2.4} />
                  </Link>
                ))}
              </div>
            )}

            <div className="text-center" style={{ marginTop: 20 }}>
              <Link to="/employee/overtime/rules" style={{ fontSize: 12, fontWeight: 700, color: OT.brand, textDecoration: "none" }}>
                Ketentuan lembur
              </Link>
            </div>
          </>
        )}
      </main>

      <OvertimeRequestSheet open={sheetOpen} onClose={closeSheet} onSubmitted={load} />
    </div>
  );
}
