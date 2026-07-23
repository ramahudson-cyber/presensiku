import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { getAttendanceHistory } from "../../services/attendanceService";
import { supabase } from "../../lib/supabase";

const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

export default function EmployeeHistory() {
  const { user } = useAuth();
  const { darkMode } = useTheme();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [history, setHistory] = useState([]);
  const [totalDays, setTotalDays] = useState(0);
  const [loading, setLoading] = useState(true);

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  const navigateMonth = (dir) => {
    let m = month + dir;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m);
    setYear(y);
  };

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);

      const lastDay = new Date(year, month + 1, 0).getDate();
      const dateFrom = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const dateTo = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      // Batasi jadwal ke hari ini kalo bulan berjalan (future dates bukan alpha)
      const schedDateTo = isCurrentMonth
        ? `${year}-${String(month + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
        : dateTo;

      try {
        const [attData, schedRes] = await Promise.all([
          getAttendanceHistory(user.id, null, dateFrom, dateTo),
          supabase
            .from("employee_schedules")
            .select("date, shift_code")
            .eq("user_id", user.id)
            .gte("date", dateFrom)
            .lte("date", schedDateTo),
        ]);

        if (cancelled) return;
        setHistory(attData);

        // Count hari kerja beneran (is_working_day = true)
        let workingDays = 0;
        const schedules = schedRes.data || [];
        const shiftCodes = [...new Set(schedules.map((s) => s.shift_code).filter(Boolean))];

        if (shiftCodes.length > 0) {
          const { data: ssData } = await supabase
            .from("shift_schedules")
            .select("shift_code, day_of_week, is_working_day")
            .in("shift_code", shiftCodes);

          schedules.forEach((sch) => {
            if (sch.shift_code) {
              const dateObj = new Date(sch.date + "T00:00:00");
              const dayOfWeek = (dateObj.getDay() + 6) % 7;
              const shiftSch = (ssData || []).find(
                (ss) => ss.shift_code === sch.shift_code && ss.day_of_week === dayOfWeek
              );
              if (shiftSch?.is_working_day) workingDays++;
            }
          });
        }

        if (!cancelled) setTotalDays(workingDays);
      } catch {
        if (!cancelled) {
          setHistory([]);
          setTotalDays(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [user?.id, year, month]);

  const formatTime = (timeStr) => {
    if (!timeStr) return "--:--";
    if (timeStr.includes("T")) {
      return new Date(timeStr).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" });
    }
    return timeStr.substring(0, 5);
  };

  // ── Stats ──
  const hadir = history.filter((r) => r.attendance_status === "hadir").length;
  const terlambat = history.filter((r) => r.attendance_status === "terlambat").length;
  const izin = history.filter((r) => r.attendance_status === "izin").length;
  const sakit = history.filter((r) => r.attendance_status === "sakit").length;
  const totalHadir = hadir + terlambat;
  const alpha = Math.max(0, totalDays - totalHadir - izin - sakit);

  // ── Donut ──
  const circumference = 2 * Math.PI * 42;
  const pct = totalDays > 0 ? Math.round((totalHadir / totalDays) * 100) : 0;
  const offset = circumference - (pct / 100) * circumference;

  // ── Glass card ──
  const glass = {
    background: darkMode ? "rgba(30,30,50,0.6)" : "rgba(255,255,255,0.05)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.05)",
    borderRadius: "24px",
    boxShadow: darkMode ? "0 8px 32px rgba(0,0,0,0.4)" : "0 8px 32px rgba(0,0,0,0.08)",
    overflow: "hidden",
  };

  const labelColor = darkMode ? "text-white" : "text-gray-900";
  const mutedColor = darkMode ? "text-white/40" : "text-gray-500";
  const cardBorder = darkMode ? "border-white/5" : "border-gray-100";

  // ── Status badge ──
  const statusBadge = (status) => {
    const isLate = status === "terlambat";
    const text = isLate ? "#f97316" : "#BF00FF";
    const label = isLate ? "Terlambat" : "Tepat Waktu";
    return (
      <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full shrink-0 whitespace-nowrap"
        style={{ background: "transparent", color: text }}>
        {label}
      </span>
    );
  };

  // ── Stat row ──
  const StatRow = ({ label, desc, value, total, color, active }) => (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3.5 transition-all duration-300 hover:translate-x-1"
      style={{
        background: active ? `linear-gradient(90deg, ${color}08, transparent)` : "transparent",
        borderLeft: `2px solid ${active ? "transparent" : color}33`,
        opacity: active ? 1 : 0.5,
        boxShadow: darkMode ? "0 1px 3px rgba(0,0,0,0.3)" : "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#BF00FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {label === "Hadir" && <polyline points="20 6 9 17 4 12"/>}
          {label === "Izin" && <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
          {label === "Sakit" && <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>}
          {label === "Alpha" && <><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></>}
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-semibold ${labelColor}`}>{label}</div>
        <div className={`text-[9px] ${mutedColor}`}>{desc}</div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-xl font-medium tabular-nums ${labelColor}`}>{value}</div>
        <div className={`text-[9px] font-medium ${mutedColor}`}>{value} dari {total} hari</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-transparent absolute top-0 left-0 pb-24">
      {/* ── HERO HEADER ── */}
      <div className="w-full pt-12 pb-6 px-6 shadow-2xl border-b border-white/5 rounded-b-[40px]"
        style={{ background: "linear-gradient(160deg, #BF40FF 0%, #6600CC 35%, #2B0066 65%, #000000 100%)" }}>
        <h1 className="text-lg font-bold" style={{ fontFamily: "'Urbanist', sans-serif", color: "#FFFFFF" }}>Riwayat Absensi</h1>
        <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>Riwayat kehadiran Anda</p>

        {/* Month nav */}
        <div className="flex items-center justify-center gap-3 mt-4">
          <button onClick={() => navigateMonth(-1)}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-85"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.6)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="text-center min-w-[140px]">
            <div className="text-[15px] font-bold" style={{ fontFamily: "'Urbanist', sans-serif", color: "#FFFFFF" }}>
              {MONTHS[month]} {year}
            </div>
            {isCurrentMonth && (
              <div className="text-[9px] font-medium uppercase tracking-[0.6px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                Bulan Ini
              </div>
            )}
          </div>
          <button onClick={() => navigateMonth(1)}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-85"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.6)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 mt-5 space-y-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#660099] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── RINGKASAN CARD ── */}
            <div style={glass}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-4 rounded-full shrink-0"
                    style={{ background: "linear-gradient(180deg, #BF00FF, #3B82F6)" }} />
                  <span className={`text-xs font-bold tracking-wide ${labelColor}`}>Ringkasan Kehadiran</span>
                </div>
                <span className="text-[10px] font-medium" style={{ color: darkMode ? "#9ba1ae" : "#6b7280" }}>
                  {MONTHS[month]} {year}
                </span>
              </div>

              {/* Donut */}
              <div className="flex items-center justify-center gap-5 px-5 pt-4 pb-2">
                <div className="relative w-[100px] h-[100px] shrink-0">
                  <svg width="100" height="100" viewBox="0 0 100 100">
                    <defs>
                      <linearGradient id="dg" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#BF00FF"/>
                        <stop offset="100%" stopColor="#7066ed"/>
                      </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="42" fill="none" stroke={darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)"} strokeWidth="8"/>
                    <circle cx="50" cy="50" r="42" fill="none" stroke="url(#dg)" strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={offset}
                      transform="rotate(-90, 50, 50)"
                      style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[22px] font-extrabold leading-none"
                      style={{ fontFamily: "'Urbanist', sans-serif", color: darkMode ? "#FFFFFF" : "#111827" }}>{pct}%</span>
                    <span className="text-[7px] font-medium uppercase tracking-[0.5px] mt-0.5" style={{ color: darkMode ? "#9ba1ae" : "#4b5563" }}>Hadir</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-[11px] font-semibold ${labelColor}`}>Kehadiran Bulan Ini</div>
                  <div className={`text-[9px] mt-0.5 ${mutedColor}`}>
                    <span className="font-semibold">{totalHadir}</span> hari hadir dari <span className="font-semibold">{totalDays}</span> hari kerja
                  </div>
                  <div className="flex gap-3 mt-2.5">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: "linear-gradient(135deg, #BF00FF, #7066ed)" }} />
                      <span className="text-[8px]" style={{ color: darkMode ? "#9ba1ae" : "#6b7280" }}>Hadir</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.15)" }} />
                      <span className="text-[8px]" style={{ color: darkMode ? "#9ba1ae" : "#6b7280" }}>Alpha</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className={`mx-5 my-2 h-px ${cardBorder}`} />

              {/* Stat rows */}
              <div className="px-1 pb-2 pt-0.5">
                <StatRow label="Hadir" desc="Kehadiran tepat waktu" value={totalHadir} total={totalDays}
                  color="#ADFF2F" active={totalHadir > 0} />
                <StatRow label="Izin" desc="Diluar tanggung jawab" value={izin} total={totalDays}
                  color="#fbbf24" active={izin > 0} />
                <StatRow label="Sakit" desc="Tidak hadir karena sakit" value={sakit} total={totalDays}
                  color="#fb923c" active={sakit > 0} />
                <StatRow label="Alpha" desc="Tanpa keterangan" value={alpha} total={totalDays}
                  color="#f87171" active={alpha > 0} />
              </div>

              {/* Footer */}
              <div className={`border-t ${cardBorder} flex items-center justify-between px-5 py-3`}>
                <span className="text-[9px] font-medium" style={{ color: darkMode ? "#9ba1ae" : "#6b7280" }}>
                  Periode: 1 — {new Date(year, month + 1, 0).getDate()} {MONTHS[month]} {year}
                </span>
                <span className="text-[9px] font-medium tabular-nums" style={{ color: darkMode ? "#9ba1ae" : "#6b7280" }}>
                  {totalHadir} dari {totalDays} hari kerja
                </span>
              </div>
            </div>

            {/* ── DAFTAR ABSENSI CARD ── */}
            <div style={glass}>
              <div className="flex items-center justify-between px-5 pt-5 pb-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-4 rounded-full shrink-0"
                    style={{ background: "linear-gradient(180deg, #BF00FF, #3B82F6)" }} />
                  <span className={`text-xs font-bold tracking-wide ${labelColor}`}>Daftar Absensi</span>
                </div>
                <span className="text-[10px] font-medium" style={{ color: darkMode ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.4)" }}>
                  {history.length} hari
                </span>
              </div>

              <div className="px-4 pb-4 pt-2">
                {history.length === 0 ? (
                  <div className="text-center py-10">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <div className={`text-sm font-semibold ${mutedColor}`}>Belum ada absensi</div>
                    <div className={`text-[10px] mt-1 ${mutedColor}`}>Tidak ada catatan kehadiran di bulan ini</div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {history.map((item, i) => (
                      <div key={i}
                        className="flex items-center gap-3 rounded-xl px-4 py-3.5 transition-all duration-200 hover:translate-x-1"
                        style={{
                          boxShadow: darkMode ? "0 1px 3px rgba(0,0,0,0.3)" : "0 1px 3px rgba(0,0,0,0.06)",
                          borderLeft: item.attendance_status === "terlambat" ? "2px solid rgba(249,115,22,0.2)" : "2px solid transparent",
                        }}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#BF00FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-semibold ${labelColor}`}>
                            {item.date
                              ? new Date(item.date + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" })
                              : "-"}
                          </div>
                          <div className={`text-[10px] mt-0.5 ${mutedColor}`}>
                            Masuk {formatTime(item.clock_in_time)} — Pulang {formatTime(item.clock_out_time)}
                          </div>
                        </div>
                        {statusBadge(item.attendance_status || "alpha")}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
