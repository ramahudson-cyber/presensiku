import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "../pages/auth/LoginPage";
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
import SchedulingPage from "../pages/admin/SchedulingPage";
import ComingSoonPage from "../pages/admin/ComingSoonPage";
import UnauthorizedPage from "../pages/UnauthorizedPage";
import BlockPage from "../pages/BlockPage";
import NotFoundPage from "../pages/NotFoundPage";

import ProtectedRoute from "./ProtectedRoute";
import PlatformGuard from "../lib/PlatformGuard";
import AdminLayout from "../layouts/AdminLayout";

function AppRoutes() {
  return (
    <Routes>
      {/* PUBLIC */}
      <Route path="/" element={<LoginPage />} />
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
        <Route index element={<DashboardPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="attendance-history" element={<AttendanceHistoryPage />} />
        <Route path="schedules" element={<SchedulingPage />} />
        <Route path="leave" element={<ComingSoonPage />} />
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
