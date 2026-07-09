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
    <div className="min-h-screen bg-obsidian relative overflow-hidden">
      {/* Radial glow dari atas */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle farthest-side at 0px -30%, rgb(75,57,239), rgba(6,3,17,0) 84%)'
        }}
      />

      {/* Subtle grid overlay */}
      <div className="absolute inset-0 professional-grid-bg pointer-events-none" />

      {/* Ambient sweep */}
      <div className="absolute inset-0 professional-ambient-bg pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-[420px] mx-auto">

          {/* Hero — rata kiri */}
          <div className="text-left mb-8 sm:mb-10 px-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-yellow/10 mb-4">
              <Shield size={22} className="text-green-yellow" />
            </div>
            <h1 className="font-urbanist text-3xl sm:text-4xl font-bold tracking-[1.22px] text-pure-white leading-none">
              Ubah Password
            </h1>
            <p className="text-slate-mist text-sm sm:text-base leading-relaxed mt-2 max-w-[320px] tracking-[0.72px]">
              Ini adalah login pertama Anda. Silakan ganti password default.
            </p>
          </div>

          {/* Card — Onyx surface */}
          <div className="bg-onyx rounded-[24px] p-6 sm:p-10">
            {error && (
              <div className="mb-4 p-3 bg-electric-violet/10 rounded-[16px] flex items-start gap-2.5">
                <AlertCircle size="15" className="text-periwinkle-glow shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm text-periwinkle-glow/90">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-mist" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Password Baru"
                  required
                  minLength={6}
                  disabled={loading}
                  className="w-full pl-11 pr-11 py-3 sm:py-3.5 bg-obsidian border border-onyx rounded-[16px] text-pure-white text-sm placeholder-slate-mist/60 focus:outline-none focus:border-electric-violet/40 focus:ring-1 focus:ring-electric-violet/20 transition-all duration-200 disabled:opacity-40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-mist hover:text-pure-white transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div className="relative">
                <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-mist" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Konfirmasi Password"
                  required
                  minLength={6}
                  disabled={loading}
                  className="w-full pl-11 pr-4 py-3 sm:py-3.5 bg-obsidian border border-onyx rounded-[16px] text-pure-white text-sm placeholder-slate-mist/60 focus:outline-none focus:border-electric-violet/40 focus:ring-1 focus:ring-electric-violet/20 transition-all duration-200 disabled:opacity-40"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 sm:py-4 px-8 bg-electric-violet text-pure-white font-medium text-sm rounded-full hover:brightness-110 active:brightness-90 transition-all duration-200 disabled:opacity-40 flex items-center justify-center gap-2.5"
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
    </div>
  );
}
