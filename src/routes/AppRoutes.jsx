import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "../pages/auth/LoginPage";
import DashboardPage from "../pages/admin/DashboardPage";
import EmployeesPage from "../pages/admin/EmployeesPage";
import AttendancePage from "../pages/attendance/AttendancePage";
import AttendanceHistoryPage from "../pages/admin/AttendanceHistoryPage";
import PengaturanPage from "../pages/admin/PengaturanPage";
import EmployeeDashboard from "../pages/employee/EmployeeDashboard";
import EmployeeSchedule from "../pages/employee/EmployeeSchedule";
import SchedulingPage from "../pages/admin/SchedulingPage";
import ComingSoonPage from "../pages/admin/ComingSoonPage";
import UnauthorizedPage from "../pages/UnauthorizedPage";
import NotFoundPage from "../pages/NotFoundPage";

import ProtectedRoute from "./ProtectedRoute";
import AdminLayout from "../layouts/AdminLayout";

function AppRoutes() {
  return (
    <Routes>
      {/* PUBLIC */}
      <Route path="/" element={<LoginPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* ADMIN */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["super_admin", "admin_puskesmas"]}>
            <AdminLayout />
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

      {/* PEGAWAI */}
      <Route
        path="/employee"
        element={
          <ProtectedRoute allowedRoles={["pegawai"]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<EmployeeDashboard />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="schedule" element={<EmployeeSchedule />} />
      </Route>

      {/* REDIRECT */}
      <Route path="/dashboard" element={<Navigate to="/admin" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default AppRoutes;
