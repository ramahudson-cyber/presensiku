import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signIn } from "../../services/authService";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { isNativePlatform } from "../../lib/devicePlatform";
import { getCurrentVersion } from "../../services/updateService";
import {
  getDeviceInfo,
  checkDeviceBinding,
  checkDeviceRequestStatus,
  sendOtpEmail,
  verifyOtp,
  createDeviceRequest,
} from "../../services/deviceService";
import {
  saveCredentials, getCredentials, clearCredentials,
  isBiometricEnabled, setBiometricEnabled, authenticateBiometric,
} from "../../services/storageService";
import {
  AlertCircle, Mail, Clock, RefreshCw, ArrowLeft, Loader2, Eye, EyeOff, Smartphone, ShieldCheck
} from "lucide-react";

export default function SignInPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [useBiometric, setUseBiometric] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");

  const [step, setStep] = useState("login");
  const [otpCode, setOtpCode] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [userEmail, setUserEmail] = useState("");
  const [deviceDebug, setDeviceDebug] = useState("");
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const appVersion = getCurrentVersion().version;

  const navigate = useNavigate();
  const { refreshUser, isAuthenticated } = useAuth();

  useEffect(() => {
    (async () => {
      const creds = await getCredentials();
      if (creds?.username) {
        setUsername(creds.username);
        setPassword(creds.password || "");
        setRememberMe(true);
        const bio = await isBiometricEnabled();
        setUseBiometric(bio);
      }
      setInitialized(true);
    })();
  }, []);

  useEffect(() => {
    if (!initialized) return;
    if (isAuthenticated) return;
    if (step !== "login") return;
    if (!useBiometric) return;
    if (!isNativePlatform()) return;
    if (!username || !password) return;

    const doBioLogin = async () => {
      try {
        const bioResult = await authenticateBiometric();
        if (bioResult) {
          document.querySelector("form")?.requestSubmit();
        }
      } catch {
        console.log("Biometric skipped or failed, fallback to manual login");
      }
    };
    doBioLogin();
  }, [initialized, useBiometric, step, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

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

  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(label ? `Timeout ${label} after ${ms}ms` : `Timeout after ${ms}ms`)), ms)
      ),
    ]);
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await withTimeout((async () => {
      console.log("[Login] 1/9 Memverifikasi akun...");
      setLoadingText("Memverifikasi akun...");
      const [email, deviceInfoResult] = await Promise.all([
        resolveEmail(username),
        getDeviceInfo(),
      ]);
      console.log("[Login] 1/9 OK — email:", email, "visitorId:", deviceInfoResult?.visitorId);

      console.log("[Login] 2/9 signIn...");
      setLoadingText("Masuk ke sistem...");
      await signIn(email, password);
      console.log("[Login] 2/9 OK — signed in");

      console.log("[Login] 3/9 Credential ops...");
      await withTimeout((async () => {
        if (rememberMe) {
          await saveCredentials(username, password);
          if (isNativePlatform()) {
            await setBiometricEnabled(useBiometric);
          }
        } else {
          await clearCredentials();
          await setBiometricEnabled(false);
        }
      })(), 15000, "credentialOps");
      console.log("[Login] 3/9 OK — credentials saved/cleared");

      console.log("[Login] 4/9 Memuat data pengguna...");
      setLoadingText("Memuat data pengguna...");
      const [
        { data: { user: authUser } },
        { data: profile }
      ] = await Promise.all([
        withTimeout(supabase.auth.getUser(), 15000, "getUser"),
        withTimeout(supabase.from("profiles").select("*").eq("id", (await supabase.auth.getUser()).data.user.id).single(), 15000, "getProfile")
      ]);
      console.log("[Login] 4/9 OK — user:", authUser?.id, "profile:", profile?.role);

      if (!authUser) throw new Error("No session");
      if (!profile) throw new Error("No profile");

      setUserEmail(profile.email || email);
      setUserName(profile.full_name || username);
      setUserId(authUser.id);
      setDeviceInfo(deviceInfoResult);

      // Admin & super_admin skip OTP entirely
      if (profile.role === "super_admin" || profile.role === "admin") {
        console.log(`[Login] ${profile.role} — skip device binding & OTP`);
        setLoadingText("Memuat dashboard...");
        await withTimeout(refreshUser(), 15000, "refreshUser");
        if (profile.role !== "super_admin" && profile.password_changed === false) {
          navigate("/ubah-password", { replace: true });
          return;
        }
        redirectByRole(profile.role);
        return;
      }

      console.log("[Login] 5/9 Memeriksa perangkat...");
      setLoadingText("Memeriksa perangkat...");
      const deviceCheck = await withTimeout(checkDeviceBinding(authUser.id, deviceInfoResult), 15000, "checkDeviceBinding");
      console.log("[Login] 5/9 OK — canLogin:", deviceCheck.canLogin, "requiresOtp:", deviceCheck.requiresOtp);

      const isDeviceError = deviceCheck.message && deviceCheck.message.startsWith("Gagal cek device");
      if (isDeviceError) {
        const debugText = `DEVICE ERROR: ${deviceCheck.message}\nvisitorId: ${deviceInfoResult?.visitorId}\nimei: ${deviceInfoResult?.imei}\ndeviceType: ${deviceInfoResult?.deviceType}`;
        setDeviceDebug(debugText);
      } else {
        setDeviceDebug("");
      }

      if (deviceCheck.canLogin && !deviceCheck.requiresOtp) {
        if (isDeviceError) {
          setError(`DEVICE BINDING ERROR — ${deviceCheck.message}`);
          setLoading(false);
          return;
        }
        console.log("[Login] 6/9 Memuat dashboard...");
        setLoadingText("Memuat dashboard...");
        await withTimeout(refreshUser(), 15000, "refreshUser");
        if (profile.role !== "super_admin" && profile.password_changed === false) {
          navigate("/ubah-password", { replace: true });
          return;
        }
        redirectByRole(profile.role);
        return;
      }

      console.log("[Login] 6/9 Cek status persetujuan...");
      setLoadingText("Cek status persetujuan...");
      const reqStatus = await withTimeout(checkDeviceRequestStatus(authUser.id, deviceInfoResult.visitorId), 15000, "checkDeviceRequestStatus");
      console.log("[Login] 6/9 OK — hasRequest:", reqStatus.hasRequest, "status:", reqStatus.status);

      if (reqStatus.hasRequest) {
        if (reqStatus.status === "pending") {
          setStep("pending");
          setLoading(false);
          return;
        }
        if (reqStatus.status === "approved") {
          await withTimeout(refreshUser(), 15000, "refreshUser");
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

      console.log("[Login] 7/9 Mengirim OTP...");
      setLoadingText("Mengirim kode OTP...");
      const otpResult = await withTimeout(sendOtpEmail(profile.email || email, profile.full_name || username), 20000, "sendOtpEmail");
      console.log("[Login] 7/9 OK — otpSent:", otpResult.success);
      if (!otpResult.success) {
        setError("Gagal mengirim OTP: " + (otpResult.error || "Cek koneksi internet"));
        setLoading(false);
        return;
      }
      setGeneratedOtp(otpResult.otp);
      setStep("otp");
    })(), 90000);
    } catch (err) {
      console.error("[Login] ERROR:", err);
      setDeviceDebug(`[${err.name}] ${err.message}`);
      const msg = err.message?.includes("Invalid login credentials")
        ? "Username/email atau password salah."
        : err.message?.includes("Timeout")
          ? "Login timeout — periksa koneksi internet"
          : err.message?.includes("Email not confirmed")
            ? "Email belum diverifikasi. Periksa email Anda."
            : err.message?.includes("rate limit")
              ? "Terlalu banyak percobaan. Tunggu beberapa saat."
              : err.message || "Terjadi kesalahan. Coba lagi.";
      setError(msg);
    } finally {
      setLoading(false);
      setLoadingText("");

      console.log("[Login] FINISHED — loading=false, error shown if any");
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
    } catch {
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
    } catch {
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
      const res = await sendOtpEmail(userEmail, userName);
      if (!res.success) {
        setError("Gagal kirim ulang: " + (res.error || "Cek koneksi internet"));
      } else {
        setGeneratedOtp(res.otp);
      }
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
    setGeneratedOtp("");
    setDeviceInfo(null);
    setError("");
  };

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

      {/* Content */}
      <div className="relative z-10 min-h-dvh flex items-start justify-center pt-[2vh] sm:pt-[4vh] p-4 sm:p-6">
        <div className="w-full lg:max-w-[1000px] mx-auto flex flex-col lg:flex-row lg:items-center lg:gap-16">

        {/* RIGHT: Hero — desktop only */}
        <div className="hidden lg:block lg:flex-1">
          <div className="text-left px-2">
            <h1 className="font-urbanist text-4xl font-bold tracking-[1.22px] text-pure-white leading-none">
              Hadir.Kuy
            </h1>
            <p className="text-green-yellow text-base leading-relaxed mt-4 tracking-[0.72px]">
              Absen anti ribet, kerja makin greget!
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-6">
              <span className="text-[#c4b5fd] text-sm tracking-[2.5px] uppercase font-semibold">Disiplin</span>
              <span className="text-slate-mist/20 text-sm">•</span>
              <span className="text-[#c4b5fd] text-sm tracking-[2.5px] uppercase font-semibold">Akurat</span>
              <span className="text-slate-mist/20 text-sm">•</span>
              <span className="text-[#c4b5fd] text-sm tracking-[2.5px] uppercase font-semibold">Optimal</span>
            </div>
            <p className="text-pure-white text-sm tracking-[1px] mt-6 uppercase">Puskesmas Ampenan</p>
          </div>
        </div>

          {/* LEFT: Card */}
          <div className="w-full max-w-[420px] mx-auto lg:mx-0 lg:flex-1">

            {/* Hero — mobile/tablet only */}
            <div className="text-left mb-6 sm:mb-10 lg:hidden px-2">
              <h1 className="font-urbanist text-3xl sm:text-4xl font-bold tracking-[1.22px] text-pure-white leading-none">
                Hadir.Kuy
              </h1>
              <p className="text-green-yellow text-sm sm:text-base leading-relaxed mt-2 tracking-[0.72px]">
                Absen anti ribet, kerja makin greget!
              </p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-4">
                <span className="text-[#c4b5fd] text-xs sm:text-sm tracking-[2.5px] uppercase font-semibold">Disiplin</span>
                <span className="text-slate-mist/20 text-xs sm:text-sm">•</span>
                <span className="text-[#c4b5fd] text-xs sm:text-sm tracking-[2.5px] uppercase font-semibold">Akurat</span>
                <span className="text-slate-mist/20 text-xs sm:text-sm">•</span>
                <span className="text-[#c4b5fd] text-xs sm:text-sm tracking-[2.5px] uppercase font-semibold">Optimal</span>
              </div>
              <p className="text-pure-white text-xs sm:text-sm tracking-[1px] mt-4 uppercase">Puskesmas Ampenan</p>
            </div>

            {/* Card */}
          <div className="bg-white/[0.04] backdrop-blur-xl rounded-[24px] p-6 sm:p-10 border border-white/[0.06] shadow-2xl">
            {/* LOGIN STEP */}
            {step === "login" && (
              <>
                <h2 className="text-lg font-semibold text-pure-white mb-5">Masuk</h2>
                {error && (
                  <div className="mb-4 p-3 bg-electric-violet/10 rounded-[16px] flex items-start gap-2.5">
                    <AlertCircle size="15" className="text-periwinkle-glow shrink-0 mt-0.5" />
                    <p className="text-xs sm:text-sm text-periwinkle-glow/90">{error}</p>
                  </div>
                )}
                {deviceDebug && (
                  <div className="mb-4 p-3 bg-onyx rounded-[16px] border border-periwinkle-glow/20">
                    <p className="text-[10px] text-slate-mist font-mono whitespace-pre-wrap break-all">{deviceDebug}</p>
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-medium text-white/70 uppercase tracking-[0.05em] mb-1.5">Username / Email</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="nama@puskesmas.com"
                      required
                      disabled={loading}
                      className="w-full px-4 sm:px-5 py-3 sm:py-3.5 bg-white/[0.06] border border-white/[0.08] rounded-[16px] text-pure-white text-sm placeholder-white/30 focus:outline-none focus:border-electric-violet/50 focus:ring-1 focus:ring-electric-violet/20 transition-all duration-200 disabled:opacity-40"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-white/70 uppercase tracking-[0.05em] mb-1.5">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        disabled={loading}
                        className="w-full px-4 sm:px-5 py-3 sm:py-3.5 bg-white/[0.06] border border-white/[0.08] rounded-[16px] text-pure-white text-sm placeholder-white/30 focus:outline-none focus:border-electric-violet/50 focus:ring-1 focus:ring-electric-violet/20 transition-all duration-200 disabled:opacity-40 pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-mist hover:text-pure-white transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => alert("Silahkan hubungi Admin untuk reset password.")}
                      className="text-xs text-white/55 hover:text-white/80 transition-colors"
                    >
                      Lupa password?
                    </button>
                  </div>

                  <div className="space-y-3 py-2">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative mt-0.5">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="peer sr-only"
                        />
                        <div className="w-[18px] h-[18px] rounded-[6px] border border-slate-mist/40 bg-obsidian peer-checked:bg-electric-violet peer-checked:border-electric-violet transition-all duration-200" />
                        <svg
                          className="absolute inset-0 w-[18px] h-[18px] text-pure-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200 pointer-events-none"
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-pure-white font-medium leading-tight">Ingat Saya</p>
                        <p className="text-[10px] text-slate-mist/60 leading-relaxed mt-0.5">
                          Username & password tersimpan untuk login cepat
                        </p>
                      </div>
                    </label>

                    {isNativePlatform() && rememberMe && (
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative mt-0.5">
                          <input
                            type="checkbox"
                            checked={useBiometric}
                            onChange={(e) => setUseBiometric(e.target.checked)}
                            className="peer sr-only"
                          />
                          <div className="w-[18px] h-[18px] rounded-[6px] border border-slate-mist/40 bg-obsidian peer-checked:bg-electric-violet peer-checked:border-electric-violet transition-all duration-200" />
                          <svg
                            className="absolute inset-0 w-[18px] h-[18px] text-pure-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200 pointer-events-none"
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm text-pure-white font-medium leading-tight flex items-center gap-1.5">
                            <ShieldCheck size={14} className="text-periwinkle-glow" />
                            Gunakan Sidik Jari
                          </p>
                          <p className="text-[10px] text-slate-mist/60 leading-relaxed mt-0.5">
                            Login cepat dengan fingerprint di perangkat ini
                          </p>
                        </div>
                      </label>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 sm:py-4 px-8 bg-electric-violet text-pure-white font-medium text-sm rounded-full hover:brightness-110 active:brightness-90 transition-all duration-200 disabled:opacity-40 flex items-center justify-center gap-2.5"
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
                <div className="mt-6 sm:mt-8 flex items-center justify-center gap-2 text-[10px] text-slate-mist/70">
                  <Smartphone size={12} className="shrink-0" />
                  <span>Device baru memerlukan verifikasi OTP & approval admin</span>
                </div>
              </>
            )}

            {/* OTP STEP */}
            {step === "otp" && (
              <>
                <div className="text-center mb-6 sm:mb-8">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-electric-violet/10 mb-4">
                    <Mail size={20} className="text-periwinkle-glow" />
                  </div>
                  <h2 className="font-urbanist text-xl sm:text-2xl font-medium tracking-[0.76px] text-pure-white">
                    Verifikasi OTP
                  </h2>
                  <p className="text-slate-mist text-xs sm:text-sm mt-2 tracking-[0.72px]">
                    Kode dikirim ke {userEmail}
                  </p>
                  <div className="mt-3 p-2 bg-green-yellow/10 border border-green-yellow/20 rounded-[12px]">
                    <p className="text-[10px] text-green-yellow/70">
                      Tidak terima email? Gunakan kode: <span className="font-mono font-bold text-green-yellow tracking-wider text-sm">{generatedOtp}</span>
                    </p>
                  </div>
                </div>
                {error && (
                  <div className="mb-4 p-3 bg-electric-violet/10 rounded-[16px] flex items-start gap-2.5">
                    <AlertCircle size="15" className="text-periwinkle-glow shrink-0 mt-0.5" />
                    <p className="text-xs sm:text-sm text-periwinkle-glow/90">{error}</p>
                  </div>
                )}
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").substring(0, 6))}
                    placeholder="000000"
                    required
                    maxLength={6}
                    disabled={loading}
                    className="w-full px-4 py-4 sm:py-5 bg-obsidian border border-onyx rounded-[16px] text-pure-white text-center text-xl sm:text-2xl font-mono tracking-[0.5em] placeholder-slate-mist/40 focus:outline-none focus:border-electric-violet/40 focus:ring-1 focus:ring-electric-violet/20 transition-all duration-200 disabled:opacity-40"
                  />
                  <button
                    type="submit"
                    disabled={loading || otpCode.length !== 6}
                    className="w-full py-3.5 sm:py-4 px-8 bg-electric-violet text-pure-white font-medium text-sm rounded-full hover:brightness-110 active:brightness-90 transition-all duration-200 disabled:opacity-40 flex items-center justify-center gap-2.5"
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
                <div className="mt-4 sm:mt-5 flex items-center justify-between">
                  <button
                    onClick={handleCancel}
                    className="text-xs text-slate-mist hover:text-pure-white transition-colors flex items-center gap-1.5"
                  >
                    <ArrowLeft size={12} /> Kembali
                  </button>
                  <button
                    onClick={handleResendOtp}
                    disabled={loading}
                    className="text-xs text-slate-mist hover:text-periwinkle-glow transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw size={12} /> Kirim ulang
                  </button>
                </div>
              </>
            )}

            {/* PENDING STEP */}
            {step === "pending" && (
              <>
                <div className="text-center mb-6 sm:mb-8">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-electric-violet/10 mb-4">
                    <Clock size={20} className="text-periwinkle-glow" />
                  </div>
                  <h2 className="font-urbanist text-xl sm:text-2xl font-medium tracking-[0.76px] text-pure-white">
                    Menunggu Approval
                  </h2>
                  <p className="text-slate-mist text-xs sm:text-sm mt-2 tracking-[0.72px]">
                    OTP terverifikasi
                  </p>
                </div>
                <div className="p-3 sm:p-4 bg-obsidian rounded-[16px] mb-4 border border-onyx">
                  <p className="text-xs text-slate-mist">
                    Status: <span className="text-periwinkle-glow">Pending</span>
                  </p>
                  <p className="text-[10px] text-slate-mist/60 mt-1">{deviceInfo?.deviceName}</p>
                </div>
                {error && (
                  <div className="mb-4 p-3 bg-electric-violet/10 rounded-[16px] flex items-start gap-2.5">
                    <AlertCircle size="15" className="text-periwinkle-glow shrink-0 mt-0.5" />
                    <p className="text-xs sm:text-sm text-periwinkle-glow/90">{error}</p>
                  </div>
                )}
                <div className="space-y-3">
                  <button
                    onClick={checkApprovalStatus}
                    disabled={loading}
                    className="w-full py-3.5 sm:py-4 px-8 bg-electric-violet text-pure-white font-medium text-sm rounded-full hover:brightness-110 active:brightness-90 transition-all duration-200 disabled:opacity-40 flex items-center justify-center gap-2.5"
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
                    className="w-full py-3.5 px-8 border border-onyx text-slate-mist text-sm rounded-full hover:bg-pure-white/5 hover:text-pure-white transition-all duration-200"
                  >
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <p className="text-center text-[10px] text-pure-white mt-6 sm:mt-8 tracking-[0.65px]">
            Hadir.Kuy v{appVersion}
          </p>
        </div>
      </div>
    </div>
    </div>
  );
}