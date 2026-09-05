import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
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
    user.password_changed === false &&
    location.pathname !== "/ubah-password"
  ) {
    return <Navigate to="/ubah-password" replace />;
  }

  return children;
}

export default ProtectedRoute;
