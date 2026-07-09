import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "react-toastify";
import {
  Clock, Save, RefreshCw, Sun, Moon, CloudSun,
  Sunset, CheckCircle2, XCircle, Info, ArrowRightLeft
} from "lucide-react";

const DAY_NAMES = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

const add5min = t => {
  const [h, m] = (t || "00:00").split(":").map(Number);
  let total = h * 60 + m + 5;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

const SHIFT_META = {
  PG: { icon: Sun, color: "text-green-yellow", bg: "bg-green-yellow/15", ring: "ring-green-yellow/30" },
  SR: { icon: Sunset, color: "text-green-yellow", bg: "bg-green-yellow/15", ring: "ring-green-yellow/30" },
  SI: { icon: CloudSun, color: "text-sky-400", bg: "bg-sky-500/15", ring: "ring-sky-500/30" },
  ML: { icon: Moon, color: "text-violet-400", bg: "bg-violet-500/15", ring: "ring-violet-500/30" },
};

export default function TabShift() {
  const [shifts, setShifts] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: s }, { data: sc }] = await Promise.all([
        supabase.from("shifts").select("*").order("code"),
        supabase.from("shift_schedules").select("*").order("day_of_week"),
      ]);
      setShifts(s || []);
      const patched = (sc || []).map(item => ({
        ...item,
        crosses_midnight: item.shift_code === "ML" ? true : item.crosses_midnight,
      }));
      const needsPatch = patched.some(
        (item, idx) => item.crosses_midnight !== (sc || [])[idx]?.crosses_midnight
      );
      setSchedules(patched);
      if (needsPatch) setDirty(true);
    } catch { toast.error("Gagal muat data"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const update = (code, day, field, value) => {
    setDirty(true);
    setSchedules(prev => {
      const existing = prev.find(s => s.shift_code === code && s.day_of_week === day);
      if (!existing) {
        return [...prev, {
          shift_code: code,
          day_of_week: day,
          is_working_day: true,
          start_time: "08:00",
          end_time: "17:00",
          latest_check_in: add5min("08:00"),
          crosses_midnight: code === "ML",
        }];
      }
      return prev.map(s => {
        if (s.shift_code === code && s.day_of_week === day) {
          const updated = { ...s, [field]: value };
          if (field === "start_time") updated.latest_check_in = add5min(value);
          if (field === "is_working_day" && value === true) {
            updated.start_time = "08:00";
            updated.end_time = "17:00";
            updated.latest_check_in = add5min("08:00");
          }
          return updated;
        }
        return s;
      });
    });
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("shift_schedules").upsert(
        schedules.map(s => ({
          shift_code: s.shift_code,
          day_of_week: s.day_of_week,
          start_time: s.is_working_day ? s.start_time : "00:00",
          end_time: s.is_working_day ? s.end_time : "00:00",
          latest_check_in: s.is_working_day ? add5min(s.start_time) : "00:00",
          crosses_midnight: s.crosses_midnight || false,
          is_working_day: s.is_working_day,
        })),
        { onConflict: "shift_code,day_of_week" }
      );
      if (error) throw error;
      toast.success("Jadwal shift disimpan");
      setDirty(false);
    } catch (err) { toast.error("Gagal: " + err.message); }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <RefreshCw size={24} className="animate-spin text-periwinkle-glow" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-pure-white">Kelola Shift</h2>
          <p className="text-sm text-slate-mist mt-0.5">Atur jam kerja setiap shift per hari</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="bg-electric-violet text-pure-white p-2 rounded-full hover:brightness-110 active:brightness-90 transition-all duration-200">
            <RefreshCw size={16} />
          </button>
          <button onClick={saveAll} disabled={saving || !dirty}
            className={`flex items-center gap-2.5 px-4 py-2.5 bg-electric-violet text-pure-white rounded-full text-sm font-medium transition-all duration-200
              ${dirty
                ? "hover:brightness-110 active:brightness-90"
                : "opacity-40 cursor-not-allowed"}`}>
            <Save size={15} /> {saving ? "Menyimpan..." : dirty ? "Simpan Perubahan" : "Tersimpan"}
          </button>
        </div>
      </div>

      {/* Shift Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {shifts.map(shift => {
          const meta = SHIFT_META[shift.code];
          const Icon = meta?.icon || Clock;
          const shiftScheds = schedules.filter(s => s.shift_code === shift.code);

          return (
            <div key={shift.code} className="design-card overflow-hidden hover:shadow-lg transition-all">
              {/* Card Header */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06] bg-gradient-to-r from-white/[0.03] to-transparent">
                <div className={`w-10 h-10 rounded-2xl ${meta?.bg || "bg-onyx"} flex items-center justify-center ring-1 ${meta?.ring || "ring-white/10"}`}>
                  <Icon size={20} className={meta?.color || "text-periwinkle-glow"} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-pure-white">{shift.name}</h3>
                  <p className="text-[10px] text-slate-mist font-mono">{shift.code}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${meta?.bg || "bg-onyx"} ${meta?.color || "text-slate-mist"}`}>
                  {shiftScheds.filter(s => s.is_working_day).length}/7 hari
                </span>
              </div>

              {/* Schedule Rows */}
              <div className="p-3 space-y-1">
                {DAY_NAMES.map((name, i) => {
                  const sched = shiftScheds.find(s => s.day_of_week === i);
                  const working = sched?.is_working_day;
                  return (
                    <div key={i} className={`flex items-center gap-2 p-2 rounded-3xl transition-all ${working ? "bg-onyx hover:bg-white/[0.06]" : "opacity-50"}`}>
                      <span className="w-14 text-[10px] font-semibold text-slate-mist shrink-0">{name}</span>
                      {working ? (
                        <>
                          <input type="time" value={sched?.start_time || ""}
                            onChange={e => update(shift.code, i, "start_time", e.target.value)}
                            className="flex-1 text-[11px] bg-onyx border border-white/[0.06] rounded-2xl px-2 py-1.5 text-pure-white focus:outline-none focus:ring-2 focus:ring-electric-violet/50" />
                          <span className="text-[10px] text-slate-mist shrink-0">—</span>
                          <input type="time" value={sched?.end_time || ""}
                            onChange={e => update(shift.code, i, "end_time", e.target.value)}
                            className="flex-1 text-[11px] bg-onyx border border-white/[0.06] rounded-2xl px-2 py-1.5 text-pure-white focus:outline-none focus:ring-2 focus:ring-electric-violet/50" />
                          <button onClick={() => update(shift.code, i, "crosses_midnight", !sched?.crosses_midnight)}
                            className={`p-1.5 rounded-full transition-all shrink-0 ${
                              sched?.crosses_midnight
                                ? "bg-violet-500/20 text-violet-400"
                                : "bg-white/5 text-slate-mist hover:bg-white/10"
                            }`}
                            title={sched?.crosses_midnight ? "Lintas malam" : "Tidak lintas malam"}>
                            <ArrowRightLeft size={13} />
                          </button>
                          <button onClick={() => update(shift.code, i, "is_working_day", false)}
                            className="p-1.5 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all shrink-0">
                            <XCircle size={13} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-[10px] text-slate-mist italic">Libur</span>
                          <button onClick={() => update(shift.code, i, "is_working_day", true)}
                            className="p-1.5 rounded-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all shrink-0">
                            <CheckCircle2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info */}
      <div className="flex items-center gap-2 p-3.5 rounded-xl bg-electric-violet/5 border border-electric-violet/10 text-[11px] text-slate-mist">
        <Info size={13} className="text-periwinkle-glow shrink-0" />
        <p>Klik <XCircle size={11} className="inline text-red-400" /> untuk libur, <CheckCircle2 size={11} className="inline text-emerald-400" /> untuk aktifkan. Jangan lupa <strong className="text-periwinkle-glow">Simpan Perubahan</strong> setelah edit.</p>
      </div>
    </div>
  );
}
