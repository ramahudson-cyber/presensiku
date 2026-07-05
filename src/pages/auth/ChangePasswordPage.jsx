import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { Loader2, AlertCircle, Eye, EyeOff, Lock, Shield } from "lucide-react";

export default function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  const redirectByRole = (role) => {
    if (role === "pegawai") navigate("/employee", { replace: true });
    else navigate("/admin", { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      await supabase
        .from("profiles")
        .update({ password_changed: true })
        .eq("id", user?.id);

      await refreshUser();
      redirectByRole(user?.role);
    } catch (err) {
      setError(err.message || "Gagal mengubah password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-dark-bg min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-[#0f0214] via-[#1a0533] to-[#2d0a4e]">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-transparent to-purple-900/20"></div>

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

      <div className="relative z-10 w-full max-w-[380px]">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/15 mb-4">
            <Shield size={28} className="text-amber-400" />
          </div>
          <h1 className="text-2xl font-extrabold text-pure-white">Ubah Password</h1>
          <p className="text-sm text-slate-mist mt-2">
            Ini adalah login pertama Anda. Silakan ganti password default.
          </p>
        </div>

        <div className="bg-black/80 backdrop-blur-xl rounded-2xl p-7 shadow-2xl shadow-purple-950/50">
          {error && (
            <div className="mb-3 p-2.5 bg-red-500/10 rounded-lg flex items-center gap-2">
              <AlertCircle size={15} className="text-red-400 shrink-0" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-mist" />
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Password Baru"
                required
                minLength={6}
                disabled={loading}
                className="w-full pl-10 pr-10 py-3 bg-black/50 border border-violet-500/20 rounded-xl text-pure-white text-sm placeholder-slate-mist focus:outline-none focus:border-violet-500/50 transition disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-mist hover:text-pure-white"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-mist" />
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Konfirmasi Password"
                required
                minLength={6}
                disabled={loading}
                className="w-full pl-10 pr-4 py-3 bg-black/50 border border-violet-500/20 rounded-xl text-pure-white text-sm placeholder-slate-mist focus:outline-none focus:border-violet-500/50 transition disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 border-gradient bg-transparent text-pure-white font-semibold rounded-xl text-sm shadow-lg shadow-purple-900/30 hover:shadow-purple-900/50 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan Password"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
