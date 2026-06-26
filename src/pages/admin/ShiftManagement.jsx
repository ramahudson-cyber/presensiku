import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "react-toastify";
import {
  Clock, Save, RefreshCw, Sun, Moon, CloudSun,
  Sunset, CheckCircle2, XCircle, Edit3
} from "lucide-react";

const DAY_NAMES = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

const SHIFT_ICONS = {
  PG: { icon: Sun, color: "text-amber-400" },
  SR: { icon: Sunset, color: "text-orange-400" },
  SI: { icon: CloudSun, color: "text-sky-400" },
  ML: { icon: Moon, color: "text-violet-400" },
};

const cardBase = "bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl transition-all";
const inputBase = "w-full px-3 py-2 text-sm rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all";
const labelBase = "block text-xs font-medium text-violet-100/70 mb-1.5 uppercase tracking-wider";
const btnPrimary = "flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-violet-900/30 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed";

function ShiftScheduleRow({ dayIndex, schedule, onChange }) {
  const isWorking = schedule?.is_working_day;
  return (
    <div className={`grid grid-cols-[80px_1fr_1fr_auto] gap-2 items-center p-2.5 rounded-xl transition-all ${isWorking ? "bg-white/[0.04]" : "bg-white/[0.02] opacity-60"}`}>
      <span className="text-xs font-semibold text-slate-300">{DAY_NAMES[dayIndex]}</span>
      {isWorking ? (
        <>
          <input type="time" value={schedule.start_time || ""}
            onChange={e => onChange(dayIndex, "start_time", e.target.value)}
            className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50" />
          <input type="time" value={schedule.end_time || ""}
            onChange={e => onChange(dayIndex, "end_time", e.target.value)}
            className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50" />
          <button onClick={() => onChange(dayIndex, "is_working_day", false)}
            className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all">
            <XCircle size={14} />
          </button>
        </>
      ) : (
        <>
          <span className="text-[11px] text-slate-500 italic col-span-2">Libur</span>
          <button onClick={() => onChange(dayIndex, "is_working_day", true)}
            className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all">
            <CheckCircle2 size={14} />
          </button>
        </>
      )}
    </div>
  );
}

function ShiftCard({ shift, schedules, onUpdateSchedule }) {
  const Icon = SHIFT_ICONS[shift.code]?.icon || Clock;
  const iconColor = SHIFT_ICONS[shift.code]?.color || "text-violet-400";

  return (
    <div className={`${cardBase} p-4 md:p-5 space-y-3`}>
      <div className="flex items-center gap-3 pb-3 border-b border-white/10">
        <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${iconColor}`}>
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white truncate">{shift.name}</h3>
          <p className="text-[10px] text-slate-400">Kode: {shift.code}</p>
        </div>
      </div>
      <div className="space-y-1">
        {DAY_NAMES.map((_, i) => {
          const sched = schedules?.find(s => s.day_of_week === i);
          return (
            <ShiftScheduleRow key={i} dayIndex={i} schedule={sched}
              onChange={(dayIndex, field, value) => onUpdateSchedule(shift.code, dayIndex, field, value)} />
          );
        })}
      </div>
    </div>
  );
}

export default function TabShift() {
  const [shifts, setShifts] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: s }, { data: sc }] = await Promise.all([
        supabase.from("shifts").select("*").order("code"),
        supabase.from("shift_schedules").select("*").order("day_of_week"),
      ]);
      setShifts(s || []);
      setSchedules(sc || []);
    } catch (err) {
      toast.error("Gagal memuat data shift");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleUpdateSchedule = async (shiftCode, dayIndex, field, value) => {
    // Optimistic update
    setSchedules(prev => prev.map(s => {
      if (s.shift_code === shiftCode && s.day_of_week === dayIndex) {
        return { ...s, [field]: value };
      }
      return s;
    }));
    // If toggling to working day, set default times
    if (field === "is_working_day" && value === true) {
      setSchedules(prev => prev.map(s => {
        if (s.shift_code === shiftCode && s.day_of_week === dayIndex) {
          return { ...s, start_time: "08:00", end_time: "17:00", latest_check_in: "08:05" };
        }
        return s;
      }));
    }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("shift_schedules")
        .upsert(schedules.map(s => ({
          shift_code: s.shift_code,
          day_of_week: s.day_of_week,
          start_time: s.is_working_day ? s.start_time : null,
          end_time: s.is_working_day ? s.end_time : null,
          latest_check_in: s.is_working_day ? (s.latest_check_in || "00:00") : "00:00",
          crosses_midnight: s.crosses_midnight || false,
          is_working_day: s.is_working_day,
        })), { onConflict: "shift_code,day_of_week" });

      if (error) throw error;
      toast.success("Jadwal shift berhasil disimpan");
    } catch (err) {
      toast.error("Gagal menyimpan: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <RefreshCw size={24} className="animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Kelola Shift</h2>
          <p className="text-sm text-slate-400">Atur jam kerja setiap shift per hari</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="p-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all">
            <RefreshCw size={16} />
          </button>
          <button onClick={saveAll} disabled={saving} className={btnPrimary}>
            <Save size={16} /> {saving ? "Menyimpan..." : "Simpan Semua"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {shifts.map(shift => (
          <ShiftCard key={shift.code} shift={shift}
            schedules={schedules.filter(s => s.shift_code === shift.code)}
            onUpdateSchedule={handleUpdateSchedule} />
        ))}
      </div>

      <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-xs text-slate-300">
        <p className="font-semibold text-amber-300 mb-1"> informasi</p>
        <p>Klik ikon <XCircle size={12} className="inline text-red-400" /> untuk menandai hari libur. Klik <CheckCircle2 size={12} className="inline text-emerald-400" /> untuk mengaktifkan kembali. Jangan lupa klik <strong>Simpan Semua</strong> setelah perubahan.</p>
      </div>
    </div>
  );
}
