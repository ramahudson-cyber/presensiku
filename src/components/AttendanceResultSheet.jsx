import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import thumbsUpImg from "../assets/thumbs-up-success.png";
import wavingGoodbyeImg from "../assets/waving-goodbye.png";

const SHIFT_NAMES = { PG: "Pagi", SR: "Sore", SI: "Siang", ML: "Malam" };

function formatTime(isoString) {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" });
}

function formatDate(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function calcDuration(clockIn, clockOut) {
  if (!clockIn || !clockOut) return null;
  const diff = new Date(clockOut) - new Date(clockIn);
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hours}j ${mins}m`;
}

// ── Inline SVG Icons (solid) ──
function CalendarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="18" rx="2" fill="#BF00FF" opacity="0.2" />
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="#BF00FF" strokeWidth="1.5" />
      <path d="M16 2v4M8 2v4M3 10h18" stroke="#BF00FF" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M20 10c0 5-5.5 10-8 12-2.5-2-8-7-8-12a8 8 0 0116 0z" fill="#BF00FF" opacity="0.2" />
      <circle cx="12" cy="10" r="5" fill="#BF00FF" />
      <circle cx="12" cy="10" r="2" fill="white" />
      <path d="M20 10c0 5-5.5 10-8 12-2.5-2-8-7-8-12a8 8 0 0116 0z" stroke="#BF00FF" strokeWidth="1.5" />
    </svg>
  );
}

// ── Confetti ──
function Confetti({ id }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spans = [];
    const colors = ["#BF00FF", "#FF0099", "#ADFF2F", "#FBBF24", "#7B00E0", "#3B82F6"];
    for (let i = 0; i < 60; i++) {
      const l = (Math.random() * 100).toFixed(1);
      const w = (3 + Math.random() * 4).toFixed(1);
      const h = (3 + Math.random() * 4).toFixed(1);
      const c = colors[Math.floor(Math.random() * colors.length)];
      const d = (Math.random() * 3).toFixed(1);
      const dur = (2.5 + Math.random() * 1.5).toFixed(1);
      spans.push(`<span style="position:absolute;left:${l}%;width:${w}px;height:${h}px;background:${c};border-radius:1px;top:-20px;animation:cf-${id} ${dur}s linear ${d}s infinite;"></span>`);
    }
    el.innerHTML = spans.join("");
  }, [id]);
  return <div ref={ref} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }} />;
}

// ── Divider ──
function Divider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.05)", width: "100%", margin: "4px 0" }} />;
}

// ── Icon Box ──
function IconBox({ children }) {
  return (
    <div style={{
      width: 26, height: 26, background: "rgba(191,0,255,0.12)", border: "1px solid rgba(191,0,255,0.25)",
      borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      {children}
    </div>
  );
}

export default function AttendanceResultSheet({ open, onClose, data, type, shiftName: shiftNameProp, locationName }) {
  const navigate = useNavigate();
  const uid = useRef(Math.random().toString(36).slice(2, 8)).current;
  if (!data) return null;
  const isCheckIn = type === "in";
  const isLate = data.is_late;

  const clockIn = formatTime(data.clock_in_time);
  const clockOut = formatTime(data.clock_out_time);
  const dateStr = formatDate(data.clock_in_time);
  const duration = calcDuration(data.clock_in_time, data.clock_out_time);
  // Nama shift dari DB (prop) → map legacy → fallback generik, agar kode
  // kustom org (mis. MLM) tetap menghasilkan label manusiawi. Nama dari DB
  // bisa huruf kecil ("malam") → dikapitalisasi.
  const cap = (s) => (s ? s.trim().charAt(0).toUpperCase() + s.trim().slice(1) : s);
  const shiftLabel = data.shift_code
    ? (cap(shiftNameProp) || SHIFT_NAMES[data.shift_code] || `Shift ${data.shift_code}`)
    : "-";
  const statusColor = isLate ? "#FBBF24" : "#ADFF2F";
  const badgeGrad = isLate
    ? "linear-gradient(145deg, #FBBF24 0%, #F59E0B 50%, #D97706 100%)"
    : "linear-gradient(145deg, #FF0099 0%, #BF00FF 50%, #7B00E0 100%)";
  // Lokasi sesuai jenis absen: masuk → location_in, pulang → location_out.
  // Nama dari record (di-enrich trigger DB saat absen) agar selalu lokasi
  // yang benar-benar dipakai, bukan lokasi alfabetis pertama.
  const locJson = isCheckIn ? data.location_in : data.location_out;
  const distance = locJson?.distance_from_location ?? locJson?.distance_from_puskesmas
    ?? data.location_in?.distance_from_puskesmas ?? null;
  const displayLocName = locJson?.matched_location_name || locationName;

  return (
    <>
      <style>{`
        @keyframes bb-${uid} {
          0%, 100% { transform: rotate(-6deg) scale(1); }
          50% { transform: rotate(-6deg) scale(1.05); }
        }
        @keyframes cf-${uid} {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          70% { opacity: 1; }
          100% { transform: translateY(820px) rotate(720deg); opacity: 0; }
        }
        @keyframes pop-${uid} {
          0% { transform: scale(0) rotate(-8deg); opacity: 0; }
          60% { transform: scale(1.12) rotate(3deg); opacity: 1; }
          80% { transform: scale(0.96) rotate(-1deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes bob-${uid} {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-7px) rotate(-2.5deg); }
        }
      `}</style>

      {open && (
        <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center animate-fade-in" onClick={onClose}>
          <div className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm" onClick={onClose} />

          <div onClick={e => e.stopPropagation()}
            style={{
              maxHeight: "93vh", width: "100%", maxWidth: 420,
              borderRadius: "28px 28px 0 0",
              background: "linear-gradient(165deg, #8B00CC 0%, #7B00E0 20%, #4A0099 55%, #6600CC 100%)",
              border: "1px solid rgba(255,0,153,0.4)",
              boxShadow: "0 20px 60px rgba(76,29,149,0.45), 0 0 40px rgba(191,0,255,0.15), inset 0 1px 0 rgba(255,255,255,0.08)",
              position: "relative", overflow: "hidden",
            }}
            className="md:rounded-3xl mx-auto flex flex-col animate-slide-up z-[9999]"
          >
            <Confetti id={uid} />

            {/* Gradient overlay */}
            <div style={{
              position: "absolute", inset: 0,
              background: "radial-gradient(circle at 50% 5%, rgba(255,0,153,0.35), transparent 50%), radial-gradient(circle at 50% 95%, rgba(112,102,237,0.25), transparent 50%)",
              pointerEvents: "none", zIndex: 1,
            }} />

            {/* Content */}
            <div style={{ position: "relative", zIndex: 2, padding: "8px 22px 24px", display: "flex", flexDirection: "column", alignItems: "center", overflowY: "auto", flex: "1 1 auto", minHeight: 0, paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
              {/* Handle */}
              <div style={{ display: "flex", justifyContent: "center", paddingBottom: 8 }}>
                <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
              </div>

              {/* 3D Badge */}
              <div style={{
                width: 76, height: 76, borderRadius: 18, background: badgeGrad,
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 16, position: "relative",
                animation: `bb-${uid} 2s ease-in-out infinite`,
                boxShadow: "0 10px 24px rgba(191,0,255,0.4), 0 4px 8px rgba(0,0,0,0.3), inset 0 -3px 6px rgba(0,0,0,0.2), inset 0 3px 6px rgba(255,255,255,0.2)",
              }}>
                <div style={{ position: "absolute", inset: -4, borderRadius: 22, background: badgeGrad, zIndex: -1, opacity: 0.35, filter: "blur(6px)" }} />
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {isCheckIn ? (
                    <><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="9"/></>
                  ) : (
                    <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>
                  )}
                </svg>
              </div>

              {/* Title */}
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "white", textAlign: "center", marginBottom: 4 }}>
                {isCheckIn ? "Absen Masuk Berhasil!" : "Absen Pulang Berhasil!"}
              </h2>
              <p style={{ fontSize: 11, color: "white", textAlign: "center", marginBottom: 4 }}>{dateStr}</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#ADFF2F", textAlign: "center", marginBottom: isLate ? 10 : 14 }}>
                {isCheckIn ? "Selamat bekerja, semangat ya !" : "Selamat beristirahat, sampai jumpa lagi !"}
              </p>

              {/* Late badge */}
              {isLate && isCheckIn && (
                <span style={{
                  fontSize: 9, fontWeight: 600, color: "#FBBF24",
                  background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)",
                  borderRadius: 20, padding: "3px 10px", marginBottom: 14,
                }}>
                  ⚠ Keterlambatan tercatat
                </span>
              )}

              {/* Ilustrasi — jempol (masuk, bob pelan) / karakter dadah (pulang, statis); pop-in sekali; gradasi memudarkan potongan bawah */}
              <div style={{ animation: `pop-${uid} 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both`, marginBottom: 10 }}>
                {isCheckIn ? (
                  <img src={thumbsUpImg} alt="Semangat!"
                    style={{
                      width: 180, height: "auto",
                      filter: "drop-shadow(0 8px 20px rgba(0,0,0,0.35))",
                      animation: `bob-${uid} 2s ease-in-out 0.7s infinite`,
                      WebkitMaskImage: "linear-gradient(to bottom, black 68%, transparent 100%)",
                      maskImage: "linear-gradient(to bottom, black 68%, transparent 100%)",
                    }} />
                ) : (
                  <img src={wavingGoodbyeImg} alt="Dadah!"
                    style={{
                      width: 180, height: "auto",
                      filter: "drop-shadow(0 8px 20px rgba(0,0,0,0.35))",
                      WebkitMaskImage: "linear-gradient(to bottom, black 80%, transparent 100%)",
                      maskImage: "linear-gradient(to bottom, black 80%, transparent 100%)",
                    }} />
                )}
              </div>

              {/* Stats Row */}
              <div style={{ display: "flex", gap: 8, width: "100%", marginBottom: 14 }}>
                <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: "white", textTransform: "uppercase", letterSpacing: 0.8 }}>{isCheckIn ? "Masuk" : "Pulang"}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "white", marginTop: 2 }}>{isCheckIn ? clockIn : clockOut}</div>
                </div>
                <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: "white", textTransform: "uppercase", letterSpacing: 0.8 }}>{isCheckIn ? "Status" : "Total"}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: statusColor, marginTop: 2 }}>
                    {isCheckIn ? (isLate ? "Terlambat" : "Tepat Waktu") : (duration || "-")}
                  </div>
                </div>
              </div>

              {/* ── Detail items ── */}
              <div style={{ width: "100%" }}>
                {/* Shift */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <IconBox><CalendarIcon /></IconBox>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "white", textTransform: "uppercase", letterSpacing: 0.5 }}>Shift</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "white" }}>{shiftLabel}</span>
                </div>
                <Divider />

                {/* Lokasi */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <IconBox><MapPinIcon /></IconBox>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: "white", textTransform: "uppercase", letterSpacing: 0.5 }}>Lokasi</span>
                      {displayLocName && <span style={{ fontSize: 10, fontWeight: 700, color: "white", display: "block", marginTop: 1 }}>{cap(displayLocName)}</span>}
                      {distance && <span style={{ fontSize: 10, fontWeight: 400, color: "white", display: "block", marginTop: 1 }}>{distance}m dari Lokasi</span>}
                    </div>
                  </div>
                  {distance && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                      color: Number(distance) <= 100 ? "#ADFF2F" : "#FBBF24",
                      background: Number(distance) <= 100 ? "rgba(173,255,47,0.1)" : "rgba(251,191,36,0.1)",
                    }}>
                      {Number(distance) <= 100 ? "Valid" : "Di Luar Jarak"}
                    </span>
                  )}
                </div>
              </div>

              {/* Button */}
              <button onClick={() => { onClose(); navigate("/employee"); }}
                style={{
                  width: "100%", padding: "14px 0", marginTop: 16,
                  background: "linear-gradient(135deg, #BF00FF 0%, #9900CC 50%, #7B00E0 100%)",
                  border: "none", borderRadius: 16, color: "white",
                  fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: 0.3,
                  boxShadow: "0 8px 24px rgba(191,0,255,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
                }}
                className="active:scale-[0.98]"
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
