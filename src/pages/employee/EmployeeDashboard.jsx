import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import {
  CheckCircle, XCircle, AlertCircle, Bell, ChevronRight, Calendar
} from "lucide-react";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [stats, setStats] = useState({ hadir: 0, izin: 0, sakit: 0, alpha: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      
      const { data: att } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();
      setTodayAttendance(att);

      const monthStart = new Date();
      monthStart.setDate(1);
      const { data: monthData } = await supabase
        .from("attendance")
        .select("attendance_status")
        .eq("user_id", user.id)
        .gte("date", monthStart.toISOString().split("T")[0]);

      const s = { hadir: 0, izin: 0, sakit: 0, alpha: 0 };
      monthData?.forEach(a => {
        if (s[a.attendance_status] !== undefined) s[a.attendance_status]++;
      });
      setStats(s);

      const { data: ann } = await supabase
        .from("announcements")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(3);
      setAnnouncements(ann || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      {/* Hero - Simple & Elegant */}
      <div className="bg-gradient-to-br from-violet-600 to-purple-700 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs opacity-80">{dateStr}</p>
            <p className="text-lg font-bold mt-1">{timeStr}</p>
          </div>
          <Link to="/employee/attendance" className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl text-xs font-semibold hover:bg-white/30 transition">
            Absen
          </Link>
        </div>
      </div>

      {/* Status Hari Ini */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-800">
        <p className="text-xs font-semibold text-gray-500 mb-3">Status Hari Ini</p>
        {todayAttendance ? (
          <div className="flex items-center gap-3">
            <CheckCircle size={20} className="text-emerald-500" />
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-white">Sudah Absen</p>
              <p className="text-xs text-gray-400">
                Masuk: {todayAttendance.clock_in_time ? new Date(todayAttendance.clock_in_time).toLocaleTimeString("id-ID", {hour:"2-digit",minute:"2-digit"}) : "-"}
              </p>
            </div>
          </div>
        ) : (
          <Link to="/employee/attendance" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Calendar size={18} className="text-violet-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800 dark:text-white">Belum Absen</p>
              <p className="text-xs text-gray-400">Tap untuk absen sekarang</p>
            </div>
            <ChevronRight size={18} className="text-gray-300 group-hover:text-violet-500" />
          </Link>
        )}
      </div>

      {/* Stats Bulan Ini */}
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-2 px-1">Bulan Ini</p>
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-3 text-center shadow-sm border border-gray-100 dark:border-slate-800">
            <CheckCircle size={14} className="mx-auto text-emerald-500 mb-1" />
            <p className="text-base font-bold text-gray-800 dark:text-white">{stats.hadir}</p>
            <p className="text-[9px] text-gray-400">Hadir</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-3 text-center shadow-sm border border-gray-100 dark:border-slate-800">
            <AlertCircle size={14} className="mx-auto text-amber-500 mb-1" />
            <p className="text-base font-bold text-gray-800 dark:text-white">{stats.izin}</p>
            <p className="text-[9px] text-gray-400">Izin</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-3 text-center shadow-sm border border-gray-100 dark:border-slate-800">
            <AlertCircle size={14} className="mx-auto text-orange-500 mb-1" />
            <p className="text-base font-bold text-gray-800 dark:text-white">{stats.sakit}</p>
            <p className="text-[9px] text-gray-400">Sakit</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-3 text-center shadow-sm border border-gray-100 dark:border-slate-800">
            <XCircle size={14} className="mx-auto text-red-500 mb-1" />
            <p className="text-base font-bold text-gray-800 dark:text-white">{stats.alpha}</p>
            <p className="text-[9px] text-gray-400">Alpha</p>
          </div>
        </div>
      </div>

      {/* Pengumuman */}
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-2 px-1">Pengumuman</p>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-800">
          {announcements.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">Belum ada pengumuman</p>
          ) : (
            <div className="space-y-2">
              {announcements.map(a => (
                <div key={a.id} className="p-3 bg-violet-50 dark:bg-violet-900/20 rounded-xl">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{a.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{a.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}