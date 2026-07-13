import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();
      setTodayAttendance(data);
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
      <div className="min-h-screen flex items-center justify-center bg-[#060311] text-white">
        <p style={{ fontFamily: "Inter, sans-serif" }}>Memuat...</p>
      </div>
    );
  }

  return (
    <div style={{ background: "#060311", minHeight: "100vh", padding: "12px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: "400px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "12px" }}>
        
        {/* Hero */}
        <div style={{ background: "#161320", borderRadius: "24px", padding: "20px", border: "1px solid rgba(255,255,255,0.06)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "-50px", right: "-50px", width: "180px", height: "180px", background: "radial-gradient(circle, rgba(75,57,239,0.3), transparent 70%)", borderRadius: "50%", pointerEvents: "none" }}></div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
            <div>
              <div style={{ fontSize: "11px", color: "#9ba1ae", letterSpacing: "1px", textTransform: "uppercase" }}>{greeting}</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "#fff", marginTop: "2px" }}>{fullName}!</div>
            </div>
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "linear-gradient(135deg, #5800fd, #2415c6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", fontWeight: 700, color: "#fff", border: "2px solid rgba(255,255,255,0.15)", boxShadow: "0 4px 20px rgba(88,0,253,0.3)", flexShrink: 0 }}>{initials}</div>
          </div>
          <div style={{ marginTop: "12px", position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: "36px", fontWeight: 700, color: "#fff", fontFamily: "monospace", letterSpacing: "-1px" }}>{timeStr}</div>
            <div style={{ fontSize: "11px", color: "#9ba1ae", marginTop: "2px", textTransform: "capitalize" }}>{dateStr}</div>
          </div>
          <button style={{ marginTop: "16px", display: "block", width: "100%", padding: "14px", background: "#5800fd", color: "#fff", border: "none", borderRadius: "9999px", fontSize: "15px", fontWeight: 600, cursor: "pointer", position: "relative", zIndex: 1 }}>
            <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", background: "#adff2f", marginRight: "8px", verticalAlign: "middle", animation: "pulse 1.5s infinite" }}></span>
            {todayAttendance ? "Absen Pulang" : "Absen Sekarang"}
          </button>
        </div>

        {/* Status Hari Ini */}
        <div style={{ background: "#161320", borderRadius: "24px", padding: "16px", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, color: "#9ba1ae", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "12px" }}>Status Hari Ini</div>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "16px", background: todayAttendance ? "rgba(173,255,47,0.15)" : "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: todayAttendance ? "#adff2f" : "#9ba1ae", flexShrink: 0 }}>{todayAttendance ? "✅" : "⏳"}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "#fff" }}>{todayAttendance ? "Sudah Absen" : "Belum Absen"}</div>
              <div style={{ fontSize: "12px", color: "#9ba1ae", marginTop: "2px" }}>{todayAttendance ? `Masuk ${new Date(todayAttendance.clock_in_time).toLocaleTimeString("id-ID", {hour:"2-digit",minute:"2-digit"})}` : "Silakan absen sekarang"}</div>
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 10px", background: todayAttendance ? "rgba(173,255,47,0.15)" : "rgba(255,255,255,0.05)", color: todayAttendance ? "#adff2f" : "#9ba1ae", borderRadius: "9999px", fontSize: "10px", fontWeight: 600 }}>
              {todayAttendance ? "✅ Hadir" : "⏳ Menunggu"}
            </span>
          </div>
        </div>

        {/* Statistik */}
        <div style={{ background: "#161320", borderRadius: "24px", padding: "16px", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, color: "#9ba1ae", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "12px" }}>Statistik Bulan Ini</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
            {[
              { icon: "✅", value: "14", label: "Hadir", color: "#adff2f" },
              { icon: "📋", value: "2", label: "Izin", color: "#adff2f" },
              { icon: "🤒", value: "1", label: "Sakit", color: "#adff2f" },
              { icon: "❌", value: "0", label: "Alpha", color: "#5800fd" },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: "center", padding: "12px 4px" }}>
                <div style={{ fontSize: "18px", marginBottom: "4px", color: s.color }}>{s.icon}</div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: "#fff" }}>{s.value}</div>
                <div style={{ fontSize: "9px", color: "#9ba1ae", marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", fontSize: "10px", color: "rgba(255,255,255,0.1)", padding: "8px 0 16px" }}>v1.6.9 — Hadir.Kuy</div>
      </div>
    </div>
  );
}