import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { getCurrentVersion } from "../../services/updateService";

export default function WelcomePage() {
  const navigate = useNavigate();
  const appVersion = getCurrentVersion().version;

  return (
    <div className="min-h-screen relative overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #BF00FF 0%, #9900CC 30%, #660099 70%, #33004D 100%)'
      }}>
      {/* Halo glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle farthest-side at 0px -30%, rgba(167,139,250,0.25), rgba(124,58,237,0) 84%)'
        }}
      />

      {/* Subtle grid overlay */}
      <div className="absolute inset-0 professional-grid-bg pointer-events-none" />

      {/* Ambient sweep */}
      <div className="absolute inset-0 professional-ambient-bg pointer-events-none" />

      {/* Floating orbs */}
      <div className="fixed top-[-10%] left-[5%] w-[300px] h-[300px] bg-[#BF00FF] rounded-full mix-blend-screen filter blur-[120px] opacity-25 animate-orb pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[5%] w-[300px] h-[300px] bg-[#BF00FF] rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-orb animate-orb-delay pointer-events-none"></div>

      {/* Content */}
      <div className="relative z-10 min-h-dvh flex items-center justify-center p-6">
        <div className="w-full max-w-[400px] flex flex-col min-h-[85vh]">
          <div className="flex-1 flex flex-col justify-center">
            <h1 className="text-[clamp(52px,12vw,68px)] font-semibold text-pure-white leading-tight">
              Hadir.Kuy
            </h1>
            <p className="text-[22px] text-pure-white/70 mt-4 leading-relaxed">
              Absen anti ribet,<br />
              kerja makin greget!
            </p>
            <p className="text-xs text-pure-white/35 mt-6 tracking-[2.5px] uppercase font-light">
              Disiplin · Akurat · Optimal
            </p>
            <button
              onClick={() => navigate("/login")}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-br from-electric-violet to-deep-indigo text-pure-white rounded-full text-sm font-semibold shadow-lg mt-8 w-auto hover:brightness-110 active:brightness-90 transition-all duration-200"
            >
              Mulai Sekarang
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="pb-4">
            <p className="text-xs text-pure-white/70">Puskesmas Ampenan</p>
            <p className="text-[10px] text-pure-white/50 mt-1">v{appVersion} — Hadir.Kuy</p>
          </div>
        </div>
      </div>
    </div>
  );
}