import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getAttendanceHistory } from "../../services/attendanceService";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import { History, Sun, Sunset, ArrowRight, Bell, ChevronRight, LogOut, ClipboardList, User, Wallet, MessageSquareWarning } from "lucide-react";
import { signOut } from "../../services/authService";
import { getShiftDefinition, getWitaDateKey, isShiftEnded } from "../../lib/shiftTime";
import { getShiftReminderInfo, getShiftEndReminderInfo, reminderToastKey, reminderToastEndKey } from "../../lib/notificationReminder";
import { getSetting } from "../../lib/settings";
import { registerPushNotifications, requestNotificationPermission, scheduleShiftReminders, subscribeAnnouncementRealtime, notifyNewAnnouncement } from "../../services/pushNotificationService";
import NotificationPermissionBanner from "../../components/NotificationPermissionBanner";
import usePullToRefresh from "../../hooks/usePullToRefresh";
import PullToRefreshIndicator from "../../components/PullToRefreshIndicator";
import ProfileAvatarButton from "../../components/ProfileAvatarButton";

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(label || `Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

// Fallback nama shift bila master DB tidak tersedia — nama resmi selalu
// diutamakan dari tabel shifts (mendukung kode kustom org, mis. MLM).
const SHIFT_NAMES = { PG:'Pagi', SR:'Sore', SI:'Siang', SG:'Siang', ML:'Malam', MLM:'Malam', LB:'Libur' };
const getShiftName = (code) => SHIFT_NAMES[code] || (code || 'Shift');
// Badge hero: "Shift : Malam". Nama dari master DB dikapitalisasi; nama yang
// sudah diawali "Shift" tidak diberi awalan ganda.
const formatShiftBadge = (name) => {
  if (!name) return null;
  const trimmed = name.trim();
  const cap = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /^shift\b/i.test(cap) ? cap : `Shift : ${cap}`;
};

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (err) {
      setLoggingOut(false);
      toast.error("Gagal keluar: " + (err?.message || "periksa koneksi"));
    }
  };
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [ackedIds, setAckedIds] = useState(new Set());
  const [stats, setStats] = useState({ hadir: 0, izin: 0, sakit: 0, alpha: 0, jadwalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [shift, setShift] = useState(null);
  const [shiftDefinitions, setShiftDefinitions] = useState([]);
  const [todaySched, setTodaySched] = useState(null);
  const [serverTime, setServerTime] = useState(new Date());
  // Grid menu premium
  const [payrollOn, setPayrollOn] = useState(false);
  const [unreadNotif, setUnreadNotif] = useState(0);
	const getGreeting = (h) => {
	  if (h >= 3 && h < 12) return "Selamat Pagi";
	  if (h >= 12 && h < 15) return "Selamat Siang";
	  if (h >= 15 && h < 18) return "Selamat Sore";
	  return "Selamat Malam";
	};

  useEffect(() => { fetchData(); }, []);

  // Push notification FCM + reminder shift terjadwal + realtime pengumuman
  useEffect(() => {
    if (!user?.id) return;
    requestNotificationPermission().then((granted) => {
      if (granted) registerPushNotifications(user.id);
    });
    const unsubscribe = subscribeAnnouncementRealtime((ann) => {
      notifyNewAnnouncement(ann);
      setAnnouncements((prev) => [ann, ...prev].slice(0, 3));
    });
    return unsubscribe;
  }, [user?.id]);

  const retryFetchData = () => {
    setFetchError(null);
    setLoading(true);
    fetchData();
  };

  useEffect(() => {
    const id = setInterval(() => {
      setServerTime(prev => new Date(prev.getTime() + 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Grid menu: flag modul gaji + badge notifikasi belum dibaca
  useEffect(() => {
    (async () => {
      try {
        setPayrollOn((await getSetting("payroll_enabled", "false")) === "true");
      } catch { /* default off */ }
    })();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const fetchUnread = async () => {
      try {
        const iso = new Date().toISOString();
        const { count: annCount } = await supabase
          .from("announcements")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true)
          .or(`expires_at.is.null,expires_at.gte.${iso}`);
        const { count: ackCount } = await supabase
          .from("announcement_acks")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);
        if (!cancelled) setUnreadNotif(Math.max(0, (annCount || 0) - (ackCount || 0)));
      } catch { /* silent */ }
    };
    fetchUnread();
    const id = setInterval(fetchUnread, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, [user?.id]);

  // Shift reminder: muncul toast sekali per shift (localStorage)
  useEffect(() => {
    const showReminder = () => {
      if (!todaySched || !shiftDefinitions.length) return;
      const today = getWitaDateKey(serverTime);
      const r = getShiftReminderInfo(serverTime, todaySched, shiftDefinitions);
      if (r.show) {
        const key = reminderToastKey(today, todaySched.shift_code);
        if (!localStorage.getItem(key)) {
          toast.info(r.message, { autoClose: 15000, toastId: key });
          localStorage.setItem(key, "1");
        }
      }
      const endR = getShiftEndReminderInfo(serverTime, todaySched, shiftDefinitions);
      if (endR.show) {
        const key = reminderToastEndKey(today, todaySched.shift_code);
        if (!localStorage.getItem(key)) {
          toast.warn(endR.message, { autoClose: 15000, toastId: key });
          localStorage.setItem(key, "1");
        }
      }
    };
    showReminder();
    const id = setInterval(showReminder, 60000);
    return () => clearInterval(id);
  }, [serverTime, todaySched, shiftDefinitions]);

  const fetchData = async () => {
    try {
      const { data: serverTimeData } = await supabase.rpc('get_server_time');
      const serverNow = new Date(serverTimeData || Date.now());
      const today = getWitaDateKey(serverNow);
      const todayParts = today.split('-').map(Number);
      const year = todayParts[0];
      const monthNumber = todayParts[1];
      const month = String(monthNumber).padStart(2, '0');
      const monthStartStr = `${year}-${month}-01`;
      const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
      const monthEndStr = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

      // PENTING: urutan nama WAJIB sama dengan urutan query di bawah.
      // (Dulu tidak sejajar — shiftsMasterRes menunjuk ke hasil shift_schedules,
      // sehingga peta nama shift kosong dan badge menampilkan kode mentah "MLM".)
      const [attRes, shiftRes, monthAttRes, annRes, ackRes, historyRes, schedRes, shiftSchedulesRes, shiftsMasterRes] = await withTimeout(Promise.all([
        supabase.from("attendance").select("*").eq("user_id", user.id).eq("date", today).maybeSingle(),
        supabase.from("employee_schedules").select("shift_code").eq("user_id", user.id).eq("date", today).maybeSingle(),
        supabase.from("attendance").select("date, attendance_status").eq("user_id", user.id).gte("date", monthStartStr).lte("date", today),
        supabase.from("announcements").select("*").eq("is_active", true)
          .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
          .order("created_at", { ascending: false }).limit(3),
        supabase.from("announcement_acks").select("announcement_id").eq("user_id", user.id),
        getAttendanceHistory(user.id),
        supabase.from("employee_schedules").select("date, shift_code").eq("user_id", user.id).gte("date", monthStartStr).lte("date", monthEndStr),
        supabase.from("shift_schedules").select("shift_code, day_of_week, end_time, crosses_midnight, is_working_day"),
        supabase.from("shifts").select("code, name"),
      ]), 20000, "fetchAll");
      const shiftNameMap = Object.fromEntries((shiftsMasterRes.data || []).map(s => [s.code, s.name]));
      const shiftDefinitions = shiftSchedulesRes.data || [];
      setShiftDefinitions(shiftDefinitions);

      if (serverTimeData) setServerTime(serverNow);

      setTodayAttendance(attRes.data);

      // null (BUKAN string "N/A") agar badge merender "Tidak ada jadwal hari ini".
      // Nama shift diutamakan dari master DB (mis. "malam" → "Shift : Malam"), bukan kode.
      setShift(shiftRes.data?.shift_code ? formatShiftBadge(shiftNameMap[shiftRes.data.shift_code] || getShiftName(shiftRes.data.shift_code)) : null);
      setTodaySched(shiftRes.data || null);

      scheduleShiftReminders(serverNow, shiftRes.data || null, shiftDefinitions);

      const s = { hadir: 0, izin: 0, sakit: 0, alpha: 0 };
      monthAttRes.data?.forEach(a => {
        const st = a.attendance_status === 'terlambat' ? 'hadir' : a.attendance_status;
        if (s[st] !== undefined) s[st]++;
      });

      const schedules = schedRes.data || [];
      const isEnded = (schedule) => isShiftEnded(
        schedule.date,
        getShiftDefinition(shiftDefinitions, schedule),
        serverNow
      );
      const completedSchedules = schedules.filter(isEnded);
      const jadwalCount = schedules.filter((schedule) => schedule.date <= today).length;

      const totalHadir = s.hadir;
      const alphaCount = Math.max(0, completedSchedules.length - totalHadir - s.izin - s.sakit);

      setStats({ ...s, alpha: alphaCount, jadwalCount });
      setAnnouncements(annRes.data || []);
      setAckedIds(new Set((ackRes.data || []).map((r) => r.announcement_id)));

    } catch (e) {
      console.error(e);
      setFetchError(e.message?.includes('Timeout') ? 'Koneksi lambat. Coba lagi.' : 'Gagal memuat data. Periksa koneksi.');
    } finally { setLoading(false); }
  };

  const { pullDistance, isRefreshing } = usePullToRefresh(fetchData);

  // Light-mode helpers
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
    shadowLg: '0 8px 24px rgba(15,23,42,0.08)',
    rowBg: 'rgba(15,23,42,0.02)',
    rowBgActive: (c) => `linear-gradient(90deg, ${c}10, transparent)`,
    donutTrack: 'rgba(0,0,0,0.06)',
    donutText: '#111827',
    donutSub: '#475563',
  };

  // Portal ke <body>: loading screen harus mengalahkan BottomNav (z-30,
  // sibling di root) — konten halaman terkurung stacking context z-10 milik
  // AdminLayout, jadi z-50 di dalamnya kalah (pola sama dgn BottomSheet).
  if (loading) return createPortal(
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: T.bg }}>
      <div className="flex flex-col items-center gap-3">
        {fetchError ? (
          <>
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-1">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="text-red-600 text-xs font-medium text-center max-w-[200px]">{fetchError}</div>
            <button onClick={retryFetchData}
              className="mt-3 px-6 py-2 bg-[#BF00FF] hover:bg-[#a000e6] text-white hero-card-bg text-xs font-semibold rounded-full transition-all duration-200 shadow-md">
              Coba Lagi
            </button>
          </>
        ) : (
          <>
            <div className="w-10 h-10 border-4 border-[#BF00FF] border-t-transparent rounded-full animate-spin"></div>
            <div className="text-gray-500 text-xs tracking-widest uppercase">Memuat...</div>
          </>
        )}
      </div>
    </div>,
    document.body
  );

  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    if (timeStr.includes('T')) {
      return new Date(timeStr).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" });
    }
    return timeStr.substring(0, 5);
  };

  // Hari ini teratasi via sanggahan disetujui (record 'hadir' tanpa jam,
  // penanda notes dari RPC review_sanggahan) — tidak alpha/terlambat dan
  // tidak dipotong gaji, absen tidak diperlukan.
  const isSanggahToday = !!todayAttendance
    && !todayAttendance?.clock_in_time
    && (todayAttendance?.notes || "").toLowerCase().includes("dikoreksi via sanggahan");

  return (
    <div className="min-h-screen w-full font-sans absolute top-0 left-0 pb-24" style={{ background: T.bg, color: T.text }}>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      {/* HERO — vibrant violet gradient. hero-card-bg dipakai karena rule global
          index.css `.text-white !important` memaksa teks gelap di light mode;
          rule proteksi hero-card-bg mengembalikan teks jadi putih. */}
      <div className="w-full p-8 pt-12 shadow-lg rounded-b-[32px] text-white hero-card-bg"
        style={{ background: 'linear-gradient(160deg, #C44DFF 0%, #BF00FF 30%, #8A00CC 60%, #4A0099 100%)' }}>
        <div className="max-w-md mx-auto">
          {/* Icon notifikasi & keluar di paling atas, tanpa background */}
          <div className="flex items-center justify-end gap-5 mb-2">
            <Link
              to="/employee/notifications"
              aria-label="Pengumuman"
              className="relative p-1 rounded-full hover:bg-white/10 active:scale-95 transition-all"
            >
              <Bell size={20} className="text-white" />
              {announcements.some((a) => !ackedIds.has(a.id)) && (
                <span className="absolute top-0 right-0 w-2 h-2 bg-rose-400 rounded-full ring-2 ring-[#8A00CC]" />
              )}
            </Link>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label="Keluar"
              className="p-1 rounded-full hover:bg-white/10 active:scale-95 transition-all disabled:opacity-60"
            >
              {loggingOut
                ? <div className="w-5 h-5 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                : <LogOut size={20} className="text-white" />}
            </button>
          </div>
          <div className="flex items-center gap-4 mb-8">
            <ProfileAvatarButton user={user} initials={user?.full_name?.charAt(0)?.toUpperCase() || "R"} variant="hero" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-[0.2em] opacity-80 text-white">{getGreeting(serverTime.getHours())},</div>
              <div className="text-2xl font-bold text-white">{user?.full_name || "Rama Hudson"}</div>
              <div className="text-xs opacity-75 mt-0.5 text-white">
                {[user?.role, user?.position].filter(Boolean).join(" · ") || "Pegawai"}
              </div>
            </div>
          </div>
          <div className="flex justify-between items-end">
            <div>
              <div className="text-4xl font-bold text-white">{serverTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</div>
              <div className="text-xs opacity-70 mt-1 text-white">{serverTime.toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
              <div className="text-[10px] mt-2 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full inline-block font-semibold" style={{ border: '1px solid rgba(255,255,255,0.25)' }}>
                {shift ? shift : "Tidak ada jadwal hari ini"}
              </div>
            </div>
            <Link to="/employee/attendance" className="bg-white text-[#8A00CC] px-8 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-200">
              Absen <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto space-y-6 p-4 mt-6">
        {/* SECTION TITLE: Status hari ini — bar + judul, pola sama dengan header "Menu" */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-4 rounded-full shrink-0" style={{ background: 'linear-gradient(180deg, #BF00FF, #3B82F6)' }} />
          <div>
            <div className="text-lg font-extrabold tracking-tight" style={{ color: T.text }}>Status hari ini</div>
            <div className="text-[10px] mt-0.5 font-normal" style={{ color: T.textMuted }}>Pantau waktu kehadiran anda</div>
          </div>
        </div>

        {/* 2 CARDS: MASUK & PULANG */}
        <div className="grid grid-cols-2 gap-3">
          {/* Status non-hadir (izin/sakit) → tampil status besar, bukan jam */}
          {(() => {
            const st = todayAttendance?.attendance_status;
            if (st !== "izin" && st !== "sakit") return null;
            const word = st === "izin" ? "IZIN" : "SAKIT";
            const badge = st === "izin" ? "Izin Disetujui" : "Sakit (Tidak Dipotong)";
            return (
              <>
                <div className="rounded-3xl p-5 relative overflow-hidden shadow-lg text-white hero-card-bg"
                  style={{ background: 'linear-gradient(135deg, #BF00FF 0%, #8A00CC 100%)', boxShadow: '0 6px 20px rgba(191,0,255,0.25)' }}>
                  <div className="text-[9px] uppercase tracking-[0.2em] opacity-75 font-semibold mb-3 flex items-center gap-1.5">
                    <Sun size={13} /> Masuk
                  </div>
                  <div className="text-[28px] font-extrabold leading-none tracking-tight mb-2">{word}</div>
                  <div className="inline-flex items-center gap-1.5 text-[9px] font-semibold bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.25)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                    <span className="opacity-90">{badge}</span>
                  </div>
                </div>
                <div className="hero-card-bg rounded-3xl p-5 relative overflow-hidden shadow-lg shadow-black/20"
                  style={{ background: '#000000', color: '#FFFFFF', boxShadow: '0 6px 20px rgba(0,0,0,0.2)' }}>
                  <div className="text-[9px] uppercase tracking-[0.2em] opacity-65 font-semibold mb-3 flex items-center gap-1.5">
                    <Sunset size={13} /> Pulang
                  </div>
                  <div className="text-[28px] font-extrabold leading-none tracking-tight mb-2">{word}</div>
                  <div className="inline-flex items-center gap-1.5 text-[9px] font-semibold bg-white/10 px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Tidak perlu absen
                  </div>
                </div>
              </>
            );
          })()}
          {/* Hari ini teratasi via sanggahan → kartu SANGGAH, bukan jam */}
          {isSanggahToday && (
            <>
              <div className="rounded-3xl p-5 relative overflow-hidden shadow-lg text-white hero-card-bg"
                style={{ background: 'linear-gradient(135deg, #BF00FF 0%, #8A00CC 100%)', boxShadow: '0 6px 20px rgba(191,0,255,0.25)' }}>
                <div className="text-[9px] uppercase tracking-[0.2em] opacity-75 font-semibold mb-3 flex items-center gap-1.5">
                  <Sun size={13} /> Masuk
                </div>
                <div className="text-[22px] font-extrabold leading-none tracking-tight mb-2">SANGGAH</div>
                <div className="inline-flex items-center gap-1.5 text-[9px] font-semibold bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.25)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                  <span className="opacity-90">Disetujui</span>
                </div>
              </div>
              <div className="hero-card-bg rounded-3xl p-5 relative overflow-hidden shadow-lg shadow-black/20"
                style={{ background: '#000000', color: '#FFFFFF', boxShadow: '0 6px 20px rgba(0,0,0,0.2)' }}>
                <div className="text-[9px] uppercase tracking-[0.2em] opacity-65 font-semibold mb-3 flex items-center gap-1.5">
                  <Sunset size={13} /> Pulang
                </div>
                <div className="text-[22px] font-extrabold leading-none tracking-tight mb-2">SANGGAH</div>
                <div className="inline-flex items-center gap-1.5 text-[9px] font-semibold bg-white/10 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Tidak perlu absen
                </div>
              </div>
            </>
          )}
          {!(todayAttendance?.attendance_status === "izin" || todayAttendance?.attendance_status === "sakit") && !isSanggahToday && (
          <>
          {/* MASUK — Purple Gradient */}
          <div className="rounded-3xl p-5 relative overflow-hidden shadow-lg text-white hero-card-bg"
            style={{ background: 'linear-gradient(135deg, #BF00FF 0%, #8A00CC 100%)', boxShadow: '0 6px 20px rgba(191,0,255,0.25)' }}>
            <div className="text-[9px] uppercase tracking-[0.2em] opacity-75 font-semibold mb-3 flex items-center gap-1.5">
              <Sun size={13} /> Masuk
            </div>
            {todayAttendance?.clock_in_time ? (
              <>
                <div className="text-[28px] font-extrabold leading-none tracking-tight mb-2">
                  {formatTime(todayAttendance.clock_in_time)}
                </div>
                {todayAttendance.is_late ? (
                  <div className="inline-flex items-center gap-1.5 text-[9px] font-semibold bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.25)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
                    <span className="opacity-90">Terlambat</span>
                    <span className="opacity-75">{todayAttendance.late_minutes} menit</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 text-[9px] font-semibold bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.25)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                    <span className="opacity-90">Tepat Waktu</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="text-base font-bold leading-none mb-2" style={{ color: '#FFFFFF' }}>Belum Absen</div>
                <div className="text-[20px] font-bold leading-none opacity-50 mb-2">--:--</div>
                <div className="inline-flex items-center gap-1.5 text-[9px] font-semibold bg-white/10 px-2.5 py-1 rounded-full opacity-60" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>—</div>
              </>
            )}
          </div>

          {/* PULANG — solid black for high-contrast readability */}
          <div className="rounded-3xl p-5 relative overflow-hidden shadow-lg shadow-black/20"
            style={{ background: '#000000', color: '#FFFFFF', boxShadow: '0 6px 20px rgba(0,0,0,0.2)' }}>
            <div className="text-[9px] uppercase tracking-[0.2em] opacity-65 font-semibold mb-3 flex items-center gap-1.5">
              <Sunset size={13} /> Pulang
            </div>
            {todayAttendance?.clock_out_time ? (
              <>
                <div className="text-[28px] font-extrabold leading-none tracking-tight mb-2">
                  {formatTime(todayAttendance.clock_out_time)}
                </div>
                <div className="inline-flex items-center gap-1.5 text-[9px] font-semibold bg-black/10 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Selesai
                </div>
              </>
            ) : (
              <>
                <div className="text-base font-bold leading-none mb-2" style={{ color: '#FFFFFF' }}>Belum Absen</div>
                <div className="inline-flex items-center gap-1.5 text-[9px] font-semibold bg-white/10 px-2.5 py-1 rounded-full opacity-60">—</div>
              </>
            )}
          </div>
          </>
          )}
        </div>

        {/* MENU UTAMA — judul + grid 3 kolom (Slip Gaji & Profil turun ke baris 2) */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, #BF00FF, #3B82F6)' }} />
          <h3 className="text-lg font-extrabold tracking-tight" style={{ color: T.text }}>Menu</h3>
        </div>
        <div className="grid grid-cols-3 gap-x-2 gap-y-4">
          {[
            { to: "/employee/leave", icon: ClipboardList, label: "Izin/Sakit", tile: "linear-gradient(135deg, #EDE9FE, #DDD6FE)", color: "text-violet-600" },
            { to: "/employee/sanggah", icon: MessageSquareWarning, label: "Sanggah", tile: "linear-gradient(135deg, #CFFAFE, #A5F3FC)", color: "text-cyan-600" },
            { to: "/employee/history", icon: History, label: "Riwayat Kehadiran", tile: "linear-gradient(135deg, #DBEAFE, #BFDBFE)", color: "text-blue-600" },
            { to: "/employee/notifications", icon: Bell, label: "Notifikasi", tile: "linear-gradient(135deg, #FEF3C7, #FDE68A)", color: "text-amber-600", badge: true },
            ...(payrollOn ? [{ to: "/employee/salary", icon: Wallet, label: "Slip Gaji", tile: "linear-gradient(135deg, #D1FAE5, #A7F3D0)", color: "text-emerald-600" }] : []),
            { to: "/employee/profile", icon: User, label: "Profil", tile: "linear-gradient(135deg, #FCE7F3, #FBCFE8)", color: "text-pink-600" },
          ].map((item) => (
            <Link key={item.to} to={item.to} className="flex flex-col items-center gap-2.5 py-1 group">
              <span className="relative w-16 h-16 rounded-[22px] flex items-center justify-center shadow-[0_6px_16px_rgba(15,23,42,0.12)] transition-transform group-hover:-translate-y-0.5 group-active:scale-95"
                style={{ background: item.tile }}>
                <item.icon size={30} strokeWidth={2} className={item.color} />
                {item.badge && unreadNotif > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold grid place-items-center shadow">
                    {unreadNotif}
                  </span>
                )}
              </span>
              <span className="text-[10.5px] font-bold text-slate-600 text-center leading-tight px-1">
                {item.label}
              </span>
            </Link>
          ))}
        </div>

        {/* Shift Reminder Banner — check-in */}
        {(() => {
          const r = getShiftReminderInfo(serverTime, todaySched, shiftDefinitions);
          if (!r.show) return null;
          return (
            <div className="rounded-3xl p-4 relative overflow-hidden border"
              style={{ background: "linear-gradient(135deg, #ECFDF5, #D1FAE5)", borderColor: "rgba(16,185,129,0.2)" }}>
              <div className="flex gap-3 items-start">
                <div className="w-9 h-9 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
                  <Bell size={16} className="text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-emerald-800">{r.message}</p>
                  <Link to="/employee/attendance"
                    className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-[10px] font-semibold transition-all active:scale-95">
                    Absen Sekarang <ChevronRight size={11} />
                  </Link>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Shift Reminder Banner — check-out */}
        {(() => {
          const rEnd = getShiftEndReminderInfo(serverTime, todaySched, shiftDefinitions);
          if (!rEnd.show) return null;
          return (
            <div className="rounded-3xl p-4 relative overflow-hidden border"
              style={{ background: "linear-gradient(135deg, #FEF3C7, #FDE68A)", borderColor: "rgba(245,158,11,0.2)" }}>
              <div className="flex gap-3 items-start">
                <div className="w-9 h-9 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                  <Sunset size={16} className="text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-amber-800">{rEnd.message}</p>
                  <Link to="/employee/attendance"
                    className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-full text-[10px] font-semibold transition-all active:scale-95">
                    Absen Pulang <ChevronRight size={11} />
                  </Link>
                </div>
              </div>
            </div>
          );
        })()}
        

        {/* BANNER IZIN NOTIFIKASI — iOS menuntut tap nyata untuk prompt */}
        <NotificationPermissionBanner />
      </div>
    </div>
  );
}
