import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { LogOut } from "lucide-react";
import { signOut } from "../../services/authService";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase.from("attendance").select("*").eq("user_id", user.id).eq("date", today).maybeSingle();
      setTodayAttendance(data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const fullName = user?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const role = user?.role || user?.user_metadata?.role || "Pegawai";
  const initials = fullName.split(" ").map(s => s[0]).join("").toUpperCase().slice(0, 2);
  
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Selamat Pagi," : hour < 18 ? "Selamat Siang," : "Selamat Malam,";

  return (
    <div className="w-full max-w-lg mx-auto bg-[#050505] min-h-screen text-white flex flex-col">
      <div className="bg-gradient-to-b from-[#6d28d9] to-[#4338ca] rounded-b-[40px] p-[50px_24px_30px_24px] flex-grow">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-[70px] h-[70px] rounded-full bg-[#4338ca] flex items-center justify-center text-2xl font-bold border-4 border-white/20 shrink-0">
            {initials}
          </div>
          <div>
            <div className="text-[13px] opacity-70 mb-[2px]">{greeting}</div>
            <div className="text-[18px] font-bold mb-[2px]">{fullName}</div>
            <div className="text-[#adff2f] text-[13px] font-medium">{role}</div>
          </div>
        </div>

        <div className="bg-black/20 p-4 rounded-[20px] mb-5">
          <div className="text-[11px] uppercase text-white/50 mb-2">Status Absensi</div>
          <div className="text-[15px] font-semibold flex items-center gap-2">
            <span className={`px-3 py-1 rounded-[12px] text-[11px] font-bold flex items-center gap-1.5 ${todayAttendance ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              ● {todayAttendance ? "Sudah Absen" : "Belum Absen"}
            </span>
            <span className="opacity-80 text-[13px]">{todayAttendance ? `Masuk: ${new Date(todayAttendance.clock_in_time).toLocaleTimeString("id-ID", {hour:"2-digit",minute:"2-digit"})}` : ""}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-auto">
          <button onClick={() => navigate("/employee/attendance")} className="bg-white/15 p-4 rounded-[20px] text-center text-[12px] font-semibold hover:bg-white/20 transition-all">Absen Sekarang</button>
          <button onClick={() => navigate("/employee/history")} className="bg-white/15 p-4 rounded-[20px] text-center text-[12px] font-semibold hover:bg-white/20 transition-all">Riwayat</button>
        </div>
      </div>
    </div>
  );
}