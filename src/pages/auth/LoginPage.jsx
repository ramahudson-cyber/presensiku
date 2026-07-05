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
  AlertCircle, Mail, Clock, RefreshCw, ArrowLeft, Loader2, Eye, EyeOff, Lock
} from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");

  const [step, setStep] = useState("login");
  const [otpCode, setOtpCode] = useState("");
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [userEmail, setUserEmail] = useState("");
  const [deviceDebug, setDeviceDebug] = useState("");
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
    if (error || !data?.email) {
      if (error) console.error("resolveEmail error:", error);
      throw new Error("Akun tidak ditemukan. Hubungi admin.");
    }
    return data.email;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // ⚡ STEP 1: Resolve email + Ambil device info SECARA PARALEL
      setLoadingText("Memverifikasi akun...");
      const [email, deviceInfoResult] = await Promise.all([
        resolveEmail(username),
        getDeviceInfo(),
      ]);

      // ⚡ STEP 2: Sign in
      setLoadingText("Masuk ke sistem...");
      await signIn(email, password);

      // ⚡ STEP 3: Ambil user + profile SECARA PARALEL (bukan sequential)
      setLoadingText("Memuat data pengguna...");
      const [
        { data: { user: authUser } },
        { data: profile }
      ] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("profiles").select("*").eq("id", (await supabase.auth.getUser()).data.user.id).single()
      ]);

      if (!authUser) throw new Error("No session");
      if (!profile) throw new Error("No profile");

      setUserEmail(profile.email || email);
      setUserName(profile.full_name || username);
      setUserId(authUser.id);
      setDeviceInfo(deviceInfoResult);

      // ⚡ STEP 4: Cek device binding
      setLoadingText("Memeriksa perangkat...");
      const deviceCheck = await checkDeviceBinding(authUser.id, deviceInfoResult);

      // DEBUG: tangkap error device binding
      const isDeviceError = deviceCheck.message && deviceCheck.message.startsWith("Gagal cek device");
      if (isDeviceError) {
        const debugText = `DEVICE ERROR: ${deviceCheck.message}\nvisitorId: ${deviceInfoResult?.visitorId}\nimei: ${deviceInfoResult?.imei}\ndeviceType: ${deviceInfoResult?.deviceType}`;
        setDeviceDebug(debugText);
      } else {
        setDeviceDebug("");
      }

      if (deviceCheck.canLogin && !deviceCheck.requiresOtp) {
        // DEBUG: kalau ada error device binding, jangan lanjut — tampilkan debug
        if (isDeviceError) {
          setError(`DEVICE BINDING ERROR — ${deviceCheck.message}`);
          setLoading(false);
          return;
        }
        setLoadingText("Memuat dashboard...");
        await refreshUser();
        // Force ganti password untuk non-super_admin yang pertama login
        if (profile.role !== "super_admin" && profile.password_changed === false) {
          navigate("/ubah-password", { replace: true });
          return;
        }
        redirectByRole(profile.role);
        return;
      }

      // ⚡ STEP 5: Cek device request status
      setLoadingText("Cek status persetujuan...");
      const reqStatus = await checkDeviceRequestStatus(authUser.id, deviceInfoResult.visitorId);

      if (reqStatus.hasRequest) {
        if (reqStatus.status === "pending") {
          setStep("pending");
          setLoading(false);
          return;
        }
        if (reqStatus.status === "approved") {
          await refreshUser();
          redirectByRole(profile.role);
          return;
        }
        if (reqStatus.status === "rejected") {
          setError("Device DITOLAK. Hubungi admin.");
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }
      }

      // ⚡ STEP 6: Kirim OTP untuk device baru
      setLoadingText("Mengirim kode OTP...");
      await sendOtpEmail(profile.email || email, profile.full_name || username);
      setStep("otp");
    } catch (err) {
      console.error("Login error:", err);
      setError("Username/email atau password salah.");
    } finally {
      setLoading(false);
      setLoadingText("");
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setLoadingText("Memverifikasi OTP...");
    try {
      const result = await verifyOtp(otpCode);
      if (!result.isValid) {
        setError(result.message || "Kode OTP salah");
        setLoading(false);
        return;
      }
      setLoadingText("Mendaftarkan perangkat...");
      const reqResult = await createDeviceRequest(deviceInfo);
      if (!reqResult.success) {
        setError("Gagal membuat device request.");
        setLoading(false);
        return;
      }
      setStep("pending");
    } catch (err) {
      setError("Terjadi kesalahan.");
    } finally {
      setLoading(false);
      setLoadingText("");
    }
  };

  const checkApprovalStatus = async () => {
    setLoading(true);
    setLoadingText("Memeriksa status...");
    try {
      const status = await checkDeviceRequestStatus(userId, deviceInfo.visitorId);
      if (status.status === "approved") {
        await refreshUser();
        const { data: profile } = await supabase.from("profiles").select("role, password_changed").eq("id", userId).single();
        if (profile) {
          if (profile.role !== "super_admin" && profile.password_changed === false) {
            navigate("/ubah-password", { replace: true });
            return;
          }
          redirectByRole(profile.role);
          return;
        }
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
      setLoadingText("");
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    setError("");
    setLoadingText("Mengirim ulang OTP...");
    try {
      await sendOtpEmail(userEmail, userName);
    } catch {
      setError("Gagal kirim ulang.");
    } finally {
      setLoading(false);
      setLoadingText("");
    }
  };

  const handleCancel = async () => {
    await supabase.auth.signOut();
    setStep("login");
    setOtpCode("");
    setDeviceInfo(null);
    setError("");
  };

  return (
    <div className="login-dark-bg min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-[#0f0214] via-[#1a0533] to-[#2d0a4e]">
      {/* Elegant Purple Gradient Blob Shapes */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-transparent to-purple-900/20"></div>

      {/* Large organic blob — top left */}
      <div className="absolute -top-48 -left-48 w-[600px] h-[600px] opacity-25 animate-blob">
        <svg viewBox="0 0 600 600" className="w-full h-full">
          <defs>
            <linearGradient id="blob1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#6d28d9" />
            </linearGradient>
          </defs>
          <path d="M300,40C400,30 520,100 550,210C580,320 540,430 460,500C380,570 240,580 140,510C40,440 -10,290 30,180C70,70 200,50 300,40Z" fill="url(#blob1)" />
        </svg>
      </div>

      {/* Medium blob — bottom right */}
      <div className="absolute -bottom-32 -right-32 w-[450px] h-[450px] opacity-20 animate-blob animation-delay-2000">
        <svg viewBox="0 0 450 450" className="w-full h-full">
          <defs>
            <linearGradient id="blob2" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
          </defs>
          <path d="M225,25C315,30 420,100 430,200C440,300 350,420 250,430C150,440 30,350 20,250C10,150 135,20 225,25Z" fill="url(#blob2)" />
        </svg>
      </div>

      {/* Small accent blob — top right */}
      <div className="absolute top-24 right-16 w-[200px] h-[200px] opacity-15 animate-blob animation-delay-4000">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <defs>
            <linearGradient id="blob3" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#c4b5fd" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          <path d="M100,12C155,18 188,65 185,110C182,155 140,188 90,185C40,182 8,135 12,85C16,35 45,6 100,12Z" fill="url(#blob3)" />
        </svg>
      </div>

      {/* Decorative curving line */}
      <div className="absolute bottom-0 left-0 right-0 h-32 opacity-15">
        <svg viewBox="0 0 1440 120" className="w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0" />
              <stop offset="50%" stopColor="#a78bfa" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0,60 C360,120 1080,0 1440,60 L1440,120 L0,120 Z" fill="url(#lineGrad)" />
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-[380px]">
        {/* Hero */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white leading-tight">
            Selamat Datang<br />di SIAP
          </h1>
          <div className="w-10 h-0.5 bg-gradient-to-r from-violet-400 to-purple-600 rounded-full mt-4 mx-auto"></div>
          <p className="text-sm sm:text-base text-slate-300/70 leading-relaxed mt-4 max-w-[320px] mx-auto">
            Sistem Informasi Administrasi dan Presensi Puskesmas Ampenan
          </p>
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
              {deviceDebug && (
                <div className="mb-3 p-2.5 bg-amber-500/10 rounded-lg border border-amber-500/30">
                  <p className="text-[10px] text-amber-300 font-mono whitespace-pre-wrap break-all">{deviceDebug}</p>
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username atau Email"
                  required
                  disabled={loading}
                  className="w-full px-4 py-3 bg-black/50 border border-violet-500/20 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition disabled:opacity-50"
                />
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                    disabled={loading}
                    className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition disabled:opacity-50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => alert("Silahkan hubungi Admin untuk reset password.")}
                  className="text-xs text-violet-300 hover:text-white block w-full text-right"
                >
                  Lupa password?
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 border-gradient bg-transparent text-white font-semibold rounded-xl text-sm shadow-lg shadow-purple-900/30 hover:shadow-purple-900/50 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {loadingText || "Memproses..."}
                    </>
                  ) : (
                    "Masuk"
                  )}
                </button>
              </form>
              <div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-slate-400">
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
                  disabled={loading}
                  className="w-full px-4 py-4 bg-black/50 border border-violet-500/20 rounded-xl text-white text-center text-2xl font-mono tracking-[0.5em] placeholder-slate-600 focus:outline-none focus:border-violet-500/50 transition disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="w-full py-3 border-gradient bg-transparent text-white font-semibold rounded-xl text-sm shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {loadingText || "Memproses..."}
                    </>
                  ) : (
                    "Verifikasi"
                  )}
                </button>
              </form>
              <div className="mt-3 flex items-center justify-between">
                <button onClick={handleCancel} className="text-xs text-slate-500 hover:text-white flex items-center gap-1">
                  <ArrowLeft size={11} /> Kembali
                </button>
                <button onClick={handleResendOtp} disabled={loading} className="text-xs text-violet-400 hover:text-violet-100">
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
                className="w-full py-3 border-gradient bg-transparent text-white font-semibold rounded-xl text-sm shadow-lg disabled:opacity-50 mb-2 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {loadingText || "Memproses..."}
                  </>
                ) : (
                  "Cek Status"
                )}
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

        <p className="text-center text-[10px] text-slate-500 mt-5">
          Puskesmas Ampenan © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
