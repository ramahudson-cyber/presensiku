// src/pages/employee/overtime/overtimeUi.jsx
/* eslint-disable react-refresh/only-export-components -- token & helper dipakai bersama halaman lembur */
// Token, helper, dan komponen kecil modul Lembur.
// Warna mengikuti DESIGN.md (biru brand #2F8BF8, teks #0F172A, border halus).
import { useEffect, useRef, useState } from "react";
import Skeleton from "../../../components/Skeleton";

export const OT = {
  bg: "#F4F2FB",
  surface: "#FFFFFF",
  border: "rgba(31,41,55,0.08)",
  divider: "#F1F5F9",
  text: "#0F172A",
  textSec: "#475569",
  textMuted: "#94A3B8",
  brand: "#2F8BF8",
  brandDark: "#1F74E0",
  iconBg: "#EEF6FF",
  shadow: "0 2px 4px rgba(0,0,0,0.04)",
  rowShadow: "0 1px 2px rgba(0,0,0,0.05)",
};

export const STATUS = {
  pending: { label: "Menunggu", color: "#3B82F6", bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.25)" },
  approved: { label: "Disetujui", color: "#10B981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.25)" },
  rejected: { label: "Ditolak", color: "#EF4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.22)" },
};

export const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export const rupiah = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");

