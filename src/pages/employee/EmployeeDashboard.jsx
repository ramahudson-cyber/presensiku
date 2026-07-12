import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { CheckCircle, XCircle, AlertCircle, ChevronRight, Calendar, Bell, Clock, ArrowRight, LogOut } from "lucide-react";
import { signOut } from "../../services/authService";
import ThemeToggle from "../../components/ThemeToggle";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [stats, setStats] = useState({ hadir: 0, izin: 0, sakit: 0, alpha: 0 });
  const [recentHistory, setRecentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveTime, setLiveTime] = useState(new Date());

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    const t = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchData = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const monthStart = new Date(); monthStart.setDate(1);
      const monthStr = monthStart.toISOString().split("T")[0];

      const [attRes, monthRes, annRes, histRes] = await Promise.all([
        supabase.from("attendance").select("*").eq("user_id", user.id).eq("date", today).maybeSingle(),
        supabase.from("attendance").select("attendance_status").eq("user_id", user.id).gte("date", monthStr),
        supabase.from("announcements").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(3),
        supabase.from("attendance").select("date, attendance_status, clock_in_time, clock_out_time").eq("user_id", user.id).order("date", { ascending: false }).limit(7)
      ]);

      setTodayAttendance(attRes.data);
      const s = { hadir: 0, izin: 0, sakit: 0, alpha: 0 };
      monthRes.data?.forEach(a => { const k = (a.attendance_status || "").toLowerCase(); if (s[k] !== undefined) s[k]++; });
      setStats(s);
      setAnnouncements(annRes.data || []);
      setRecentHistory(histRes.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="design-card-hover p-5 h-20 animate-pulse"></div>
        <div className="design-card-hover p-4 h-16 animate-pulse"></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{[1,2,3,4].map(i => <div key={i} className="design-card-hover p-3 h-16 animate-pulse"></div>)}</div>
      </div>
    );
  }

  const now = liveTime;
  const h = now.getHours();
  let greeting = "Selamat Malam";
  if (h >= 3 && h < 12) greeting = "Selamat Pagi";
  else if (h >= 12 && h < 15) greeting = "Selamat Siang";
  else if (h >= 15 && h < 18) greeting = "Selamat Sore";

  const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).replace(/\b\w/g, c => c.toUpperCase());
  const initials = (user?.full_name || user?.user_metadata?.full_name || user?.email || "U").split(" ").map(s => s[0]).join("").toUpperCase().slice(0, 2);
  const fullName = user?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const email = user?.email || "user@puskesmas";
  const role = user?.role || user?.user_metadata?.role || "Pegawai";

  // Shift badge logic
  let shiftIcon = "☀️", shiftLabel = "Pagi", shiftAbbr = "PG";
  if (h >= 15) { shiftIcon = "🌅"; shiftLabel = "Sore"; shiftAbbr = "SG"; }
  if (h >= 18) { shiftIcon = "🌙"; shiftLabel = "Malam"; shiftAbbr = "ML"; }

  return (
    <div className="animate-fade-in relative left-1/2 -translate-x-1/2 w-screen max-w-lg flex flex-1 flex-col h-full">
      
      {/* ===== HERO SECTION — Modern Profile ===== */}
      <div className="relative overflow-hidden" style={{ borderRadius: "0 0 28px 28px" }}>
        {/* Abstract Gradient Background */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(45deg, #FF0080, #7928CA, #0070F3)", filter: "blur(40px)", opacity: 0.6 }} />
        
        <div className="relative p-6 pt-10 pb-8 flex flex-col items-start">
          {/* Profile Pic + Ring */}
          <div className="w-20 h-20 rounded-full border-4 border-onyx bg-gray-800 shadow-xl flex items-center justify-center text-3xl font-bold text-white overflow-hidden">
            <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&h=200&fit=crop" alt="User" className="w-full h-full object-cover" />
          </div>

          {/* Name & Handle */}
          <h2 className="text-xl font-bold text-white mt-4">{fullName}</h2>
          <p className="text-slate-400 text-sm">@{email.split('@')[0]}</p>

          {/* Stats Row */}
          <div className="flex gap-8 mt-6">
            <div className="text-left">
              <div className="text-lg font-bold text-white">28</div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">Cerita</div>
            </div>
            <div className="text-left">
              <div className="text-lg font-bold text-white">164</div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">Followers</div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== CONTENT WRAPPER ===== */}
      <div style={{
        background: "var(--color-onyx)",
        padding: "32px 16px 80px",
        flex: 1,
      }}>
        
        {/* Status */}
        <Link to="/employee/attendance" className="block" style={{textDecoration:"none"}}>
          <div className="design-card-hover p-4 shadow-lg flex items-center justify-between transition">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-electric-violet/10 flex items-center justify-center">
                {todayAttendance ? <CheckCircle size={18} className="text-emerald-300" /> : <Calendar size={18} className="text-violet-300" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-pure-white">{todayAttendance ? "Sudah Absen" : "Belum Absen"}</p>
                <p className="text-[11px] text-slate-mist">{todayAttendance ? `Masuk: ${new Date(todayAttendance.clock_in_time).toLocaleTimeString("id-ID", {hour:"2-digit",minute:"2-digit"})} · Pulang: ${todayAttendance.clock_out_time ? new Date(todayAttendance.clock_out_time).toLocaleTimeString("id-ID", {hour:"2-digit",minute:"2-digit"}) : "—"}` : "Tap untuk absen"}</p>
              </div>
            </div>
            {todayAttendance && (() => {
              const raw = (todayAttendance.attendance_status || "").toLowerCase();
              const badgeMap = { hadir: { label: "✅ Hadir", color: "#adff2f" }, izin: { label: "📋 Izin", color: "#fbbf24" }, sakit: { label: "🤒 Sakit", color: "#fb7185" }, alpha: { label: "❌ Alpha", color: "#fca5a5" } };
              const b = badgeMap[raw] || { label: raw, color: "#9ba1ae" };
              return <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ background: b.color + "20", color: b.color }}>{b.label}</span>;
            })() || <ChevronRight size={18} className="text-slate-mist" />}
          </div>
        </Link>

        {/* Stats — Bulan Ini */}
        <div style={{marginTop:"16px"}}>
          <p className="text-[10px] font-bold text-slate-mist uppercase tracking-widest mb-2 px-1">Bulan Ini</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Hadir", value: stats.hadir, icon: CheckCircle, color: "text-emerald-300" },
              { label: "Izin", value: stats.izin, icon: AlertCircle, color: "text-green-yellow" },
              { label: "Sakit", value: stats.sakit, icon: AlertCircle, color: "text-green-yellow" },
              { label: "Alpha", value: stats.alpha, icon: XCircle, color: "text-red-300" },
            ].map((s) => (
              <div key={s.label} className="design-card-hover p-3 text-center shadow-lg">
                <s.icon size={14} className={`mx-auto mb-1 ${s.color}`} />
                <p className="text-base font-bold text-pure-white">{s.value}</p>
                <p className="text-[9px] text-slate-mist">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pengumuman */}
        <div style={{marginTop:"16px"}}>
          <p className="text-[10px] font-bold text-slate-mist uppercase tracking-widest mb-2 px-1">Pengumuman</p>
          <div className="design-card-hover p-4 shadow-lg">
            {announcements.length === 0 ? (
              <div className="text-center py-4">
                <Bell size={20} className="mx-auto text-slate-mist mb-1" />
                <p className="text-xs text-slate-mist">Belum ada pengumuman</p>
              </div>
            ) : (
              <div className="space-y-2">
                {announcements.map(a => (
                  <div key={a.id} className="p-3 bg-onyx border border-white/[0.06] rounded-2xl">
                    <p className="text-sm font-semibold text-pure-white">{a.title}</p>
                    <p className="text-xs text-slate-mist mt-1">{a.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Riwayat Absensi */}
        <div style={{marginTop:"16px"}}>
          <p className="text-[10px] font-bold text-slate-mist uppercase tracking-widest mb-2 px-1">Riwayat Absensi</p>
          <div className="design-card-hover p-4 shadow-lg">
            {recentHistory.length === 0 ? (
              <div className="text-center py-4">
                <Clock size={20} className="mx-auto text-slate-mist mb-1" />
                <p className="text-xs text-slate-mist">Belum ada riwayat</p>
              </div>
            ) : (
              <div className="space-y-0">
                {/* Header Row */}
                <div className="grid grid-cols-[8px_1fr_1fr_1fr_50px] gap-2 items-center py-1.5 border-b border-white/[0.08] mb-1">
                  <div></div>
                  <p className="text-[9px] font-bold text-slate-mist uppercase tracking-wider">Tanggal</p>
                  <p className="text-[9px] font-bold text-slate-mist uppercase tracking-wider text-center">Masuk</p>
                  <p className="text-[9px] font-bold text-slate-mist uppercase tracking-wider text-center">Pulang</p>
                  <p className="text-[9px] font-bold text-slate-mist uppercase tracking-wider text-right">Status</p>
                </div>
                {recentHistory.map((r, i) => {
                  const d = new Date(r.date + "T00:00:00");
                  const dayName = d.toLocaleDateString("id-ID", { weekday: "long" });
                  const dateStr = d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
                  const raw = (r.attendance_status || "").toLowerCase();
                  const statusMap = {
                    hadir: { label: "Hadir", textColor: "#adff2f", dotColor: "#adff2f", shadow: "0 0 6px rgba(173,255,47,0.4)", bg: "rgba(173,255,47,0.08)" },
                    izin: { label: "Izin", textColor: "#fbbf24", dotColor: "#fbbf24", shadow: "", bg: "rgba(251,191,36,0.08)" },
                    sakit: { label: "Sakit", textColor: "#fb7185", dotColor: "#fb7185", shadow: "", bg: "rgba(251,113,133,0.08)" },
                    alpha: { label: "Alpha", textColor: "#fca5a5", dotColor: "#fca5a5", shadow: "", bg: "rgba(252,165,165,0.08)" },
                  };
                  const s = statusMap[raw] || { label: r.attendance_status || "—", textColor: "#9ba1ae", dotColor: "#9ba1ae", shadow: "", bg: "transparent" };
                  const clockIn = r.clock_in_time ? new Date(r.clock_in_time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "—";
                  const clockOut = r.clock_out_time ? new Date(r.clock_out_time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "—";
                  return (
                    <div key={r.id || i} className="grid grid-cols-[8px_1fr_1fr_1fr_50px] gap-2 items-center py-2.5 border-b border-white/[0.04] last:border-b-0 rounded-xl px-2" style={{ background: s.bg || "transparent" }}>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.dotColor, boxShadow: s.shadow || "none" }}></div>
                      <div>
                        <p className="text-[11px] text-slate-mist font-semibold">{dayName}</p>
                        <p className="text-[10px] text-white/40">{dateStr}</p>
                      </div>
                      <p className="text-[11px] font-mono text-center font-semibold" style={{ color: s.textColor }}>{clockIn}</p>
                      <p className="text-[11px] font-mono text-center font-semibold" style={{ color: s.textColor }}>{clockOut}</p>
                      <p className="text-[11px] font-semibold text-right" style={{ color: s.textColor }}>{s.label}</p>
                    </div>
                  );
                })}
                <Link to="/employee/attendance" className="flex items-center justify-center gap-1 pt-2 text-[11px] text-periwinkle-glow hover:text-electric-violet transition-colors">
                  Lihat Semua <ArrowRight size={12} />
                </Link>
              </div>
            )}
          </div>
        </div>

	      </div>{/* end content wrapper */}
    </div>
  );
}
