import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import {
  ChevronLeft, ChevronRight, RefreshCw, Upload,
  Download, Calendar, Users, Sun, Moon, Sunset, CloudSun,
  Loader2, X, CheckCircle2, Layers, Trash2, Copy
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
const DAY_NAMES = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];

const inputBase = "w-full px-3 py-2.5 text-sm rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all";
const btnPrimary = "flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-violet-900/30 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed";

function getDaysInMonth(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days = [];
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
  const [showShiftPicker, setShowShiftPicker] = useState(null);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const fileInputRef = useRef(null);

  const days = getDaysInMonth(year, month);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const dateStr = (d) => d ? `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;

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

  const loadSchedules = useCallback(async () => {
    if (!selectedUser) return;
    setLoading(true);
    try {
      const firstDayStr = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const lastDayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const { data } = await supabase
        .from("employee_schedules")
        .select("date, shift_code, is_manual_override")
        .eq("user_id", selectedUser)
        .gte("date", firstDayStr)
        .lte("date", lastDayStr);
      const map = {};
      (data || []).forEach(s => { map[s.date] = s; });
      setSchedules(map);
    } catch { toast.error("Gagal memuat jadwal"); }
    finally { setLoading(false); }
  }, [selectedUser, year, month, lastDay]);

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
    setShowShiftPicker(dateStr(day));
  };

  const assignShift = async (shiftCode) => {
    if (!showShiftPicker || !selectedUser) return;
    const key = showShiftPicker;
    try {
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
    } catch (err) { toast.error("Gagal: " + err.message); }
    setShowShiftPicker(null);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      let success = 0, errors = 0;
      for (const row of rows) {
        const nama = String(row.Nama || row.nama || "").trim();
        const tglRaw = row.Tanggal || row.tanggal || "";
        const shiftCode = String(row.Shift || row.shift || "").toUpperCase();
        if (!nama || !tglRaw || !SHIFT_MAP[shiftCode]) { errors++; continue; }
        let parsedDate;
        if (/^\d{4}-\d{2}-\d{2}$/.test(tglRaw)) parsedDate = tglRaw;
        else if (/^\d{2}\/\d{2}\/\d{4}$/.test(tglRaw)) { const [d,m,y] = tglRaw.split("/"); parsedDate = `${y}-${m}-${d}`; }
        else { errors++; continue; }
        const { data: profiles } = await supabase.from("profiles").select("id").ilike("full_name", `%${nama}%`).limit(1);
        if (!profiles?.[0]) { errors++; continue; }
        const { error } = await supabase.from("employee_schedules").upsert({
          user_id: profiles[0].id, date: parsedDate, shift_code: shiftCode,
        }, { onConflict: "user_id,date" });
        if (error) errors++; else success++;
      }
      toast.success(`${success} berhasil${errors ? `, ${errors} gagal` : ""}`);
      if (selectedUser) loadSchedules();
    } catch { toast.error("Gagal membaca file"); }
    e.target.value = "";
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Nama Pegawai", "Tanggal", "Shift"],
      ["dr. H. Ahmad Fauzi", "01/07/2026", "PG"],
      ["Ns. Baiq Elma, S.Kep", "01/07/2026", "SI"],
    ]);
    ws["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws, "Jadwal");
    XLSX.writeFile(wb, "template-jadwal-shift.xlsx");
  };

  const handleClearMonth = async () => {
    if (!selectedUser) return;
    if (!confirm(`Hapus semua jadwal ${employees.find(e => e.id === selectedUser)?.full_name} bulan ${MONTHS[month]} ${year}?`)) return;
    const firstDayStr = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    await supabase.from("employee_schedules").delete().eq("user_id", selectedUser).gte("date", firstDayStr).lte("date", lastDayStr);
    setSchedules({});
    toast.success("Jadwal bulan ini dihapus");
  };

  const handleCopyPrevMonth = async () => {
    if (!selectedUser) return;
    const prevM = month === 0 ? 11 : month - 1;
    const prevY = month === 0 ? year - 1 : year;
    const prevLastDay = new Date(prevY, prevM + 1, 0).getDate();
    const thisMonthDays = lastDay;
    const daysToCopy = Math.min(prevLastDay, thisMonthDays);

    setLoading(true);
    try {
      const prevFirst = `${prevY}-${String(prevM + 1).padStart(2, "0")}-01`;
      const prevLast = `${prevY}-${String(prevM + 1).padStart(2, "0")}-${String(daysToCopy).padStart(2, "0")}`;
      const { data: prevData } = await supabase
        .from("employee_schedules")
        .select("date, shift_code")
        .eq("user_id", selectedUser)
        .gte("date", prevFirst)
        .lte("date", prevLast);

      if (!prevData?.length) { toast.info("Tidak ada jadwal bulan sebelumnya"); setLoading(false); return; }

      const inserts = prevData.map(s => {
        const d = parseInt(s.date.split("-")[2]);
        const newDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        return { user_id: selectedUser, date: newDate, shift_code: s.shift_code };
      });

      const { error } = await supabase.from("employee_schedules").upsert(inserts, { onConflict: "user_id,date" });
      if (error) throw error;
      toast.success(`Duplikasi ${inserts.length} jadwal berhasil`);
      await loadSchedules();
    } catch (err) { toast.error("Gagal: " + err.message); }
    setLoading(false);
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
            <Upload size={14} /> Upload
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

      {/* Quick Actions */}
      {selectedUser && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowBulkAssign(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-300 text-xs hover:bg-violet-600/30 transition-all">
            <Layers size={14} /> Isi Cepat
          </button>
          <button onClick={handleCopyPrevMonth} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-600/20 border border-sky-500/30 text-sky-300 text-xs hover:bg-sky-600/30 transition-all">
            <Copy size={14} /> Copy Bulan Lalu
          </button>
          <button onClick={handleClearMonth} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-600/20 border border-red-500/30 text-red-300 text-xs hover:bg-red-600/30 transition-all">
            <Trash2 size={14} /> Hapus Bulan Ini
          </button>
        </div>
      )}

      {/* Shift Legend */}
      <div className="flex flex-wrap gap-2">
        {SHIFTS.map(s => {
          const Icon = s.icon;
          return (
            <span key={s.code} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium ${s.bg} ${s.color} ring-1 ring-white/10`}>
              <Icon size={12} /> {s.name}
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-white/5 text-slate-400 ring-1 ring-white/10">
          <X size={12} /> Kosong
        </span>
      </div>

      {/* Calendar */}
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
            <div className="grid grid-cols-7 gap-1.5 mb-1.5">
              {DAYS.map(d => (
                <div key={d} className="text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {days.map((day, i) => {
                const key = dateStr(day);
                const sched = key ? schedules[key] : undefined;
                const shiftInfo = sched ? SHIFT_MAP[sched.shift_code] : null;
                const today = new Date();
                const isToday = day && year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
                return (
                  <button key={i} onClick={() => handleDayClick(day)} disabled={!day}
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

      {/* Shift Picker */}
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
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm ${isActive ? "bg-violet-600/30 border border-violet-500/50 text-white" : "bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"}`}>
                    <Icon size={18} className={s.color} />
                    <span className="flex-1 text-left">{s.name}</span>
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
            <button onClick={() => setShowShiftPicker(null)} className="w-full mt-3 py-2.5 rounded-xl bg-white/5 text-slate-400 text-sm hover:bg-white/10 transition-all">Tutup</button>
          </div>
        </div>
      )}

      {/* Bulk Assign */}
      {showBulkAssign && (
        <BulkAssignDialog
          employees={employees}
          year={year}
          month={month}
          lastDay={lastDay}
          onClose={() => setShowBulkAssign(false)}
          onDone={() => { setShowBulkAssign(false); if (selectedUser) loadSchedules(); }}
        />
      )}

      {/* Info */}
      <div className="p-3 rounded-2xl bg-sky-500/5 border border-sky-500/20 text-[11px] text-slate-300">
        <p><span className="font-semibold text-sky-300">Petunjuk:</span> Pilih pegawai → klik tanggal untuk assign shift. Atau gunakan <strong>Isi Cepat</strong> untuk mengisi banyak hari sekaligus, atau <strong>Upload</strong> untuk import massal via Excel.</p>
      </div>
    </div>
  );
}

/* ============================================================
   BULK ASSIGN DIALOG
   ============================================================ */
function BulkAssignDialog({ employees, year, month, lastDay, onClose, onDone }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [dateRange, setDateRange] = useState({ start: 1, end: lastDay });
  const [dayFilter, setDayFilter] = useState([0,1,2,3,4,5]); // Senin-Sabtu
  const [shiftCode, setShiftCode] = useState("PG");
  const [saving, setSaving] = useState(false);

  const DAYS_SHORT = ["Sen","Sel","Rab","Kam","Jum","Sab","Min"];

  const toggleEmployee = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleDay = (i) => {
    setDayFilter(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  };

  const handleSelectAll = () => {
    if (selectAll) { setSelectedIds([]); setSelectAll(false); }
    else { setSelectedIds(employees.map(e => e.id)); setSelectAll(true); }
  };

  const handleApply = async () => {
    if (!selectedIds.length) { toast.warning("Pilih pegawai dulu"); return; }
    if (!dayFilter.length) { toast.warning("Pilih hari dulu"); return; }
    if (dateRange.start > dateRange.end) { toast.warning("Tanggal awal > akhir"); return; }

    setSaving(true);
    let total = 0;

    try {
      // Filter days within range that match dayFilter
      // day_of_week: 0=Senin..6=Minggu
      // JS getDay: 0=Minggu..6=Sabtu → convert to 0=Senin..6=Minggu: (d+6)%7
      const inserts = [];
      for (let d = dateRange.start; d <= dateRange.end; d++) {
        const jsDay = new Date(year, month, d).getDay();
        const pgDay = (jsDay + 6) % 7;
        if (!dayFilter.includes(pgDay)) continue;

        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        for (const uid of selectedIds) {
          inserts.push({ user_id: uid, date: dateStr, shift_code: shiftCode });
        }
      }

      if (!inserts.length) { toast.warning("Tidak ada hari yang cocok"); setSaving(false); return; }

      // Batch upsert
      const { error } = await supabase.from("employee_schedules").upsert(inserts, { onConflict: "user_id,date" });
      if (error) throw error;

      total = inserts.length;
      toast.success(`${total} jadwal ${SHIFTS.find(s => s.code === shiftCode)?.name} untuk ${selectedIds.length} pegawai`);
      onDone();
    } catch (err) { toast.error("Gagal: " + err.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-gradient-to-br from-[#1a0533] to-[#2d0a4e] border border-white/10 rounded-2xl p-5 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><Layers size={16} /> Isi Cepat Jadwal</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 transition-all"><X size={16} /></button>
        </div>

        <div className="space-y-4">

          {/* Shift */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1.5">Shift</label>
            <div className="grid grid-cols-2 gap-2">
              {SHIFTS.map(s => {
                const Icon = s.icon;
                return (
                  <button key={s.code} onClick={() => setShiftCode(s.code)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs transition-all ${shiftCode === s.code ? "bg-violet-600/30 border border-violet-500/50 text-white" : "bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"}`}>
                    <Icon size={14} className={s.color} /> {s.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1.5">Rentang Tanggal</label>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Dari</span>
              <input type="number" min={1} max={lastDay} value={dateRange.start}
                onChange={e => setDateRange(prev => ({ ...prev, start: Math.max(1, Math.min(lastDay, Number(e.target.value)))}))}
                className="w-16 px-2 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-white text-center" />
              <span className="text-[11px] text-slate-400">s/d</span>
              <input type="number" min={1} max={lastDay} value={dateRange.end}
                onChange={e => setDateRange(prev => ({ ...prev, end: Math.max(1, Math.min(lastDay, Number(e.target.value)))}))}
                className="w-16 px-2 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-white text-center" />
              <span className="text-[11px] text-slate-400">{MONTHS[month]} {year}</span>
            </div>
          </div>

          {/* Days of Week */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1.5">Hari</label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS_SHORT.map((d, i) => (
                <button key={i} onClick={() => toggleDay(i)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${dayFilter.includes(i) ? "bg-violet-600/30 border border-violet-500/50 text-white" : "bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10"}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Employees */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-semibold text-slate-400 uppercase">Pegawai</label>
              <button onClick={handleSelectAll} className="text-[10px] text-violet-400 hover:text-violet-300 transition-all">
                {selectAll ? "Hapus semua" : "Pilih semua"}
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {employees.map(emp => (
                <label key={emp.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-xs transition-all ${selectedIds.includes(emp.id) ? "bg-violet-600/20 border border-violet-500/30" : "bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                  <input type="checkbox" checked={selectedIds.includes(emp.id)} onChange={() => toggleEmployee(emp.id)} className="accent-violet-500" />
                  <span className="text-slate-300 flex-1">{emp.full_name}</span>
                  <span className="text-[9px] text-slate-500">{emp.role}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Apply */}
          <button onClick={handleApply} disabled={saving} className={btnPrimary + " w-full justify-center"}>
            {saving ? <><Loader2 size={16} className="animate-spin" /> Menyimpan...</> : <><CheckCircle2 size={16} /> Terapkan</>}
          </button>
        </div>
      </div>
    </div>
  );
}
