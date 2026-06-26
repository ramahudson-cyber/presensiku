import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import {
  ChevronLeft, ChevronRight, Save, RefreshCw, Upload,
  Download, Calendar, Users, Sun, Moon, Sunset, CloudSun,
  Loader2, X, CheckCircle2, FileSpreadsheet
} from "lucide-react";

const SHIFTS = [
  { code: "PG", name: "Pagi", icon: Sun, color: "text-amber-400", bg: "bg-amber-500/20" },
  { code: "SR", name: "Sore", icon: Sunset, color: "text-orange-400", bg: "bg-orange-500/20" },
  { code: "SI", name: "Siang", icon: CloudSun, color: "text-sky-400", bg: "bg-sky-500/20" },
  { code: "ML", name: "Malam", icon: Moon, color: "text-violet-400", bg: "bg-violet-500/20" },
];

const SHIFT_MAP = Object.fromEntries(SHIFTS.map(s => [s.code, s]));

const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const DAYS = ["Sen","Sel","Rab","Kam","Jum","Sab","Min"];

const inputBase = "w-full px-3 py-2.5 text-sm rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all";
const btnPrimary = "flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-violet-900/30 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed";

function getDaysInMonth(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days = [];
  // JS getDay(): 0=Minggu, 1=Senin, ... 6=Sabtu
  // Convert to Senin=0 .. Minggu=6
  const startPad = (firstDay.getDay() + 6) % 7;
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
  return days;
}

