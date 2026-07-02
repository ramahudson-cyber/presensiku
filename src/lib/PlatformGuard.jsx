import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isNativePlatform } from "./devicePlatform";

const WEB_ALLOWED_ROLES = ["super_admin", "admin_puskesmas", "kepala_unit"];

function PlatformGuard({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Memuat...</p>
        </div>
      </div>
    );
  }

  const isNative = isNativePlatform();
  const userRole = user?.role;

  if (!isNative && !WEB_ALLOWED_ROLES.includes(userRole)) {
    return <Navigate to="/block" replace />;
  }

  return children;
}

export default PlatformGuard;
