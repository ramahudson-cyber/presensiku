import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { Outlet } from "react-router-dom";

function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0f0524]">
      {/* Animated Gradient Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#1a0533] via-[#0f0524] to-[#2d0a4e] animate-gradient-bg"></div>
      
      {/* Floating Orbs */}
      <div className="fixed top-[-10%] left-[5%] w-[400px] h-[400px] bg-purple-700 rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-orb"></div>
      <div className="fixed bottom-[-10%] right-[5%] w-[400px] h-[400px] bg-violet-800 rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-orb animate-orb-delay"></div>

      <Sidebar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      {menuOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden" onClick={() => setMenuOpen(false)} />
      )}

      <div className="relative z-10 w-full md:ml-[260px] min-h-screen flex flex-col">
        <Header onMenuClick={() => setMenuOpen(true)} />
        <main className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;