import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { signOut } from "../../services/authService";
import { getCurrentVersion } from "../../services/updateService";
import { PremiumStatCard } from "./PremiumStatCard";
import {
  TrendingUp, Bell, RefreshCw, BellOff, LogOut,
} from "lucide-react";

const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const DAYS_FULL = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const getWitaDateString = (date = new Date()) => {
  const witaMs = date.getTime() + (8 * 60 * 60 * 1000);
  return new Date(witaMs).toISOString().split("T")[0];
};

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalPegawai: 0, hadirHariIni: 0, izinSakit: 0, cuti: 0 });
  const [userGroups, setUserGroups] = useState({ all: [], present: [], absent: [], on_leave: [] });
  const [weeklyData, setWeeklyData] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [announcements, setAnnouncements] = useState([]);
  const [serverNow, setServerNow] = useState(new Date());

  useEffect(() => {
    const syncServer = async () => {
      try {
        const { data, error } = await supabase.rpc("get_server_time");
        if (error) throw error;
        if (data) setServerNow(new Date(data));
      } catch (err) { console.error("Server time sync failed:", err); }
    };
    syncServer();
    const t = setInterval(syncServer, 60000);
    return () => clearInterval(t);
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const serverDate = new Date();
      const today = getWitaDateString(serverDate);

      // Parallel: all profiles, today's attendance, announcements
      const [profilesRes, attendanceTodayRes, announceRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url"),
        supabase.from("attendance").select("user_id, attendance_status").eq("date", today),
        supabase.from("announcements").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(3),
      ]);

      const allProfiles = profilesRes.data || [];
      const attendanceToday = attendanceTodayRes.data || [];
      const announceData = announceRes.data || [];

      const presentIds = new Set(attendanceToday.filter(a => a.attendance_status === "hadir" || a.attendance_status === "terlambat").map(a => a.user_id));
      const absentIds = new Set(attendanceToday.filter(a => a.attendance_status === "izin" || a.attendance_status === "sakit").map(a => a.user_id));
      const onLeaveIds = new Set(attendanceToday.filter(a => a.attendance_status === "cuti").map(a => a.user_id));

      setUserGroups({
        all: allProfiles,
        present: allProfiles.filter(p => presentIds.has(p.id)),
        absent: allProfiles.filter(p => absentIds.has(p.id)),
        on_leave: allProfiles.filter(p => onLeaveIds.has(p.id)),
      });

      const hadir = presentIds.size;
      const izinSakit = absentIds.size;
      const cuti = onLeaveIds.size;

      const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(serverDate);
        d.setDate(d.getDate() - (6 - i));
        return getWitaDateString(d);
      });
      const { data: weekAttendance } = await supabase.from("attendance").select("date").in("date", weekDates).in("attendance_status", ["hadir", "terlambat"]);
      const weeklyMap = {};
      weekDates.forEach(d => weeklyMap[d] = 0);
      weekAttendance?.forEach(a => { if (weeklyMap[a.date] !== undefined) weeklyMap[a.date]++; });
      const weekly = weekDates.map(d => weeklyMap[d]);

      setStats({
        totalPegawai: allProfiles.length,
        hadirHariIni: hadir,
        izinSakit,
        cuti,
      });
      setWeeklyData(weekly);
      setAnnouncements(announceData);
    } catch (err) { console.error("Dashboard error:", err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchDashboardData(); }, []);

  const maxWeekly = Math.max(...weeklyData, 1);
  const witaTime = () => new Date(serverNow.getTime() + (8 * 60 * 60 * 1000)).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });
  const witaDate = () => {
    const d = new Date(serverNow.getTime() + (8 * 60 * 60 * 1000));
    return `${DAYS_FULL[d.getUTCDay()]}, ${d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`;
  };
  const handleLogout = async () => { await signOut(); navigate("/"); };
  const userInitial = user?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "S";

  return (
    <div className="flex-1">
      {/* Hero Section — violet gradient, DESIGN.md hero */}
      <div className="hero-card-bg bg-gradient-to-r from-[#C44DFF] via-[#BF00FF] to-[#8A00CC] px-4 pt-3 pb-4 sm:px-6 lg:px-8 rounded-b-[32px]">
        {/* Top row: Time and actions */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-bold tracking-tight text-white">{witaTime()}</div>
            <div className="text-xs font-medium text-white/60">{witaDate()}</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/admin/announcements")} className="relative w-9 h-9 rounded-full bg-white/[0.15] flex items-center justify-center hover:bg-white/25 transition-colors"><Bell size={17} className="text-white/80" /><span className="absolute top-1.5 right-1.5 w-2 h-2 bg-white rounded-full ring-2 ring-[#8A00CC]"></span></button>
            <button onClick={handleLogout} className="w-9 h-9 rounded-full bg-white/[0.15] flex items-center justify-center hover:bg-white/25 transition-colors"><LogOut size={17} className="text-white/80" /></button>
          </div>
        </div>

        {/* Bottom row: Profile */}
        <div className="flex items-center gap-4 mt-5">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-white/40 to-white/10 border-2 border-white/40 shadow-xl flex items-center justify-center backdrop-blur-sm">
            <span className="text-2xl font-bold text-white">{userInitial}</span>
          </div>
          <div>
            <div className="text-sm font-medium text-white/70">Selamat datang,</div>
            <div className="text-xl font-bold text-white tracking-tight">{user?.full_name || "Super Admin"}</div>
            <div className="text-xs text-white/60 mt-1 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-white/20 text-white/90 text-[10px] font-semibold uppercase tracking-wide">{user?.role || "super_admin"}</span>
              <span>{user?.email || "admin@puskesmas"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section — light canvas */}
      <div className="px-4 sm:px-6 lg:px-8 py-6 flex-1">
        <div className="flex justify-end mb-4">
          <button onClick={fetchDashboardData} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200/80 text-slate-600 rounded-full text-xs shadow-sm hover:bg-slate-50 transition-all duration-200">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />Refresh
          </button>
        </div>

        {/* Premium Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-5">
          <PremiumStatCard title="Total Pegawai" sub="Seluruh status" value={stats.totalPegawai} users={userGroups.all} loading={loading} />
          <PremiumStatCard title="Hadir Hari Ini" sub="Sudah check-in" value={stats.hadirHariIni} users={userGroups.present} loading={loading} />
          <PremiumStatCard title="Izin / Sakit" sub="Hari ini" value={stats.izinSakit} users={userGroups.absent} loading={loading} />
          <PremiumStatCard title="Cuti" sub="Hari ini" value={stats.cuti} users={userGroups.on_leave} loading={loading} />
        </div>

        {/* Grafik + Pengumuman */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-5 mt-3 sm:mt-4 md:mt-6">
          <div className="design-card p-4 sm:p-5 md:p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-3 md:mb-6"><h2 className="text-sm sm:text-base md:text-lg font-bold text-slate-900">Grafik Presensi 7 Hari</h2><div className="flex items-center gap-2 text-xs text-slate-500"><TrendingUp size={14} /> Kehadiran harian</div></div>
            <div className="flex items-end gap-[3px] sm:gap-1 md:gap-2 h-32 sm:h-40 md:h-48">
              {weeklyData.map((val, i) => {
                const d = new Date(serverNow); d.setDate(d.getDate() - (6 - i));
                const isToday = i === 6;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 sm:gap-1.5 group">
                    <span className="text-[10px] sm:text-xs text-slate-700 font-semibold tabular-nums">{val}</span>
                    <div className={`w-full rounded-t-lg md:rounded-t-xl transition-all duration-300 group-hover:scale-105 ${isToday ? "bg-gradient-to-t from-electric-violet to-periwinkle-glow shadow-lg" : "bg-gradient-to-t from-violet-300 to-purple-200 group-hover:from-violet-400 group-hover:to-purple-300"}`} style={{ height: `${(val / maxWeekly) * 100}%`, minHeight: val > 0 ? "6px" : "0" }} />
                    <span className={`text-[10px] sm:text-xs ${isToday ? "font-bold text-electric-violet" : "text-slate-400"}`}>{DAYS[d.getDay()]}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="design-card p-4 sm:p-5 md:p-6">
            <div className="flex items-center justify-between mb-3 md:mb-4"><h2 className="text-sm sm:text-base md:text-lg font-bold text-slate-900">Pengumuman</h2><div className="p-1.5 rounded-lg bg-[#F5F3FF]"><Bell size={16} className="text-[#BF00FF]" /></div></div>
            {loading ? <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-2xl" />)}</div>
            : announcements.length === 0 ? <div className="text-center py-6 sm:py-8 flex flex-col items-center gap-1.5 sm:gap-2"><div className="p-2 sm:p-3 rounded-2xl bg-slate-50"><BellOff size={18} className="sm:w-6 sm:h-6 text-slate-400" /></div><p className="text-slate-400 text-xs sm:text-sm">Belum ada pengumuman</p></div>
            : <div className="space-y-3">{announcements.map((a) => <div key={a.id} className="p-3 bg-slate-50/80 border border-slate-100 rounded-2xl hover:scale-[1.02] transition-all"><p className="text-sm font-semibold text-slate-900 line-clamp-1">{a.title}</p><p className="text-xs text-slate-600 mt-1 line-clamp-2">{a.content}</p><p className="text-xs text-[#7032c4] mt-1.5 font-medium">{new Date(a.created_at).toLocaleDateString("id-ID")}</p></div>)}</div>}
          </div>
        </div>
        <footer className="text-center text-[10px] text-slate-400 pb-2 select-none mt-6">v{getCurrentVersion().version} &mdash; Presensiku</footer>
      </div>
    </div>
  );
}