import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "react-toastify";
import TimeSelect from "../../components/TimeSelect";
import Skeleton from "../../components/Skeleton";
import {
  Clock, Save, RefreshCw, Sun, Moon, CloudSun,
  Sunset, CheckCircle2, XCircle, Info, ArrowRightLeft
} from "lucide-react";

// Durasi shift minimum yang dianggap wajar. Shift 3 menit (mis. 00:55–00:58)
// membuat sistem menandai pegawai ALPHA palsu karena jadwal dianggap sudah
// selesai sejak dini hari, dan server menolak absen masuk/pulang.
const MIN_SHIFT_MINUTES = 60;
const MAX_SHIFT_MINUTES = 24 * 60;

// Hitung durasi (menit) sebuah slot shift. Lintas malam dihitung sampai besok.
const shiftDurationMinutes = (startTime, endTime, crossesMidnight) => {
  const parse = (t) => {
    const m = String(t || "").match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const h = Number(m[1]);
    const mi = Number(m[2]);
    if (h > 23 || mi > 59) return null;
    return h * 60 + mi;
  };
  const start = parse(startTime);
  const end = parse(endTime);
  if (start === null || end === null) return null;
  const delta = end - start;
  if (crossesMidnight || delta < 0) return delta + 1440;
  return delta;
};

const DAY_NAMES = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

// Tanpa toleransi telat: latest_check_in selalu sama dengan jam mulai
// (server juga memaksa hal yang sama lewat trigger shift_schedule_time_guard).
const sameAsStart = t => t || "00:00";

const SHIFT_META = {
  PG: { icon: Sun, color: "text-green-yellow", bg: "bg-green-yellow/15", ring: "ring-green-yellow/30" },
  SR: { icon: Sunset, color: "text-green-yellow", bg: "bg-green-yellow/15", ring: "ring-green-yellow/30" },
  SI: { icon: CloudSun, color: "text-sky-400", bg: "bg-sky-500/15", ring: "ring-sky-500/30" },
  ML: { icon: Moon, color: "text-blue-400", bg: "bg-blue-500/15", ring: "ring-blue-500/30" },
};

