import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import { History, Sun, Sunset, ArrowRight, Bell, ChevronRight, LogOut, ClipboardList, User, Wallet, MessageSquareWarning, Clock } from "lucide-react";
import { signOut } from "../../services/authService";
import { getShiftDefinition, getWitaDateKey, isShiftEnded, getEarlyLeaveInfo, formatDuration } from "../../lib/shiftTime";
import { getShiftReminderInfo, getShiftEndReminderInfo, reminderToastKey, reminderToastEndKey } from "../../lib/notificationReminder";
import { getSetting } from "../../lib/settings";
import { registerPushNotifications, requestNotificationPermission, scheduleShiftReminders, subscribeAnnouncementRealtime, notifyNewAnnouncement } from "../../services/pushNotificationService";
import NotificationPermissionBanner from "../../components/NotificationPermissionBanner";
import usePullToRefresh from "../../hooks/usePullToRefresh";
import PullToRefreshIndicator from "../../components/PullToRefreshIndicator";
import ProfileAvatarButton from "../../components/ProfileAvatarButton";
import Skeleton from "../../components/Skeleton";

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(label || `Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

// Fallback nama shift terpusat (mendukung kode kustom instansi, mis. SNG).
import { shiftLabelPrefixed as formatShiftBadge } from "../../lib/shiftName";

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
  const [yesterdaySched, setYesterdaySched] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [ackedIds, setAckedIds] = useState(new Set());
  const [stats, setStats] = useState({ hadir: 0, izin: 0, sakit: 0, alpha: 0, terlambat: 0, jadwalCount: 0 });
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
    // 5 menit (dulu 1 menit). Realtime pengumuman sudah menangani pembaruan
    // instan; polling ini hanya jaring pengaman dan ikut membebani egress
    // bila ratusan pegawai membuka dashboard bersamaan.
    const id = setInterval(fetchUnread, 300000);
    return () => { cancelled = true; clearInterval(id); };
  }, [user?.id]);

  // Shift reminder: muncul toast sekali per shift (localStorage)
  useEffect(() => {
    const showReminder = () => {
      if (!todaySched || !shiftDefinitions.length) return;
      const today = getWitaDateKey(serverTime);
      const r = getShiftReminderInfo(serverTime, todaySched, shiftDefinitions, todayAttendance);
      if (r.show) {
        const key = reminderToastKey(today, todaySched.shift_code);
        if (!localStorage.getItem(key)) {
          toast.info(r.message, { autoClose: 15000, toastId: key });
          localStorage.setItem(key, "1");
        }
      }
      const endR = getShiftEndReminderInfo(serverTime, todaySched, shiftDefinitions, todayAttendance, yesterdaySched);
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
  }, [serverTime, todaySched, shiftDefinitions, todayAttendance, yesterdaySched]);

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
      const [attRes, shiftRes, monthAttRes, annRes, ackRes, schedRes, shiftSchedulesRes, shiftsMasterRes] = await withTimeout(Promise.all([
        supabase.from("attendance").select("*").eq("user_id", user.id).eq("date", today).maybeSingle(),
        supabase.from("employee_schedules").select("shift_code").eq("user_id", user.id).eq("date", today).maybeSingle(),
        supabase.from("attendance").select("date, attendance_status, shift_code").eq("user_id", user.id).gte("date", monthStartStr).lte("date", today),
        supabase.from("announcements").select("*").eq("is_active", true)
          .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
          .order("created_at", { ascending: false }).limit(3),
        supabase.from("announcement_acks").select("announcement_id").eq("user_id", user.id),
        supabase.from("employee_schedules").select("date, shift_code").eq("user_id", user.id).gte("date", monthStartStr).lte("date", monthEndStr),
        supabase.from("shift_schedules").select("shift_code, day_of_week, start_time, end_time, crosses_midnight, is_working_day"),
        supabase.from("shifts").select("code, name"),
      ]), 20000, "fetchAll");
      const shiftNameMap = Object.fromEntries((shiftsMasterRes.data || []).map(s => [s.code, s.name]));
      const shiftDefinitions = shiftSchedulesRes.data || [];
      setShiftDefinitions(shiftDefinitions);

      if (serverTimeData) setServerTime(serverNow);

      // Shift malam lintas malam: setelah tengah malam, baris absensi KEMARIN
      // masih menunggu absen pulang (clock_in terisi, clock_out kosong) —
      // pakai baris itu untuk kartu status & pengingat, plus jadwal kemarin
      // untuk konteks pengingat.
      let att = attRes.data;
      const yesterdayKey = getWitaDateKey(new Date(serverNow.getTime() - 86400000));
      if (!att) {
        try {
          const { data: openNight } = await supabase.from("attendance").select("*")
            .eq("user_id", user.id).eq("date", yesterdayKey)
            .not("clock_in_time", "is", null).is("clock_out_time", null).maybeSingle();
          if (openNight) {
            const dow = (new Date(yesterdayKey + "T00:00:00").getDay() + 6) % 7;
            const { data: nightDef } = await supabase.from("shift_schedules").select("crosses_midnight")
              .eq("shift_code", openNight.shift_code).eq("day_of_week", dow).maybeSingle();
            if (nightDef?.crosses_midnight) att = openNight;
          }
        } catch { /* fallback: tanpa baris kemarin */ }
      }
      {
        const { data: ySched } = await supabase.from("employee_schedules")
          .select("shift_code").eq("user_id", user.id).eq("date", yesterdayKey).maybeSingle();
        setYesterdaySched(ySched?.shift_code ? { shift_code: ySched.shift_code, date: yesterdayKey } : null);
      }

      setTodayAttendance(att);
      setShift(shiftRes.data?.shift_code ? formatShiftBadge(shiftRes.data.shift_code, shiftNameMap[shiftRes.data.shift_code]) : null);
      setTodaySched(shiftRes.data || null);

      // null (BUKAN string "N/A") agar badge merender "Tidak ada jadwal hari ini".
      // Nama shift diutamakan dari master DB (mis. "malam" → "Shift : Malam"), bukan kode.
      setShift(shiftRes.data?.shift_code ? formatShiftBadge(shiftRes.data.shift_code, shiftNameMap[shiftRes.data.shift_code]) : null);
      setTodaySched(shiftRes.data || null);

      scheduleShiftReminders(serverNow, shiftRes.data || null, shiftDefinitions, attRes.data || null);

      const s = { hadir: 0, izin: 0, sakit: 0, alpha: 0, terlambat: 0 };
      // Absensi lembur di hari tanpa jadwal (shift_code NULL) TIDAK dihitung
      // sebagai hari hadir — kalau dihitung, alpha hari kerja lain bisa
      // tertutupi sehingga angkanya tampak lebih baik dari kenyataan.
      // Sama dengan aturan upsert_payroll_line di server.
      const scheduledDates = new Set((schedRes.data || []).map((x) => x.date));
      monthAttRes.data?.forEach(a => {
        const countsAsWorkday = a.shift_code === null
          ? scheduledDates.has(a.date)
          : true;
        if (!countsAsWorkday) return;
        if (a.attendance_status === 'terlambat') s.terlambat++;
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

  // Muat data saat halaman dibuka. Dipindah ke bawah deklarasi fetchData agar
  // urutan deklarasi benar (react-hooks/immutability).
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: T.bg }}>
      {fetchError ? (
        <div className="min-h-full flex items-center justify-center px-6">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-1">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="text-red-600 text-xs font-medium text-center max-w-[200px]">{fetchError}</div>
            <button onClick={retryFetchData}
              className="mt-3 px-6 py-2 bg-[#2F8BF8] hover:bg-[#1F74E0] text-white hero-card-bg text-xs font-semibold rounded-full transition-all duration-200 shadow-md">
              Coba Lagi
            </button>
          </div>
        </div>
      ) : (
        <div className="min-h-screen w-full font-sans pb-24">
          {/* HERO skeleton */}
          <div className="w-full rounded-b-[34px]"
            style={{ background: 'linear-gradient(150deg, #0B3FB8 0%, #1449D8 34%, #2F7BF0 68%, #3F93FD 100%)', paddingBottom: 74 }}>
            <div className="relative max-w-md mx-auto" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}>
              <div className="flex items-start justify-between gap-3 pl-4 pr-2">
                <div className="flex items-center gap-3 min-w-0">
                  <Skeleton dark width={46} height={46} radius={999} />
                  <div className="min-w-0" style={{ display: 'grid', gap: 7 }}>
                    <Skeleton dark width={92} height={9} />
                    <Skeleton dark width={148} height={15} />
                    <Skeleton dark width={108} height={9} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton dark width={36} height={36} radius={999} />
                  <Skeleton dark width={36} height={36} radius={999} />
                </div>
              </div>
              <div className="px-4 mt-3">
                <Skeleton dark width={88} height={20} radius={999} />
              </div>
              <div className="mx-[14px] mt-3 bg-white rounded-[26px] grid"
                style={{ gridTemplateColumns: '1.08fr 0.92fr', marginBottom: -130, boxShadow: '0 18px 40px rgba(9,33,84,0.20)' }}>
                <div className="min-w-0" style={{ padding: '18px 13px 14px 15px', display: 'grid', gap: 12, alignContent: 'start' }}>
                  <Skeleton width={128} height={30} />
                  <Skeleton width={150} height={10} />
                  <Skeleton width="100%" height={42} radius={999} />
                </div>
                <div className="min-w-0" style={{ padding: '18px 15px 14px 13px', borderLeft: '1px solid #EDF1F7', display: 'grid', gap: 12, alignContent: 'start' }}>
                  <Skeleton width="100%" height={30} radius={999} />
                  <div className="grid grid-cols-2" style={{ gap: '10px 8px' }}>
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} style={{ display: 'grid', gap: 6 }}>
                        <Skeleton width={26} height={14} />
                        <Skeleton width={40} height={8} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* KONTEN skeleton */}
          <div className="relative max-w-md mx-auto px-4" style={{ paddingTop: 150, display: 'grid', gap: 16 }}>
            <Skeleton width={128} height={14} />
            <Skeleton width="100%" height={92} radius={22} />
            <Skeleton width={104} height={14} />
            <div className="grid grid-cols-4" style={{ gap: 10 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ display: 'grid', justifyItems: 'center', gap: 8 }}>
                  <Skeleton width={48} height={48} radius={16} />
                  <Skeleton width={38} height={8} />
                </div>
              ))}
            </div>
            <Skeleton width="100%" height={72} radius={20} />
          </div>
        </div>
      )}
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
      {/* HERO — header biru dengan gelombang berlapis. Kartu ringkasan menimpa
          tepi bawah header. Section Status Hari Ini & Menu sengaja tidak diubah. */}
      <div className="w-full rounded-b-[34px] text-white hero-card-bg emp-hero-drop relative"
        style={{ background: 'linear-gradient(150deg, #0B3FB8 0%, #1449D8 34%, #2F7BF0 68%, #3F93FD 100%)', paddingBottom: 74 }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-b-[34px]" aria-hidden="true">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 390 230" preserveAspectRatio="none" fill="none">
            <defs>
              <linearGradient id="empWaveTop" x1="390" y1="0" x2="110" y2="220" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7FCBFF" stopOpacity="0.72" />
                <stop offset="1" stopColor="#2F7BF0" stopOpacity="0.10" />
              </linearGradient>
              <linearGradient id="empWaveMid" x1="390" y1="50" x2="170" y2="225" gradientUnits="userSpaceOnUse">
                <stop stopColor="#9EDFFF" stopOpacity="0.62" />
                <stop offset="1" stopColor="#3B9BFB" stopOpacity="0.06" />
              </linearGradient>
              <linearGradient id="empWaveEdge" x1="390" y1="0" x2="100" y2="210" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FFFFFF" stopOpacity="0.30" />
                <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M390 0V172C330 84 245 30 148 0Z" fill="url(#empWaveTop)" />
            <path d="M390 60C305 108 258 160 236 230H390Z" fill="url(#empWaveMid)" />
            <path d="M390 130C348 152 316 182 298 230H390Z" fill="#7ED4FF" opacity="0.38" />
            <path d="M390 172C330 84 245 30 148 0" stroke="url(#empWaveEdge)" strokeWidth="2" />
            <path d="M390 60C305 108 258 160 236 230" stroke="url(#empWaveEdge)" strokeWidth="1.6" />
          </svg>
        </div>

        <div className="relative max-w-md mx-auto" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}>
          <div className="flex items-start justify-between gap-3 pl-4 pr-2">
            <div className="flex items-center gap-3 min-w-0">
              <ProfileAvatarButton user={user} initials={user?.full_name?.charAt(0)?.toUpperCase() || "R"} variant="hero" />
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-white/90">{getGreeting(serverTime.getHours())},</div>
                <div className="text-[17px] font-extrabold tracking-tight leading-tight text-white">{user?.full_name || "Rama Hudson"}</div>
                <div className="flex items-center gap-1 text-[11px] text-white/85 mt-0.5 text-white">
                  <span className="truncate min-w-0">{[user?.role, user?.position].filter(Boolean).join(" · ") || "Pegawai"}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-0 shrink-0">
              <Link to="/employee/notifications" aria-label="Pengumuman"
                className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all">
                <Bell size={20} className="text-white" />
                {announcements.some((a) => !ackedIds.has(a.id)) && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full" />
                )}
              </Link>
              <button onClick={handleLogout} disabled={loggingOut} aria-label="Keluar"
                className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all disabled:opacity-60">
                {loggingOut
                  ? <div className="w-5 h-5 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                  : <LogOut size={20} className="text-white" />}
              </button>
            </div>
          </div>

          {/* KARTU DI HEADER */}
          <div className="mx-[14px] mt-3 bg-white rounded-[26px] grid"
            style={{ gridTemplateColumns: '1.08fr 0.92fr', marginBottom: -130, boxShadow: '0 18px 40px rgba(9,33,84,0.20)', color: T.text }}>
            <div className="min-w-0" style={{ padding: '15px 13px 14px 15px' }}>
              <div className="text-[31px] font-extrabold leading-none tracking-[-0.045em] tabular-nums"
                style={{ color: T.text }}>
                {serverTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
              <div className="text-[9.5px] font-semibold mt-1.5" style={{ color: T.textMuted }}>
                {serverTime.toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <Link to="/employee/attendance"
                className="mt-3 w-full h-[42px] rounded-full flex items-center justify-center gap-1 whitespace-nowrap text-white text-[11px] font-extrabold active:scale-[0.98] transition"
                style={{ background: 'linear-gradient(135deg, #2F8BF8 0%, #1F6FE8 100%)', boxShadow: '0 4px 10px rgba(47,139,248,0.25)', padding: '0 6px' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                  <path d="M12 4.5a7.5 7.5 0 0 0-7.5 7.5v3" /><path d="M12 4.5A7.5 7.5 0 0 1 19.5 12v4.5" />
                  <path d="M12 8a4 4 0 0 0-4 4v5" /><path d="M12 8a4 4 0 0 1 4 4v5.5" />
                  <path d="M12 11.5a1.2 1.2 0 0 0-1.2 1.2v6" /><path d="M12 11.5a1.2 1.2 0 0 1 1.2 1.2v6.5" />
                </svg>
                Absen Sekarang
                <ArrowRight size={13} className="shrink-0" />
              </Link>
              {shift ? (
                <span className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9.5px] font-bold max-w-full"
                  style={{ background: '#E8F1FE', color: '#1F6FE8' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                    <circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 1.8" />
                  </svg>
                  <span className="truncate">{shift}</span>
                </span>
              ) : (
                <span className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9.5px] font-bold"
                  style={{ background: '#EEF2F8', color: '#475569' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                    <circle cx="12" cy="12" r="8.5" /><path d="M12 8v4" /><path d="M12 15.5h.01" />
                  </svg>
                  Shift: Tidak ada
                </span>
              )}
            </div>

            <div className="min-w-0" style={{ padding: '15px 15px 14px 13px', borderLeft: '1px solid #EDF1F7' }}>
              <Link to="/employee/history"
                className="w-full h-[30px] rounded-full flex items-center gap-1 px-2 text-[10px] font-extrabold whitespace-nowrap"
                style={{ background: '#E8F1FE', color: '#1F6FE8' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                  <rect x="3" y="4.5" width="18" height="17" rx="3.5" /><path d="M16 2.5v4M8 2.5v4M3 10h18" />
                </svg>
                Status Bulan Ini
                <ChevronRight size={12} className="ml-auto shrink-0" />
              </Link>
              <div className="grid grid-cols-2 mt-1.5">
                {[
                  { label: 'Hadir', value: stats.hadir, color: '#10B981' },
                  { label: 'Terlambat', value: stats.terlambat || 0, color: '#F59E0B' },
                  { label: 'Izin', value: stats.izin, color: '#7C5CE0' },
                  { label: 'Sakit', value: stats.sakit, color: '#94A3B8' },
                ].map((item, i) => (
                  <div key={item.label} style={{
                    padding: '6px 0 2px 7px',
                    borderTop: i >= 2 ? '1px solid #EDF1F7' : 'none',
                    borderLeft: i % 2 === 1 ? '1px solid #EDF1F7' : 'none',
                  }}>
                    <div className="flex items-center gap-1 text-[9px] font-semibold" style={{ color: T.textSec }}>
                      <span className="inline-block rounded-full shrink-0" style={{ width: 7, height: 7, background: item.color }} />
                      {item.label}
                    </div>
                    <div className="text-[14px] font-extrabold tracking-tight mt-0.5" style={{ color: T.text }}>
                      {item.value}<span className="text-[9px] font-bold ml-0.5" style={{ color: T.textSec }}> Hari</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div aria-hidden="true" style={{ height: 40 }} />

      <div className="max-w-md mx-auto space-y-6 p-4 mt-6">
        {/* SECTION TITLE: Status hari ini — bar + judul, pola sama dengan header "Menu".
            emp-status-title: judul memudar halus (tanpa membesar). */}
        <div className="emp-status-title flex items-center gap-3 mb-4">
          <div>
            <div className="text-lg font-extrabold tracking-tight" style={{ color: T.text }}>Status hari ini</div>
            <div className="text-[10px] mt-0.5 font-normal" style={{ color: T.textMuted }}>Pantau waktu kehadiran anda</div>
          </div>
        </div>

        {/* 2 CARDS: MASUK & PULANG
            emp-status-cards: kartu muncul timbul (naik + membesar dari 93%). */}
        <div className="emp-status-cards grid grid-cols-2 gap-3">
          {/* Status non-hadir (izin/sakit) → tampil status besar, bukan jam */}
          {(() => {
            const st = todayAttendance?.attendance_status;
            if (st !== "izin" && st !== "sakit") return null;
            const word = st === "izin" ? "IZIN" : "SAKIT";
            const badge = st === "izin" ? "Izin Disetujui" : "Sakit (Tidak Dipotong)";
            return (
              <>
                <div className="rounded-3xl p-5 relative overflow-hidden shadow-lg text-white hero-card-bg"
                  style={{ background: '#000000', boxShadow: '0 6px 20px rgba(0,0,0,0.2)' }}>
                  <div className="text-[9px] uppercase tracking-[0.2em] font-semibold mb-3 flex items-center gap-1.5">
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
                  <div className="text-[9px] uppercase tracking-[0.2em] font-semibold mb-3 flex items-center gap-1.5">
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
                style={{ background: '#000000', boxShadow: '0 6px 20px rgba(0,0,0,0.2)' }}>
                <div className="text-[9px] uppercase tracking-[0.2em] font-semibold mb-3 flex items-center gap-1.5">
                  <Sun size={13} /> Masuk
                </div>
                <div className="text-[22px] font-extrabold leading-none tracking-tight mb-2">Koreksi</div>
                <div className="inline-flex items-center gap-1.5 text-[9px] font-semibold bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.25)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                  <span className="opacity-90">Disetujui</span>
                </div>
              </div>
              <div className="hero-card-bg rounded-3xl p-5 relative overflow-hidden shadow-lg shadow-black/20"
                style={{ background: '#000000', color: '#FFFFFF', boxShadow: '0 6px 20px rgba(0,0,0,0.2)' }}>
                <div className="text-[9px] uppercase tracking-[0.2em] font-semibold mb-3 flex items-center gap-1.5">
                  <Sunset size={13} /> Pulang
                </div>
                <div className="text-[22px] font-extrabold leading-none tracking-tight mb-2">Koreksi</div>
                <div className="inline-flex items-center gap-1.5 text-[9px] font-semibold bg-white/10 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Tidak perlu absen
                </div>
              </div>
            </>
          )}
          {!(todayAttendance?.attendance_status === "izin" || todayAttendance?.attendance_status === "sakit") && !isSanggahToday && (
          <>
          {/* MASUK — solid black, senada dengan card Pulang */}
          <div className="rounded-3xl p-5 relative overflow-hidden shadow-lg text-white hero-card-bg"
            style={{ background: '#000000', boxShadow: '0 6px 20px rgba(0,0,0,0.2)' }}>
            <div className="text-[9px] uppercase tracking-[0.2em] font-semibold mb-3 flex items-center gap-1.5">
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
                <div className="text-[20px] font-bold leading-none opacity-50">--:--</div>
              </>
            )}
          </div>

          {/* PULANG — solid black for high-contrast readability */}
          <div className="rounded-3xl p-5 relative overflow-hidden shadow-lg shadow-black/20"
            style={{ background: '#000000', color: '#FFFFFF', boxShadow: '0 6px 20px rgba(0,0,0,0.2)' }}>
            <div className="text-[9px] uppercase tracking-[0.2em] font-semibold mb-3 flex items-center gap-1.5">
              <Sunset size={13} /> Pulang
            </div>
            {todayAttendance?.clock_out_time ? (
              <>
                <div className="text-[28px] font-extrabold leading-none tracking-tight mb-2">
                  {formatTime(todayAttendance.clock_out_time)}
                </div>
                {(() => {
                  // Pulang lebih awal dari jam selesai shift → tandai di card hitam
                  // (tanpa toleransi, konsisten dengan aturan potongan pulang cepat)
                  const todayKey = getWitaDateKey(serverTime);
                  const earlyInfo = getEarlyLeaveInfo(
                    todayAttendance.clock_out_time,
                    todayKey,
                    getShiftDefinition(shiftDefinitions, { date: todayKey, shift_code: todaySched?.shift_code }),
                    0
                  );
                  return (
                    <div className="inline-flex items-center gap-1.5 text-[9px] font-semibold bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.25)' }}>
                      <span className={`w-1.5 h-1.5 rounded-full ${earlyInfo ? "bg-amber-300" : "bg-emerald-300"}`} />
                      <span className="opacity-90">{earlyInfo ? `Pulang Cepat ${formatDuration(earlyInfo.earlyMinutes)}` : "Selesai"}</span>
                    </div>
                  );
                })()}
              </>
            ) : (
              <>
                <div className="text-base font-bold leading-none mb-2" style={{ color: '#FFFFFF' }}>Belum Absen</div>
                <div className="text-[20px] font-bold leading-none opacity-50">--:--</div>
              </>
            )}
          </div>
          </>
          )}
        </div>

        {/* MENU UTAMA — judul + grid 3 kolom (Slip Gaji & Profil turun ke baris 2) */}
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-lg font-extrabold tracking-tight" style={{ color: T.text }}>Menu</h3>
        </div>
        <div className="grid grid-cols-3 gap-x-2 gap-y-4">
          {[
            { to: "/employee/leave", icon: ClipboardList, label: "Izin/Sakit" },
            { to: "/employee/sanggah", icon: MessageSquareWarning, label: "Koreksi" },
            { to: "/employee/overtime", icon: Clock, label: "Lembur" },
            { to: "/employee/history", icon: History, label: "Riwayat Kehadiran" },
            { to: "/employee/notifications", icon: Bell, label: "Pengumuman", badge: true },
            ...(payrollOn ? [{ to: "/employee/salary", icon: Wallet, label: "Slip Gaji" }] : []),
            { to: "/employee/profile", icon: User, label: "Profil" },
          ].map((item) => (
            <Link key={item.to} to={item.to} className="flex flex-col items-center gap-2.5 py-1 group">
              <span className="hero-card-bg relative w-16 h-16 rounded-[22px] flex items-center justify-center shadow-[0_6px_16px_rgba(47,139,248,0.28)] transition-transform group-hover:-translate-y-0.5 group-active:scale-95"
                style={{ background: 'linear-gradient(135deg, #2F8BF8 0%, #1F74E0 100%)' }}>
                <item.icon size={30} strokeWidth={2} className="text-white" />
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

        {/* PENGUMUMAN — section baru di bawah Menu; maksimal 3 pengumuman aktif.
            Tautan "Lihat Semua" menuju halaman Pengumuman pegawai. */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-lg font-extrabold tracking-tight" style={{ color: T.text }}>Pengumuman</h3>
            <Link to="/employee/notifications"
              className="inline-flex items-center gap-0.5 text-[12px] font-extrabold shrink-0"
              style={{ color: "#1859C9" }}>
              Lihat Semua
              <ChevronRight size={14} />
            </Link>
          </div>

          {announcements.length === 0 ? (
            <div className="text-center px-4 py-6">
              <span className="w-11 h-11 rounded-full grid place-items-center mx-auto mb-2" style={{ background: "#EEF6FF" }}>
                <Bell size={20} style={{ color: "#2F8BF8" }} />
              </span>
              <p className="m-0 text-[13px] font-extrabold text-slate-700">Belum ada pengumuman</p>
              <p className="m-0 mt-1 text-[12px] text-slate-600">Pengumuman dari admin instansi akan muncul di sini.</p>
            </div>
          ) : (
            <div>
              {announcements.slice(0, 3).map((a, i) => {
                const isRead = ackedIds.has(a.id);
                const prio = a.priority === "urgent"
                  ? { label: "Urgent", bg: "#FFE4E6", color: "#9F1239" }
                  : a.priority === "penting"
                    ? { label: "Penting", bg: "#FEF3C7", color: "#92400E" }
                    : null;
                const annDate = new Date(a.published_at || a.created_at).toLocaleDateString("id-ID", {
                  day: "numeric", month: "short", year: "numeric",
                });
                return (
                  <Link key={a.id} to="/employee/notifications"
                    className="flex items-start gap-[11px] py-3 active:opacity-80 transition-opacity"
                    style={{ borderTop: i ? "1px solid #F1F5F9" : "none" }}>
                    <span className="w-[7px] h-[7px] rounded-full mt-1.5 shrink-0"
                      style={{ background: isRead ? "#E2E8F0" : "#2F8BF8" }} />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-start gap-2 min-w-0">
                        <b className="text-[13px] font-extrabold leading-snug line-clamp-2 min-w-0"
                          style={{ color: isRead ? "#0F172A" : "#1859C9", letterSpacing: "-0.005em" }}>
                          {a.title}
                        </b>
                        {prio && (
                          <span className="flex-none text-[11px] font-extrabold rounded-full px-2 py-0.5"
                            style={{ background: prio.bg, color: prio.color }}>
                            {prio.label}
                          </span>
                        )}
                      </span>
                      <span className="block text-[13px] mt-1 line-clamp-2"
                        style={{ color: "#4A5A70", lineHeight: 1.55 }}>
                        {a.content}
                      </span>
                      <span className="block mt-1.5 text-[12px] font-bold" style={{ color: "#475569" }}>
                        {annDate}
                      </span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 mt-1" style={{ color: "#CBD5E1" }} />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Shift Reminder Banner — check-in */}
        {(() => {
          const r = getShiftReminderInfo(serverTime, todaySched, shiftDefinitions, todayAttendance);
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
          const rEnd = getShiftEndReminderInfo(serverTime, todaySched, shiftDefinitions, todayAttendance, yesterdaySched);
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
