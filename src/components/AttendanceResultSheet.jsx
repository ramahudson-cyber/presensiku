import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import thumbsUpImg from "../assets/thumbs-up-success.png";
import wavingGoodbyeImg from "../assets/waving-goodbye.png";
import { shiftLabelPrefixed } from "../lib/shiftName";

function formatTime(isoString) {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" });
}

function formatDate(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

const cap = (s) => (s ? s.trim().charAt(0).toUpperCase() + s.trim().slice(1) : s);

// ── Inline SVG Icons (light mode, satu aksen biru) ──
function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="18" rx="2.5" fill="#2F8BF8" opacity="0.16" />
      <rect x="3" y="4" width="18" height="18" rx="2.5" stroke="#2F8BF8" strokeWidth="1.6" />
      <path d="M16 2v4M8 2v4M3 10h18" stroke="#2F8BF8" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M20 10c0 5-5.5 10-8 12-2.5-2-8-7-8-12a8 8 0 1 1 16 0z" fill="#2F8BF8" opacity="0.16" />
      <path d="M20 10c0 5-5.5 10-8 12-2.5-2-8-7-8-12a8 8 0 1 1 16 0z" stroke="#2F8BF8" strokeWidth="1.6" />
      <circle cx="12" cy="10" r="2.6" fill="#2F8BF8" />
    </svg>
  );
}

// ── Seal: 12 gerigi biru + centang putih (mengikuti referensi desain) ──
const SEAL_PATH =
  "M50.00 10.00 Q62.68 2.67 70.00 15.36 Q84.65 15.35 84.64 30.00 Q97.33 37.32 90.00 50.00 " +
  "Q97.33 62.68 84.64 70.00 Q84.65 84.65 70.00 84.64 Q62.68 97.33 50.00 90.00 " +
  "Q37.32 97.33 30.00 84.64 Q15.35 84.65 15.36 70.00 Q2.67 62.68 10.00 50.00 " +
  "Q2.67 37.32 15.36 30.00 Q15.35 15.35 30.00 15.36 Q37.32 2.67 50.00 10.00 Z";

function SuccessSeal() {
  return (
    <svg width="86" height="86" viewBox="0 0 100 100" aria-hidden="true"
      style={{ display: "block", filter: "drop-shadow(0 1px 2px rgba(47,139,248,0.12))" }}>
      <path d={SEAL_PATH} fill="#2F8BF8" />
      <path d="M31 51 L44 64 L69 38" fill="none" stroke="#FFFFFF" strokeWidth="6"
        strokeLinecap="round" strokeLinejoin="round" className="seal-check" />
    </svg>
  );
}

// ── Konfeti: potongan kertas kecil biru yang jatuh & berputar ──
// Palet dibatasi ke keluarga biru brand agar tetap satu aksen.
const PAPER_COLORS = ["#2F8BF8", "#1F74E0", "#39C0DF", "#93C5FD", "#BFDBFE"];

// Posisi/ukuran/durasi dibuat deterministik dari seed agar tidak berubah
// tiap re-render, tapi tetap terasa acak.
function buildPieces(seed, count) {
  let s = seed || 1;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: +(rnd() * 100).toFixed(2),
    w: +(4 + rnd() * 4).toFixed(1),
    h: +(6 + rnd() * 6).toFixed(1),
    delay: +(rnd() * 1.6).toFixed(2),
    dur: +(3.2 + rnd() * 1.8).toFixed(2),
    drift: +((rnd() - 0.5) * 70).toFixed(0),
    spin: +(360 + rnd() * 900).toFixed(0),
    color: PAPER_COLORS[Math.floor(rnd() * PAPER_COLORS.length)],
    radius: rnd() > 0.75 ? "50%" : "1.5px",
  }));
}

function Confetti({ seed, pieces = 46 }) {
  const list = useMemo(() => buildPieces(seed, pieces), [seed, pieces]);

  return (
    <div aria-hidden="true" style={{
      position: "absolute", inset: 0, overflow: "hidden",
      pointerEvents: "none", zIndex: 3,
    }}>
      {list.map(p => (
        <span key={p.id} style={{
          position: "absolute",
          top: -18,
          left: `${p.left}%`,
          width: p.w,
          height: p.h,
          background: p.color,
          borderRadius: p.radius,
          opacity: 0,
          transformStyle: "preserve-3d",
          ["--cf-drift"]: `${p.drift}px`,
          ["--cf-spin"]: `${p.spin}deg`,
          animation: `cf-fall ${p.dur}s linear ${p.delay}s forwards`,
        }} />
      ))}
    </div>
  );
}

