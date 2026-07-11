import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import { getCurrentVersion } from "../services/updateService";
import { Outlet, useLocation } from "react-router-dom";

function AdminLayout() {
  const location = useLocation();
  const isDashboard = location.pathname === "/admin";
  const isEmployee = location.pathname === "/employee";

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-white dark:bg-obsidian transition-colors duration-500">
      {/* Magenta Purple Gradient Background */}
      <div className="fixed inset-0" style={{ background: 'linear-gradient(160deg, #BF00FF 0%, #9900CC 30%, #660099 70%, #33004D 100%)', opacity: 0.08, pointerEvents: 'none' }}></div>

      {/* Floating Orbs — magenta purple — dark mode only */}
      <div className="fixed top-[-10%] left-[5%] w-[400px] h-[400px] bg-[#BF00FF] rounded-full mix-blend-screen filter blur-[120px] opacity-25 animate-orb pointer-events-none hidden dark:block"></div>
      <div className="fixed bottom-[-10%] right-[5%] w-[400px] h-[400px] bg-[#BF00FF] rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-orb animate-orb-delay pointer-events-none hidden dark:block"></div>
      <div className="fixed inset-0 professional-ambient-bg pointer-events-none"></div>
      <div className="fixed inset-0 professional-grid-bg pointer-events-none"></div>

      <Sidebar menuOpen={false} />

      <div className="relative z-10 w-full xl:w-[calc(100%-260px)] xl:ml-[260px] min-h-screen flex flex-col min-w-0">
        {!(isDashboard || isEmployee) && <Header />}
        <main className={`flex-1 w-full min-w-0 overflow-x-hidden p-3 sm:p-4 md:p-5 lg:p-6 xl:p-8 ${isDashboard ? 'pb-0' : 'pb-24 md:pb-6'} flex flex-col`}>
          <div className="mx-auto max-w-[2000px] w-full flex-1 flex flex-col">
            <Outlet />
            {!isDashboard && (
              <footer className="text-center text-[10px] text-white/[0.15] pb-2 select-none mt-2">
                v{getCurrentVersion().version} &mdash; Hadir.Kuy
              </footer>
            )}
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}

export default AdminLayout;

