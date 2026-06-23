import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { CheckCircle, XCircle, AlertCircle, ChevronRight, Calendar, Bell } from "lucide-react";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [stats, setStats] = useState({ hadir: 0, izin: 0, sakit: 0, alpha: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const monthStart = new Date(); monthStart.setDate(1);
      const monthStr = monthStart.toISOString().split("T")[0];

      const [attRes, monthRes, annRes] = await Promise.all([
        supabase.from("attendance").select("*").eq("user_id", user.id).eq("date", today).maybeSingle(),
        supabase.from("attendance").select("attendance_status").eq("user_id", user.id).gte("date", monthStr),
        supabase.from("announcements").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(3)
      ]);

      setTodayAttendance(attRes.data);
      const s = { hadir: 0, izin: 0, sakit: 0, alpha: 0 };
      monthRes.data?.forEach(a => { if (s[a.attendance_status] !== undefined) s[a.attendance_status]++; });
      setStats(s);
      setAnnouncements(annRes.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="bg-[#6B4BA3] rounded-2xl p-5 h-20 animate-pulse"></div>
        <div className="bg-[#6B4BA3] rounded-2xl p-4 h-16 animate-pulse"></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{[1,2,3,4].map(i => <div key={i} className="bg-[#6B4BA3] rounded-xl p-3 h-16 animate-pulse"></div>)}</div>
      </div>
    );
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Hero - Solid Purple Card */}
      <div className="bg-[#6B4BA3] rounded-2xl p-5 text-white shadow-lg shadow-[#2A1A3A]/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] opacity-70 uppercase tracking-wider">{dateStr}</p>
            <p className="text-2xl font-bold mt-1">{timeStr}</p>
          </div>
          <Link to="/employee/attendance" className="bg-white/20 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-white/30 transition">
            Absen
          </Link>
        </div>
      </div>

      {/* Status */}
      <Link to="/employee/attendance" className="block">
        <div className="bg-[#6B4BA3] rounded-2xl p-4 shadow-lg shadow-[#2A1A3A]/20 flex items-center justify-between hover:bg-[#7A5BB3] transition">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              {todayAttendance ? <CheckCircle size={18} className="text-emerald-300" /> : <Calendar size={18} className="text-white" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{todayAttendance ? "Sudah Absen" : "Belum Absen"}</p>
              <p className="text-[11px] text-violet-200">{todayAttendance ? `Masuk: ${new Date(todayAttendance.clock_in_time).toLocaleTimeString("id-ID", {hour:"2-digit",minute:"2-digit"})}` : "Tap untuk absen"}</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-violet-300" />
        </div>
      </Link>

      {/* Stats - Responsive: 2 cols mobile, 4 cols tablet+ */}
      <div>
        <p className="text-[10px] font-bold text-violet-200/60 uppercase tracking-widest mb-2 px-1">Bulan Ini</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Hadir", value: stats.hadir, icon: CheckCircle, color: "text-emerald-300" },
            { label: "Izin", value: stats.izin, icon: AlertCircle, color: "text-amber-300" },
            { label: "Sakit", value: stats.sakit, icon: AlertCircle, color: "text-orange-300" },
            { label: "Alpha", value: stats.alpha, icon: XCircle, color: "text-red-300" },
          ].map((s) => (
            <div key={s.label} className="bg-[#6B4BA3] rounded-xl p-3 text-center shadow-lg shadow-[#2A1A3A]/20">
              <s.icon size={14} className={`mx-auto mb-1 ${s.color}`} />
              <p className="text-base font-bold text-white">{s.value}</p>
              <p className="text-[9px] text-violet-200">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pengumuman */}
      <div>
        <p className="text-[10px] font-bold text-violet-200/60 uppercase tracking-widest mb-2 px-1">Pengumuman</p>
        <div className="bg-[#6B4BA3] rounded-2xl p-4 shadow-lg shadow-[#2A1A3A]/20">
          {announcements.length === 0 ? (
            <div className="text-center py-4">
              <Bell size={20} className="mx-auto text-violet-300/50 mb-1" />
              <p className="text-xs text-violet-200/60">Belum ada pengumuman</p>
            </div>
          ) : (
            <div className="space-y-2">
              {announcements.map(a => (
                <div key={a.id} className="p-3 bg-white/5 rounded-xl">
                  <p className="text-sm font-semibold text-white">{a.title}</p>
                  <p className="text-xs text-violet-200/80 mt-1">{a.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}