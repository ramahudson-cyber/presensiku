import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getAttendanceHistory } from "../../services/attendanceService";
import { supabase } from "../../lib/supabase";

const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

// Light-mode tokens — per DESIGN.md
const T = {
  bg: '#F4F2FB',
  surface: '#FFFFFF',
  border: 'rgba(31,41,55,0.08)',
  div: '#F1F5F9',
  text: '#0F172A',
  textSec: '#475569',
  textMuted: '#94A3B8',
  sub: '#6B7280',
  shadow: '0 4px 16px rgba(15,23,42,0.06)',
  rowBg: 'rgba(15,23,42,0.02)',
  rowShadow: '0 1px 3px rgba(0,0,0,0.06)',
  iconBg: '#F5F3FF',
  donutTrack: 'rgba(0,0,0,0.06)',
  donutText: '#111827',
  donutSub: '#475563',
};

const STATUS_META = {
  hadir:     { label: 'Tepat Waktu', color: '#10B981', bg: 'rgba(16,185,129,0.08)',  left: 'transparent' },
  terlambat: { label: 'Terlambat',   color: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  left: 'rgba(245,158,11,0.5)' },
  izin:      { label: 'Izin',        color: '#D97706', bg: 'rgba(251,191,36,0.12)',  left: 'rgba(251,191,36,0.5)' },
  sakit:     { label: 'Sakit',       color: '#EA580C', bg: 'rgba(251,146,60,0.12)',  left: 'rgba(251,146,60,0.5)' },
  alpha:     { label: 'Alpha',       color: '#EF4444', bg: 'rgba(239,68,68,0.08)',   left: 'rgba(239,68,68,0.5)' },
};

const ICONS = {
  clock:    <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
  heart:    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>,
  x:        <><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></>,
};

const iconFor = (status) => status === 'izin' ? ICONS.calendar : status === 'sakit' ? ICONS.heart : status === 'alpha' ? ICONS.x : ICONS.clock;

