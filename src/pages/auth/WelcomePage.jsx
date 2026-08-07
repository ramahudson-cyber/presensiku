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

              {/* Ripple sonar — memancar dari pusat pin, loop halus */}
              <ellipse className="ripple" cx="60" cy="66" rx="38" ry="26" style={{ "--delay": "0.6s" }} />
              <ellipse className="ripple" cx="60" cy="66" rx="38" ry="26" style={{ "--delay": "2.1s" }} />

              {/* Body pin */}
              <path
                className="draw pin"
                d="M60 10 C38 10 22 26 22 46 C22 66 43 92 60 106 C77 92 98 66 98 46 C98 26 82 10 60 10 Z"
                pathLength="100"
                stroke="url(#pinStroke)"
              />

              {/* Ring dalam */}
              <circle className="draw inner-line" cx="60" cy="46" r="26" pathLength="100" />

              {/* Celah inti (pop + pulse) */}
              <g className="pop-in">
                <circle className="core core-outer" cx="60" cy="46" r="17" />
                <circle className="core core-mid" cx="60" cy="46" r="11" />
                <circle className="core core-dot" cx="60" cy="46" r="5" />
              </g>
            </svg>
          </div>

          <h1 className="wordmark reveal d-word">PRESENSIKU</h1>

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
          <p className="place">Puskesmas Ampenan</p>
          <p className="ver">v{appVersion} — Presensiku</p>
        </footer>
      </div>
    </div>
  );
}

const PREMIUM_STYLES = `
  .premium-frame {
    position: relative;
    min-height: 100dvh;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: linear-gradient(160deg, #BF00FF 0%, #9900CC 30%, #660099 70%, #33004D 100%);
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
    background: radial-gradient(circle farthest-side at 50% 115%, rgba(20,0,40,0.55), rgba(20,0,40,0) 60%);
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
    background: rgba(255,110,240,0.55);
    animation: driftA 14s cubic-bezier(0.32,0.72,0,1) infinite alternate;
  }
  .orb-b {
    width: 300px; height: 300px;
    bottom: -10%; right: -8%;
    background: rgba(150,40,255,0.6);
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
    animation: reveal 1s cubic-bezier(0.16,1,0.3,1) forwards;
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
    filter: drop-shadow(0 2px 18px rgba(0,0,0,0.25));
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
    text-transform: uppercase;
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
    color: #2B0048;
    font-family: inherit;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    box-shadow:
      0 1px 0 rgba(255,255,255,0.9) inset,
      0 14px 40px -8px rgba(0,0,0,0.45),
      0 4px 12px rgba(0,0,0,0.2);
    transition: transform 0.45s cubic-bezier(0.32,0.72,0,1), box-shadow 0.45s cubic-bezier(0.32,0.72,0,1);
    will-change: transform;
  }
  .btn:hover {
    transform: translateY(-2px);
    box-shadow:
      0 1px 0 rgba(255,255,255,0.9) inset,
      0 22px 52px -10px rgba(0,0,0,0.5),
      0 6px 16px rgba(0,0,0,0.22);
  }
  .btn:active { transform: scale(0.97); }
  .btn .ico {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: linear-gradient(135deg, #E93DFF 0%, #8B5CF6 100%);
    color: #fff;
    box-shadow: 0 4px 14px rgba(155,40,255,0.45);
    transition: transform 0.45s cubic-bezier(0.32,0.72,0,1);
  }
  .btn:hover .ico { transform: translateX(3px); }

  /* ── Footer ── */
  .footer { width: 100%; padding-bottom: 6px; text-align: center; }
  .place { font-size: 12px; font-weight: 600; letter-spacing: 0.08em; color: rgba(255,255,255,0.7); }
  .ver { margin-top: 4px; font-size: 10px; font-weight: 400; letter-spacing: 0.12em; color: rgba(255,255,255,0.4); }

  /* ── Urutan muncul ── */
  .d-logo  { --d: 0s; }
  .d-word  { --d: 3s; }
  .d-tag   { --d: 3.3s; }
  .d-motto { --d: 3.6s; }
  .d-btn   { --d: 3.9s; }
  .d-foot  { --d: 4.15s; }

  @media (prefers-reduced-motion: reduce) {
    .draw, .reveal, .orb, .logo, .logo-glow, .core, .ripple { animation: none !important; }
    .draw { stroke-dashoffset: 0; }
    .core { opacity: 1; }
    .reveal { opacity: 1; filter: none; transform: none; }
  }
`;