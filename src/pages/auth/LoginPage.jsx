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
  Activity, LogIn, AlertCircle, Smartphone, Mail, Clock,
  CheckCircle2, XCircle, RefreshCw,
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
      await new Promise((resolve) => setTimeout(resolve, 500));

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Gagal mendapatkan user session");

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (!profile) throw new Error("Profil tidak ditemukan");

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

      const requestStatusInfo = await checkDeviceRequestStatus(authUser.id, info.visitorId);

      if (requestStatusInfo.hasRequest) {
        if (requestStatusInfo.status === "pending") {
          setStep("pending");
          setLoading(false);
          return;
        } else if (requestStatusInfo.status === "approved") {
          await refreshUser();
          redirectByRole(profile.role);
          return;
        } else if (requestStatusInfo.status === "rejected") {
          setError("🚫 Permintaan device Anda DITOLAK oleh admin.\n\nHubungi admin puskesmas.");
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }
      }

      const sendResult = await sendOtpEmail(profile.email || email, profile.full_name || username);
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
      if (!result.isValid) {
        setError(result.message || "Kode OTP salah");
        setLoading(false);
        return;
      }

      const reqResult = await createDeviceRequest(deviceInfo);
      if (!reqResult.success) {
        setError("Gagal membuat device request: " + reqResult.error);
        setLoading(false);
        return;
      }

      setStep("pending");
    } catch (err) {
      setError("Terjadi kesalahan: " + err.message);
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
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .single();
        if (profile?.role) {
          redirectByRole(profile.role);
          return;
        }
        navigate("/admin", { replace: true });
      } else if (status.status === "rejected") {
        setError("🚫 Permintaan device Anda DITOLAK oleh admin.\n\nHubungi admin.");
        await supabase.auth.signOut();
        setStep("login");
      } else {
        setError("Masih menunggu approval admin.");
      }
    } catch (err) {
      setError("Gagal cek status: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    setError("");
    try {
      await sendOtpEmail(userEmail, userName);
    } catch (err) {
      setError("Gagal kirim ulang OTP: " + err.message);
    } finally {
      setLoading(false);
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
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 shadow-lg shadow-violet-600/30 mb-4">
            <Activity size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-wider">SIAP</h1>
          <p className="text-violet-300 text-xs mt-1 tracking-widest uppercase">Puskesmas Ampenan</p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-violet-900/50">
          
          {/* STEP 1: LOGIN */}
          {step === "login" && (
            <>
              <h2 className="text-xl font-bold text-white mb-6 text-center">Masuk ke Sistem</h2>
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2">
                  <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300 whitespace-pre-line">{error}</p>
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-violet-300 mb-1.5">Username atau Email</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="AMP002"
                    required
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-violet-300 mb-1.5">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-purple-700 text-white font-bold rounded-xl shadow-lg shadow-violet-600/30 hover:shadow-violet-600/50 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div><span>Memverifikasi...</span></>
                  ) : (
                    <><LogIn size={18} /><span>Masuk</span></>
                  )}
                </button>
              </form>
              <div className="mt-6 p-3 bg-violet-500/5 border border-violet-500/20 rounded-xl flex items-start gap-2">
                <Smartphone size={16} className="text-violet-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-violet-300/80">
                  <strong>Keamanan Device:</strong> Login dari device baru memerlukan verifikasi OTP & approval admin.
                </p>
              </div>
            </>
          )}

          {/* STEP 2: OTP */}
          {step === "otp" && (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 mb-3">
                  <Mail size={28} className="text-white" />
                </div>
                <h2 className="text-xl font-bold text-white mb-1">Verifikasi OTP</h2>
                <p className="text-slate-400 text-xs">Kode OTP telah dikirim ke:</p>
                <p className="text-white font-semibold text-sm mt-1 break-all">{userEmail}</p>
              </div>
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2">
                  <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300 whitespace-pre-line">{error}</p>
                </div>
              )}
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-violet-300 mb-1.5">Kode OTP (6 digit)</label>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").substring(0, 6))}
                    placeholder="000000"
                    required
                    maxLength={6}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white text-center text-2xl font-mono tracking-[0.5em] placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                  />
                  <p className="text-[10px] text-slate-500 mt-2 text-center">Kode berlaku 10 menit</p>
                </div>
                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-purple-700 text-white font-bold rounded-xl shadow-lg shadow-violet-600/30 hover:shadow-violet-600/50 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div><span>Memverifikasi...</span></>
                  ) : (
                    <><CheckCircle2 size={18} /><span>Verifikasi OTP</span></>
                  )}
                </button>
              </form>
              <div className="mt-4 flex justify-between items-center">
                <button onClick={handleCancel} className="text-xs text-slate-400 hover:text-white transition">← Kembali</button>
                <button onClick={handleResendOtp} disabled={loading} className="text-xs text-violet-400 hover:text-violet-300 transition flex items-center gap-1">
                  <RefreshCw size={12} /> Kirim ulang OTP
                </button>
              </div>
            </>
          )}

          {/* STEP 3: PENDING */}
          {step === "pending" && (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 mb-3">
                  <Clock size={28} className="text-white" />
                </div>
                <h2 className="text-xl font-bold text-white mb-1">Menunggu Approval</h2>
                <p className="text-slate-400 text-xs">OTP berhasil diverifikasi!</p>
              </div>
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-4">
                <p className="text-sm text-amber-200"><strong>📋 Status:</strong> Pending Approval</p>
                <p className="text-xs text-amber-300/80 mt-2">Device Anda:</p>
                <p className="text-xs text-white font-mono mt-1 bg-black/30 p-2 rounded-lg break-all">{deviceInfo?.deviceName}</p>
                <p className="text-xs text-amber-300/80 mt-3">Mohon tunggu admin menyetujui device Anda.</p>
              </div>
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2">
                  <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300 whitespace-pre-line">{error}</p>
                </div>
              )}
              <div className="space-y-3">
                <button
                  onClick={checkApprovalStatus}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div><span>Memeriksa...</span></>
                  ) : (
                    <><RefreshCw size={18} /><span>Cek Status Approval</span></>
                  )}
                </button>
                <button
                  onClick={handleCancel}
                  className="w-full py-3 border border-slate-700 text-slate-400 rounded-xl hover:bg-slate-800 transition text-sm"
                >
                  Logout & Kembali
                </button>
              </div>
            </>
          )}
        </div>
        
        <p className="text-center text-[10px] text-slate-600 mt-6">
          Sistem Informasi Administrasi & Presensi
        </p>
      </div>
    </div>
  );
}