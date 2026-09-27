import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { signOut } from "../services/authService";
import BottomSheet from "./BottomSheet";

// Token light-mode, sama dengan BottomSheet/EmployeeProfile
const T = {
  border: 'rgba(31,41,55,0.08)',
  text: '#0F172A',
  textSec: '#475569',
  textMuted: '#94A3B8',
  iconBg: '#F5F3FF',
};

// Sheet profil yang dibuka saat foto profil diklik: info akun + keluar.
// Gaya & perilaku logout meniru kartu "Keluar dari Akun" di EmployeeProfile
// (tanpa konfirmasi, redirect /login, toast bila gagal).
export default function ProfileSheet({ open, onClose }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const avatarUrl = user?.avatar_url || user?.user_metadata?.avatar_url || null;
  const initial = user?.full_name?.charAt(0)?.toUpperCase() || "P";
  const position = user?.position || user?.role || "Pegawai";
  const orgName = user?.organization?.name || user?.department || null;

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (err) {
      setLoggingOut(false);
      toast.error("Gagal keluar: " + (err?.message || "periksa koneksi"));
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Foto Profil" subtitle="Ketuk di luar untuk menutup">
      <div className="space-y-4 pb-2">
        {/* Identitas */}
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 shrink-0 rounded-2xl p-[2.5px]"
            style={{ background: 'linear-gradient(135deg, #BF00FF, #9900CC, #7066ed)' }}>
            <div className="w-full h-full rounded-[14px] flex items-center justify-center overflow-hidden"
              style={{ background: avatarUrl ? 'transparent' : T.iconBg }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-extrabold" style={{ color: '#BF00FF' }}>{initial}</span>
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-extrabold tracking-tight truncate" style={{ color: T.text }}>
              {user?.full_name || user?.username || "User"}
            </p>
            <p className="text-xs mt-0.5 truncate" style={{ color: T.textSec }}>
              {position}{orgName ? ` · ${orgName}` : ""}
            </p>
          </div>
        </div>

        {/* Keluar */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.98]"
          style={{
            background: 'rgba(251,113,133,0.08)',
            border: '1px solid rgba(251,113,133,0.15)',
            color: '#fb7185',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(251,113,133,0.15)';
            e.currentTarget.style.borderColor = 'rgba(251,113,133,0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(251,113,133,0.08)';
            e.currentTarget.style.borderColor = 'rgba(251,113,133,0.15)';
          }}
        >
          {loggingOut ? (
            <div className="w-4 h-4 border-2 border-rose-300 border-t-transparent rounded-full animate-spin" />
          ) : (
            <LogOut size={16} />
          )}
          {loggingOut ? 'Keluar...' : 'Keluar dari Akun'}
        </button>
      </div>
    </BottomSheet>
  );
}