export default function SchedulingPage() {
  const [employees, setEmployees] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [schedules, setSchedules] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showShiftPicker, setShowShiftPicker] = useState(null);
  const fileInputRef = useRef(null);

  const days = getDaysInMonth(year, month);
  const dateStr = (d) => d ? `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;

  // Load employees
  useEffect(() => {
    const fetchEmployees = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .neq("role", "super_admin")
        .order("full_name");
      setEmployees(data || []);
    };
    fetchEmployees();
  }, []);

  // Load schedules for selected employee & month
  const loadSchedules = useCallback(async () => {
    if (!selectedUser) return;
    setLoading(true);
    try {
      const firstDay = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month + 1, 0);
      const lastDayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

      const { data } = await supabase
        .from("employee_schedules")
        .select("date, shift_code, is_manual_override")
        .eq("user_id", selectedUser)
        .gte("date", firstDay)
        .lte("date", lastDay);

      const map = {};
      (data || []).forEach(s => { map[s.date] = s; });
      setSchedules(map);
    } catch (err) {
      toast.error("Gagal memuat jadwal");
    } finally {
      setLoading(false);
    }
  }, [selectedUser, year, month]);

  useEffect(() => { loadSchedules(); }, [loadSchedules]);

  const handlePrevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const handleNextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const handleDayClick = (day) => {
    if (!selectedUser) { toast.warning("Pilih pegawai dulu"); return; }
    const key = dateStr(day);
    setShowShiftPicker(key);
  };

  const assignShift = async (shiftCode) => {
    if (!showShiftPicker || !selectedUser) return;
    const key = showShiftPicker;

    try {
      // Delete if same shift (toggle off)
      if (schedules[key]?.shift_code === shiftCode) {
        await supabase.from("employee_schedules").delete().eq("user_id", selectedUser).eq("date", key);
        setSchedules(prev => { const n = { ...prev }; delete n[key]; return n; });
        toast.success("Shift dihapus");
      } else {
        const { error } = await supabase.from("employee_schedules").upsert({
          user_id: selectedUser, date: key, shift_code: shiftCode,
        }, { onConflict: "user_id,date" });
        if (error) throw error;
        setSchedules(prev => ({ ...prev, [key]: { date: key, shift_code: shiftCode, is_manual_override: true } }));
        toast.success(`Shift ${SHIFT_MAP[shiftCode]?.name || shiftCode} ditetapkan`);
      }
    } catch (err) {
      toast.error("Gagal: " + err.message);
    }
    setShowShiftPicker(null);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);
      let success = 0, errors = 0;

      for (const row of rows) {
        const nama = String(row.Nama || row.nama || row.NAMA || "").trim();
        const tglRaw = row.Tanggal || row.tanggal || "";
        const shiftCode = String(row.Shift || row.shift || "").toUpperCase();

        if (!nama || !tglRaw || !shiftCode) { errors++; continue; }
        if (!SHIFT_MAP[shiftCode]) { errors++; continue; }

        let parsedDate;
        if (/^\d{4}-\d{2}-\d{2}$/.test(tglRaw)) parsedDate = tglRaw;
        else if (/^\d{2}\/\d{2}\/\d{4}$/.test(tglRaw)) {
          const [d, m, y] = tglRaw.split("/");
          parsedDate = `${y}-${m}-${d}`;
        } else if (/^\d{2}-\d{2}-\d{4}$/.test(tglRaw)) {
          const [d, m, y] = tglRaw.split("-");
          parsedDate = `${y}-${m}-${d}`;
        } else { errors++; continue; }

        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .ilike("full_name", nama)
          .maybeSingle();

        if (!profile) { errors++; continue; }

        const { error } = await supabase.from("employee_schedules").upsert({
          user_id: profile.id, date: parsedDate, shift_code: shiftCode,
        }, { onConflict: "user_id,date" });
        if (error) errors++;
        else success++;
      }

      toast.success(`${success} jadwal berhasil diimport${errors ? `, ${errors} gagal` : ""}`);
      if (selectedUser) loadSchedules();
    } catch (err) {
      toast.error("Gagal membaca file: " + err.message);
    }
    e.target.value = "";
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const data = [
      ["Nama Pegawai", "Tanggal", "Shift"],
      ["dr. H. Ahmad Fauzi", "01/07/2026", "PG"],
      ["Ns. Baiq Elma, S.Kep", "01/07/2026", "SI"],
      ["Apt. Riza Lestari, S.Farm", "02/07/2026", "ML"],
      ["drg. Nyoman Triadi", "01/07/2026", "SR"],
      ["Siti Rahmawati, Amd.Keb", "01/07/2026", "PG"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws, "Jadwal");
    XLSX.writeFile(wb, "template-jadwal-shift.xlsx");
  };

  return (
    <div className="space-y-4 animate-fade-in min-w-0 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Penjadwalan Shift</h1>
          <p className="text-sm text-slate-400 mt-0.5">Atur jadwal shift pegawai per bulan</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadTemplate} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 text-xs transition-all">
            <Download size={14} /> Template
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 text-xs transition-all">
            <Upload size={14} /> Upload Excel
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
          <button onClick={loadSchedules} className="p-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} className={`${inputBase} pl-9`}>
            <option value="" className="bg-[#1a0a35]">Pilih Pegawai</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id} className="bg-[#1a0a35]">{emp.full_name} ({emp.role})</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
          <button onClick={handlePrevMonth} className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold text-white whitespace-nowrap min-w-[140px] text-center">
            {MONTHS[month]} {year}
          </span>
          <button onClick={handleNextMonth} className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Shift Legend */}
      <div className="flex flex-wrap gap-2">
        {SHIFTS.map(s => {
          const Icon = s.icon;
          return (
            <span key={s.code} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium ${s.bg} ${s.color} ring-1 ring-white/10`}>
              <Icon size={12} /> {s.name} ({s.code})
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-white/5 text-slate-400 ring-1 ring-white/10">
          <X size={12} /> Tidak ada jadwal
        </span>
      </div>

      {/* Calendar Grid */}
      {!selectedUser ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-8">
          <Calendar size={48} className="text-slate-500 mb-3" />
          <p className="text-slate-400 text-sm">Pilih pegawai untuk melihat jadwal</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 size={24} className="animate-spin text-violet-400" />
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-3 md:p-4 overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1.5 mb-1.5">
              {DAYS.map(d => (
                <div key={d} className="text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar cells */}
            <div className="grid grid-cols-7 gap-1.5">
              {days.map((day, i) => {
                const key = dateStr(day);
                const sched = key ? schedules[key] : undefined;
                const shiftInfo = sched ? SHIFT_MAP[sched.shift_code] : null;
                const today = new Date();
                const isToday = day && year === today.getFullYear() && month === today.getMonth() && day === today.getDate();

                return (
                  <button key={i} onClick={() => handleDayClick(day)}
                    disabled={!day}
                    className={`relative aspect-square rounded-xl flex flex-col items-center justify-center transition-all text-xs
                      ${!day ? "invisible" : "cursor-pointer hover:scale-105 active:scale-95"}
                      ${isToday ? "ring-2 ring-violet-500" : ""}
                      ${!shiftInfo ? "bg-white/[0.03] hover:bg-white/[0.06]" : shiftInfo.bg + " hover:brightness-110"}
                    `}>
                    <span className={`text-[10px] font-bold ${isToday ? "text-violet-300" : "text-slate-400"}`}>{day}</span>
                    {shiftInfo && (
                      <div className={`flex items-center gap-0.5 mt-0.5 ${shiftInfo.color}`}>
                        <shiftInfo.icon size={10} />
                        <span className="text-[8px] font-semibold">{shiftInfo.code}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Shift Picker Modal */}
      {showShiftPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setShowShiftPicker(null)}>
          <div className="bg-gradient-to-br from-[#1a0533] to-[#2d0a4e] border border-white/10 rounded-2xl p-5 w-full max-w-xs shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">Pilih Shift</h3>
              <span className="text-[11px] text-slate-400">{showShiftPicker}</span>
            </div>
            <div className="space-y-2">
              {SHIFTS.map(s => {
                const Icon = s.icon;
                const isActive = schedules[showShiftPicker]?.shift_code === s.code;
                return (
                  <button key={s.code} onClick={() => assignShift(s.code)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm
                      ${isActive ? "bg-violet-600/30 border border-violet-500/50 text-white" : "bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"}`}>
                    <Icon size={18} className={s.color} />
                    <span className="flex-1 text-left">{s.name} ({s.code})</span>
                    {isActive && <CheckCircle2 size={16} className="text-emerald-400" />}
                  </button>
                );
              })}
              {schedules[showShiftPicker] && (
                <button onClick={() => assignShift(schedules[showShiftPicker].shift_code)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs hover:bg-red-500/20 transition-all">
                  <X size={14} /> Hapus Jadwal
                </button>
              )}
            </div>
            <button onClick={() => setShowShiftPicker(null)}
              className="w-full mt-3 py-2.5 rounded-xl bg-white/5 text-slate-400 text-sm hover:bg-white/10 transition-all">
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="p-3 rounded-2xl bg-sky-500/5 border border-sky-500/20 text-[11px] text-slate-300">
        <p><span className="font-semibold text-sky-300">Petunjuk:</span> Pilih pegawai, klik tanggal untuk menetapkan shift. Atau gunakan <strong>Upload Excel</strong> untuk import massal. Download <strong>Template</strong> untuk format yang benar.</p>
      </div>
    </div>
  );
}
