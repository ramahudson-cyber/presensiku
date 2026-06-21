import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { Outlet } from "react-router-dom";

function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="w-full md:ml-[280px] min-h-screen flex flex-col">
        <Header onMenuClick={() => setMenuOpen(true)} />
        <main className="flex-1 p-3 md:p-6 max-w-2xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;