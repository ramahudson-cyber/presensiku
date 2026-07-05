import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import { getCurrentVersion } from "../services/updateService";
import { Outlet } from "react-router-dom";

function AdminLayout() {
  return (
    <div className="min-h-screen relative overflow-x-hidden bg-white dark:bg-obsidian transition-colors duration-500">
      {/* Deep Violet Gradient Background — dark mode only */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#2415c6]/20 via-obsidian to-[#5800fd]/10 animate-gradient-bg pointer-events-none hidden dark:block"></div>

      {/* Floating Orbs — DESIGN.md Halo Violet — dark mode only */}
      <div className="fixed top-[-10%] left-[5%] w-[400px] h-[400px] bg-halo-violet rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-orb pointer-events-none hidden dark:block"></div>
      <div className="fixed bottom-[-10%] right-[5%] w-[400px] h-[400px] bg-electric-violet rounded-full mix-blend-screen filter blur-[120px] opacity-15 animate-orb animate-orb-delay pointer-events-none hidden dark:block"></div>
      <div className="fixed inset-0 professional-ambient-bg pointer-events-none"></div>
      <div className="fixed inset-0 professional-grid-bg pointer-events-none"></div>

      <Sidebar menuOpen={false} />

      <div className="relative z-10 w-full xl:w-[calc(100%-260px)] xl:ml-[260px] min-h-screen flex flex-col min-w-0">
        <Header />
        <main className="flex-1 w-full min-w-0 overflow-x-hidden p-3 sm:p-4 md:p-5 lg:p-6 xl:p-8 pb-24 md:pb-6">
          <div className="mx-auto max-w-[2000px] w-full">
            <Outlet />
          </div>
          <footer className="text-center text-[10px] text-white/[0.15] pb-2 select-none mt-2">
            v{getCurrentVersion().version} &mdash; SIAP Puskesmas Ampenan
          </footer>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}

export default AdminLayout;

