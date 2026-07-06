import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Capacitor } from '@capacitor/core';

const WEB_ALLOWED_ROLES = ["super_admin", "admin_puskesmas", "kepala_unit"];

function getDeviceType() {
  try {
    if (Capacitor.isNativePlatform()) return "native";
  } catch {}
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

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

  const deviceType = getDeviceType();
  const userRole = user?.role;

  // Native app (Capacitor) always allowed
  if (deviceType === "native") return children;

  // Admin roles always allowed
  if (WEB_ALLOWED_ROLES.includes(userRole)) return children;

  // iOS pegawai allowed (no APK available)
  if (deviceType === "ios") return children;

  // Android or Desktop pegawai → blocked
  return <Navigate to={`/block?device=${deviceType}`} replace />;
}

export default PlatformGuard;
