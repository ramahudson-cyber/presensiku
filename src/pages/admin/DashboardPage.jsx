import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import {
  Users, UserCheck, UserMinus, UserX,
  TrendingUp, Calendar, Bell, RefreshCw, BellOff, Inbox,
} from "lucide-react";

const cardBase =
  "bg-white/5 rounded-2xl p-4 sm:p-5 md:p-6 transition-all";

function StatCard({ title, value, subtitle, icon: Icon, accent = "from-violet-500 to-purple-700", loading }) {
  return (
    <div className={`${cardBase} hover:scale-[1.02] hover:shadow-violet-900/20 hover:shadow-lg animate-fade-in`}>
      <div className="flex items-start justify-between gap-2 md:gap-3">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs text-slate-200 uppercase tracking-wider truncate">{title}</p>
          {loading ? (
            <div className="h-8 sm:h-10 w-16 sm:w-20 bg-white/10 animate-pulse rounded-lg mt-1 sm:mt-2" />
          ) : (
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mt-0.5 sm:mt-2 tabular-nums">{value}</h3>
          )}
          <p className="text-[10px] sm:text-xs text-violet-200/40 mt-0.5 sm:mt-2 truncate">{subtitle}</p>
        </div>
        <div className={`p-2 sm:p-3 rounded-xl bg-gradient-to-br ${accent} text-white shadow-lg shadow-violet-900/30 shrink-0`}>
          <Icon size={16} className="sm:w-5 sm:h-5" />
        </div>
      </div>
    </div>
  );
}

