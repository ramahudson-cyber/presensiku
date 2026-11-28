import { useState } from "react";
import { FingerprintPattern, Loader2, CheckCircle2, ShieldAlert } from "lucide-react";

// Palet mengikuti DESIGN.md — light mode, satu aksen biru, tanpa gradien kartu.
const T = {
  surface: "#FFFFFF",
  border: "rgba(31,41,55,0.08)",
  div: "#F1F5F9",
  text: "#0F172A",
  textSec: "#475569",
  textMuted: "#94A3B8",
  blue: "#2F8BF8",
  blueDeep: "#1F74E0",
  blueTint: "#EEF6FF",
  green: "#10B981",
  greenTint: "#ECFDF5",
  amber: "#B45309",
  amberTint: "#FEF3E2",
  red: "#DC2626",
  redTint: "#FEF2F2",
};

// Ikon inline: repo ini memakai lucide 1.18 yang belum punya beberapa ikon baru,
// jadi path ditulis langsung agar tidak bergantung versi paket.
function Ico({ children, size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  );
}
const PinIco = (p) => <Ico {...p}><path d="M12 21s-6.5-4.6-6.5-10A6.5 6.5 0 0 1 18.5 11c0 5.4-6.5 10-6.5 10z" /><circle cx="12" cy="10.6" r="2.3" /></Ico>;
const ClockIco = (p) => <Ico {...p}><circle cx="12" cy="12" r="8.6" /><path d="M12 7.6V12l3 1.8" /></Ico>;
const TimerIco = (p) => <Ico {...p}><path d="M12 3.6a8.4 8.4 0 0 1 8.4 8.4" /><path d="M12 7.4a4.6 4.6 0 0 1 4.6 4.6" /><path d="M12 3.6v8.2l5.6 5.6" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /></Ico>;
const ShieldIco = (p) => <Ico {...p}><path d="M12 3l7 2.8v5.6c0 4.3-2.9 7.7-7 9.6-4.1-1.9-7-5.3-7-9.6V5.8L12 3z" /><path d="M9.2 12.2l2 2 3.6-3.9" /></Ico>;
const ChevronIco = (p) => <Ico {...p}><path d="M6 9.5l6 6 6-6" /></Ico>;

const ROW_ICON = { pin: PinIco, clock: ClockIco, timer: TimerIco, shield: ShieldIco };

const TONE = {
  green: { bg: T.greenTint, fg: "#0B7A59" },
  neutral: { bg: T.div, fg: T.textSec },
  amber: { bg: T.amberTint, fg: T.amber },
  red: { bg: T.redTint, fg: T.red },
};

function Badge({ children, tone = "green" }) {
  const c = TONE[tone] || TONE.neutral;
  return (
    <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-[9.5px] font-bold whitespace-nowrap"
      style={{ background: c.bg, color: c.fg }}>
      {children}
    </span>
  );
}

/**
 * Panel data presensi yang menempel di bawah layar.
 *
 * Kenapa bukan BottomSheet modal: panel ini harus selalu terlihat agar pegawai
 * tahu kesiapan absennya sebelum menekan sidik jari. BottomSheet berbasis
 * portal + backdrop akan menutupi peta dan memaksa buka-tutup.
 *
 * Semua nilai berasal dari DB (jadwal, lokasi, absensi) — komponen ini hanya
 * mengatur tampilan, tidak menghitung ulang aturan absensi.
 */
