import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getBlockDeviceType, isPegawaiWebBlocked } from "./devicePlatform";

function PlatformGuard({ children }) {
  const { user, loading } = useAuth();

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

  if (isPegawaiWebBlocked(user?.role)) {
    return <Navigate to={`/block?device=${getBlockDeviceType()}`} replace />;
  }

  return children;
}

export default PlatformGuard;
