import { useNavigate } from "react-router-dom";
import { getCurrentVersion } from "../../services/updateService";

export default function WelcomePage() {
  const navigate = useNavigate();
  const appVersion = getCurrentVersion().version;

  return (
    <div className="premium-frame">
      <style>{PREMIUM_STYLES}</style>

      <div className="orb orb-a" aria-hidden="true" />
      <div className="orb orb-b" aria-hidden="true" />

      <div className="content">
        <div className="hero">
          {/* Logo: location pin premium — draw + ripple + core pulse */}
      <div className="logo reveal d-logo" aria-hidden="true">
        <div className="logo-glow" />
        <svg viewBox="0 0 120 120" fill="none">
          <defs>
            <linearGradient id="pinStroke" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="rgba(255,255,255,0.45)" />
            </linearGradient>
          </defs>

          {/* Ripple sonar — memancar dari pusat logo */}
          <ellipse className="ripple" cx="60" cy="66" rx="38" ry="26" style={{ "--delay": "1.3s" }} />
          <ellipse className="ripple" cx="60" cy="66" rx="38" ry="26" style={{ "--delay": "2.5s" }} />

          {/* Fingerprint — alur menggambar diri (ikon FAB Presensi) */}
          <g transform="translate(3 6) scale(4.75)" stroke="url(#pinStroke)" strokeWidth="0.55">
            <path className="draw" pathLength="100" d="M2 12a10 10 0 0 1 18-6c.8 1.1 1.4 2.3 1.8 3.7" style={{ "--dur": "0.5s", "--delay": "0.1s" }} />
            <path className="draw" pathLength="100" d="M21.85 16.4c.2-1.6.25-3 .12-4.6" style={{ "--dur": "0.5s", "--delay": "0.22s" }} />
            <path className="draw" pathLength="100" d="M9 6.8a6 6 0 0 1 9 5.2c0 .8-.03 1.5-.1 2.2" style={{ "--dur": "0.5s", "--delay": "0.34s" }} />
            <path className="draw" pathLength="100" d="M4.6 19.9C5.4 18.3 6 15.4 6 12a6 6 0 0 1 .34-2" style={{ "--dur": "0.5s", "--delay": "0.46s" }} />
            <path className="draw" pathLength="100" d="M12 10a2 2 0 0 0-2 2c0 1.3-.12 2.9-.3 4.4" style={{ "--dur": "0.5s", "--delay": "0.58s" }} />
            <path className="draw" pathLength="100" d="M14.1 13.1c-.05 2.5-.4 5.9-1.1 8.9" style={{ "--dur": "0.5s", "--delay": "0.7s" }} />
            <path className="draw" pathLength="100" d="M17.35 21.1c.15-.6.4-2.2.47-3" style={{ "--dur": "0.5s", "--delay": "0.82s" }} />
            <path className="draw" pathLength="100" d="M8.6 22.1c.25-.7.45-1.4.6-2.1" style={{ "--dur": "0.5s", "--delay": "0.94s" }} />
          </g>

          {/* Titik inti */}
          <path className="core" d="M2 16h.01" transform="translate(3 6) scale(4.75)" stroke="#fff" strokeWidth="0.95" />
        </svg>
      </div>

          <h1 className="wordmark reveal d-word">Presensiku</h1>

          <p className="tagline reveal d-tag">
            Absen anti ribet,
            <br />
            kerja makin greget!
          </p>

          <p className="motto reveal d-motto">Disiplin · Akurat · Optimal</p>

          <button className="btn reveal d-btn" type="button" onClick={() => navigate("/login")}>
            Mulai Sekarang
            <span className="ico">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </button>
        </div>

        <footer className="footer reveal d-foot">
          <p className="place">Presensiku</p>
          <p className="ver">v{appVersion} — Presensiku</p>
        </footer>
      </div>
    </div>
  );
}