export default function AttendanceReadySheet({
  mode = "checkin",           // checkin | checkout
  title,
  subtitle,
  windowLabel,
  windowRemaining,
  windowNote,
  rows = [],
  detail = [],
  deviceLabel,
  deviceTone = "green",
  deviceNote,
  note,
  noteTone = "neutral",
  blockedReason,
  closedLabel,
  saving = false,
  fabLabel,
  onAction,
  disabled = false,
}) {
  const [expanded, setExpanded] = useState(false);

  // Peek dijaga clamp agar tetap muat di layar pendek. Tingginya dipilih agar
  // judul + jendela absen + tiga baris ringkasan tampil utuh tanpa terpotong;
  // animasi tetap lewat transform (bukan height) sesuai aturan animasi.
  // Catatan tambahan (mis. lembur) menambah tinggi agar baris tidak terpotong.
  const peek = windowNote ? "clamp(392px, 54vh, 468px)" : "clamp(352px, 50vh, 424px)";

  return (
    <div
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[28px] bg-white"
      style={{
        height: "min(86dvh, 640px)",
        transform: expanded ? "translateY(0)" : `translateY(calc(100% - ${peek}))`,
        transition: "transform 560ms cubic-bezier(.22,1.12,.36,1)",
        willChange: "transform",
        borderTop: `1px solid ${T.border}`,
        boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
      }}
    >
      {/* ── Aksi utama: sidik jari menonjol di tepi atas sheet ── */}
      <div className="absolute -top-[46px] left-1/2 -translate-x-1/2 z-30">
        <div className={`relative ${saving ? "is-scanning" : ""}`}>
          <div className="pointer-events-none">
            <span className="ripple-ring" />
            <span className="ripple-ring r2" />
            <span className="ripple-ring r3" />
          </div>

          <button
            type="button"
            onClick={onAction}
            disabled={disabled || saving}
            aria-label={fabLabel || "Absen masuk"}
            aria-busy={saving ? "true" : "false"}
            className="relative w-[92px] h-[92px] rounded-full flex items-center justify-center text-white
              transition-[transform,box-shadow,opacity] duration-300 active:scale-95
              disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              // Tombol selalu biru: hijau khusus menandakan aksi yang SUDAH
              // tercatat (dipakai AttendanceResultSheet), bukan aksi pulang.
              background: `linear-gradient(158deg, #4E9EF4 0%, ${T.blue} 52%, ${T.blueDeep} 100%)`,
              boxShadow: "0 1px 2px rgba(24,84,168,0.12), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -8px 14px -8px rgba(9,44,92,0.06)",
            }}
          >
            {saving || !onAction ? (
              <Loader2 size={38} className="animate-spin text-white/80" />
            ) : (
              <FingerprintPattern size={44} strokeWidth={1.4} />
            )}
          </button>
        </div>
      </div>

      {/* Gagang sheet — juga tombol buka/tutup detail */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        aria-label={expanded ? "Ringkas panel absen" : "Perluas panel absen"}
        className="shrink-0 flex justify-center pt-2.5 pb-1 w-full"
      >
        <span className="w-10 h-1.5 rounded-full" style={{ background: "rgba(15,23,42,0.14)" }} />
      </button>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-5 pt-11 scrollbar-thin">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[19px] leading-tight font-extrabold tracking-[-0.02em]" style={{ color: T.text }}>
              {title}
            </h2>
            {subtitle && (
              <p className="text-[12px] mt-1 flex items-center gap-1.5 flex-wrap" style={{ color: T.textSec }}>
                {subtitle}
              </p>
            )}
          </div>
          <Badge tone={blockedReason ? (closedLabel ? "red" : "amber") : "green"}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }} />
            {blockedReason ? (closedLabel || "Tertunda") : mode === "checkout" ? "Siap pulang" : "Dibuka"}
          </Badge>
        </div>

        {/* Sisa waktu / jendela absen */}
        {windowLabel && (
          <div className="mt-3.5 flex items-center gap-3 p-3 rounded-[16px]"
            style={{ background: T.blueTint, border: "1px solid rgba(47,139,248,0.14)" }}>
            <span className="w-8 h-8 rounded-[10px] bg-white flex items-center justify-center shrink-0"
              style={{ color: T.blueDeep, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
              <ClockIco size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-bold" style={{ color: T.blueDeep, opacity: 0.85 }}>Jendela absen</p>
              <p className="text-[12.5px] font-bold mt-0.5 tracking-[-0.01em]" style={{ color: T.text }}>{windowLabel}</p>
            </div>
            {windowRemaining && (
              <span className="font-mono tabular-nums text-[11.5px] font-semibold px-2 py-1 rounded-[9px] whitespace-nowrap"
                style={{ color: T.blueDeep, background: "rgba(255,255,255,0.72)" }}>
                {windowRemaining}
              </span>
            )}
          </div>
        )}

        {windowNote && (
          <p className="text-[11px] mt-2 leading-relaxed" style={{ color: T.textSec }}>{windowNote}</p>
        )}

        {/* Ringkasan baris — data nyata dari jadwal & titik lokasi */}
        {rows.length > 0 && (
          <ul className="mt-1">
            {rows.map((r, i) => {
              const Icon = ROW_ICON[r.icon] || PinIco;
              return (
                <li key={i} className="flex items-center gap-3 py-2.5"
                  style={{ borderBottom: i === rows.length - 1 ? "none" : `1px solid ${T.div}` }}>
                  <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
                    style={{ background: "#F7F9FD", border: "1px solid rgba(15,23,42,0.05)", color: T.textSec }}>
                    <Icon size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold" style={{ color: T.textSec }}>{r.label}</p>
                    <p className="text-[12.5px] font-bold mt-0.5 tracking-[-0.01em] flex items-center gap-2 flex-wrap"
                      style={{ color: T.text }}>
                      <span className={r.mono ? "font-mono tabular-nums" : ""}>{r.value}</span>
                      {r.badge && <Badge tone={r.badgeTone || "neutral"}>{r.badge}</Badge>}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Detail teknis — disembunyikan agar peek tetap ringkas */}
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          className="w-full min-h-[48px] mt-1 flex items-center justify-between gap-2.5 text-[12px] font-bold"
          style={{ color: T.blueDeep, borderTop: `1px solid ${T.div}` }}
        >
          <span>{expanded ? "Tutup detail" : "Detail kesiapan absen"}</span>
          <ChevronIco size={16} className="transition-transform duration-300"
            style={{ transform: expanded ? "rotate(180deg)" : "none" }} />
        </button>

        {expanded && (
          <div className="animate-fade-in">
            {detail.length > 0 && (
              <div className="grid grid-cols-2 gap-x-4">
                {detail.map((d, i) => (
                  <div key={i} className="py-2.5" style={{ borderBottom: `1px solid ${T.div}` }}>
                    <p className="text-[11px] font-semibold" style={{ color: T.textMuted }}>{d.label}</p>
                    <p className={`text-[12px] font-bold mt-0.5 tracking-[-0.01em] ${d.mono ? "font-mono tabular-nums" : ""}`}
                      style={{ color: T.text }}>{d.value}</p>
                  </div>
                ))}
              </div>
            )}

            {deviceLabel && (
              <div className="flex items-center gap-2.5 mt-3">
                <span style={{ color: deviceTone === "red" ? T.red : deviceTone === "amber" ? T.amber : T.green }}>
                  {deviceTone === "red" || deviceTone === "amber"
                    ? <ShieldAlert size={15} />
                    : <ShieldIco size={15} />}
                </span>
                <p className="text-[11.5px] font-semibold" style={{ color: T.text }}>{deviceLabel}</p>
                <Badge tone={deviceTone}>{deviceTone === "green" ? "Aman" : "Periksa"}</Badge>
              </div>
            )}
            {deviceNote && (
              <p className="text-[10.5px] mt-1 leading-relaxed" style={{ color: T.textMuted }}>{deviceNote}</p>
            )}
          </div>
        )}

        {/* Alasan tombol terkunci — selalu terlihat, tidak disembunyikan di detail */}
        {blockedReason && (
          <div className="flex items-start gap-2 mt-3 p-2.5 rounded-[13px]"
            style={{ background: T.amberTint }}>
            <span className="shrink-0 mt-px" style={{ color: T.amber }}><ShieldAlert size={13} /></span>
            <p className="text-[10.8px] leading-relaxed font-medium" style={{ color: T.amber }}>{blockedReason}</p>
          </div>
        )}

        {note && (
          <div className="flex items-start gap-2 mt-3 p-2.5 rounded-[13px]"
            style={{ background: noteTone === "green" ? T.greenTint : "#F7F9FD" }}>
            <span className="shrink-0 mt-px" style={{ color: noteTone === "green" ? T.green : T.textMuted }}>
              <CheckCircle2 size={13} />
            </span>
            <p className="text-[10.8px] leading-relaxed" style={{ color: noteTone === "green" ? "#0B7A59" : T.textSec }}>
              {note}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
