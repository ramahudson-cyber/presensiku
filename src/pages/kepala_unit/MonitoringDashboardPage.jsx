import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { signOut } from "../../services/authService";
import {
  Users, UserCheck, UserMinus, UserX,
  TrendingUp, Calendar, Bell, RefreshCw, BellOff, Inbox,
  Sun, Moon, LogOut, Sunset, CloudSun,
} from "lucide-react";

function StatCard({ title, value, subtitle, icon: Icon, accent = "from-[#BF00FF] to-[#8A00CC]", loading }) {
  return (
    <div className="p-4 sm:p-5 md:p-6 bg-white border border-slate-200/70 rounded-2xl shadow-[0_4px_16px_rgba(15,23,42,0.06)] hover:scale-[1.02] hover:border-[#BF00FF]/30 transition-all duration-300">
      <div className="flex items-start justify-between gap-2 md:gap-3">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider truncate">{title}</p>
          {loading ? (
            <div className="h-8 sm:h-10 w-16 sm:w-20 bg-slate-100 animate-pulse rounded-lg mt-1 sm:mt-2" />
          ) : (
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mt-0.5 sm:mt-2 tabular-nums">{value}</h3>
          )}
          <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 sm:mt-2 truncate">{subtitle}</p>
        </div>
        <div className={`p-2 sm:p-3 rounded-2xl bg-gradient-to-br ${accent} text-white shadow-lg shrink-0`}>
          <Icon size={16} className="sm:w-5 sm:h-5" />
        </div>
      </div>
    </div>
  );
}

function AttendanceBadge({ status }) {
  const palette = {
    hadir:  { bg: "rgba(16,185,129,0.12)", text: "#059669", border: "rgba(16,185,129,0.25)" },
    izin:   { bg: "rgba(251,191,36,0.12)", text: "#b45309", border: "rgba(251,191,36,0.3)" },
    sakit:  { bg: "rgba(251,113,133,0.12)", text: "#e11d48", border: "rgba(251,113,133,0.25)" },
    cuti:   { bg: "rgba(14,165,233,0.12)", text: "#0284c7", border: "rgba(14,165,233,0.25)" },
    alpha:  { bg: "rgba(244,63,94,0.12)", text: "#e11d48", border: "rgba(244,63,94,0.25)" },
    terlambat: { bg: "rgba(251,146,60,0.12)", text: "#ea580c", border: "rgba(251,146,60,0.3)" },
  };
  const c = palette[status] || { bg: "rgba(15,23,42,0.06)", text: "#64748b", border: "rgba(15,23,42,0.1)" };
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      {status?.toUpperCase() || "-"}
    </span>
  );
}

const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const DAYS_FULL = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const SHIFT_META = {
  PG: { icon: Sun, color: "text-[#65a30d]", bg: "bg-green-yellow/15", border: "border-green-yellow/25", badge: "bg-green-yellow/20" },
  SR: { icon: Sunset, color: "text-[#65a30d]", bg: "bg-green-yellow/15", border: "border-green-yellow/25", badge: "bg-green-yellow/20" },
  SI: { icon: CloudSun, color: "text-sky-600", bg: "bg-sky-500/15", border: "border-sky-500/25", badge: "bg-sky-500/20" },
  ML: { icon: Moon, color: "text-violet-600", bg: "bg-violet-500/15", border: "border-violet-500/25", badge: "bg-violet-500/20" },
};

const getWitaDateString = (date = new Date()) => {
  const witaMs = date.getTime() + (8 * 60 * 60 * 1000);
  return new Date(witaMs).toISOString().split("T")[0];
};

