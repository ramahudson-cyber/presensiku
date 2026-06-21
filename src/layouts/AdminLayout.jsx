import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { Outlet } from "react-router-dom";

function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0f0524] relative overflow-hidden">
      {/* Animated Gradient Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#1a0533] via-[#0f0524] to-[#2d0a4e] animate-gradient-bg"></div>
      
      {/* Decorative Orbs */}
      <div className="fixed top-[-5%] left-[10%] w-[500px] h-[500px] bg-purple-700 rounded-full mix-blend-screen filter blur-[120px] opacity-15 animate-orb"></div>
      <div className="fixed bottom-[-5%] right-[10%] w-[500px] h-[500px] bg-violet-800 rounded-full mix-blend-screen filter blur-[120px] opacity-15 animate-orb animate-orb-delay"></div>
      
      {/* Geometric Pattern Overlay */}
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 25px 25px, white 2px, transparent 0)`,
          backgroundSize: '50px 50px'
        }}
      />

      <Sidebar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="relative z-10 w-full md:ml-[270px] min-h-screen flex flex-col">
        <Header onMenuClick={() => setMenuOpen(true)} />
        <main className="flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;