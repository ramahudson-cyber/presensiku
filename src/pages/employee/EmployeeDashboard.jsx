import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [history, setHistory] = useState([]);
  const [todaySchedule, setTodaySchedule] = useState(null);
  const [monthlyStats, setMonthlyStats] = useState({ hadir: 0, izin: 0, sakit: 0, alpha: 0 });
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString("id-ID", {hour:"2-digit",minute:"2-digit"}) : "—";
  const statusMeta = (status) => {
    if (status === "hadir" || status === "present") return { label: "Hadir", icon: "✅", cls: "hadir" };
    if (status === "telat" || status === "late") return { label: "Telat", icon: "⚠️", cls: "terlambat" };
    if (status === "izin") return { label: "Izin", icon: "📋", cls: "izin" };
    if (status === "sakit") return { label: "Sakit", icon: "🤒", cls: "sakit" };
    if (status === "alpha" || status === "absent") return { label: "Alpha", icon: "❌", cls: "alpha" };
    return { label: status || "—", icon: "◻️", cls: "" };
  };

  const fetchData = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const thisMonth = today.slice(0, 7); // YYYY-MM

      const [attendanceRes, historyRes, schedRes, statsRes, profileRes] = await Promise.all([
        supabase.from("attendance").select("*").eq("user_id", user.id).eq("date", today).maybeSingle(),
        supabase.from("attendance").select("*").eq("user_id", user.id).neq("date", today).order("date", { ascending: false }).limit(5),
        supabase.from("employee_schedules").select("shift_code, date").eq("user_id", user.id).eq("date", today).maybeSingle(),
        supabase.from("attendance").select("attendance_status").eq("user_id", user.id).gte("date", `${thisMonth}-01`).lte("date", today),
        supabase.from("profiles").select("*").eq("id", user.id).single().catch(() => null)
      ]);

      setTodayAttendance(attendanceRes.data);
      setHistory(historyRes.data || []);
      setProfile(profileRes?.data || null);

      // Schedule
      if (schedRes.data) {
        const { data: shiftInfo } = await supabase.from("shifts").select("name").eq("code", schedRes.data.shift_code).single();
        const pgDay = new Date().getDay(); // 0=Sun
        const dayOfWeek = pgDay === 0 ? 6 : pgDay - 1; // convert to Mon=0..Sun=6
        const { data: schedTime } = await supabase
          .from("shift_schedules")
          .select("start_time, end_time")
          .eq("shift_code", schedRes.data.shift_code)
          .eq("day_of_week", dayOfWeek)
          .maybeSingle();
        setTodaySchedule({
          name: shiftInfo?.name || schedRes.data.shift_code,
          start: schedTime?.start_time?.slice(0,5) || "—",
          end: schedTime?.end_time?.slice(0,5) || "—"
        });
      }

      // Monthly stats
      const rows = statsRes.data || [];
      const stats = { hadir: 0, izin: 0, sakit: 0, alpha: 0 };
      rows.forEach(r => {
        const s = r.attendance_status;
        if (s === "hadir" || s === "present") stats.hadir++;
        else if (s === "telat" || s === "late") stats.hadir++; // telat counted as hadir
        else if (s === "izin") stats.izin++;
        else if (s === "sakit") stats.sakit++;
        else if (s === "alpha" || s === "absent") stats.alpha++;
      });
      setMonthlyStats(stats);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const fullName = user?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const role = user?.role || user?.user_metadata?.role || "Pegawai";
  const initials = fullName.split(" ").map(s => s[0]).join("").toUpperCase().slice(0, 2);

  const hour = clock.getHours();
  const greeting = hour < 12 ? "Selamat Pagi" : hour < 15 ? "Selamat Siang" : hour < 18 ? "Selamat Sore" : "Selamat Malam";

	  const timeStr = clock.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
	  const dateStr = clock.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#060311" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "rgba(173,255,47,0.3)", borderTopColor: "#adff2f" }} />
          <p className="text-sm text-slate-mist font-inter">Memuat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-3" style={{ background: "#060311", fontFamily: "Inter, sans-serif" }}>
      <div className="w-full max-w-[400px] mx-auto flex flex-col gap-3">

        {/* HERO — full bleed samain preview */}
        <div className="relative overflow-hidden rounded-none rounded-b-[24px] p-6 -mx-3"
             style={{ background: "linear-gradient(135deg, #0d0015 0%, #000 40%, #0a0011 100%)", borderBottom: "1px solid rgba(150,0,255,0.2)", boxShadow: "0 8px 40px rgba(150,0,255,0.15)" }}>
          <div className="absolute top-[-80px] right-[-80px] w-[280px] h-[280px] rounded-full pointer-events-none"
               style={{ background: "radial-gradient(circle, rgba(180,0,255,0.35), transparent 70%)" }} />
          <div className="absolute bottom-[-100px] left-[-100px] w-[300px] h-[300px] rounded-full pointer-events-none"
               style={{ background: "radial-gradient(circle, rgba(120,0,255,0.25), transparent 70%)" }} />

          {/* Top row: avatar + greeting + icons */}
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-[28px] font-bold text-white shrink-0 border-2"
                 style={{ background: "linear-gradient(135deg, #5800fd, #2415c6)", borderColor: "rgba(255,255,255,0.15)", boxShadow: "0 4px 20px rgba(88,0,253,0.3)" }}>
              {initials}
            </div>
            <div className="flex-1">
              <div className="text-[11px] text-slate-mist uppercase tracking-[1px]">{greeting}</div>
              <div className="text-[20px] font-bold text-white mt-0.5 font-urbanist">{fullName}!</div>
            </div>
            {/* Icons */}
            <div className="flex items-center gap-1">
              <button className="p-1.5 rounded-xl text-slate-mist hover:text-white transition-colors" aria-label="Notifikasi">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
                </svg>
              </button>
              <button className="p-1.5 rounded-xl text-slate-mist hover:text-white transition-colors" aria-label="Toggle tema">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
                </svg>
              </button>
              <button className="p-1.5 rounded-xl text-slate-mist hover:text-white transition-colors" aria-label="Logout">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Time & Date */}
          <div className="mt-3 relative z-10">
            <div className="text-[36px] font-bold text-white font-urbanist tracking-[-1px]">{timeStr}</div>
            <div className="text-[11px] text-slate-mist mt-0.5 capitalize">{dateStr}</div>
          </div>

          {/* Absen Button */}
          <button className="mt-4 w-full py-3.5 text-white font-semibold text-[15px] relative z-10 border-none cursor-pointer transition-all duration-200 hover:brightness-110"
                  style={{ background: "#5800fd", borderRadius: "9999px" }}>
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-yellow mr-2 align-middle"
                  style={{ animation: "pulse 1.5s infinite" }} />
            {todayAttendance ? "Absen Pulang" : "Absen Sekarang"}
          </button>
        </div>

        {/* SHIFT & LOKASI */}
        <div className="grid grid-cols-2 gap-3">
          <div className="design-card p-4 flex justify-between items-start">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[1.5px] mb-2" style={{ color: "#c8ccd4" }}>SHIFT HARI INI</div>
              <div className="text-[18px] font-bold text-white font-urbanist">{todaySchedule?.name || "—"}</div>
              <div className="text-[12px] text-slate-mist mt-0.5">{todaySchedule ? `${todaySchedule.start} - ${todaySchedule.end}` : "—"}</div>
            </div>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#adff2f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mt-1 shrink-0 opacity-90">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="design-card p-4 flex justify-between items-start">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[1.5px] mb-2" style={{ color: "#c8ccd4" }}>LOKASI</div>
              <div className="text-[18px] font-bold text-white font-urbanist">{profile?.unit_kerja || profile?.location || "Puskesmas"}</div>
              <div className="text-[12px] text-slate-mist mt-0.5">{profile?.instansi || profile?.position || "—"}</div>
            </div>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#adff2f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mt-1 shrink-0 opacity-90">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
        </div>

        {/* STATUS HARI INI */}
        <div className="design-card p-5">
          <div className="card-title" style={{ color: "#c8ccd4" }}>Status Hari Ini</div>
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-[16px] flex items-center justify-center text-xl shrink-0"
                 style={{ background: todayAttendance ? "rgba(173,255,47,0.15)" : "rgba(255,255,255,0.05)", color: todayAttendance ? "#adff2f" : "#9ba1ae" }}>
              {todayAttendance ? "✅" : "⏳"}
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-semibold text-white">{todayAttendance ? "Sudah Absen Masuk" : "Belum Absen"}</div>
              <div className="text-[12px] text-slate-mist mt-0.5">
                {todayAttendance
                  ? `Masuk ${new Date(todayAttendance.clock_in_time).toLocaleTimeString("id-ID", {hour:"2-digit",minute:"2-digit"})} · Pulang —`
                  : "Silakan absen sekarang"}
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold"
                  style={{ background: todayAttendance ? "rgba(173,255,47,0.15)" : "rgba(255,255,255,0.05)", color: todayAttendance ? "#adff2f" : "#9ba1ae" }}>
              {todayAttendance ? "✅ Hadir" : "⏳ Menunggu"}
            </span>
          </div>
        </div>

        {/* STATISTIK BULAN INI */}
        <div className="design-card p-5">
          <div className="card-title" style={{ color: "#c8ccd4" }}>Statistik Bulan Ini</div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: "✅", value: monthlyStats.hadir, label: "Hadir", color: "#adff2f" },
              { icon: "📋", value: monthlyStats.izin, label: "Izin", color: "#adff2f" },
              { icon: "🤒", value: monthlyStats.sakit, label: "Sakit", color: "#adff2f" },
              { icon: "❌", value: monthlyStats.alpha, label: "Alpha", color: "#5800fd" },
            ].map((s, i) => (
              <div key={i} className="text-center p-3">
                <div className="text-[18px] mb-1" style={{ color: s.color }}>{s.icon}</div>
                <div className="text-[20px] font-bold text-white font-urbanist">{s.value}</div>
                <div className="text-[9px] text-slate-mist mt-0.5 uppercase tracking-[0.5px]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIWAYAT ABSENSI */}
        <div className="design-card p-5">
          <div className="card-title" style={{ color: "#c8ccd4" }}>Riwayat Absensi</div>
          <div className="grid gap-2 border-b pb-2 mb-1"
               style={{ gridTemplateColumns: "8px 1.5fr 1fr 1fr 1.5fr", gap: "8px", borderColor: "rgba(255,255,255,0.08)" }}>
            <div></div>
            <p className="text-[9px] font-bold text-slate-mist uppercase tracking-[0.5px] text-left">Tanggal</p>
            <p className="text-[9px] font-bold text-slate-mist uppercase tracking-[0.5px] text-left">Masuk</p>
            <p className="text-[9px] font-bold text-slate-mist uppercase tracking-[0.5px] text-left">Pulang</p>
            <p className="text-[9px] font-bold text-slate-mist uppercase tracking-[0.5px] text-right">Status</p>
          </div>
          <div>
            {history.length === 0 ? (
              <div className="text-center py-4">
                <div className="text-[24px] mb-1.5 opacity-50">📋</div>
                <div className="text-[12px] text-slate-mist">Belum ada riwayat absensi</div>
              </div>
            ) : (
              history.map((item, i) => {
                const d = new Date(item.date + "T00:00:00");
                const dayName = d.toLocaleDateString("id-ID", { weekday: "long" });
                const dateStr = d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
                const status = statusMeta(item.attendance_status);
                return (
                <div key={i} className="py-2.5 border-b last:border-b-0"
                     style={{ display: "grid", gridTemplateColumns: "8px 1.5fr 1fr 1fr 1.5fr", gap: "8px", alignItems: "center", borderColor: "rgba(255,255,255,0.04)" }}>
                  <div className="w-2 h-2 rounded-full shrink-0"
                       style={{ background: status.cls === "hadir" ? "#adff2f" : "#fbbf24", boxShadow: status.cls === "hadir" ? "0 0 8px rgba(173,255,47,0.5)" : "none" }} />
                  <div className="text-[11px] text-slate-mist text-left">
                    {dayName}
                    <div className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{dateStr}</div>
                  </div>
                  <div className="text-[11px] font-mono text-left"
                       style={{ color: status.cls === "terlambat" ? "#fbbf24" : "#6ee7b7" }}>{formatTime(item.clock_in_time)}</div>
                  <div className="text-[11px] font-mono text-left" style={{ color: "#9ba1ae" }}>{formatTime(item.clock_out_time)}</div>
                  <div className="text-[11px] font-semibold text-right"
                       style={{ color: status.cls === "hadir" ? "#adff2f" : "#fbbf24" }}>
                    {status.icon} {status.label}
                  </div>
                </div>
                );
              })
            )}
          </div>
          <div className="text-center pt-2.5">
            <a href="#" className="text-[11px] flex items-center justify-center gap-1 no-underline" style={{ color: "#7066ed" }}>
              Lihat Semua →
            </a>
          </div>
        </div>

        {/* PENGUMUMAN */}
        <div className="design-card p-5">
          <div className="card-title" style={{ color: "#c8ccd4" }}>Pengumuman</div>
          <div className="text-center py-4">
            <div className="text-[24px] mb-1.5 opacity-50">🔔</div>
            <div className="text-[12px] text-slate-mist">Belum ada pengumuman</div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="text-center text-[10px] py-2 pb-4" style={{ color: "rgba(255,255,255,0.1)" }}>v1.6.9 — Hadir.Kuy</div>
      </div>
    </div>
  );
}