export default function KepalaUnitDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalPegawai: 0, hadirHariIni: 0, izinSakit: 0, cuti: 0 });
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [weeklyData, setWeeklyData] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [announcements, setAnnouncements] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [mySchedule, setMySchedule] = useState(null);
  const [myScheduleLoading, setMyScheduleLoading] = useState(true);

  // ⏰ SERVER TIME STATE (anti-cheat)
  const [serverNow, setServerNow] = useState(new Date());

  // ⏰ Sync server time saat load + tiap 1 menit
  useEffect(() => {
    const syncServer = async () => {
      try {
        const { data, error } = await supabase.rpc("get_server_time");
        if (error) throw error;
        if (data) setServerNow(new Date(data));
      } catch (err) {
        console.error("Server time sync failed:", err);
      }
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

      // Parallel: totalPegawai, attendanceToday (limited), announcements
      const [totalPegawaiRes, attendanceTodayRes, announceRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact" }),
        supabase
          .from("attendance")
          .select("*, profiles(full_name, position)")
          .eq("date", today)
          .order("clock_in_time", { ascending: false })
          .limit(8),
        supabase.from("announcements").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(3),
      ]);

      const totalPegawai = totalPegawaiRes.count || 0;
      const attendanceToday = attendanceTodayRes.data || [];
      const announceData = announceRes.data || [];

      const hadir = attendanceToday.filter(a =>
        a.attendance_status === "hadir" || a.attendance_status === "terlambat"
      ).length;
      const izinSakit = attendanceToday.filter(a =>
        a.attendance_status === "izin" || a.attendance_status === "sakit"
      ).length;
      const cuti = attendanceToday.filter(a => a.attendance_status === "cuti").length;

      // Weekly chart: 1 query instead of 7
      const weekDates = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(serverDate);
        d.setDate(d.getDate() - i);
        weekDates.push(getWitaDateString(d));
      }
      const { data: weekAttendance } = await supabase
        .from("attendance")
        .select("date")
        .in("date", weekDates)
        .in("attendance_status", ["hadir", "terlambat"]);
      const weeklyMap = {};
      weekDates.forEach(d => weeklyMap[d] = 0);
      weekAttendance?.forEach(a => { if (weeklyMap[a.date] !== undefined) weeklyMap[a.date]++; });
      const weekly = weekDates.map(d => weeklyMap[d]);

      // Jadwal shift pribadi admin hari ini
      setMyScheduleLoading(true);
      try {
        const witaDay = new Date(serverDate.getTime() + (8 * 60 * 60 * 1000)).getUTCDay();
        const pgDayOfWeek = witaDay === 0 ? 6 : witaDay - 1;
        const { data: sched } = await supabase
          .from("employee_schedules")
          .select("shift_code")
          .eq("user_id", user.id)
          .eq("date", today)
          .maybeSingle();
        if (sched) {
          const [{ data: shiftInfo }, { data: scheduleDetail }] = await Promise.all([
            supabase.from("shifts").select("name").eq("code", sched.shift_code).single(),
            supabase.from("shift_schedules")
              .select("start_time, end_time, latest_check_in, is_working_day")
              .eq("shift_code", sched.shift_code)
              .eq("day_of_week", pgDayOfWeek)
              .single(),
          ]);
          setMySchedule({
            code: sched.shift_code,
            name: shiftInfo?.name || sched.shift_code,
            ...scheduleDetail,
          });
        } else {
          setMySchedule(null);
        }
      } catch {
        setMySchedule(null);
      } finally {
        setMyScheduleLoading(false);
      }

      setStats({
        totalPegawai,
        hadirHariIni: hadir,
        izinSakit,
        cuti,
      });
      setRecentAttendance(attendanceToday);
      setWeeklyData(weekly);
      setAnnouncements(announceData);
      setLastUpdated(new Date().toLocaleTimeString("id-ID"));
    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const maxWeekly = Math.max(...weeklyData, 1);

  const fmtTime = (iso) =>
    iso ? new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-";

  const witaTime = () => {
    const d = new Date(serverNow.getTime() + (8 * 60 * 60 * 1000));
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  const witaDate = () => {
    const d = new Date(serverNow.getTime() + (8 * 60 * 60 * 1000));
    const dayName = DAYS_FULL[d.getUTCDay()];
    const date = d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    return `${dayName}, ${date}`;
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const userInitial = user?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "S";

  return (
    <div className="flex-1">
      {/* ===== HERO — violet gradient, DESIGN.md ===== */}
      <div className="hero-card-bg bg-gradient-to-r from-[#C44DFF] via-[#BF00FF] to-[#8A00CC] px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4 pb-5 rounded-b-[32px]">
        {/* Top Row: Clock + Date + Shift Badge | Action Icons */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-white tracking-wide tabular-nums">{witaTime()}</div>
            <div className="text-[11px] sm:text-xs text-white/50 font-medium mt-0.5">{witaDate()}</div>

            {/* Shift Badge — Loading */}
            {myScheduleLoading && (
              <div className="h-5 w-28 bg-white/[0.08] animate-pulse rounded-full mt-2" />
            )}

            {/* Shift Badge — Kosong */}
            {!myScheduleLoading && !mySchedule && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mt-2 rounded-full bg-white/[0.06] border border-white/15">
                <Calendar size={10} className="text-white/40" />
                <span className="text-[10px] text-white/60">Tidak ada jadwal</span>
              </div>
            )}

            {/* Shift Badge — Ada shift */}
            {!myScheduleLoading && mySchedule?.code && (() => {
              const meta = SHIFT_META[mySchedule.code] || SHIFT_META.PG;
              const Icon = meta.icon;
              return (
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 mt-2 rounded-full ${meta.bg} border ${meta.border}`}>
                  <Icon size={12} className={meta.color} />
                  <span className={`text-[10px] font-semibold ${meta.color}`}>{mySchedule.name}</span>
                  <span className={`text-[10px] font-bold ${meta.color} ${meta.badge} px-1 rounded`}>{mySchedule.code}</span>
                  <span className="text-[10px] text-white/50 mx-0.5">|</span>
                  <span className="text-[10px] text-white/80 tabular-nums">{mySchedule.start_time?.slice(0,5)} – {mySchedule.end_time?.slice(0,5)}</span>
                  {mySchedule.latest_check_in && (
                    <span className={`text-[10px] ${meta.color}/70 tabular-nums`}>⌛{mySchedule.latest_check_in?.slice(0,5)}</span>
                  )}
                </div>
              );
            })()}

          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate("/admin/announcements")}
              className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors"
            >
              <Bell size={17} className="text-white/80" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-white rounded-full ring-2 ring-[#8A00CC]"></span>
            </button>
            <button
              onClick={handleLogout}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors"
            >
              <LogOut size={17} className="text-white/80" />
            </button>
          </div>
        </div>

        {/* Profile Section */}
        <div className="text-center">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-white/40 to-white/10 border-2 border-white/40 shadow-xl flex items-center justify-center">
            <span className="text-3xl sm:text-4xl font-bold text-white">{userInitial}</span>
          </div>
          <div className="text-white/60 text-xs sm:text-sm font-medium mt-2 sm:mt-3">Selamat datang,</div>
          <div className="text-white text-lg sm:text-xl font-bold mt-0.5">{user?.full_name || "Kepala Unit"}</div>
          <div className="text-white/50 text-[11px] sm:text-xs mt-0.5 flex items-center justify-center gap-1.5">
            <span className="px-2 py-0.5 rounded-full bg-white/20 text-white/90 text-[10px] font-medium">{user?.role || "kepala_unit"}</span>
            <span className="text-white/40">•</span>
            <span>{user?.email || "kepala@puskesmas"}</span>
          </div>
        </div>
      </div>

      {/* ===== CONTENT — light canvas ===== */}
      <div className="px-4 sm:px-6 lg:px-8 py-6 flex-1">
        {/* Refresh */}
        <div className="flex justify-end mb-3">
          <button
            onClick={fetchDashboardData}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200/80 text-slate-600 rounded-full text-xs shadow-sm hover:bg-slate-50 transition-all duration-200"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 lg:gap-5">
          <StatCard title="Total Pegawai" value={stats.totalPegawai} subtitle="Seluruh status kepegawaian" icon={Users} loading={loading} />
          <StatCard title="Hadir Hari Ini" value={stats.hadirHariIni} subtitle="Sudah check-in" icon={UserCheck} accent="from-emerald-500 to-teal-600" loading={loading} />
          <StatCard title="Izin / Sakit" value={stats.izinSakit} subtitle="Hari ini" icon={UserMinus} accent="from-amber-500 to-orange-600" loading={loading} />
          <StatCard title="Cuti" value={stats.cuti} subtitle="Hari ini" icon={UserX} accent="from-sky-500 to-blue-600" loading={loading} />
        </div>

        {/* Grafik + Pengumuman */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-5 mt-3 sm:mt-4 md:mt-6">
          <div className="p-4 sm:p-5 md:p-6 bg-white border border-slate-200/70 rounded-2xl shadow-[0_4px_16px_rgba(15,23,42,0.06)] lg:col-span-2">
            <div className="flex items-center justify-between mb-3 md:mb-6">
              <h2 className="text-sm sm:text-base md:text-lg font-bold text-slate-900">Grafik Presensi 7 Hari</h2>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <TrendingUp size={14} /> Kehadiran harian
              </div>
            </div>
            <div className="flex items-end gap-[3px] sm:gap-1 md:gap-2 h-32 sm:h-40 md:h-48">
              {weeklyData.map((val, i) => {
                const d = new Date(serverNow);
                d.setDate(d.getDate() - (6 - i));
                const isToday = i === 6;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 sm:gap-1.5 group">
                    <span className="text-[10px] sm:text-xs text-slate-700 font-semibold tabular-nums">{val}</span>
                    <div
                      className={`w-full rounded-t-lg md:rounded-t-xl transition-all duration-300 group-hover:scale-105 ${
                        isToday
                          ? "bg-gradient-to-t from-electric-violet to-periwinkle-glow shadow-lg"
                          : "bg-gradient-to-t from-violet-300 to-purple-200 group-hover:from-violet-400 group-hover:to-purple-300"
                      }`}
                      style={{ height: `${(val / maxWeekly) * 100}%`, minHeight: val > 0 ? "6px" : "0" }}
                    />
                    <span className={`text-[10px] sm:text-xs ${isToday ? "font-bold text-electric-violet" : "text-slate-400"}`}>
                      {DAYS[d.getDay()]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 sm:p-5 md:p-6 bg-white border border-slate-200/70 rounded-2xl shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h2 className="text-sm sm:text-base md:text-lg font-bold text-slate-900">Pengumuman</h2>
              <div className="p-1.5 rounded-lg bg-[#F5F3FF]">
                <Bell size={16} className="text-[#BF00FF]" />
              </div>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-2xl" />)}
              </div>
            ) : announcements.length === 0 ? (
              <div className="text-center py-6 sm:py-8 flex flex-col items-center gap-1.5 sm:gap-2">
                <div className="p-2 sm:p-3 rounded-2xl bg-slate-50">
                  <BellOff size={18} className="sm:w-6 sm:h-6 text-slate-400" />
                </div>
                <p className="text-slate-400 text-xs sm:text-sm">Belum ada pengumuman</p>
              </div>
            ) : (
              <div className="space-y-3">
                {announcements.map((a) => (
                  <div key={a.id} className="p-3 bg-slate-50/80 border border-slate-100 rounded-2xl hover:scale-[1.02] transition-all">
                    <p className="text-sm font-semibold text-slate-900 line-clamp-1">{a.title}</p>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">{a.content}</p>
                    <p className="text-xs text-[#7032c4] mt-1.5 font-medium">
                      {new Date(a.created_at).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tabel Absensi Terkini */}
        <div className="p-4 sm:p-5 md:p-6 bg-white border border-slate-200/70 rounded-2xl shadow-[0_4px_16px_rgba(15,23,42,0.06)] mt-3 sm:mt-4 md:mt-6">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h2 className="text-sm sm:text-base md:text-lg font-bold text-slate-900">Absensi Terkini Hari Ini</h2>
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-500">
              <Calendar size={12} className="sm:w-[14px] sm:h-[14px]" /> {lastUpdated && `Update: ${lastUpdated}`}
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-2xl" />)}
            </div>
          ) : recentAttendance.length === 0 ? (
            <div className="text-center py-8 sm:py-12 flex flex-col items-center gap-2 sm:gap-3">
              <div className="p-3 sm:p-4 bg-slate-50 rounded-2xl">
                <Inbox size={24} className="sm:w-8 sm:h-8 text-slate-400" />
              </div>
              <div>
                <p className="text-slate-500 font-medium text-sm sm:text-base">Belum ada absensi hari ini</p>
                <p className="text-slate-400 text-[11px] sm:text-xs mt-0.5 sm:mt-1">Data akan muncul setelah pegawai melakukan check-in</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2.5 px-3 font-semibold text-slate-500 text-[10px] sm:text-xs uppercase tracking-wider">Nama</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-slate-500 text-[10px] sm:text-xs uppercase tracking-wider">Masuk</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-slate-500 text-[10px] sm:text-xs uppercase tracking-wider">Pulang</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-slate-500 text-[10px] sm:text-xs uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentAttendance.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3">
                        <div>
                          <p className="font-medium text-slate-900 text-xs sm:text-sm">{a.profiles?.full_name || "-"}</p>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-emerald-600 font-mono tabular-nums text-[11px] sm:text-sm">{fmtTime(a.clock_in_time)}</td>
                      <td className="py-2.5 px-3">
                        {a.clock_out_time ? (
                          <span className="text-rose-600 font-mono tabular-nums text-[11px] sm:text-sm">{fmtTime(a.clock_out_time)}</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">Belum</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3"><AttendanceBadge status={a.attendance_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Versi Aplikasi */}
        <footer className="text-center text-[10px] text-slate-400 pb-2 select-none mt-6">
          v-debug-ku
        </footer>
      </div>
    </div>
  );
}