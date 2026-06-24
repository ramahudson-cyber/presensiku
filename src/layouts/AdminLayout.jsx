import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import { Outlet } from "react-router-dom";

function AdminLayout() {
  return (
    <div className="min-h-screen relative overflow-x-hidden bg-slate-50 dark:bg-[#0f0524] transition-colors duration-500">
      {/* Animated Gradient Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-violet-50 via-white to-slate-100 dark:from-[#1a0533] dark:via-[#0f0524] dark:to-[#2d0a4e] animate-gradient-bg pointer-events-none"></div>

      {/* Floating Orbs */}
      <div className="fixed top-[-10%] left-[5%] w-[400px] h-[400px] bg-violet-300 dark:bg-purple-700 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[120px] opacity-25 dark:opacity-20 animate-orb pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[5%] w-[400px] h-[400px] bg-purple-300 dark:bg-violet-800 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[120px] opacity-25 dark:opacity-20 animate-orb animate-orb-delay pointer-events-none"></div>
      <div className="fixed inset-0 professional-ambient-bg pointer-events-none"></div>
      <div className="fixed inset-0 professional-grid-bg pointer-events-none"></div>

      <Sidebar menuOpen={false} />

      <div className="relative z-10 w-full xl:w-[calc(100%-260px)] xl:ml-[260px] min-h-screen flex flex-col min-w-0">
        <Header />
        <main className="flex-1 w-full min-w-0 overflow-x-hidden p-3 sm:p-4 md:p-5 lg:p-6 xl:p-8 pb-24 md:pb-6">
          <div className="mx-auto max-w-[2000px] w-full">
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}

export default AdminLayout;
