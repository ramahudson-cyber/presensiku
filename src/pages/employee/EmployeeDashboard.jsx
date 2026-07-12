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
    <div className="w-full max-w-lg mx-auto min-h-screen text-white p-6" style={{ background: 'linear-gradient(160deg, #BF00FF 0%, #9900CC 30%, #7B1FA2 70%, #4A148C 100%)' }}>
      <div className="flex items-center gap-4 mb-8 relative z-10">
        <div className="w-[70px] h-[70px] rounded-full bg-violet-600 flex items-center justify-center text-2xl font-bold border-2 border-white/10 shrink-0 shadow-lg">{initials}</div>
        <div>
          <div className="text-[13px] opacity-90 mb-[2px]">{greeting}</div>
          <div className="text-[18px] font-bold mb-[2px]">{fullName}</div>
          <div className="text-[#adff2f] text-[13px] font-medium">{role}</div>
        </div>
      </div>

      <div className="relative bg-white/5 border border-violet-500/30 rounded-2xl overflow-hidden mb-5">
        <div className="absolute top-0 left-0 right-0 h-[100px] bg-gradient-to-b from-violet-500/40 to-transparent pointer-events-none" />
        <div className="p-5 text-[13px] font-semibold text-white/60 uppercase tracking-wider relative">Status Absensi</div>
        <div className="p-5 pt-0 flex flex-col items-start relative">
           <span className="text-[#adff2f] font-bold text-[13px] mb-1">● {todayAttendance ? "Sudah Absen" : "Belum Absen"}</span>
           <span className="text-[13px] font-semibold text-white/80">{todayAttendance ? `Masuk: ${new Date(todayAttendance.clock_in_time).toLocaleTimeString("id-ID", {hour:"2-digit",minute:"2-digit"})}` : "Silakan absen segera"}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate("/employee/attendance")} className="bg-white/10 p-4 rounded-2xl text-center text-sm font-bold hover:bg-white/20 transition">Absen</button>
          <button onClick={() => navigate("/employee/history")} className="bg-white/10 p-4 rounded-2xl text-center text-sm font-bold hover:bg-white/20 transition">Riwayat</button>
      </div>
    </div>
  );
}