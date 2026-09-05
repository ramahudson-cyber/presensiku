import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import { getCurrentVersion } from "../services/updateService";
import { Outlet, useLocation } from "react-router-dom";

function AdminLayout() {
  const location = useLocation();
  const isDashboard = location.pathname === "/admin";
  const isEmployeePath = location.pathname === "/employee" || location.pathname.startsWith("/employee/");
  const isAttendancePath = location.pathname === "/employee/attendance" || location.pathname === "/admin/attendance";
  const isAdminPath = location.pathname.startsWith("/admin");

  return (
    <div className={`min-h-screen relative overflow-x-hidden transition-colors duration-500 ${isAdminPath ? "admin-light bg-[#F4F2FB]" : "bg-slate-50"}`}>
      {/* Admin = light ambient (soft violet-tinted canvas, DESIGN.md) */}
      <div className="fixed inset-0 pointer-events-none professional-ambient-bg hidden-only-admin"></div>
      <div className="fixed inset-0 pointer-events-none professional-grid-bg opacity-60 hidden-only-admin"></div>
      {/* Employee area — soft violet ambient (light) */}
      <div
        className="fixed inset-0 pointer-events-none hidden-only-employee"
        style={{
          background: "radial-gradient(circle at 22% 18%, rgba(191,0,255,0.10), transparent 34%), radial-gradient(circle at 86% 10%, rgba(255,0,153,0.06), transparent 30%), radial-gradient(circle at 70% 84%, rgba(112,102,237,0.05), transparent 34%)",
        }}
      ></div>
      <div className="fixed inset-0 professional-grid-bg opacity-45 pointer-events-none hidden-only-employee"></div>

      <Sidebar menuOpen={false} />

      <div className="relative z-10 w-full xl:w-[calc(100%-260px)] xl:ml-[260px] min-h-screen flex flex-col min-w-0">
        {!(isDashboard || isEmployeePath) && <Header />}
        <main className={`flex-1 w-full min-w-0 overflow-x-hidden p-3 sm:p-4 md:p-5 lg:p-6 xl:p-8 md:pb-24 flex flex-col`}>
          <div className="mx-auto max-w-[2000px] w-full flex-1 flex flex-col">
            <Outlet />
            {!isDashboard && (
              <footer className={`text-center text-[10px] pb-2 select-none mt-2 ${isAdminPath ? "text-slate-400" : "text-slate-400"}`}>
                v{getCurrentVersion().version} &mdash; Presensiku
              </footer>
            )}
          </div>
        </main>
      </div>

      <BottomNav hidden={isAttendancePath} />
    </div>
  );
}

export default AdminLayout;