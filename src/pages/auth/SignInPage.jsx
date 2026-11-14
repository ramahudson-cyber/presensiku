import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signIn } from "../../services/authService";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { getBlockDeviceType, getDeviceType, isPegawaiWebBlocked, isNativePlatform } from "../../lib/devicePlatform";
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
  AlertCircle, Mail, Clock, RefreshCw, ArrowLeft, Loader2, Eye, EyeOff, Smartphone, ShieldCheck, XCircle
} from "lucide-react";

export default function SignInPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [useBiometric, setUseBiometric] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState("");
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");

  const [step, setStep] = useState("login");
  const [otpCode, setOtpCode] = useState("");
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [userEmail, setUserEmail] = useState("");
  const [, setDeviceDebug] = useState("");
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const appVersion = getCurrentVersion().version;

  const navigate = useNavigate();
  const { refreshUser, isAuthenticated, setLoading: setAuthLoading, loading: authLoading } = useAuth();

  const redirectAfterLogin = (profile) => {
    if (profile?.role !== "super_admin" && profile?.password_changed !== true) {
      navigate("/ubah-password", { replace: true });
      return true;
    }
    redirectByRole(profile?.role);
    return false;
  };

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
    const value = input.trim();
    if (!value) throw new Error("Username atau email wajib diisi");

    let identifier = value;
    let slug = null;
    // username@slug-instansi tetap memakai namespace; email kontak berdomain
    // titik dikirim utuh agar resolver dapat memetakan ke auth_email sintetis.
    const atCount = (value.match(/@/g) || []).length;
    if (atCount === 1 && !/\.[a-z]{2,}$/i.test(value)) {
      const sep = value.indexOf("@");
      identifier = value.slice(0, sep);
      slug = value.slice(sep + 1);
      if (!identifier || !slug) throw new Error("Format login: username@kode-instansi");
    }

    const { data, error } = await supabase.rpc("resolve_login_identity", {
      p_username: identifier,
      p_org_slug: slug,
    });
    if (error || !data) {
      if (error) console.error("resolveEmail error:", error);
      throw new Error(error?.message || "Akun tidak ditemukan. Hubungi admin.");
    }
    return data;
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
    if (loading || authLoading) return; // cegah double-submit / race
    setError("");
    setLoading(true);

    try {
      await withTimeout((async () => {
      console.log("[Login] 1/9 Memverifikasi akun...");
      setLoadingText("Memverifikasi akun...");
      const email = await resolveEmail(username);
      console.log("[Login] 1/9 OK — email:", email);

      console.log("[Login] 2/9 signIn...");
      setLoadingText("Masuk ke sistem...");
      await signIn(email, password);
      console.log("[Login] 2/9 OK — signed in");

      console.log("[Login] 3/9 Credential ops...");
      console.log("[Login] 3/9 Memuat data pengguna...");
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

      const deviceType = getDeviceType();
      if (isPegawaiWebBlocked(profile.role, deviceType)) {
        await supabase.auth.signOut();
        await clearCredentials();
        await setBiometricEnabled(false);
        setAuthLoading(false);
        setLoading(false);
        navigate(`/block?device=${getBlockDeviceType(deviceType)}`, { replace: true });
        return;
      }

      // Instansi disuspend oleh super admin → tolak login
      if (profile.organization_id && profile.role !== "super_admin") {
        const { data: org } = await supabase
          .from("organizations")
          .select("is_active")
          .eq("id", profile.organization_id)
          .maybeSingle();
        if (org && org.is_active === false) {
          await supabase.auth.signOut();
          await clearCredentials();
          await setBiometricEnabled(false);
          setAuthLoading(false);
          setLoading(false);
          setShowSuspendModal(true);
          return;
        }
      }

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

      setUserEmail(profile.email || email);
      setUserName(profile.full_name || username);
      setUserId(authUser.id);

      // Admin & super_admin skip device binding and OTP entirely.
      if (profile.role === "super_admin" || profile.role === "admin") {
        console.log(`[Login] ${profile.role} — skip device binding & OTP`);
        setLoadingText("Memuat dashboard...");
        await withTimeout(refreshUser(), 15000, "refreshUser");
        setAuthLoading(false); // tutup spinner global sebelum navigasi
        await new Promise((r) => setTimeout(r, 0)); // pastikan AuthContext re-render loading=false
        if (redirectAfterLogin(profile)) return;
        return;
      }

      const deviceInfoResult = await getDeviceInfo();
      setDeviceInfo(deviceInfoResult);

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
        setAuthLoading(false);
        await new Promise((r) => setTimeout(r, 0));
        if (redirectAfterLogin(profile)) return;
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
          setAuthLoading(false);
          await new Promise((r) => setTimeout(r, 0));
          redirectAfterLogin(profile);
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
      setAuthLoading(false);

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
      setAuthLoading(false);
    }
  };

  const checkApprovalStatus = async () => {
    setLoading(true);
    setLoadingText("Memeriksa status...");
    try {
      const status = await checkDeviceRequestStatus(userId, deviceInfo.visitorId);
      if (status.status === "approved") {
        await refreshUser();
        setAuthLoading(false);
        await new Promise((r) => setTimeout(r, 0));
        const { data: profile } = await supabase.from("profiles").select("role, password_changed").eq("id", userId).single();
        if (profile) {
          if (redirectAfterLogin(profile)) return;
          return;
        }
        navigate("/login", { replace: true });
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
      setAuthLoading(false);
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
    <div className="min-h-dvh w-full flex flex-col lg:flex-row overflow-hidden" style={{ background: "#F4F2FB" }}>
      {/* ATAS/KIRI +-35% — peta fokus + gelombang radius (Preview B) */}
      <div
        className="relative flex flex-col items-center justify-center overflow-hidden flex-[35_1_0%] min-h-[200px] lg:flex-1 lg:min-h-0 lg:h-screen lg:px-12"
        style={{
          background: "linear-gradient(160deg,#39C0DF 0%,#32ACFB 34%,#3F93FD 66%,#4A7CFB 100%)",
        }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1.2px, transparent 1.3px)", backgroundSize: "18px 18px", opacity: 0.45, maskImage: "radial-gradient(circle at 50% 45%, #000 25%, transparent 76%)", WebkitMaskImage: "radial-gradient(circle at 50% 45%, #000 25%, transparent 76%)" }} />
        <svg viewBox="0 0 300 192" fill="none" className="relative w-full max-w-[280px] h-[180px] lg:max-w-[440px] lg:h-[290px]">
          <g stroke="#fff" strokeOpacity="0.16" strokeWidth="1.6" strokeLinecap="round">
            <path d="M8 38h88M120 26h72M202 42h90" />
            <path d="M8 122h68M102 142h108M232 120h62" />
            <path d="M58 10v38M162 10v32M252 12v30M38 142v42M140 150v34M242 132v50" />
            <path d="M0 76h300M0 106h300" strokeOpacity="0.09" />
          </g>
          <g fill="#fff" fillOpacity="0.07">
            <rect x="20" y="48" width="28" height="18" rx="5" />
            <rect x="130" y="40" width="34" height="20" rx="5" />
            <rect x="214" y="54" width="26" height="16" rx="5" />
            <rect x="54" y="114" width="30" height="18" rx="5" />
            <rect x="160" y="114" width="36" height="18" rx="5" />
          </g>
          <g stroke="#fff" strokeWidth="1.7">
            <circle className="emp-radar" cx="150" cy="96" r="24" strokeOpacity="0.6" />
            <circle className="emp-radar emp-radar-2" cx="150" cy="96" r="24" strokeOpacity="0.6" />
            <circle className="emp-radar emp-radar-3" cx="150" cy="96" r="24" strokeOpacity="0.6" />
          </g>
          <g className="emp-pin-float">
            <circle cx="150" cy="96" r="25" fill="#fff" fillOpacity="0.16" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.6" />
            <path d="M150 80c-6.1 0-11 4.7-11 10.5 0 7.3 11 17.5 11 17.5s11-10.2 11-17.5C161 84.7 156.1 80 150 80z" fill="#fff" />
            <circle cx="150" cy="90.8" r="3.7" fill="#2F8BF8" />
          </g>
        </svg>
        {/* Identitas — hanya desktop */}
        <div className="hidden lg:flex flex-col items-center text-center">
          <div className="text-[34px] font-extrabold tracking-[0.24em]" style={{ color: "#FFFFFF", textIndent: "0.24em" }}>
            PRESENSIKU
          </div>
          <p className="text-sm mt-3" style={{ color: "rgba(255,255,255,0.85)" }}>
            Absen lebih rapi, kerja lebih tenang.
          </p>
          <p className="text-[11px] font-bold mt-4 tracking-[0.3em]" style={{ color: "rgba(255,255,255,0.6)" }}>
            Disiplin · Akurat · Optimal
          </p>
        </div>
      </div>

      {/* SHEET/KANAN +-65% — putih; mobile: sheet, desktop: panel kanan */}
      <div
        className="relative z-10 flex flex-col overflow-hidden flex-[65_1_0%] min-h-0 -mt-6 rounded-t-[32px] bg-white shadow-[0_-10px_34px_rgba(15,23,42,0.14)] lg:flex-1 lg:w-1/2 lg:h-screen lg:mt-0 lg:rounded-none"
      >
        <div className="flex justify-center pt-2.5 pb-1 shrink-0 lg:hidden">
          <span className="block rounded-full" style={{ width: 42, height: 5, background: "#E2E8F0" }} />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-7 pb-6 lg:overflow-visible lg:px-14 lg:flex lg:flex-col lg:justify-center">
          <div className="w-full lg:max-w-[400px] lg:mx-auto">
            {/* LOGIN STEP */}
            {step === "login" && (
              <>
                <h2 className="text-2xl font-extrabold tracking-tight leading-none" style={{ color: "#0F172A" }}>Masuk</h2>
                <p className="text-xs mt-2 mb-5" style={{ color: "#475569" }}>
                  Gunakan username atau email terdaftar.
                </p>
                {error && (
                  <div className="mb-4 p-3 rounded-[14px] flex items-start gap-2.5"
                    style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
                    <AlertCircle size={15} className="shrink-0 mt-0.5" style={{ color: "#EF4444" }} />
                    <p className="text-xs sm:text-sm" style={{ color: "#B91C1C" }}>{error}</p>
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[9.5px] font-extrabold uppercase tracking-[0.13em] mb-1.5" style={{ color: "#94A3B8" }}>
                      Username / Email
                    </label>
                    <div
                      className="flex items-center gap-2.5 rounded-[14px] border px-3.5"
                      style={{ background: "#FAFAFC", borderColor: "rgba(31,41,55,0.08)" }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M4 6h16v12H4z" />
                        <path d="m4 7 8 6 8-6" />
                      </svg>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="nama@email.com"
                        required
                        disabled={loading}
                        className="flex-1 min-w-0 py-3 bg-transparent text-sm outline-none disabled:opacity-40"
                        style={{ color: "#0F172A" }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9.5px] font-extrabold uppercase tracking-[0.13em] mb-1.5" style={{ color: "#94A3B8" }}>
                      Password
                    </label>
                    <div
                      className="flex items-center gap-2.5 rounded-[14px] border px-3.5"
                      style={{ background: "#FAFAFC", borderColor: "rgba(31,41,55,0.08)" }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <rect x="4" y="10" width="16" height="10" rx="2" />
                        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                      </svg>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Masukkan password"
                        required
                        disabled={loading}
                        className="flex-1 min-w-0 py-3 bg-transparent text-sm outline-none disabled:opacity-40"
                        style={{ color: "#0F172A" }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="shrink-0"
                        style={{ color: "#94A3B8" }}
                        aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  {/* Remember Me & Forgot Password Row */}
                  <div className="flex justify-between items-center py-2">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative mt-0.5">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="peer sr-only"
                        />
                        <div
                          className="w-[18px] h-[18px] rounded-[6px] border transition-all duration-200 peer-checked:bg-electric-violet peer-checked:border-electric-violet"
                          style={{ borderColor: "#CBD5E1", background: "#FFFFFF" }}
                        />
                        <svg
                          className="absolute inset-0 w-[18px] h-[18px] opacity-0 peer-checked:opacity-100 transition-opacity duration-200 pointer-events-none"
                          fill="none" viewBox="0 0 24 24" stroke="#FFFFFF" strokeWidth={3}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-tight" style={{ color: "#475569" }}>Ingat Saya</p>
                      </div>
                    </label>

                    <button
                      type="button"
                      onClick={() => alert("Silahkan hubungi Admin untuk reset password.")}
                      className="text-xs font-bold transition-colors"
                      style={{ color: "#2F8BF8" }}
                    >
                      Lupa password?
                    </button>
                  </div>

                  {/* Biometric Checkbox (only if Remember Me enabled) */}
                  {rememberMe && isNativePlatform() && (
                    <label className="flex items-start gap-3 cursor-pointer group mb-4">
                      <div className="relative mt-0.5">
                        <input
                          type="checkbox"
                          checked={useBiometric}
                          onChange={(e) => setUseBiometric(e.target.checked)}
                          className="peer sr-only"
                        />
                        <div
                          className="w-[18px] h-[18px] rounded-[6px] border transition-all duration-200 peer-checked:bg-electric-violet peer-checked:border-electric-violet"
                          style={{ borderColor: "#CBD5E1", background: "#FFFFFF" }}
                        />
                        <svg
                          className="absolute inset-0 w-[18px] h-[18px] opacity-0 peer-checked:opacity-100 transition-opacity duration-200 pointer-events-none"
                          fill="none" viewBox="0 0 24 24" stroke="#FFFFFF" strokeWidth={3}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-tight flex items-center gap-1.5" style={{ color: "#475569" }}>
                          <ShieldCheck size={14} style={{ color: "#2F8BF8" }} />
                          Gunakan Sidik Jari
                        </p>
                      </div>
                    </label>
                  )}

                  {/* Note for Ingat Saya removed from checkbox label */}
                  {rememberMe && <p className="text-[10px] leading-relaxed -mt-2 mb-4 ml-[30px]" style={{ color: "#94A3B8" }}>Username &amp; password tersimpan untuk login cepat</p>}

                  <div
                    className="w-full py-3.5 sm:py-4 px-8 rounded-full text-pure-white font-bold text-sm flex items-center justify-center gap-2.5"
                    style={{ background: "linear-gradient(135deg, #39C0DF 0%, #2F8BF8 55%, #4A7CFB 100%)", boxShadow: "0 10px 24px -8px rgba(47,139,248,0.55)" }}
                  >
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2.5 disabled:opacity-40"
                      style={{ background: "transparent", border: 0, color: "inherit", font: "inherit", cursor: loading ? "default" : "pointer" }}
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
                  </div>
                </form>
                <div
                  className="mt-4 p-3 rounded-[14px] flex items-start gap-2.5"
                  style={{ background: "#EEF6FF", border: "1px solid rgba(47,139,248,0.16)" }}
                >
                  <Smartphone size={13} className="shrink-0 mt-0.5" style={{ color: "#2F8BF8" }} />
                  <span className="text-[10px] leading-relaxed" style={{ color: "#3A5A7A" }}>
                    Perangkat baru memerlukan verifikasi OTP via email dan persetujuan admin.
                  </span>
                </div>
              </>
            )}

            {/* OTP STEP */}
            {step === "otp" && (
              <>
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-[16px] mb-4"
                    style={{ background: "#EEF6FF", border: "1px solid rgba(47,139,248,0.16)" }}>
                    <Mail size={20} style={{ color: "#2F8BF8" }} />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight" style={{ color: "#0F172A" }}>
                    Verifikasi OTP
                  </h2>
                  <p className="text-xs sm:text-sm mt-2" style={{ color: "#475569" }}>
                    Kode dikirim ke {userEmail}
                  </p>
                  <div className="mt-3 p-2.5 rounded-[12px]" style={{ background: "#FEFCE8", border: "1px solid #FDE68A" }}>
                    <p className="text-[10px]" style={{ color: "#92400E" }}>
                      Tidak terima email? Periksa folder spam, atau gunakan tombol kirim ulang di bawah.
                    </p>
                  </div>
                </div>
                {error && (
                  <div className="mb-4 p-3 rounded-[14px] flex items-start gap-2.5"
                    style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
                    <AlertCircle size={15} className="shrink-0 mt-0.5" style={{ color: "#EF4444" }} />
                    <p className="text-xs sm:text-sm" style={{ color: "#B91C1C" }}>{error}</p>
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
                    className="w-full py-4 sm:py-5 rounded-[16px] text-center text-xl sm:text-2xl font-mono tracking-[0.5em] outline-none disabled:opacity-40"
                    style={{ background: "#FAFAFC", border: "1px solid rgba(31,41,55,0.08)", color: "#0F172A" }}
                  />
                  <button
                    type="submit"
                    disabled={loading || otpCode.length !== 6}
                    className="w-full py-3.5 sm:py-4 px-8 rounded-full text-white font-bold text-sm flex items-center justify-center gap-2.5 disabled:opacity-40 transition-all"
                    style={{ background: "linear-gradient(135deg, #39C0DF 0%, #2F8BF8 55%, #4A7CFB 100%)" }}
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
                <div className="mt-4 flex items-center justify-between">
                  <button
                    onClick={handleCancel}
                    className="text-xs font-semibold flex items-center gap-1.5"
                    style={{ color: "#94A3B8" }}
                  >
                    <ArrowLeft size={12} /> Kembali
                  </button>
                  <button
                    onClick={handleResendOtp}
                    disabled={loading}
                    className="text-xs font-semibold flex items-center gap-1.5"
                    style={{ color: "#2F8BF8" }}
                  >
                    <RefreshCw size={12} /> Kirim ulang
                  </button>
                </div>
              </>
            )}

            {/* PENDING STEP */}
            {step === "pending" && (
              <>
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-[16px] mb-4"
                    style={{ background: "#EEF6FF", border: "1px solid rgba(47,139,248,0.16)" }}>
                    <Clock size={20} style={{ color: "#2F8BF8" }} />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight" style={{ color: "#0F172A" }}>
                    Menunggu Approval
                  </h2>
                  <p className="text-xs sm:text-sm mt-2" style={{ color: "#475569" }}>OTP terverifikasi</p>
                </div>
                <div className="p-3.5 rounded-[14px] mb-4" style={{ background: "#FAFAFC", border: "1px solid rgba(31,41,55,0.08)" }}>
                  <p className="text-xs" style={{ color: "#475569" }}>
                    Status: <span className="font-bold" style={{ color: "#2F8BF8" }}>Pending</span>
                  </p>
                  <p className="text-[10px] mt-1" style={{ color: "#94A3B8" }}>{deviceInfo?.deviceName}</p>
                </div>
                {error && (
                  <div className="mb-4 p-3 rounded-[14px] flex items-start gap-2.5"
                    style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
                    <AlertCircle size={15} className="shrink-0 mt-0.5" style={{ color: "#EF4444" }} />
                    <p className="text-xs sm:text-sm" style={{ color: "#B91C1C" }}>{error}</p>
                  </div>
                )}
                <div className="space-y-3">
                  <button
                    onClick={checkApprovalStatus}
                    disabled={loading}
                    className="w-full py-3.5 sm:py-4 px-8 rounded-full text-white font-bold text-sm flex items-center justify-center gap-2.5 disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg, #39C0DF 0%, #2F8BF8 55%, #4A7CFB 100%)" }}
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
                    className="w-full py-3.5 px-8 rounded-full text-sm font-semibold transition-all"
                    style={{ background: "#FFFFFF", border: "1px solid rgba(31,41,55,0.12)", color: "#475569" }}
                  >
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <p className="text-center text-[10px] mt-5 tracking-[0.65px]" style={{ color: "#94A3B8" }}>
            Presensiku v{appVersion}
          </p>
        </div>
      </div>
        {/* Modal premium: akun disuspend */}
        {showSuspendModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative z-10 w-full max-w-sm rounded-[28px] border border-white/10 p-7 text-center animate-slide-up"
              style={{ background: 'linear-gradient(160deg, #2A1745 0%, #17102B 100%)', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
              <div className="w-14 h-14 rounded-full bg-rose-500/15 flex items-center justify-center mx-auto mb-4">
                <XCircle size={28} className="text-rose-400" />
              </div>
              <h3 className="text-lg font-bold text-pure-white">Akun Disuspend</h3>
              <p className="text-sm text-slate-mist mt-2 leading-relaxed">
                Akun Anda sedang di suspend dan tidak bisa login.
              </p>
              <button
                onClick={() => setShowSuspendModal(false)}
                className="mt-6 w-full py-3 rounded-full bg-electric-violet text-pure-white text-sm font-bold hover:brightness-110 active:brightness-90 transition-all"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
    </div>
  );
}