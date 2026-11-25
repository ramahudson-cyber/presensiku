import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getBlockDeviceType, isPegawaiWebBlocked } from "./devicePlatform";
import AppBootSkeleton from "../components/AppBootSkeleton";

function PlatformGuard({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <AppBootSkeleton label="Memuat..." />;
  }

  if (isPegawaiWebBlocked(user?.role)) {
    return <Navigate to={`/block?device=${getBlockDeviceType()}`} replace />;
  }

  return children;
}

export default PlatformGuard;