export default function EmployeeHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [history, setHistory] = useState([]);
  const [totalDays, setTotalDays] = useState(0);
  const [workingDaysPassed, setWorkingDaysPassed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  const navigateMonth = (dir) => {
    let m = month + dir;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m);
    setYear(y);
  };

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);
    setFetchError(null);

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
          .lte("date", dateTo),
      ]);

      setHistory(attData || []);

      const schedules = schedRes.data || [];
      setTotalDays(schedules.length);
      setWorkingDaysPassed(
        schedules.filter((sch) => new Date(sch.date + "T00:00:00") <= today).length
      );
    } catch (e) {
      console.error(e);
      setFetchError("Gagal memuat data. Periksa koneksi.");
      setHistory([]);
      setTotalDays(0);
      setWorkingDaysPassed(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user?.id) return;
      setLoading(true);
      setFetchError(null);

      const lastDay = new Date(year, month + 1, 0).getDate();
      const dateFrom = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const dateTo = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
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
        setHistory(attData || []);

        const schedules = schedRes.data || [];
        setTotalDays(schedules.length);
        setWorkingDaysPassed(
          schedules.filter((sch) => new Date(sch.date + "T00:00:00") <= today).length
        );
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setFetchError("Gagal memuat data. Periksa koneksi.");
          setHistory([]);
          setTotalDays(0);
          setWorkingDaysPassed(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
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
  const alpha = Math.max(0, workingDaysPassed - totalHadir - izin - sakit);

  // ── Donut ──
  const circumference = 2 * Math.PI * 42;
  const pct = totalDays > 0 ? Math.round((totalHadir / totalDays) * 100) : 0;
  const offset = circumference - (pct / 100) * circumference;

  const StatRow = ({ label, desc, value, total, color, active }) => (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3.5 transition-all duration-300 hover:translate-x-1"
      style={{
        background: active ? `linear-gradient(90deg, ${color}12, transparent)` : "transparent",
        borderLeft: `2px solid ${active ? "transparent" : color}33`,
        opacity: active ? 1 : 0.5,
        boxShadow: T.rowShadow,
      }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: T.iconBg }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#BF00FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {label === "Hadir" && <polyline points="20 6 9 17 4 12"/>}
          {label === "Izin" && <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
          {label === "Sakit" && <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>}
          {label === "Alpha" && <><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></>}
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold" style={{ color: T.text }}>{label}</div>
        <div className="text-[9px]" style={{ color: T.sub }}>{desc}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xl font-medium tabular-nums" style={{ color: T.text }}>{value}</div>
        <div className="text-[9px] font-medium" style={{ color: T.sub }}>{value} dari {total} hari</div>
      </div>
    </div>
  );

  const timeLabel = (item) => {
    const st = item.attendance_status;
    if (st === "izin") return "Izin (tanpa absen)";
    if (st === "sakit") return "Sakit";
    if (st === "alpha") return "Tidak hadir tanpa keterangan";
    return `Masuk ${formatTime(item.clock_in_time)} — Pulang ${formatTime(item.clock_out_time)}`;
  };

  const initials = user?.full_name?.charAt(0)?.toUpperCase() || "R";

  return (
    <div className="min-h-screen w-full font-sans absolute top-0 left-0 right-0 pb-24" style={{ background: T.bg, color: T.text }}>
      {/* ── HEADER — simple elegant ── */}
      <div className="pt-14 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} aria-label="Kembali"
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 hover:bg-white hover:shadow-sm active:scale-90"
              style={{ color: T.text }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className="text-[17px] font-bold tracking-tight" style={{ color: T.text }}>Riwayat Absensi</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover border" style={{ borderColor: 'rgba(191,0,255,0.15)' }} />
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold"
                style={{ background: T.iconBg, color: '#BF00FF', border: '1px solid rgba(191,0,255,0.15)' }}>
                {initials}
              </div>
            )}
            <span className="text-[9px] font-medium leading-none max-w-[72px] truncate text-center" style={{ color: T.sub }}>
              {user?.position || user?.role || "Pegawai"}
            </span>
          </div>
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-center gap-3.5 mt-6">
          <button onClick={() => navigateMonth(-1)} aria-label="Bulan sebelumnya"
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 hover:bg-white hover:text-[#BF00FF] hover:shadow-sm active:scale-90"
            style={{ color: T.textMuted }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="text-center min-w-[130px]">
            <div className="text-sm font-semibold" style={{ color: T.text }}>{MONTHS[month]} {year}</div>
            {isCurrentMonth && (
              <div className="text-[9px] font-semibold uppercase tracking-[0.5px] mt-0.5" style={{ color: '#BF00FF' }}>
                Bulan Ini
              </div>
            )}
          </div>
          <button onClick={() => navigateMonth(1)} aria-label="Bulan berikutnya"
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 hover:bg-white hover:text-[#BF00FF] hover:shadow-sm active:scale-90"
            style={{ color: T.textMuted }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 mt-6 space-y-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#BF00FF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center py-16">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="text-red-600 text-xs font-medium text-center max-w-[200px]">{fetchError}</div>
            <button onClick={fetchData}
              className="mt-3 px-6 py-2 bg-[#BF00FF] hover:bg-[#a000e6] text-white text-xs font-semibold rounded-full transition-all duration-200 shadow-md">
              Coba Lagi
            </button>
          </div>
        ) : (
          <>
            {/* ── RINGKASAN CARD ── */}
            <div className="rounded-3xl p-5 relative overflow-hidden"
              style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
              <div className="flex items-center justify-between px-1 pt-1 pb-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-4 rounded-full shrink-0" style={{ background: "linear-gradient(180deg, #BF00FF, #3B82F6)" }} />
                  <span className="text-xs font-bold tracking-wide" style={{ color: T.text }}>Ringkasan Kehadiran</span>
                </div>
                <span className="text-[10px] font-medium" style={{ color: T.sub }}>{MONTHS[month]} {year}</span>
              </div>

              <div className="flex items-center justify-center gap-5 px-0 pt-3 pb-2">
                <div className="relative w-[100px] h-[100px] shrink-0">
                  <svg width="100" height="100" viewBox="0 0 100 100">
                    <defs>
                      <linearGradient id="dg" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#BF00FF"/>
                        <stop offset="100%" stopColor="#7066ed"/>
                      </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="42" fill="none" stroke={T.donutTrack} strokeWidth="8"/>
                    <circle cx="50" cy="50" r="42" fill="none" stroke="url(#dg)" strokeWidth="8"
                      strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
                      transform="rotate(-90, 50, 50)" style={{ transition: "stroke-dashoffset 0.6s ease-out" }} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[22px] font-extrabold leading-none" style={{ color: T.donutText }}>{pct}%</span>
                    <span className="text-[7px] font-medium uppercase tracking-[0.5px] mt-0.5" style={{ color: T.donutSub }}>Hadir</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold" style={{ color: T.text }}>Kehadiran Bulan Ini</div>
                  <div className="text-[9px] mt-0.5" style={{ color: T.sub }}>
                    <span className="font-semibold">{totalHadir}</span> hari hadir dari <span className="font-semibold">{totalDays}</span> hari kerja
                  </div>
                  <div className="flex gap-3 mt-2.5">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: "linear-gradient(135deg, #BF00FF, #7066ed)" }} />
                      <span className="text-[8px]" style={{ color: T.sub }}>Hadir</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: "rgba(0,0,0,0.12)" }} />
                      <span className="text-[8px]" style={{ color: T.sub }}>Alpha</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mx-0 my-2 h-px" style={{ background: T.div }} />

              <div className="px-0 pb-1 pt-0.5">
                <StatRow label="Hadir" desc="Kehadiran tepat waktu" value={totalHadir} total={totalDays}
                  color="#ADFF2F" active={totalHadir > 0} />
                <StatRow label="Izin" desc="Diluar tanggung jawab" value={izin} total={totalDays}
                  color="#fbbf24" active={izin > 0} />
                <StatRow label="Sakit" desc="Tidak hadir karena sakit" value={sakit} total={totalDays}
                  color="#fb923c" active={sakit > 0} />
                <StatRow label="Alpha" desc="Tanpa keterangan" value={alpha} total={totalDays}
                  color="#f87171" active={alpha > 0} />
              </div>

              <div className="border-t flex items-center justify-between pt-3 mt-1" style={{ borderColor: T.div }}>
                <span className="text-[9px] font-medium" style={{ color: T.sub }}>
                  Periode: 1 — {new Date(year, month + 1, 0).getDate()} {MONTHS[month]} {year}
                </span>
                <span className="text-[9px] font-medium tabular-nums" style={{ color: T.sub }}>
                  {totalHadir} dari {totalDays} hari kerja
                </span>
              </div>
            </div>

            {/* ── DAFTAR ABSENSI CARD ── */}
            <div className="rounded-3xl p-5 relative overflow-hidden"
              style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
              <div className="flex items-center justify-between px-1 pt-1 pb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-4 rounded-full shrink-0" style={{ background: "linear-gradient(180deg, #BF00FF, #3B82F6)" }} />
                  <span className="text-xs font-bold tracking-wide" style={{ color: T.text }}>Daftar Absensi</span>
                </div>
                <span className="text-[10px] font-medium" style={{ color: T.sub }}>{history.length} hari</span>
              </div>

              {history.length === 0 ? (
                <div className="text-center py-10">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 opacity-60">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <div className="text-sm font-semibold" style={{ color: T.textMuted }}>Belum ada absensi</div>
                  <div className="text-[10px] mt-1" style={{ color: T.textMuted }}>Tidak ada catatan kehadiran di bulan ini</div>
                </div>
              ) : (
                <div className="space-y-1">
                  {history.map((item, i) => {
                    const st = item.attendance_status || "alpha";
                    const meta = STATUS_META[st] || STATUS_META.alpha;
                    return (
                      <div key={item.id || i}
                        className="flex items-center gap-3 rounded-xl px-4 py-3.5 transition-all duration-200 hover:translate-x-1"
                        style={{ boxShadow: T.rowShadow, background: T.rowBg, borderLeft: `2px solid ${meta.left}` }}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: T.iconBg }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#BF00FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {iconFor(st)}
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold" style={{ color: T.text }}>
                            {item.date
                              ? new Date(item.date + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" })
                              : "-"}
                          </div>
                          <div className="text-[10px] mt-0.5" style={{ color: T.sub }}>
                            {timeLabel(item)}
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full shrink-0 whitespace-nowrap"
                          style={{ color: meta.color, background: meta.bg }}>
                          {meta.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