const PREMIUM_STYLES = `
  .premium-frame {
    position: relative;
    box-sizing: border-box;
    /* 100vh fallback WAJIB: svh/dvh mengecil saat ada inset sistem (URL bar,
       gesture nav) sehingga frame berhenti lebih awal dan background putih
       body terlihat sebagai gap di bawah. 100vh = large viewport, selalu
       menutup; kelebihan tinggi ditampung overflow: hidden. */
    min-height: 100vh;
    min-height: 100svh;
    min-height: 100dvh;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 24px calc(24px + env(safe-area-inset-bottom, 0px));
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    /* Palet biru dari desain referensi: turquoise → biru → ungu-biru.
       Hanya warna yang berubah; struktur, ukuran, jarak, dan animasi tetap. */
    background: linear-gradient(160deg, #39C0DF 0%, #32ACFB 32%, #3F93FD 62%, #4A7CFB 100%);
    -webkit-font-smoothing: antialiased;
  }
  .premium-frame::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(circle farthest-side at 50% -20%, rgba(255,255,255,0.14), rgba(255,255,255,0) 62%);
  }
  .premium-frame::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(circle farthest-side at 50% 115%, rgba(6,24,48,0.5), rgba(6,24,48,0) 60%);
  }

  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(90px);
    mix-blend-mode: screen;
    pointer-events: none;
    will-change: transform;
  }
  .orb-a {
    width: 340px; height: 340px;
    top: -8%; left: -6%;
    background: rgba(110,255,196,0.42);
    animation: driftA 14s cubic-bezier(0.32,0.72,0,1) infinite alternate;
  }
  .orb-b {
    width: 300px; height: 300px;
    bottom: -10%; right: -8%;
    background: rgba(84,226,212,0.5);
    animation: driftB 18s cubic-bezier(0.32,0.72,0,1) infinite alternate;
  }
  @keyframes driftA { to { transform: translate3d(70px,50px,0) scale(1.15); } }
  @keyframes driftB { to { transform: translate3d(-60px,-40px,0) scale(1.1); } }

  .content {
    position: relative;
    z-index: 10;
    width: 100%;
    max-width: 400px;
    min-height: 88dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .hero {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  /* ── Logo ── */
  .logo {
    position: relative;
    width: 170px;
    height: 170px;
    animation: logoFloat 7s cubic-bezier(0.32,0.72,0,1) 3.6s infinite alternate;
    will-change: transform;
  }
  .logo-glow {
    position: absolute;
    inset: 10%;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,0.30), rgba(255,255,255,0) 66%);
    filter: blur(24px);
    animation: glowPulse 5s cubic-bezier(0.32,0.72,0,1) 2.4s infinite alternate;
    will-change: transform, opacity;
  }
  .logo svg { position: relative; display: block; width: 100%; height: 100%; overflow: visible; }

  .draw {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 100;
    stroke-dashoffset: 100;
    animation: drawStroke var(--dur, 0.9s) cubic-bezier(0.16,1,0.3,1) forwards;
    animation-delay: var(--delay, 0s);
  }
  .pin        { --dur: 1.6s; --delay: 0.3s; stroke-width: 3; }
  .inner-line { --dur: 0.8s; --delay: 1.7s; stroke-width: 2.2; stroke: rgba(255,255,255,0.85); }
  @keyframes drawStroke { to { stroke-dashoffset: 0; } }

  .ripple {
    fill: none;
    stroke: rgba(255,255,255,0.4);
    stroke-width: 1.4;
    transform-box: fill-box;
    transform-origin: center;
    opacity: 0;
    animation: ripple 3s cubic-bezier(0.32,0.72,0,1) infinite;
    animation-delay: var(--delay, 0s);
  }
  @keyframes ripple {
    0%   { transform: scale(0.35); opacity: 0; }
    12%  { opacity: 0.5; }
    100% { transform: scale(2.6); opacity: 0; }
  }

  .core {
    opacity: 0;
    transform-box: fill-box;
    transform-origin: center;
    animation: dotPop 0.7s cubic-bezier(0.34,1.56,0.64,1) 2s forwards,
               corePulse 3.2s cubic-bezier(0.32,0.72,0,1) 2.8s infinite alternate;
  }
  .core-outer { fill: rgba(255,255,255,0.16); }
  .core-mid   { fill: rgba(255,255,255,0.45); }
  .core-dot   { fill: #fff; }
  @keyframes dotPop {
    from { opacity: 0; transform: scale(0.3); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes corePulse {
    from { transform: scale(0.96); }
    to   { transform: scale(1.06); }
  }
  @keyframes logoFloat { to { transform: translate3d(0,-9px,0); } }
  @keyframes glowPulse { to { transform: scale(1.12); opacity: 1; } }

  /* ── Reveal berurutan ── */
  .reveal {
    opacity: 0;
    filter: blur(10px);
    transform: translate3d(0,26px,0);
    animation: reveal 0.65s cubic-bezier(0.16,1,0.3,1) forwards;
    animation-delay: var(--d, 0s);
  }
  @keyframes reveal { to { opacity: 1; filter: blur(0); transform: translate3d(0,0,0); } }

  .wordmark {
    margin-top: 34px;
    font-size: clamp(30px, 9vw, 38px);
    font-weight: 700;
    letter-spacing: 0.3em;
    text-indent: 0.3em;
    color: #fff;
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.08));
  }
  .tagline {
    margin-top: 18px;
    font-size: 18px;
    font-weight: 400;
    line-height: 1.55;
    color: rgba(255,255,255,0.78);
  }
  .motto {
    margin-top: 22px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.34em;
    text-indent: 0.34em;
    color: rgba(255,255,255,0.42);
  }

  /* ── CTA ── */
  .btn {
    margin-top: 40px;
    display: inline-flex;
    align-items: center;
    gap: 16px;
    padding: 9px 9px 9px 30px;
    border: none;
    border-radius: 999px;
    background: #fff;
    color: #0B3A66;
    font-family: inherit;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    box-shadow:
      0 1px 0 rgba(255,255,255,0.9) inset,
      0 1px 2px rgba(0,0,0,0.08);
    transition: transform 0.45s cubic-bezier(0.32,0.72,0,1), box-shadow 0.45s cubic-bezier(0.32,0.72,0,1);
    will-change: transform;
  }
  .btn:hover {
    transform: translateY(-2px);
    box-shadow:
      0 1px 0 rgba(255,255,255,0.9) inset,
      0 2px 4px rgba(0,0,0,0.10);
  }
  .btn:active { transform: scale(0.97); }
  .btn .ico {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: linear-gradient(135deg, #54E2D4 0%, #2F8BF8 100%);
    color: #fff;
    box-shadow: 0 1px 2px rgba(47,139,248,0.15);
    transition: transform 0.45s cubic-bezier(0.32,0.72,0,1);
  }
  .btn:hover .ico { transform: translateX(3px); }

  /* ── Footer ── */
  .footer { width: 100%; padding-bottom: 6px; text-align: center; }
  .place { font-size: 12px; font-weight: 600; letter-spacing: 0.08em; color: rgba(255,255,255,0.7); }
  .ver { margin-top: 4px; font-size: 10px; font-weight: 400; letter-spacing: 0.12em; color: rgba(255,255,255,0.4); }

  /* ── Urutan muncul ── */
  .d-logo  { --d: 0s; }
  .d-word  { --d: 0.8s; }
  .d-tag   { --d: 1s; }
  .d-motto { --d: 1.2s; }
  .d-btn   { --d: 1.4s; }
  .d-foot  { --d: 1.6s; }

  @media (prefers-reduced-motion: reduce) {
    .draw, .reveal, .orb, .logo, .logo-glow, .core, .ripple { animation: none !important; }
    .draw { stroke-dashoffset: 0; }
    .core { opacity: 1; }
    .reveal { opacity: 1; filter: none; transform: none; }
  }
`;