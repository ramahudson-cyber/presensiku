import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { getWitaDateKey } from "../../lib/shiftTime";
import { getShiftReminderInfo, getShiftEndReminderInfo, getUnreadCount, reminderToastKey, reminderToastEndKey } from "../../lib/notificationReminder";
import { Bell, CalendarCheck, ArrowLeft, Check, CheckCheck, Clock, Megaphone, ChevronRight, Sunset } from "lucide-react";
import { toast } from "react-toastify";
import { scheduleShiftReminders, subscribeAnnouncementRealtime, notifyNewAnnouncement } from "../../services/pushNotificationService";
import usePullToRefresh from "../../hooks/usePullToRefresh";
import PullToRefreshIndicator from "../../components/PullToRefreshIndicator";
import BottomSheet from "../../components/BottomSheet";

// Badge prioritas — konsisten dengan halaman admin
const PRIORITY_BADGE = {
  normal:  { label: "Normal",  cls: "bg-slate-100 text-slate-600" },
  penting: { label: "Penting", cls: "bg-amber-100 text-amber-700" },
  urgent:  { label: "Urgent",  cls: "bg-rose-100 text-rose-700" },
};
const fmtAnnDate = (iso) => iso
  ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
  : "-";

export default function EmployeeNotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [serverTime, setServerTime] = useState(new Date());
  const [todaySchedule, setTodaySchedule] = useState(null);
  const [shiftDefinitions, setShiftDefinitions] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [ackedIds, setAckedIds] = useState(new Set());
  const [acking, setAcking] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    fetchData();
    const tick = setInterval(() => setServerTime((p) => new Date(p.getTime() + 1000)), 1000);
    return () => clearInterval(tick);
  }, []);

  // Pengumuman baru masuk detik itu juga (realtime)
  useEffect(() => {
    const unsubscribe = subscribeAnnouncementRealtime((ann) => {
      notifyNewAnnouncement(ann);
      setAnnouncements((prev) => [ann, ...prev]);
    });
    return unsubscribe;
  }, []);

  const fetchData = async () => {
    try {
      const [timeRes, annRes, ackRes, schedRes, shiftRes] = await Promise.all([
        supabase.rpc("get_server_time"),
        supabase.from("announcements").select("*").eq("is_active", true)
          .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
          .order("created_at", { ascending: false }),
        supabase.from("announcement_acks").select("announcement_id").eq("user_id", user.id),
        supabase.from("employee_schedules").select("shift_code").eq("user_id", user.id)
          .eq("date", getWitaDateKey()).maybeSingle(),
        supabase.from("shift_schedules")
          .select("shift_code, day_of_week, start_time, end_time, is_working_day"),
      ]);

      if (timeRes.data) setServerTime(new Date(timeRes.data));
      setAnnouncements(annRes.data || []);
      setAckedIds(new Set((ackRes.data || []).map((r) => r.announcement_id)));
      setTodaySchedule(schedRes.data || null);
      setShiftDefinitions(shiftRes.data || []);
      scheduleShiftReminders(
        timeRes.data ? new Date(timeRes.data) : new Date(),
        schedRes.data || null,
        shiftRes.data || []
      );
    } catch (err) {
      console.error("❌ Gagal memuat notifikasi:", err);
      toast.error("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  const reminder = getShiftReminderInfo(serverTime, todaySchedule, shiftDefinitions);
  const endReminder = getShiftEndReminderInfo(serverTime, todaySchedule, shiftDefinitions);
  const unreadCount = getUnreadCount(announcements, ackedIds);
  const today = getWitaDateKey(serverTime);

  const { pullDistance, isRefreshing } = usePullToRefresh(fetchData);

  const handleMarkRead = async (announcementId) => {
    if (ackedIds.has(announcementId)) return;
    setAcking(announcementId);
    try {
      const { error } = await supabase.from("announcement_acks").insert({
        user_id: user.id,
        announcement_id: announcementId,
      });
      if (error) throw error;
      setAckedIds((prev) => new Set(prev).add(announcementId));
    } catch (err) {
      toast.error("Gagal menandai: " + err.message);
    } finally {
      setAcking(null);
    }
  };

  const handleMarkAllRead = async () => {
    const unreadIds = announcements.filter((a) => !ackedIds.has(a.id));
    if (unreadIds.length === 0) return;
    try {
      const { error } = await supabase.from("announcement_acks").insert(
        unreadIds.map((a) => ({ user_id: user.id, announcement_id: a.id }))
      );
      if (error) throw error;
      setAckedIds(new Set(announcements.map((a) => a.id)));
      toast.success("Semua pengumuman ditandai sudah dibaca");
    } catch (err) {
      toast.error("Gagal: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen pb-20" style={{ background: "#F4F2FB" }}>
        <Clock size={20} className="animate-spin text-[#BF00FF]" />
      </div>
    );
  }

  const T = {
    bg: "#F4F2FB", surface: "#FFFFFF", border: "rgba(31,41,55,0.08)",
    div: "#F1F5F9", text: "#0F172A", textSec: "#475569", textMuted: "#94A3B8",
    sub: "#6B7280", accent: "#BF00FF",
  };

  return (
    <div className="min-h-screen w-full font-sans absolute top-0 left-0 right-0 pb-24" style={{ background: T.bg }}>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      {/* HEADER — pola Profil / Izin & Sakit */}
      <div className="pt-14 px-6">
        <div className="flex items-center justify-between mb-5">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm border hover:bg-gray-50 active:scale-95 transition-all" style={{ borderColor: T.border }}>
            <ArrowLeft size={16} style={{ color: T.text }} />
          </button>
          <div className="w-9 h-9 rounded-full bg-electric-violet/10 flex items-center justify-center">
            <Bell size={16} className="text-electric-violet" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[17px] font-bold tracking-tight" style={{ color: T.text }}>Notifikasi</h1>
            <p className="text-xs mt-0.5" style={{ color: T.textMuted }}>
              {unreadCount > 0 ? `${unreadCount} belum dibaca` : "Semua sudah dibaca"}
            </p>
          </div>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead}
              className="text-xs bg-electric-violet/10 hover:bg-electric-violet/20 text-electric-violet rounded-full px-3 py-1.5 transition-all flex items-center gap-1 font-semibold">
              <CheckCheck size={12} /> Baca Semua
            </button>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 mt-6 space-y-4">
        {/* Reminder Card — check-in */}
        {reminder.show && (
          <div className="rounded-3xl p-5 relative overflow-hidden border"
            style={{
              background: "linear-gradient(135deg, #ECFDF5, #D1FAE5)",
              borderColor: "rgba(16,185,129,0.2)",
            }}>
            <div className="flex gap-3 items-start">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
                <CalendarCheck size={18} className="text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-emerald-800 text-sm">Pengingat Absen Masuk</h3>
                <p className="text-emerald-700 text-xs mt-1 leading-relaxed">{reminder.message}</p>
                <button onClick={() => navigate("/employee/attendance")}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-xs font-medium transition-all active:scale-95">
                  Absen Sekarang <ChevronRight size={12} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reminder Card — check-out */}
        {endReminder.show && (
          <div className="rounded-3xl p-5 relative overflow-hidden border"
            style={{
              background: "linear-gradient(135deg, #FEF3C7, #FDE68A)",
              borderColor: "rgba(245,158,11,0.2)",
            }}>
            <div className="flex gap-3 items-start">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                <Sunset size={18} className="text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-amber-800 text-sm">Pengingat Absen Pulang</h3>
                <p className="text-amber-700 text-xs mt-1 leading-relaxed">{endReminder.message}</p>
                <button onClick={() => navigate("/employee/attendance")}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-full text-xs font-medium transition-all active:scale-95">
                  Absen Pulang <ChevronRight size={12} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Daftar Pengumuman */}
        <div className="rounded-3xl overflow-hidden border bg-white"
          style={{ borderColor: T.border }}>
          <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: T.border }}>
            <Megaphone size={14} className="text-[#BF00FF]" />
            <h2 className="font-semibold text-sm" style={{ color: T.text }}>Pengumuman</h2>
          </div>
          {announcements.length === 0 ? (
            <div className="py-10 text-center" style={{ color: T.textMuted }}>
              <Bell size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs">Tidak ada pengumuman</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: T.border }}>
              {announcements.map((a) => {
                const isRead = ackedIds.has(a.id);
                const isAcking = acking === a.id;
                return (
                  <div key={a.id}
                    className={`px-5 py-3.5 transition-all cursor-pointer ${isRead ? "" : "bg-[#F5F0FF]"} hover:bg-[#F0EDFF] active:bg-[#EBE5FF]`}
                    onClick={() => { handleMarkRead(a.id); setDetail(a); }}
                  >
                    <div className="flex gap-3 items-start">
                      <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${isRead ? "bg-transparent" : "bg-[#BF00FF]"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 justify-between">
                          <h4 className={`text-xs font-semibold truncate ${isRead ? "" : "text-[#BF00FF]"}`}
                            style={{ color: isRead ? T.text : "#BF00FF" }}>
                            {a.title}
                          </h4>
                          {!isRead && (
                            <button onClick={(e) => { e.stopPropagation(); handleMarkRead(a.id); }}
                              disabled={isAcking}
                              className="shrink-0 p-1 rounded-full hover:bg-white/50 transition-all disabled:opacity-50"
                              title="Tandai sudah dibaca">
                              <Check size={12} style={{ color: T.textMuted }} />
                            </button>
                          )}
                        </div>
                        <span className={`inline-block text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full mt-1 ${(PRIORITY_BADGE[a.priority] || PRIORITY_BADGE.normal).cls}`}>
                          {(PRIORITY_BADGE[a.priority] || PRIORITY_BADGE.normal).label}
                        </span>
                        <p className="text-xs mt-1 line-clamp-2" style={{ color: T.textSec }}>{a.content}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail pengumuman — isi penuh + prioritas */}
      <BottomSheet open={!!detail} onClose={() => setDetail(null)} title="Detail Pengumuman" snap="auto">
        {detail && (
          <div className="pb-2">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${(PRIORITY_BADGE[detail.priority] || PRIORITY_BADGE.normal).cls}`}>
                {(PRIORITY_BADGE[detail.priority] || PRIORITY_BADGE.normal).label}
              </span>
              <span className="text-[10px] text-slate-400 inline-flex items-center gap-1">
                <Clock size={10} /> {fmtAnnDate(detail.published_at || detail.created_at)}
              </span>
            </div>
            <h3 className="text-sm font-bold leading-snug mb-3" style={{ color: T.text }}>{detail.title}</h3>
            <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: T.textSec }}>{detail.content}</p>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
