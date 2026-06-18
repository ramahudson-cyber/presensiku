import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "../pages/auth/LoginPage";
import DashboardPage from "../pages/admin/DashboardPage";
import EmployeesPage from "../pages/admin/EmployeesPage";clear
import AttendancePage from "../pages/attendance/AttendancePage";
import AttendanceHistoryPage from "../pages/admin/AttendanceHistoryPage";
import PengaturanPage from "../pages/admin/PengaturanPage";
import ComingSoonPage from "../pages/admin/ComingSoonPage";
import UnauthorizedPage from "../pages/UnauthorizedPage";
import NotFoundPage from "../pages/NotFoundPage";

import ProtectedRoute from "./ProtectedRoute";
import AdminLayout from "../layouts/AdminLayout";

function AppRoutes() {
  return (
    <Routes>
      {/* PUBLIC ROUTES */}
      <Route path="/" element={<LoginPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* ADMIN ROUTES (super_admin, admin_puskesmas) */}
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
        
        {/* ✅ Pengaturan: hanya super_admin */}
        <Route 
          path="settings" 
          element={
            <ProtectedRoute allowedRoles={["super_admin"]}>
              <PengaturanPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Route placeholder untuk modul yang belum dibuat */}
        <Route path="schedules" element={<ComingSoonPage />} />
        <Route path="leave" element={<ComingSoonPage />} />
        <Route path="announcements" element={<ComingSoonPage />} />
        <Route path="reports" element={<ComingSoonPage />} />
      </Route>

      {/* EMPLOYEE ROUTES (pegawai) */}
      <Route
        path="/employee"
        element={
          <ProtectedRoute allowedRoles={["pegawai"]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AttendancePage />} />
      </Route>

      {/* REDIRECTS */}
      <Route path="/dashboard" element={<Navigate to="/admin" replace />} />

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default AppRoutes;