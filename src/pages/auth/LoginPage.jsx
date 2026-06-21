import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signIn } from "../../services/authService";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import {
  getDeviceInfo,
  checkDeviceBinding,
  checkDeviceRequestStatus,
  sendOtpEmail,
  verifyOtp,
  createDeviceRequest,
} from "../../services/deviceService";
import {
  AlertCircle, Mail, Clock, RefreshCw, ArrowLeft
} from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [step, setStep] = useState("login");
  const [otpCode, setOtpCode] = useState("");
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");

  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const redirectByRole = (role) => {
    if (role === "pegawai") navigate("/employee", { replace: true });
    else navigate("/admin", { replace: true });
  };

  const resolveEmail = async (input) => {
    if (input.includes("@")) return input;
    const { data, error } = await supabase
      .from("profiles")
      .select("email")
      .eq("username", input.trim())
      .maybeSingle();
    if (error || !data?.email) return `${input.trim()}@puskesmas.local`;
    return data.email;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const email = await resolveEmail(username);
      await signIn(email, password);
      await new Promise((r) => setTimeout(r, 500));
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("No session");
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", authUser.id).single();
      if (!profile) throw new Error("No profile");
      setUserEmail(profile.email || email);
      setUserName(profile.full_name || username);
      setUserId(authUser.id);
      const info = await getDeviceInfo();
      setDeviceInfo(info);
      const deviceCheck = await checkDeviceBinding(authUser.id, info);
      if (deviceCheck.canLogin && !deviceCheck.requiresOtp) {
        await refreshUser();
        redirectByRole(profile.role);
        return;
      }
      const reqStatus = await checkDeviceRequestStatus(authUser.id, info.visitorId);
      if (reqStatus.hasRequest) {
        if (reqStatus.status === "pending") { setStep("pending"); setLoading(false); return; }
        if (reqStatus.status === "approved") { await refreshUser(); redirectByRole(profile.role); return; }
        if (reqStatus.status === "rejected") { setError("Device DITOLAK. Hubungi admin."); await supabase.auth.signOut(); setLoading(false); return; }
      }
      await sendOtpEmail(profile.email || email, profile.full_name || username);
      setStep("otp");
    } catch (err) {
      setError("Username/email atau password salah.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await verifyOtp(otpCode);
      if (!result.isValid) { setError(result.message || "Kode OTP salah"); setLoading(false); return; }
      const reqResult = await createDeviceRequest(deviceInfo);
      if (!reqResult.success) { setError("Gagal membuat device request."); setLoading(false); return; }
      setStep("pending");
    } catch (err) {
      setError("Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  };

  const checkApprovalStatus = async () => {
    setLoading(true);
    try {
      const status = await checkDeviceRequestStatus(userId, deviceInfo.visitorId);
      if (status.status === "approved") {
        await refreshUser();
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
        if (profile?.role) { redirectByRole(profile.role); return; }
        navigate("/admin", { replace: true });
      } else if (status.status === "rejected") {
        setError("DITOLAK. Hubungi admin.");
        await supabase.auth.signOut();
        setStep("login");
      } else {
        setError("Masih menunggu approval admin.");
      }
    } catch (err) {
      setError("Gagal cek status.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    setError("");
    try { await sendOtpEmail(userEmail, userName); } catch { setError("Gagal kirim ulang."); } finally { setLoading(false); }
  };

  const handleCancel = async () => {
    await supabase.auth.signOut();
    setStep("login");
    setOtpCode("");
    setDeviceInfo(null);
    setError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#1a0533]">
      {/* Gradient Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-700 rounded-full mix-blend-screen filter blur-[120px] opacity-30"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-violet-800 rounded-full mix-blend-screen filter blur-[120px] opacity-25"></div>
      <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] bg-indigo-700 rounded-full mix-blend-screen filter blur-[100px] opacity-20"></div>

      <div className="relative z-10 w-full max-w-[380px]">
        {/* Logo */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 mb-3 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-700 rounded-2xl rotate-6 opacity-40"></div>
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-2xl -rotate-3 opacity-40"></div>
            <div className="relative w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-purple-900/50">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white">
                <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M12 22V12M2 7l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="2" fill="currentColor"/>
              </svg>
            </div>
          </div>
          <h1 className="text-xl font-bold text-white">Selamat Datang di SIAP</h1>
          <p className="text-violet-300/50 text-[11px] mt-1.5">Sistem Informasi Administrasi dan Presensi</p>
        </div>

        {/* Card - Black Glassmorphism */}
        <div className="bg-black/80 backdrop-blur-xl rounded-2xl p-7 shadow-2xl shadow-purple-950/50">
          
          {/* STEP 1: LOGIN */}
          {step === "login" && (
            <>
              {error && (
                <div className="mb-3 p-2.5 bg-red-500/10 rounded-lg flex items-center gap-2">
                  <AlertCircle size={15} className="text-red-400 shrink-0" />
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username atau Email"
                  required
                  className="w-full px-4 py-3 bg-black/50 border border-violet-500/20 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  className="w-full px-4 py-3 bg-black/50 border border-violet-500/20 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-700 text-white font-semibold rounded-xl text-sm shadow-lg shadow-purple-900/30 hover:shadow-purple-900/50 transition disabled:opacity-50"
                >
                  {loading ? "Memproses..." : "Masuk"}
                </button>
              </form>
              <div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-violet-300/40">
                <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
                <span>Device baru memerlukan verifikasi OTP & approval admin</span>
              </div>
            </>
          )}

          {/* STEP 2: OTP */}
          {step === "otp" && (
            <>
              <div className="text-center mb-5">
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-violet-500/10 mb-2">
                  <Mail size={22} className="text-violet-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Verifikasi OTP</h2>
                <p className="text-slate-500 text-[11px] mt-1">Kode dikirim ke {userEmail}</p>
              </div>
              {error && (
                <div className="mb-3 p-2.5 bg-red-500/10 rounded-lg flex items-center gap-2">
                  <AlertCircle size={15} className="text-red-400 shrink-0" />
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").substring(0, 6))}
                  placeholder="000000"
                  required
                  maxLength={6}
                  className="w-full px-4 py-4 bg-black/50 border border-violet-500/20 rounded-xl text-white text-center text-2xl font-mono tracking-[0.5em] placeholder-slate-600 focus:outline-none focus:border-violet-500/50 transition"
                />
                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-700 text-white font-semibold rounded-xl text-sm shadow-lg disabled:opacity-50"
                >
                  {loading ? "Memproses..." : "Verifikasi"}
                </button>
              </form>
              <div className="mt-3 flex items-center justify-between">
                <button onClick={handleCancel} className="text-xs text-slate-500 hover:text-white flex items-center gap-1">
                  <ArrowLeft size={11} /> Kembali
                </button>
                <button onClick={handleResendOtp} disabled={loading} className="text-xs text-violet-400 hover:text-violet-300">
                  Kirim ulang
                </button>
              </div>
            </>
          )}

          {/* STEP 3: PENDING */}
          {step === "pending" && (
            <>
              <div className="text-center mb-5">
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-amber-500/10 mb-2">
                  <Clock size={22} className="text-amber-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Menunggu Approval</h2>
                <p className="text-slate-500 text-[11px] mt-1">OTP terverifikasi</p>
              </div>
              <div className="p-2.5 bg-amber-500/10 rounded-lg mb-3">
                <p className="text-xs text-amber-200">Status: Pending</p>
                <p className="text-[10px] text-amber-300/60 mt-0.5">{deviceInfo?.deviceName}</p>
              </div>
              {error && (
                <div className="mb-3 p-2.5 bg-red-500/10 rounded-lg flex items-center gap-2">
                  <AlertCircle size={15} className="text-red-400 shrink-0" />
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}
              <button
                onClick={checkApprovalStatus}
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl text-sm shadow-lg disabled:opacity-50 mb-2"
              >
                {loading ? "Memeriksa..." : "Cek Status"}
              </button>
              <button
                onClick={handleCancel}
                className="w-full py-3 border border-violet-500/10 text-slate-500 rounded-xl text-sm hover:bg-white/5 transition"
              >
                Logout
              </button>
            </>
          )}
        </div>
        
        <p className="text-center text-[10px] text-violet-300/30 mt-5">
          Puskesmas Ampenan © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}