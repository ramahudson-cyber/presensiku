import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import { Outlet } from "react-router-dom";

function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen relative bg-[#0f0524] overflow-x-hidden">
      {/* Animated Gradient Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#1a0533] via-[#0f0524] to-[#2d0a4e] animate-gradient-bg pointer-events-none"></div>

      {/* Floating Orbs */}
      <div className="fixed top-[-10%] left-[5%] w-[400px] h-[400px] bg-purple-700 rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-orb pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[5%] w-[400px] h-[400px] bg-violet-800 rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-orb animate-orb-delay pointer-events-none"></div>

      <Sidebar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      {menuOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden" onClick={() => setMenuOpen(false)} />
      )}

      <div className="relative z-10 w-full md:ml-[260px] min-h-screen flex flex-col">
        <Header onMenuClick={() => setMenuOpen(true)} />
        {/* FIX: hapus max-w-2xl, pakai w-full. Padding hanya di sini, tidak di pages. */}
        <main className="flex-1 w-full p-3 sm:p-4 md:p-5 lg:p-6 pb-24 md:pb-6">
          <Outlet />
        </main>
      </div>

      <BottomNav />
    </div>
  );
}

export default AdminLayout;