// Durasi jam desimal -> "2 jam" / "1,5 jam" / "45 menit"
export function durationLabel(hours) {
  const total = Math.max(0, Math.round(Number(hours || 0) * 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h} jam ${m} menit`;
  if (h) return `${h} jam`;
  return `${m} menit`;
}

// "2026-11-12" -> "12 Nov 2026"
export function fmtDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

// timestamp ISO -> "12 Nov 2026 • 16.45" (WITA)
export function fmtDateTime(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  const date = d.toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Makassar",
  });
  const time = d.toLocaleTimeString("id-ID", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar",
  }).replace(":", ".");
  return `${date} • ${time}`;
}

export const monthKeyOf = (dateStr) => (dateStr || "").slice(0, 7);
export const monthLabel = (key) => {
  const [y, m] = (key || "").split("-");
  return `${MONTHS[Number(m) - 1] || ""} ${y || ""}`.trim();
};
export const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// ── Ikon kecil (satu gaya garis, stroke 2) ─────────────────────────
const ic = (props) => ({
  width: props.size || 16, height: props.size || 16, viewBox: "0 0 24 24",
  fill: "none", stroke: "currentColor", strokeWidth: props.sw || 2,
  strokeLinecap: "round", strokeLinejoin: "round",
});

export const Icon = {
  back: (p = {}) => <svg {...ic(p)}><path d="M15 19l-7-7 7-7" /></svg>,
  chevron: (p = {}) => <svg {...ic(p)}><path d="M9 5l7 7-7 7" /></svg>,
  down: (p = {}) => <svg {...ic(p)}><path d="M6 9l6 6 6-6" /></svg>,
  calendar: (p = {}) => <svg {...ic(p)}><rect x="3" y="4" width="18" height="18" rx="3.4" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>,
  clock: (p = {}) => <svg {...ic(p)}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></svg>,
  check: (p = {}) => <svg {...ic(p)}><path d="M5 13l4 4L19 7" /></svg>,
  close: (p = {}) => <svg {...ic(p)}><path d="M6 18L18 6M6 6l12 12" /></svg>,
  send: (p = {}) => <svg {...ic(p)}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4z" /></svg>,
  info: (p = {}) => <svg width={p.size || 18} height={p.size || 18} viewBox="0 0 24 24" fill="#2F8BF8" style={p.style}><circle cx="12" cy="12" r="10" /><path d="M12 10.5v6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" /><circle cx="12" cy="7.5" r="1.3" fill="#fff" /></svg>,
  doc: (p = {}) => <svg {...ic(p)}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>,
  wallet: (p = {}) => <svg {...ic(p)}><rect x="2.5" y="6" width="19" height="14" rx="3" /><path d="M2.5 10h19M16 15h2" /></svg>,
  list: (p = {}) => <svg {...ic(p)}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>,
};

export function StatusBadge({ status }) {
  const st = STATUS[status] || STATUS.pending;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "5px 12px",
      borderRadius: 999, background: st.bg, color: st.color,
      fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
    }}>{st.label}</span>
  );
}

// App bar ringan untuk sub-halaman (putih, tombol kembali bulat)
export function LightAppBar({ title, onBack, right = null }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 8px" }}>
      <button type="button" onClick={onBack} aria-label="Kembali"
        style={{
          width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
          background: "#fff", border: `1px solid ${OT.border}`, color: OT.text,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: OT.rowShadow, cursor: "pointer",
        }}>
        <Icon.back size={17} sw={2.6} />
      </button>
      <h1 style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: 800, color: OT.text, letterSpacing: "-0.01em" }}>
        {title}
      </h1>
      <div style={{ width: 40, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>{right}</div>
    </div>
  );
}

export function Loader({ label = "Memuat...", variant = "list" }) {
  const rows = variant === "detail" ? 4 : variant === "rules" ? 5 : 3;
  return (
    <div role="status" aria-label={label} style={{ padding: "8px 0" }}>
      {variant === "detail" && <Skeleton width="100%" height={104} radius={24} />}
      {variant === "rules" && <Skeleton width="100%" height={150} radius={24} style={{ marginTop: 4 }} />}
      {variant === "dashboard" && (
        <>
          <div className="flex items-start justify-between gap-3">
            <div style={{ display: "grid", gap: 10 }}>
              <Skeleton width={128} height={11} />
              <Skeleton width={152} height={30} />
              <Skeleton width={188} height={9} />
            </div>
            <Skeleton width={86} height={32} radius={999} />
          </div>
          <div className="grid grid-cols-3" style={{ marginTop: 16 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: "grid", gap: 7, justifyItems: "center" }}>
                <Skeleton width={30} height={16} />
                <Skeleton width={56} height={8} />
              </div>
            ))}
          </div>
          <Skeleton width={110} height={11} style={{ marginTop: 18 }} />
        </>
      )}
      <div style={{ display: "grid", gap: 10, marginTop: variant === "dashboard" ? 10 : 14 }}>
        {[...Array(rows)].map((_, i) => (
          <Skeleton key={i} width="100%" height={variant === "detail" ? 54 : variant === "rules" ? 44 : 62} radius={14} />
        ))}
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "48px 16px" }}>
      <div style={{
        width: 48, height: 48, borderRadius: "50%", background: "rgba(239,68,68,0.08)",
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, color: "#EF4444",
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <p style={{ fontSize: 12, color: "#EF4444", fontWeight: 600 }}>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry}
          style={{
            marginTop: 16, padding: "10px 24px", borderRadius: 999, border: "none",
            background: OT.brand, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>Coba Lagi</button>
      )}
    </div>
  );
}

export function EmptyState({ title, subtitle, action }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "44px 16px" }}>
      <div style={{
        width: 52, height: 52, borderRadius: "50%", background: OT.iconBg, color: OT.brand,
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12,
      }}>
        <Icon.clock size={24} sw={1.8} />
      </div>
      <p style={{ fontSize: 13, fontWeight: 700, color: OT.text }}>{title}</p>
      {subtitle && <p style={{ fontSize: 11.5, color: OT.textMuted, marginTop: 6, maxWidth: 260, lineHeight: 1.5 }}>{subtitle}</p>}
      {action}
    </div>
  );
}

// Pemilih bulan: tombol teks + panah bawah, dropdown daftar bulan.
// tone "brand"   -> teks biru polos (di atas latar terang)
// tone "soft"    -> pill tint biru muda (di atas latar putih)
// tone "onBrand" -> pill putih transparan (di atas header biru)
export function MonthMenu({ value, onChange, options, tone = "brand" }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  const triggerStyle = tone === "onBrand"
    ? {
        display: "inline-flex", alignItems: "center", gap: 5,
        background: "rgba(255,255,255,0.16)", color: "#fff",
        fontSize: 11.5, fontWeight: 700,
        padding: "6px 12px", borderRadius: 999, border: "none", cursor: "pointer",
      }
    : tone === "soft"
      ? {
          display: "inline-flex", alignItems: "center", gap: 5,
          background: OT.iconBg, color: OT.brand,
          fontSize: 11.5, fontWeight: 700,
          padding: "6px 12px", borderRadius: 999, border: "none", cursor: "pointer",
        }
      : {
          display: "inline-flex", alignItems: "center", gap: 4, border: "none", background: "none",
          color: OT.brand, fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: 0,
        };

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={triggerStyle}>
        {monthLabel(value)}
        <Icon.down size={12} sw={2.6} />
      </button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 40,
          width: 168, maxHeight: 232, overflowY: "auto",
          background: "#fff", borderRadius: 16, border: `1px solid ${OT.border}`,
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)", padding: 6,
        }}>
          {options.map((key) => (
            <button key={key} type="button"
              onClick={() => { onChange(key); setOpen(false); }}
              style={{
                display: "block", width: "100%", textAlign: "left", border: "none",
                background: key === value ? OT.iconBg : "transparent",
                color: key === value ? OT.brand : OT.textSec,
                fontSize: 12, fontWeight: key === value ? 800 : 600,
                padding: "8px 10px", borderRadius: 10, cursor: "pointer",
              }}>
              {monthLabel(key)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Daftar bulan (12 terakhir + bulan dari data) untuk MonthMenu.
export function monthOptions(rows, currentKey) {
  const set = new Set([currentKey]);
  (rows || []).forEach((r) => { if (r.date) set.add(monthKeyOf(r.date)); });
  const now = new Date();
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return Array.from(set).sort().reverse();
}