function AttendanceBadge({ status }) {
  const map = {
    hadir:  "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    izin:   "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    sakit:  "bg-orange-500/15 text-orange-300 ring-orange-500/30",
    cuti:   "bg-sky-500/15 text-sky-300 ring-sky-500/30",
    alpha:  "bg-rose-500/15 text-rose-300 ring-rose-500/30",
    terlambat: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${map[status] || "bg-white/5 text-slate-200 ring-white/10"}`}>
      {status?.toUpperCase() || "-"}
    </span>
  );
}

const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const getWitaDateString = (date = new Date()) => {
  const witaMs = date.getTime() + (8 * 60 * 60 * 1000);
  return new Date(witaMs).toISOString().split("T")[0];
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalPegawai: 0, hadirHariIni: 0, izinSakit: 0, cuti: 0 });
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [weeklyData, setWeeklyData] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [announcements, setAnnouncements] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

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
      // ⏰ Pakai server time untuk "today" (anti-cheat)
      let serverDate;
      try {
        const { data: serverNow } = await supabase.rpc("get_server_time");
        serverDate = new Date(serverNow);
      } catch {
        serverDate = new Date();
      }
      const today = getWitaDateString(serverDate);

      // 1. Total pegawai
      const { count: totalPegawai } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // 2. Absensi hari ini
      const { data: attendanceToday } = await supabase
        .from("attendance")
        .select("*, profiles(full_name, department, position)")
        .eq("date", today)
        .order("clock_in_time", { ascending: false });

      const hadir = attendanceToday?.filter(a =>
        a.attendance_status === "hadir" || a.attendance_status === "terlambat"
      ).length || 0;
      const izinSakit = attendanceToday?.filter(a =>
        a.attendance_status === "izin" || a.attendance_status === "sakit"
      ).length || 0;
      const cuti = attendanceToday?.filter(a => a.attendance_status === "cuti").length || 0;

      // 3. Data mingguan (7 hari terakhir) — pakai server time
      const weekly = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(serverDate);
        d.setDate(d.getDate() - i);
        const dateStr = getWitaDateString(d);
        const { count } = await supabase
          .from("attendance")
          .select("*", { count: "exact", head: true })
          .eq("date", dateStr)
          .in("attendance_status", ["hadir", "terlambat"]);
        weekly.push(count || 0);
      }

      // 4. Pengumuman terbaru
      const { data: announceData } = await supabase
        .from("announcements")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(3);

      setStats({
        totalPegawai: totalPegawai || 0,
        hadirHariIni: hadir,
        izinSakit,
        cuti,
      });
      setRecentAttendance(attendanceToday?.slice(0, 8) || []);
      setWeeklyData(weekly);
      setAnnouncements(announceData || []);
      setLastUpdated(new Date().toLocaleTimeString("id-ID"));
    } catch (err) {
      console.error("❌ Dashboard error:", err);
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

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6 animate-fade-in">
      {/* Refresh */}
      <div className="flex justify-end">
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-violet-100 hover:text-white rounded-xl text-xs font-medium transition-all shrink-0"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Stat Cards - Responsive Grid: 1 col mobile, 2 cols tablet, 4 cols desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 lg:gap-5">
        <StatCard title="Total Pegawai" value={stats.totalPegawai} subtitle="Seluruh status kepegawaian" icon={Users} accent="from-violet-500 to-purple-700" loading={loading} />
        <StatCard title="Hadir Hari Ini" value={stats.hadirHariIni} subtitle="Sudah check-in" icon={UserCheck} accent="from-emerald-500 to-teal-700" loading={loading} />
        <StatCard title="Izin / Sakit" value={stats.izinSakit} subtitle="Hari ini" icon={UserMinus} accent="from-amber-500 to-orange-700" loading={loading} />
        <StatCard title="Cuti" value={stats.cuti} subtitle="Hari ini" icon={UserX} accent="from-sky-500 to-blue-700" loading={loading} />
      </div>

      {/* Grafik + Pengumuman - Responsive: stacked mobile, side-by-side tablet, 2:1 layout desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-5">
        <div className={`${cardBase} lg:col-span-2`}>
          <div className="flex items-center justify-between mb-3 md:mb-6">
            <h2 className="text-sm sm:text-base md:text-lg font-bold text-white">Grafik Presensi 7 Hari</h2>
            <div className="flex items-center gap-2 text-xs text-slate-200">
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
                  <span className="text-[10px] sm:text-xs text-violet-100/80 font-semibold tabular-nums">{val}</span>
                  <div
                    className={`w-full rounded-t-lg md:rounded-t-xl transition-all duration-300 group-hover:scale-105 ${
                      isToday
                        ? "bg-gradient-to-t from-violet-500 to-purple-400 shadow-lg shadow-violet-900/40"
                        : "bg-gradient-to-t from-violet-700/60 to-purple-500/40 group-hover:from-violet-600 group-hover:to-purple-400"
                    }`}
                    style={{ height: `${(val / maxWeekly) * 100}%`, minHeight: val > 0 ? "6px" : "0" }}
                  />
                  <span className={`text-[10px] sm:text-xs ${isToday ? "font-bold text-violet-100" : "text-slate-400"}`}>
                    {DAYS[d.getDay()]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className={cardBase}>
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h2 className="text-sm sm:text-base md:text-lg font-bold text-white">Pengumuman</h2>
            <div className="p-1.5 rounded-lg bg-violet-500/15">
              <Bell size={16} className="text-violet-100" />
            </div>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-white/5 animate-pulse rounded-xl" />)}
            </div>
          ) : announcements.length === 0 ? (
            <div className="text-center py-6 sm:py-8 flex flex-col items-center gap-1.5 sm:gap-2">
              <div className="p-2 sm:p-3 rounded-2xl bg-white/5">
                <BellOff size={18} className="sm:w-6 sm:h-6 text-slate-400" />
              </div>
              <p className="text-slate-400 text-xs sm:text-sm">Belum ada pengumuman</p>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((a) => (
                <div key={a.id} className="p-3 bg-violet-500/10 rounded-xl border border-violet-500/20 hover:scale-[1.02] transition-all">
                  <p className="text-sm font-semibold text-white line-clamp-1">{a.title}</p>
                  <p className="text-xs text-violet-200/50 mt-1 line-clamp-2">{a.content}</p>
                  <p className="text-xs text-violet-400 mt-1.5 font-medium">
                    {new Date(a.created_at).toLocaleDateString("id-ID")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabel Absensi Terkini */}
      <div className={cardBase}>
          <div className="flex items-center justify-between mb-3 md:mb-4">
          <h2 className="text-sm sm:text-base md:text-lg font-bold text-white">Absensi Terkini Hari Ini</h2>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-200">
            <Calendar size={12} className="sm:w-[14px] sm:h-[14px]" /> {lastUpdated && `Update: ${lastUpdated}`}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 bg-white/5 animate-pulse rounded-xl" />)}
          </div>
        ) : recentAttendance.length === 0 ? (
          <div className="text-center py-8 sm:py-12 flex flex-col items-center gap-2 sm:gap-3">
            <div className="p-3 sm:p-4 rounded-2xl bg-white/5">
              <Inbox size={24} className="sm:w-8 sm:h-8 text-slate-400" />
            </div>
            <div>
              <p className="text-violet-200/60 font-medium text-sm sm:text-base">Belum ada absensi hari ini</p>
              <p className="text-slate-400 text-[11px] sm:text-xs mt-0.5 sm:mt-1">Data akan muncul setelah pegawai melakukan check-in</p>
            </div>
          </div>
        ) : (
          <div className="-mx-3 md:-mx-3">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-200 text-[10px] sm:text-xs uppercase tracking-wider">Nama</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-200 text-[10px] sm:text-xs uppercase tracking-wider hidden lg:table-cell">Departemen</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-200 text-[10px] sm:text-xs uppercase tracking-wider">Masuk</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-200 text-[10px] sm:text-xs uppercase tracking-wider hidden md:table-cell">Pulang</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-200 text-[10px] sm:text-xs uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentAttendance.map((a) => (
                  <tr key={a.id} className="hover:bg-white/5 transition-all">
                    <td className="py-2.5 px-3">
                      <div>
                        <p className="font-medium text-white text-xs sm:text-sm">{a.profiles?.full_name || "-"}</p>
                        <p className="text-[10px] sm:text-xs text-violet-200/40 lg:hidden mt-0.5">{a.profiles?.department || "-"}</p>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-violet-200/60 text-xs hidden lg:table-cell">{a.profiles?.department || "-"}</td>
                    <td className="py-2.5 px-3 text-emerald-300 font-mono tabular-nums text-[11px] sm:text-sm">{fmtTime(a.clock_in_time)}</td>
                    <td className="py-2.5 px-3 text-rose-300 font-mono tabular-nums text-[11px] sm:text-sm hidden md:table-cell">{fmtTime(a.clock_out_time)}</td>
                    <td className="py-2.5 px-3"><AttendanceBadge status={a.attendance_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