export default function AttendanceResultSheet({ open, onClose, data, type, shiftName: shiftNameProp, locationName, endAtMs, makeupTargetMs }) {
  const navigate = useNavigate();

  // Seed konfeti: acak tiap sheet dibuka, stabil selama terbuka.
  // Hook diletakkan sebelum early-return agar urutan hooks tidak berubah.
  const [confettiSeed, setConfettiSeed] = useState(1);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) setConfettiSeed(Math.floor(Math.random() * 1e6) + 1);
    wasOpen.current = open;
  }, [open]);

  if (!data) return null;
  const isCheckIn = type === "in";
  const isLate = data.is_late;

  const clockIn = formatTime(data.clock_in_time);
  const clockOut = formatTime(data.clock_out_time);
  const dateStr = formatDate(data.clock_in_time);
  // Label shift: nama dari DB (prop) diprioritaskan, lalu alias umum
  // (termasuk kode kustom instansi seperti SNG), terakhir kode mentah.
  const shiftLabel = data.shift_code
    ? shiftLabelPrefixed(data.shift_code, shiftNameProp)
    : "-";
  // ── Status pulang ──
  // Batas pulang = jam selesai shift + menit telat (kompensasi). Pulang
  // sebelum batas itu = "Pulang Cepat" walau sudah lewat jam selesai shift;
  // pulang di/dalam batas = "Pulang Tepat Waktu".
  const targetMs = makeupTargetMs ?? endAtMs;
  let pulangStatus = null;
  let pulangTone = "ok"; // ok | warn
  if (!isCheckIn) {
    if (targetMs && data.clock_out_time) {
      const outMs = new Date(data.clock_out_time).getTime();
      if (outMs < targetMs) {
        pulangStatus = "Pulang Cepat";
        pulangTone = "warn";
      } else {
        pulangStatus = "Pulang Tepat Waktu";
        pulangTone = "ok";
      }
    } else {
      pulangStatus = "-";
      pulangTone = "ok";
    }
  }
  // Lokasi sesuai jenis absen: masuk → location_in, pulang → location_out.
  // Nama dari record (di-enrich trigger DB saat absen) agar selalu lokasi
  // yang benar-benar dipakai, bukan lokasi alfabetis pertama.
  const locJson = isCheckIn ? data.location_in : data.location_out;
  const distance = locJson?.distance_from_location ?? locJson?.distance_from_puskesmas
    ?? data.location_in?.distance_from_puskesmas ?? null;
  const displayLocName = locJson?.matched_location_name || locationName;

  const statusText = isCheckIn ? (isLate ? "Terlambat" : "Tepat waktu") : (pulangStatus || "-");
  const statusTone = isCheckIn ? (isLate ? "warn" : "ok") : pulangTone;
  const timeLabel = isCheckIn ? "Masuk" : "Pulang";
  const timeValue = isCheckIn ? clockIn : clockOut;

  return (
    <>
      <style>{`
        @keyframes seal-pop {
          0% { transform: scale(0.4); opacity: 0; }
          60% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes seal-draw { to { stroke-dashoffset: 0; } }
        @keyframes seal-halo {
          0% { transform: scale(0.85); opacity: 0.5; }
          70% { transform: scale(1.5); opacity: 0; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes illus-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes cf-fall {
          0% {
            opacity: 0;
            transform: translate3d(0, -20px, 0) rotate(0deg);
          }
          8% { opacity: 1; }
          70% { opacity: 1; }
          100% {
            opacity: 0;
            transform: translate3d(var(--cf-drift), 620px, 0) rotate(var(--cf-spin));
          }
        }
        .seal-wrap { position: relative; animation: seal-pop 0.6s cubic-bezier(0.34, 1.4, 0.64, 1) both; }
        .seal-halo {
          position: absolute; inset: -6px; border-radius: 50%;
          border: 2px solid rgba(47,139,248,0.35);
          /* opacity 0 + forwards: cincin tidak terlihat sebelum animasi mulai
             dan benar-benar hilang setelah 2 putaran selesai. */
          opacity: 0;
          animation: seal-halo 1.8s cubic-bezier(0.16, 1, 0.3, 1) 0.35s 2 forwards;
          pointer-events: none;
        }
        .seal-check {
          stroke-dasharray: 60;
          stroke-dashoffset: 60;
          animation: seal-draw 0.55s 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .illus-img { animation: illus-bob 2.6s ease-in-out 0.6s infinite; }
        @media (prefers-reduced-motion: reduce) {
          .seal-wrap, .illus-img, .seal-halo { animation: none !important; }
          .seal-halo { display: none; }
          .seal-check { animation: none !important; stroke-dashoffset: 0; }
        }
      `}</style>

      {open && (
        <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center" onClick={onClose}>
          <div className="fixed inset-0 z-[9998] bg-slate-900/30 backdrop-blur-[2px]" onClick={onClose} />

          <div onClick={e => e.stopPropagation()}
            className="md:rounded-3xl mx-auto flex flex-col animate-slide-up z-[9999] w-full"
            style={{
              maxHeight: "93vh", maxWidth: 420,
              borderRadius: "28px 28px 0 0",
              background: "#FFFFFF",
              border: "1px solid rgba(31,41,55,0.08)",
              boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
              position: "relative", overflow: "hidden",
            }}
          >
            <div style={{
              padding: "10px 22px calc(26px + env(safe-area-inset-bottom, 0px))",
              display: "flex", flexDirection: "column", alignItems: "center",
              overflowY: "auto", flex: "1 1 auto", minHeight: 0,
            }}>
              {/* Konfeti kertas biru */}
              <Confetti seed={confettiSeed} />

              {/* Handle */}
              <div style={{ display: "flex", justifyContent: "center", paddingBottom: 14 }}>
                <div style={{ width: 40, height: 4, borderRadius: 2, background: "#E2E8F0" }} />
              </div>

              {/* Seal biru */}
              <div className="seal-wrap" style={{ marginBottom: 14 }}>
                <span className="seal-halo" />
                <SuccessSeal />
              </div>

              {/* Judul */}
              <h2 style={{
                fontSize: 20, fontWeight: 800, letterSpacing: "-0.015em",
                color: "#0F172A", textAlign: "center", margin: 0, marginBottom: 5,
              }}>
                {isCheckIn ? "Absen masuk berhasil" : "Absen pulang berhasil"}
              </h2>
              <p style={{ fontSize: 11, fontWeight: 500, color: "#94A3B8", textAlign: "center", margin: 0, marginBottom: 8 }}>
                {dateStr}
              </p>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: "#2F8BF8", textAlign: "center", margin: 0, marginBottom: 12 }}>
                {isCheckIn ? "Selamat bekerja, semangat ya" : "Selamat beristirahat, sampai jumpa lagi"}
              </p>

              {/* Keterlambatan */}
              {isLate && isCheckIn && (
                <span style={{
                  fontSize: 10.5, fontWeight: 600, color: "#B45309",
                  background: "#FEF3C7", border: "1px solid #FDE68A",
                  borderRadius: 999, padding: "4px 11px", marginBottom: 12,
                  display: "inline-flex", alignItems: "center", gap: 5,
                }}>
                  Keterlambatan tercatat
                </span>
              )}

              {/* Ilustrasi: jempol (masuk) / karakter dadah (pulang), gradasi memudarkan potongan bawah */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 2 }}>
                <img
                  src={isCheckIn ? thumbsUpImg : wavingGoodbyeImg}
                  alt={isCheckIn ? "Semangat" : "Dadah"}
                  className="illus-img"
                  style={{
                    width: 162, height: "auto", display: "block",
                    WebkitMaskImage: "linear-gradient(to bottom, #000 58%, transparent 86%)",
                    maskImage: "linear-gradient(to bottom, #000 58%, transparent 86%)",
                  }}
                />
              </div>

              {/* Ringkasan jam & status */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%", margin: "14px 0 6px" }}>
                <div style={{
                  background: "#F7F9FD", border: "1px solid rgba(31,41,55,0.06)",
                  borderRadius: 14, padding: "11px 12px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", marginBottom: 3 }}>{timeLabel}</div>
                  <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.01em", color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
                    {timeValue}
                  </div>
                </div>
                <div style={{
                  background: "#F7F9FD", border: "1px solid rgba(31,41,55,0.06)",
                  borderRadius: 14, padding: "11px 12px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", marginBottom: 3 }}>Status</div>
                  <div style={{
                    fontSize: 13.5, fontWeight: 800, letterSpacing: 0,
                    color: statusTone === "warn" ? "#F59E0B" : "#10B981",
                    whiteSpace: "nowrap",
                  }}>
                    {statusText}
                  </div>
                </div>
              </div>

              {/* Detail */}
              <div style={{ width: "100%", marginTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "9px 4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 9, background: "#EEF6FF",
                      display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 28px",
                    }}>
                      <CalendarIcon />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>Shift</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", textAlign: "right", whiteSpace: "nowrap" }}>
                    {shiftLabel}
                  </div>
                </div>

                <div style={{ height: 1, background: "#F1F5F9", width: "100%" }} />

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "9px 4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 9, background: "#EEF6FF",
                      display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 28px",
                    }}>
                      <MapPinIcon />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>Lokasi</div>
                      <div style={{ fontSize: 10, fontWeight: 500, color: "#94A3B8", marginTop: 1 }}>
                        {cap(displayLocName) || "-"}
                        {distance ? ` · ${distance} m dari lokasi` : ""}
                      </div>
                    </div>
                  </div>
                  {distance && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 7,
                      background: Number(distance) <= 100 ? "#ECFDF5" : "#FFFBEB",
                      color: Number(distance) <= 100 ? "#047857" : "#B45309",
                      border: `1px solid ${Number(distance) <= 100 ? "#A7F3D0" : "#FDE68A"}`,
                      whiteSpace: "nowrap",
                    }}>
                      {Number(distance) <= 100 ? "Valid" : "Di luar jarak"}
                    </span>
                  )}
                </div>
              </div>

              {/* Tutup */}
              <button
                onClick={() => { onClose(); navigate("/employee"); }}
                className="active:scale-[0.985]"
                style={{
                  width: "100%", padding: "15px 0", marginTop: 16,
                  background: "#1F74E0", border: "none", borderRadius: 16,
                  color: "#FFFFFF", fontSize: 14.5, fontWeight: 700,
                  fontFamily: "inherit", letterSpacing: "0.01em", cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(31,116,224,0.12)",
                  transition: "transform 0.16s ease, background 0.16s ease",
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
