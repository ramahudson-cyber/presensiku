import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { Outlet } from "react-router-dom";

function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#5B3A8E] relative overflow-hidden">
      {/* Decorative Pattern */}
      <div
        className="fixed inset-0 opacity-5"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 80%, white 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      />

      <Sidebar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="relative z-10 w-full md:ml-[270px] min-h-screen flex flex-col">
        <Header onMenuClick={() => setMenuOpen(true)} />
        <main className="flex-1 p-3 md:p-6 max-w-2xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;