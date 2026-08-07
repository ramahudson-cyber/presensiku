import { Routes, Route, Navigate } from "react-router-dom";
import WelcomePage from "../pages/auth/WelcomePage";
import SignInPage from "../pages/auth/SignInPage";
import ChangePasswordPage from "../pages/auth/ChangePasswordPage";
import DashboardPage from "../pages/admin/DashboardPage";
import EmployeesPage from "../pages/admin/EmployeesPage";
import AttendancePage from "../pages/attendance/AttendancePage";
import AttendanceHistoryPage from "../pages/admin/AttendanceHistoryPage";
import PengaturanPage from "../pages/admin/PengaturanPage";
import EmployeeDashboard from "../pages/employee/EmployeeDashboard";
import EmployeeSchedule from "../pages/employee/EmployeeSchedule";
import EmployeeProfile from "../pages/employee/EmployeeProfile";
import EmployeeHistory from "../pages/employee/EmployeeHistory";
import EmployeeEditProfile from "../pages/employee/EmployeeEditProfile";
import SchedulingPage from "../pages/admin/SchedulingPage";
import LeaveManagementPage from "../pages/admin/LeaveManagementPage";
import LeaveRequestPage from "../pages/employee/LeaveRequestPage";
import ComingSoonPage from "../pages/admin/ComingSoonPage";
import UnauthorizedPage from "../pages/UnauthorizedPage";
import BlockPage from "../pages/BlockPage";
import NotFoundPage from "../pages/NotFoundPage";

import ProtectedRoute from "./ProtectedRoute";
import PlatformGuard from "../lib/PlatformGuard";
import AdminLayout from "../layouts/AdminLayout";
import { useAuth } from "../context/AuthContext";

import KepalaUnitDashboard from "../pages/kepala_unit/MonitoringDashboardPage";

function RoleBasedDashboard() {
  const { user } = useAuth();
  if (user?.role === "kepala_unit") {
    return <KepalaUnitDashboard />;
  }
  return <DashboardPage />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* PUBLIC */}
      <Route path="/" element={<WelcomePage />} />
      <Route path="/login" element={<SignInPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="/block" element={<BlockPage />} />

      {/* ADMIN */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["super_admin", "admin_puskesmas", "kepala_unit"]}>
            <PlatformGuard>
              <AdminLayout />
            </PlatformGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={<RoleBasedDashboard />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="attendance-history" element={<AttendanceHistoryPage />} />
        <Route path="schedules" element={<SchedulingPage />} />
        <Route path="leave" element={<LeaveManagementPage />} />
        <Route path="announcements" element={<ComingSoonPage />} />
        <Route path="settings" element={<PengaturanPage />} />
      </Route>

      {/* PEGAWAI - DETEKSI DEVICE DINONAKTIFKAN SEMENTARA */}
      <Route
        path="/employee"
        element={<AdminLayout />}
      >
        <Route index element={<EmployeeDashboard />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="schedule" element={<EmployeeSchedule />} />
        <Route path="profile" element={<EmployeeProfile />} />
        <Route path="profile/edit" element={<EmployeeEditProfile />} />
        <Route path="history" element={<EmployeeHistory />} />
        <Route path="leave" element={<LeaveRequestPage />} />
      </Route>

      {/* UBAH PASSWORD (wajib untuk first login) */}
      <Route
        path="/ubah-password"
        element={
          <ProtectedRoute>
            <ChangePasswordPage />
          </ProtectedRoute>
        }
      />

      {/* REDIRECT */}
      <Route path="/dashboard" element={<Navigate to="/admin" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default AppRoutes;
