import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { Outlet } from "react-router-dom";

function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-950">
      <Sidebar />

      {/* 
        ml-0 md:ml-[280px] -> Di HP (mobile) margin kiri 0, di Desktop margin 280px 
        p-4 md:p-8 -> Di HP padding 4, di Desktop padding 8
      */}
      <div className="flex-1 w-full md:ml-[280px]">
        <Header />
        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;