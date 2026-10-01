import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { signOut } from "../../services/authService";
import { isShiftEnded, getMondayFirstDayOfWeek } from "../../lib/shiftTime";
import usePullToRefresh from "../../hooks/usePullToRefresh";
import PullToRefreshIndicator from "../../components/PullToRefreshIndicator";
import {
  TrendingUp, Bell, RefreshCw, BellOff, LogOut,
} from "lucide-react";

const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const getWitaDateString = (date = new Date()) => {
  const witaMs = date.getTime() + (8 * 60 * 60 * 1000);
  return new Date(witaMs).toISOString().split("T")[0];
};

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalPegawai: 0, hadirHariIni: 0, izinSakit: 0, alpha: 0 });
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
    // Tick per detik antara sync — jam hero berjalan real-time
    const tick = setInterval(() => setServerNow(prev => new Date(prev.getTime() + 1000)), 1000);
    return () => { clearInterval(t); clearInterval(tick); };
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const serverDate = new Date();
      const today = getWitaDateString(serverDate);
      const yesterday = getWitaDateString(new Date(serverDate.getTime() - 24 * 60 * 60 * 1000));

      // Parallel: all profiles, attendance (kemarin+hari ini untuk alpha shift malam), announcements, jadwal & aturan shift
      const [profilesRes, attendanceRes, announceRes, schedRes, shiftRulesRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url"),
        supabase.from("attendance").select("user_id, attendance_status, date").in("date", [yesterday, today]),
        supabase.from("announcements").select("*").eq("is_active", true)
          .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
          .order("created_at", { ascending: false }).limit(3),
        supabase.from("employee_schedules").select("user_id, date, shift_code").in("date", [yesterday, today]),
        supabase.from("shift_schedules").select("shift_code, day_of_week, end_time, crosses_midnight, is_working_day")
          .in("day_of_week", [getMondayFirstDayOfWeek(today), getMondayFirstDayOfWeek(yesterday)]),
      ]);

      const allProfiles = profilesRes.data || [];
      const attendanceRows = attendanceRes.data || [];
      const announceData = announceRes.data || [];
      const attendanceToday = attendanceRows.filter(a => a.date === today);

      const presentIds = new Set(attendanceToday.filter(a => a.attendance_status === "hadir" || a.attendance_status === "terlambat").map(a => a.user_id));
      const absentIds = new Set(attendanceToday.filter(a => a.attendance_status === "izin" || a.attendance_status === "sakit").map(a => a.user_id));

      // Alpha: jadwal kerja yang shift-nya sudah berakhir tanpa record absen apa pun.
      // Jadwal kemarin dihitung hanya untuk shift Malam lintas tengah malam yang berakhir hari ini.
      const attendedKeys = new Set(attendanceRows.map(a => `${a.user_id}|${a.date}`));
      const profileIds = new Set(allProfiles.map(p => p.id));
      const shiftRuleMap = new Map((shiftRulesRes.data || []).map(s => [`${s.shift_code}|${s.day_of_week}`, s]));
      const now = new Date();
      const alphaIds = new Set();
      (schedRes.data || []).forEach(s => {
        const isToday = s.date === today;
        const isYesterday = s.date === yesterday;
        if (!isToday && !isYesterday) return;
        const def = shiftRuleMap.get(`${s.shift_code}|${getMondayFirstDayOfWeek(s.date)}`);
        if (!def) return;
        if (isYesterday && !def.crosses_midnight) return;
        if (attendedKeys.has(`${s.user_id}|${s.date}`)) return;
        if (!isShiftEnded(s.date, def, now)) return;
        if (!profileIds.has(s.user_id)) return;
        alphaIds.add(s.user_id);
      });

      const hadir = presentIds.size;
      const izinSakit = absentIds.size;
      const alpha = alphaIds.size;

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
        alpha,
      });
      setWeeklyData(weekly);
      setAnnouncements(announceData);
    } catch (err) { console.error("Dashboard error:", err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchDashboardData(); }, []);

  const { pullDistance, isRefreshing } = usePullToRefresh(fetchDashboardData);

  const maxWeekly = Math.max(...weeklyData, 1);
  const witaTime = () => serverNow.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Makassar" });
  const witaDate = () => serverNow.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Makassar" });
  // Tanggal pendek untuk mobile — tanggal panjang mempersempit kolom nama
  const witaDateShort = () => serverNow.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Makassar" });
  const userInitial = user?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "S";

  return (
    <div className="flex-1">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      {/* Hero Section — violet gradient, one-row compact, in-flow with margin (Variant B) */}
      <div className="hero-card-bg mx-3 mt-3 sm:mx-4 sm:mt-4 md:mx-5 md:mt-5 lg:mx-6 lg:mt-6 xl:mx-8 xl:mt-8 bg-gradient-to-r from-[#C44DFF] via-[#BF00FF] to-[#8A00CC] rounded-[24px] shadow-xl ring-1 ring-violet-300/40">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3 px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4">
          {/* Time block — tanggal pendek di mobile agar nama tidak terdesak */}
          <div className="shrink-0">
            <div className="text-xl sm:text-2xl font-bold text-white tabular-nums leading-none tracking-tight">{witaTime()}</div>
            <div className="text-[10px] sm:text-[11px] text-white/70 font-medium mt-1 tabular-nums">
              <span className="sm:hidden">{witaDateShort()}</span>
              <span className="hidden sm:inline">{witaDate()}</span>
            </div>
          </div>
          {/* Divider */}
          <div className="w-px h-10 bg-white/25 shrink-0 hidden sm:block" aria-hidden="true" />
          {/* Profile */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-white text-sm sm:text-base font-bold shadow-md shrink-0">
              {userInitial}
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-[15px] font-bold text-white truncate tracking-tight">{user?.full_name || "Super Admin"}</div>
              <div className="text-[10px] sm:text-[11px] text-white/70 truncate font-medium uppercase tracking-wider">
                {user?.role || "super_admin"}<span className="hidden sm:inline"> &middot; {user?.email || "admin@presensiku"}</span>
              </div>
            </div>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => navigate("/admin/announcements")} className="relative w-9 h-9 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all" aria-label="Pengumuman">
              <Bell size={15} className="text-white" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-400 rounded-full ring-2 ring-[#8A00CC]" />
            </button>
          </div>
        </div>
        {/* Email line — mobile only (desktop shows inline next to role) */}
        {user?.email && (
          <div className="sm:hidden text-[11px] text-white/75 truncate px-4 pb-3 -mt-1 font-medium">{user.email}</div>
        )}
      </div>

      {/* Content Section — light canvas */}
      <div className="px-4 sm:px-6 lg:px-8 py-6 flex-1">
        <div className="flex justify-end mb-4">
          <button onClick={fetchDashboardData} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200/80 text-slate-600 rounded-full text-xs shadow-sm hover:bg-slate-50 transition-all duration-200">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />Refresh
          </button>
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
      </div>
    </div>
  );
}