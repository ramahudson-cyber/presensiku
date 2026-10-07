import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { signOut } from "../services/authService";
import { XCircle, LogOut } from "lucide-react";

const STUCK_TIMEOUT_MS = 15000;

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading, isAuthenticated, profileError, retryProfile } = useAuth();
  const location = useLocation();
  const [stuck, setStuck] = useState(false);
  const timer = useRef(null);

  // Jaring pengaman: bila `loading` bertahan lama (jaringan macet / race tak terduga),
  // tampilkan opsi muat ulang alih-alih spinner tak berujung.
  useEffect(() => {
    if (loading) {
      timer.current = setTimeout(() => setStuck(true), STUCK_TIMEOUT_MS);
    } else {
      setStuck(false);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [loading]);

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
<p className="mt-4 text-gray-600">
            {stuck ? "Lama memuat..." : "Memuat..."}
          </p>
          {stuck && (
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-5 py-2 rounded-full bg-purple-600 text-white text-sm hover:bg-purple-700 transition-colors"
            >
              Muat Ulang
            </button>
          )}
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Sesi valid tapi profil gagal dimuat (jaringan lambat / timeout) —
  // DULU langsung ditendang ke /login sehingga pegawai harus login + OTP
  // ulang padahal sesinya masih ada. Tampilkan opsi muat ulang profil.
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center max-w-xs px-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat profil...</p>
          {profileError && (
            <p className="mt-2 text-xs text-red-500">Gagal memuat profil — periksa koneksi Anda.</p>
          )}
          <div className="mt-4 flex flex-col gap-2 items-center">
            <button
              onClick={() => retryProfile()}
              className="px-5 py-2 rounded-full bg-purple-600 text-white text-sm hover:bg-purple-700 transition-colors"
            >
              Coba Lagi
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2 rounded-full border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
            >
              Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Instansi disuspend oleh super admin → admin & pegawai instansi itu
  // terkunci sampai diaktifkan kembali (super_admin platform bebas).
  if (
    user?.organization &&
    user.organization.is_active === false &&
    user.role !== "super_admin"
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center max-w-sm px-4">
          <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
            <XCircle size={28} className="text-rose-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-800">Instansi Disuspend</h2>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            Instansi Anda sedang disuspend oleh super admin. Aplikasi tidak dapat
            digunakan sampai instansi diaktifkan kembali.
          </p>
          <button
            onClick={async () => { await signOut(); window.location.href = "/#/login"; }}
            className="mt-5 px-5 py-2 rounded-full border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors inline-flex items-center gap-2"
          >
            <LogOut size={13} /> Keluar
          </button>
        </div>
      </div>
    );
  }

  // Check role if allowedRoles is specified
  if (allowedRoles && user) {
    const userRole = user?.role;
    
    if (!userRole || !allowedRoles.includes(userRole)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Force password change untuk non-super_admin yang belum ganti password
  // Kecuali lagi di halaman /ubah-password itu sendiri
  if (
    user &&
    user.role !== "super_admin" &&
    user.password_changed !== true &&
    location.pathname !== "/ubah-password"
  ) {
    return <Navigate to="/ubah-password" replace />;
  }

  return children;
}

export default ProtectedRoute;