export default function TabShift() {
  const [shifts, setShifts] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  // Simpan per-kartu: kode shift yang punya perubahan belum tersimpan,
  // dan kode yang sedang diproses. Supaya admin tidak perlu scroll ke atas.
  const [dirtyCodes, setDirtyCodes] = useState(() => new Set());
  const [savingCode, setSavingCode] = useState(null);

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

  // Empat shift tetap bawaan sistem — dedupe bila ada baris ganda,
  // urut sesuai kode kanonik. Shift legacy non-sistem tidak ditampilkan.
  const canonicalShifts = (() => {
    const byCode = new Map();
    (shifts || []).forEach((s) => {
      if (!["PG", "SR", "SI", "ML"].includes(s.code)) return;
      const cur = byCode.get(s.code);
      if (!cur || (s.is_active && !cur.is_active)) byCode.set(s.code, s);
    });
    return ["PG", "SR", "SI", "ML"].map((c) => byCode.get(c)).filter(Boolean);
  })();

  const toggleActive = async (shift) => {
    const next = !shift.is_active;
    setShifts((prev) => prev.map((s) => (s.id === shift.id ? { ...s, is_active: next } : s)));
    const { error } = await supabase.from("shifts").update({ is_active: next }).eq("id", shift.id);
    if (error) {
      setShifts((prev) => prev.map((s) => (s.id === shift.id ? { ...s, is_active: shift.is_active } : s)));
      toast.error("Gagal mengubah status shift: " + error.message);
      return;
    }
    toast.success(`${shift.name} ${next ? "diaktifkan" : "dinonaktifkan"}`);
  };

  const update = (code, day, field, value) => {
    setDirty(true);
    setDirtyCodes(prev => new Set(prev).add(code));
    setSchedules(prev => {
      const existing = prev.find(s => s.shift_code === code && s.day_of_week === day);
      if (!existing) {
        const shift = shifts.find(item => item.code === code);
        return [...prev, {
          organization_id: shift?.organization_id,
          shift_code: code,
          day_of_week: day,
          is_working_day: true,
          start_time: "08:00",
          end_time: "17:00",
          latest_check_in: sameAsStart("08:00"),
          crosses_midnight: code === "ML",
        }];
      }
      return prev.map(s => {
        if (s.shift_code === code && s.day_of_week === day) {
          const updated = { ...s, [field]: value };
          if (field === "start_time") updated.latest_check_in = sameAsStart(value);
          if (field === "is_working_day" && value === true) {
            updated.start_time = "08:00";
            updated.end_time = "17:00";
            updated.latest_check_in = sameAsStart("08:00");
          }
          return updated;
        }
        return s;
      });
    });
  };

  // Validasi baris shift sebelum disimpan. Mengembalikan pesan error
  // (string) bila ada yang tidak wajar, atau null bila lolos.
  const validateRows = (rows, labelPerBaris) => {
    // Hari kerja wajib punya jam mulai & selesai
    const invalid = rows.find(s => s.is_working_day && (!s.start_time || !s.end_time));
    if (invalid) {
      return `Hari ${DAY_NAMES[invalid.day_of_week]}${labelPerBaris ? ` pada shift "${invalid.shift_code}"` : ""} belum lengkap jamnya`;
    }

    // Durasi harus wajar. Jam seperti 00:55–00:58 (3 menit) membuat jadwal
    // dianggap selesai sejak dini hari → pegawai ditandai ALPHA palsu dan
    // absen masuk/pulang ditolak server.
    const tooShort = [];
    rows.forEach(s => {
      if (!s.is_working_day) return;
      const dur = shiftDurationMinutes(s.start_time, s.end_time, s.crosses_midnight);
      if (dur === null || dur < MIN_SHIFT_MINUTES || dur > MAX_SHIFT_MINUTES) {
        tooShort.push({ ...s, dur });
      }
    });
    if (tooShort.length > 0) {
      const list = tooShort
        .map(s => {
          const jam = `${String(s.start_time).slice(0, 5)}–${String(s.end_time).slice(0, 5)}`;
          const info = s.dur === null ? "jam tidak valid" : `${s.dur} menit`;
          return labelPerBaris
            ? `${DAY_NAMES[s.day_of_week]} (${jam} = ${info})`
            : `${s.shift_code} ${DAY_NAMES[s.day_of_week]} (${jam} = ${info})`;
        })
        .join(", ");
      return `Durasi shift tidak wajar — minimal ${MIN_SHIFT_MINUTES} menit: ${list}`;
    }

    return null;
  };

  // Inti penyimpanan: dipakai saveAll (semua kartu) dan saveShift (satu kartu).
  const persistRows = async (rows) => {
    const { error } = await supabase.from("shift_schedules").upsert(
      rows.map(s => ({
        organization_id: s.organization_id,
        shift_code: s.shift_code,
        day_of_week: s.day_of_week,
        start_time: s.is_working_day ? s.start_time : "00:00",
        end_time: s.is_working_day ? s.end_time : "00:00",
        latest_check_in: s.is_working_day ? sameAsStart(s.start_time) : "00:00",
        crosses_midnight: s.crosses_midnight || false,
        is_working_day: s.is_working_day,
      })),
      { onConflict: "organization_id,shift_code,day_of_week" }
    );
    if (error) throw error;
  };

  /** Simpan hanya satu kartu shift — tombol di dalam kartu, tanpa scroll ke atas. */
  const saveShift = async (code) => {
    const rows = schedules.filter(s => s.shift_code === code);
    const errMsg = validateRows(rows, true);
    if (errMsg) {
      toast.error(errMsg, { autoClose: 8000 });
      return;
    }
    setSavingCode(code);
    try {
      await persistRows(rows);
      toast.success("Jadwal shift disimpan");
      // Hitung sisa kartu yang masih punya perubahan belum tersimpan.
      const sisa = new Set(dirtyCodes);
      sisa.delete(code);
      setDirtyCodes(sisa);
      // Tombol global hanya aktif bila masih ada kartu lain yang kotor.
      setDirty(sisa.size > 0);
    } catch (err) {
      toast.error("Gagal: " + err.message);
    }
    setSavingCode(null);
  };

  const saveAll = async () => {
    const errMsg = validateRows(schedules, false);
    if (errMsg) {
      toast.error(errMsg, { autoClose: 8000 });
      return;
    }

    setSaving(true);
    try {
      await persistRows(schedules);
      toast.success("Jadwal shift disimpan");
      setDirty(false);
      setDirtyCodes(new Set());
    } catch (err) { toast.error("Gagal: " + err.message); }
    setSaving(false);
  };

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div style={{ display: "grid", gap: 8 }}>
            <Skeleton dark width={150} height={15} />
            <Skeleton dark width={210} height={9} />
          </div>
          <Skeleton dark width={104} height={30} radius={999} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4"
              style={{ display: "grid", gap: 10 }}>
              <Skeleton dark width={96} height={12} />
              {[0, 1, 2].map((j) => (
                <div key={j} className="flex items-center justify-between">
                  <Skeleton dark width="30%" height={9} />
                  <Skeleton dark width={72} height={22} radius={8} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-pure-white">Kelola Shift</h2>
          <p className="text-sm text-slate-mist mt-0.5">Empat shift bawaan sistem - nyalakan/matikan sesuai kebutuhan instansi, lalu atur jam kerjanya</p>
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
        {canonicalShifts.length === 0 ? (
          <div className="md:col-span-2 design-card p-10 text-center">
            <Clock size={32} className="mx-auto mb-3 text-periwinkle-glow" />
            <h3 className="text-base font-semibold text-pure-white">Belum ada data shift</h3>
            <p className="text-sm text-slate-mist mt-1">Instansi ini belum memiliki konfigurasi jam kerja.</p>
          </div>
        ) : canonicalShifts.map(shift => {
          const meta = SHIFT_META[shift.code];
          const Icon = meta?.icon || Clock;
          const shiftScheds = schedules.filter(s => s.shift_code === shift.code);
          const cardDirty = dirtyCodes.has(shift.code);
          const cardSaving = savingCode === shift.code;
          // Peringatan durasi per kartu (tanpa harus menekan Simpan dulu).
          const cardDurBad = shiftScheds.some((s) => {
            if (!s.is_working_day) return false;
            const dur = shiftDurationMinutes(s.start_time, s.end_time, s.crosses_midnight);
            return dur === null || dur < MIN_SHIFT_MINUTES || dur > MAX_SHIFT_MINUTES;
          });

          return (
            <div key={shift.code} className={`design-card overflow-hidden hover:shadow-lg transition-all ${shift.is_active ? "" : "opacity-75"}`}>
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
                <button
                  type="button"
                  onClick={() => toggleActive(shift)}
                  title={shift.is_active ? "Klik untuk menonaktifkan shift ini" : "Klik untuk mengaktifkan shift ini"}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-all duration-200 ${shift.is_active ? "bg-emerald-500" : "bg-slate-600"}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200 ${shift.is_active ? "translate-x-5" : "translate-x-1"}`} />
                </button>
              </div>
              {!shift.is_active && (
                <div className="mx-4 mt-2 rounded-xl px-3 py-1.5 bg-amber-500/10 border border-amber-500/20">
                  <p className="text-[9.5px] font-bold text-amber-300">Nonaktif - tidak bisa dipilih di jadwal pegawai sampai diaktifkan</p>
                </div>
              )}

              {/* Keterangan cara pakai */}
              <div className="mx-4 mt-3 rounded-xl px-3 py-2 border border-blue-500/20 bg-blue-500/[0.06]">
                <p className="text-[10px] text-slate-mist leading-relaxed">
                  <b className="text-blue-300">Lintas Malam:</b> ketuk icon <ArrowRightLeft size={10} className="inline -mt-0.5" /> di samping jam — jadi ungu saat aktif. Jam pulang dihitung besok (contoh: Malam 20:00 → 07:00). Lintas malam untuk kode <b className="text-blue-300">ML</b> aktif otomatis.
                </p>
              </div>

              {/* Schedule Rows */}
              <div className="p-3 space-y-1">
                {DAY_NAMES.map((name, i) => {
                  const sched = shiftScheds.find(s => s.day_of_week === i);
                  const working = sched?.is_working_day;
                  const dur = working
                    ? shiftDurationMinutes(sched?.start_time, sched?.end_time, sched?.crosses_midnight)
                    : null;
                  const durBad = working && (dur === null || dur < MIN_SHIFT_MINUTES || dur > MAX_SHIFT_MINUTES);
                  return (
                    <div key={i} className={`p-2 rounded-3xl transition-all ${working ? "bg-onyx hover:bg-white/[0.06]" : "opacity-50"} ${durBad ? "ring-1 ring-rose-500/60" : ""}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-14 text-[10px] font-semibold text-slate-mist shrink-0">{name}</span>
                      {working ? (
                        <>
                          <TimeSelect value={sched?.start_time || ""}
                            onChange={val => update(shift.code, i, "start_time", val)} />
                          <span className="text-[10px] text-slate-mist shrink-0">—</span>
                          <TimeSelect value={sched?.end_time || ""}
                            onChange={val => update(shift.code, i, "end_time", val)} />
                          <button onClick={() => update(shift.code, i, "crosses_midnight", !sched?.crosses_midnight)}
                            className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-full transition-all shrink-0 text-[9px] font-bold ${
                              sched?.crosses_midnight
                                ? "bg-blue-500/25 text-blue-300 ring-1 ring-blue-400/40"
                                : "bg-white/5 text-slate-mist hover:bg-white/10"
                            }`}
                            title={sched?.crosses_midnight ? "Lintas malam aktif — jam pulang besok (klik untuk matikan)" : "Klik untuk aktifkan lintas malam"}>
                            <ArrowRightLeft size={12} />
                            {sched?.crosses_midnight ? "Lintas Malam" : ""}
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
                    {durBad && (
                      <p className="mt-1.5 ml-16 text-[9.5px] font-bold text-rose-400">
                        Durasi {dur === null ? "tidak valid" : `${dur} menit`} — minimal {MIN_SHIFT_MINUTES} menit. Perbaiki jam sebelum menyimpan.
                      </p>
                    )}
                    </div>
                  );
                })}
              </div>
              {/* Footer — tombol Simpan khusus kartu ini, supaya admin tidak
                  perlu scroll ke atas. Muncul selalu agar mudah dijangkau. */}
              <div className="px-3 pb-3 pt-1">
                {cardDurBad && (
                  <p className="mb-2 px-1 text-[10px] font-bold text-rose-400">
                    Ada jam tidak wajar di kartu ini — perbaiki sebelum menyimpan.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => saveShift(shift.code)}
                  disabled={cardSaving || !cardDirty}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-full text-[12px] font-bold transition-all duration-200
                    ${cardDirty
                      ? "bg-electric-violet text-pure-white hover:brightness-110 active:brightness-90"
                      : "bg-white/[0.06] text-slate-mist cursor-not-allowed"}`}>
                  {cardSaving ? (
                    <><RefreshCw size={14} className="animate-spin" /> Menyimpan...</>
                  ) : cardDirty ? (
                    <><Save size={14} /> Simpan {shift.name}</>
                  ) : (
                    <><CheckCircle2 size={14} /> {shift.name} tersimpan</>
                  )}
                </button>
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
