import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const STUCK_TIMEOUT_MS = 15000;

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading, isAuthenticated } = useAuth();
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

  if (!user) {
    return <Navigate to="/login" replace />;
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
