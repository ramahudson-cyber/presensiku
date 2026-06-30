import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import {
  ChevronLeft, ChevronRight, RefreshCw, Upload,
  Download, Calendar, Users, Sun, Moon, Sunset, CloudSun,
  Loader2, X, CheckCircle2, Layers, Trash2, Copy,
  Search, CalendarRange, Clock, UserCheck
} from "lucide-react";
import BottomSheet from "../../components/BottomSheet";
import ConfirmSheet from "../../components/ConfirmSheet";

const SHIFTS = [
  { code: "PG", name: "Pagi", icon: Sun, color: "text-amber-400", bg: "bg-amber-500/15", ring: "ring-amber-500/30" },
  { code: "SR", name: "Sore", icon: Sunset, color: "text-orange-400", bg: "bg-orange-500/15", ring: "ring-orange-500/30" },
  { code: "SI", name: "Siang", icon: CloudSun, color: "text-sky-400", bg: "bg-sky-500/15", ring: "ring-sky-500/30" },
  { code: "ML", name: "Malam", icon: Moon, color: "text-violet-400", bg: "bg-violet-500/15", ring: "ring-violet-500/30" },
];

const SHIFT_MAP = Object.fromEntries(SHIFTS.map(s => [s.code, s]));

const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const DAY_NAMES = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
const DAY_SHORT = ["Sen","Sel","Rab","Kam","Jum","Sab","Min"];

function getDaysInMonth(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days = [];
  const pad = (first.getDay() + 6) % 7;
  for (let i = 0; i < pad; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(d);
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
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [confirmClear, setConfirmClear] = useState(null);
  const fileInputRef = useRef(null);

  const days = getDaysInMonth(year, month);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const dateStr = (d) => d ? `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;

  const selectedEmployee = employees.find(e => e.id === selectedUser);
  const assignedCount = Object.keys(schedules).length;

  useEffect(() => {
    supabase.from("profiles").select("id, full_name, role").neq("role", "super_admin").order("full_name")
      .then(({ data }) => setEmployees(data || []));
  }, []);

  const loadSchedules = useCallback(async () => {
    if (!selectedUser) return;
    setLoading(true);
    try {
      const s = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const e = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const { data } = await supabase.from("employee_schedules").select("date, shift_code")
        .eq("user_id", selectedUser).gte("date", s).lte("date", e);
      const m = {}; (data || []).forEach(x => m[x.date] = x);
      setSchedules(m);
    } catch { toast.error("Gagal muat jadwal"); } finally { setLoading(false); }
  }, [selectedUser, year, month, lastDay]);

  useEffect(() => { loadSchedules(); }, [loadSchedules]);

  const nav = (dir) => {
    let m = month + dir;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  };

  return (
    <div className="space-y-5 animate-fade-in min-w-0 pb-24 md:pb-6">

      {/* HEADER */}
      <div className="relative bg-gradient-to-br from-violet-600/20 via-purple-700/10 to-transparent rounded-2xl p-5 md:p-6 border border-white/10 overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-600/10 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-700 rounded-xl flex items-center justify-center shadow-lg shadow-violet-900/30">
                <CalendarRange size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Penjadwalan Shift</h1>
                <p className="text-sm text-slate-400 mt-0.5">Atur jadwal shift pegawai per bulan</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleDownloadTemplate}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 text-xs transition-all active:scale-95">
              <Download size={14} /> Template
            </button>
            <button onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 text-xs transition-all active:scale-95">
              <Upload size={14} /> Upload Excel
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
          </div>
        </div>
      </div>

      {/* CONTROLS */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Users size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
          <div onClick={() => setShowSearchModal(true)}
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-white/5 border border-white/10 text-white cursor-pointer flex items-center gap-2 hover:bg-white/[0.08] transition-all">
            {selectedEmployee ? (
              <>
                <span className="flex-1 truncate font-medium">{selectedEmployee.full_name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400">{selectedEmployee.role}</span>
              </>
            ) : (
              <span className="text-slate-400 flex-1">Pilih pegawai...</span>
            )}
            <Search size={14} className="text-slate-500 shrink-0" />
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5">
          <button onClick={() => nav(-1)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all"><ChevronLeft size={17} /></button>
          <span className="text-sm font-semibold text-white w-[136px] text-center select-none">{MONTHS[month]} {year}</span>
          <button onClick={() => nav(1)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all"><ChevronRight size={17} /></button>
        </div>
      </div>

      {/* QUICK ACTIONS + STATS */}
      {selectedUser && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowBulkAssign(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-600/30 to-purple-700/30 border border-violet-500/30 text-violet-200 text-xs font-medium hover:from-violet-600/40 hover:to-purple-700/40 transition-all active:scale-95 shadow-sm">
              <Layers size={14} /> Isi Cepat
            </button>
            <button onClick={handleCopyPrevMonth}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600/20 border border-sky-500/25 text-sky-300 text-xs font-medium hover:bg-sky-600/30 transition-all active:scale-95">
              <Copy size={14} /> Copy Bulan Lalu
            </button>
            <button onClick={handleClearMonth}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600/15 border border-red-500/20 text-red-300 text-xs font-medium hover:bg-red-600/25 transition-all active:scale-95">
              <Trash2 size={14} /> Hapus Bulan
            </button>
          </div>
          <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><Calendar size={12} /> {assignedCount}/{lastDay} hari</span>
            <span className="w-px h-3 bg-white/10" />
            <span className="flex items-center gap-1"><Clock size={12} /> {MONTHS[month]}</span>
          </div>
        </div>
      )}

      {/* LEGEND */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mr-1">Shift</span>
        {SHIFTS.map(s => {
          const Icon = s.icon;
          return (
            <span key={s.code} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium ${s.bg} ${s.color} ring-1 ${s.ring}`}>
              <Icon size={11} /> {s.name}
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-white/[0.03] text-slate-500 ring-1 ring-white/5">
          <X size={11} /> Kosong
        </span>
      </div>

      {/* CALENDAR */}
      {!selectedUser ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-700/20 flex items-center justify-center mb-4 ring-1 ring-white/10">
            <Calendar size={32} className="text-violet-400" />
          </div>
          <p className="text-slate-300 font-medium">Pilih pegawai untuk mulai</p>
          <p className="text-slate-500 text-sm mt-1">Klik kolom pencarian di atas, lalu cari nama pegawai</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin text-violet-400" />
            <p className="text-sm text-slate-400">Memuat jadwal...</p>
          </div>
        </div>
      ) : (
        <div className="bg-violet-500/[0.06] backdrop-blur-sm border border-white/10 rounded-2xl p-3 md:p-5 overflow-x-auto">
          <div className="min-w-[620px]">
            <div className="grid grid-cols-7 gap-2 mb-2">
              {DAY_SHORT.map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {days.map((day, i) => {
                const key = dateStr(day);
                const sched = key ? schedules[key] : undefined;
                const shiftInfo = sched ? SHIFT_MAP[sched.shift_code] : null;
                const now = new Date();
                const isToday = day && year === now.getFullYear() && month === now.getMonth() && day === now.getDate();
                return (
                  <button key={i} onClick={() => handleDayClick(day)} disabled={!day}
                    className={`group relative aspect-[4/3] rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 text-xs
                      ${!day ? "invisible" : "cursor-pointer active:scale-95"}
                      ${isToday ? "ring-2 ring-violet-500 ring-offset-2 ring-offset-[#05000a]" : ""}
                      ${!shiftInfo
                        ? "bg-white/[0.02] hover:bg-white/[0.06] hover:shadow-lg hover:shadow-violet-900/10"
                        : `${shiftInfo.bg} hover:brightness-110 hover:shadow-lg hover:shadow-${shiftInfo.code === "PG" ? "amber" : shiftInfo.code === "SR" ? "orange" : shiftInfo.code === "SI" ? "sky" : "violet"}-900/20`
                      }
                    `}>
                    <span className={`text-[11px] font-bold leading-none ${isToday ? "text-violet-300" : "text-slate-400"}`}>{day}</span>
                    {shiftInfo && (
                      <div className={`flex items-center gap-0.5 mt-0.5 ${shiftInfo.color}`}>
                        <shiftInfo.icon size={9} />
                        <span className="text-[7px] font-bold tracking-wider">{shiftInfo.name}</span>
                      </div>
                    )}
                    <div className={`absolute inset-0 rounded-xl transition-opacity duration-300 opacity-0 group-hover:opacity-100 bg-gradient-to-t from-white/[0.06] to-transparent pointer-events-none`} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SHIFT PICKER — Bottom Sheet */}
      <BottomSheet open={!!showShiftPicker} onClose={() => setShowShiftPicker(null)}
        title="Atur Shift" subtitle={showShiftPicker}>
        <div className="space-y-1.5">
          {SHIFTS.map(s => {
            const Icon = s.icon;
            const isActive = schedules[showShiftPicker]?.shift_code === s.code;
            return (
              <button key={s.code} onClick={() => assignShift(s.code)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all text-sm
                  ${isActive ? "bg-violet-600/30 border border-violet-500/50 text-white shadow-lg shadow-violet-900/20" : "bg-white/[0.04] border border-transparent text-slate-300 hover:bg-white/10 hover:border-white/10"}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.bg}`}>
                  <Icon size={16} className={s.color} />
                </div>
                <span className="flex-1 text-left font-medium">{s.name}</span>
                {isActive && <CheckCircle2 size={16} className="text-emerald-400" />}
              </button>
            );
          })}
        </div>
        {schedules[showShiftPicker] && (
          <button onClick={() => assignShift(schedules[showShiftPicker].shift_code)}
            className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-medium hover:bg-red-500/20 transition-all active:scale-95">
            <Trash2 size={13} /> Hapus Jadwal
          </button>
        )}
      </BottomSheet>

      {/* BULK ASSIGN */}
      {showBulkAssign && (
        <BulkAssignDialog
          employees={employees}
          year={year} month={month} lastDay={lastDay}
          onClose={() => setShowBulkAssign(false)}
          onDone={() => { setShowBulkAssign(false); if (selectedUser) loadSchedules(); }}
        />
      )}

      {/* EMPLOYEE SEARCH — Bottom Sheet */}
      <BottomSheet open={showSearchModal} onClose={() => setShowSearchModal(false)}
        title="Cari Pegawai" subtitle={employees.length + " pegawai terdaftar"}>
        <EmployeeSearchContent
          employees={employees} value={selectedUser}
          onSelect={(id) => { setSelectedUser(id); setShowSearchModal(false); }} />
      </BottomSheet>

      {/* CONFIRM CLEAR */}
      <ConfirmSheet open={!!confirmClear} onClose={() => setConfirmClear(null)}
        title="Hapus Jadwal Bulan Ini"
        message={`Hapus semua jadwal ${confirmClear?.name} bulan ${MONTHS[month]} ${year}?`}
        confirmText="Ya, Hapus" onConfirm={confirmClearMonth} />

      {/* FOOTER INFO */}
      <div className="flex items-center gap-2 p-3.5 rounded-xl bg-gradient-to-r from-sky-500/5 to-violet-500/5 border border-sky-500/10 text-[11px] text-slate-400">
        <div className="w-6 h-6 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
          <UserCheck size={13} className="text-sky-400" />
        </div>
        <p>Klik tanggal untuk atur shift. Gunakan <strong className="text-sky-300 font-semibold">Isi Cepat</strong> untuk mengisi banyak jadwal sekaligus, <strong className="text-sky-300 font-semibold">Upload</strong> via Excel, atau <strong className="text-sky-300 font-semibold">Copy Bulan Lalu</strong> untuk duplikasi.</p>
      </div>
    </div>
  );

  // ============================================================
  // HANDLERS
  // ============================================================
  function handleDownloadTemplate() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Nama Pegawai", "Tanggal", "Shift"],
      ["dr. H. Ahmad Fauzi", "01/07/2026", "PG"],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Jadwal");
    XLSX.writeFile(wb, "template-jadwal-shift.xlsx");
  }

  function handleDayClick(day) {
    if (!selectedUser) { toast.warning("Pilih pegawai dulu"); return; }
    setShowShiftPicker(dateStr(day));
  }

  async function assignShift(shiftCode) {
    if (!showShiftPicker || !selectedUser) return;
    const key = showShiftPicker;
    try {
      if (schedules[key]?.shift_code === shiftCode) {
        await supabase.from("employee_schedules").delete().eq("user_id", selectedUser).eq("date", key);
        setSchedules(prev => { const n = { ...prev }; delete n[key]; return n; });
        toast.success("Jadwal dihapus");
      } else {
        const { error } = await supabase.from("employee_schedules").upsert(
          { user_id: selectedUser, date: key, shift_code: shiftCode },
          { onConflict: "user_id,date" }
        );
        if (error) throw error;
        setSchedules(prev => ({ ...prev, [key]: { date: key, shift_code: shiftCode } }));
        toast.success(`Shift ${SHIFTS.find(s => s.code === shiftCode)?.name} ditetapkan`);
      }
    } catch (err) { toast.error("Gagal: " + err.message); }
    setShowShiftPicker(null);
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      let ok = 0, fail = 0;
      for (const row of rows) {
        const nama = String(row.Nama || "").trim();
        const tgl = String(row.Tanggal || "").trim();
        const sc = String(row.Shift || "").toUpperCase();
        if (!nama || !tgl || !SHIFT_MAP[sc]) { fail++; continue; }
        let pd; if (/^\d{4}-\d{2}-\d{2}$/.test(tgl)) pd = tgl;
        else if (/^\d{2}\/\d{2}\/\d{4}$/.test(tgl)) { const [d,m,y] = tgl.split("/"); pd = `${y}-${m}-${d}`; }
        else { fail++; continue; }
        const { data: ps } = await supabase.from("profiles").select("id").ilike("full_name", `%${nama}%`).limit(1);
        if (!ps?.[0]) { fail++; continue; }
        const { error } = await supabase.from("employee_schedules").upsert(
          { user_id: ps[0].id, date: pd, shift_code: sc }, { onConflict: "user_id,date" }
        );
        if (error) fail++; else ok++;
      }
      toast.success(`${ok} berhasil${fail ? `, ${fail} gagal` : ""}`);
      if (selectedUser) loadSchedules();
    } catch { toast.error("Gagal baca file"); }
    e.target.value = "";
  }

  async function handleCopyPrevMonth() {
    if (!selectedUser) return;
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    const pDays = Math.min(new Date(py, pm + 1, 0).getDate(), lastDay);
    setLoading(true);
    try {
      const { data: prev } = await supabase.from("employee_schedules").select("date, shift_code")
        .eq("user_id", selectedUser)
        .gte("date", `${py}-${String(pm + 1).padStart(2,"0")}-01`)
        .lte("date", `${py}-${String(pm + 1).padStart(2,"0")}-${String(pDays).padStart(2,"0")}`);
      if (!prev?.length) { toast.info("Tidak ada jadwal bulan lalu"); setLoading(false); return; }
      const inserts = prev.map(s => ({
        user_id: selectedUser,
        date: `${year}-${String(month + 1).padStart(2,"0")}-${s.date.split("-")[2].padStart(2,"0")}`,
        shift_code: s.shift_code
      }));
      const { error } = await supabase.from("employee_schedules").upsert(inserts, { onConflict: "user_id,date" });
      if (error) throw error;
      toast.success(`✅ ${inserts.length} jadwal dicopy dari bulan lalu`);
      await loadSchedules();
    } catch (err) { toast.error("Gagal: " + err.message); }
    setLoading(false);
  }

  function handleClearMonth() {
    if (!selectedUser) return;
    const name = employees.find(e => e.id === selectedUser)?.full_name;
    setConfirmClear({ name });
  }

  async function confirmClearMonth() {
    if (!selectedUser) return;
    const s = `${year}-${String(month + 1).padStart(2,"0")}-01`;
    const e = `${year}-${String(month + 1).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
    await supabase.from("employee_schedules").delete().eq("user_id", selectedUser).gte("date", s).lte("date", e);
    setSchedules({});
    setConfirmClear(null);
    toast.success("Jadwal dibersihkan");
  }
}

/* ============================================================
   EMPLOYEE SEARCH CONTENT
   ============================================================ */
function EmployeeSearchContent({ employees, value, onSelect }) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 200); }, []);

  const filtered = q ? employees.filter(e => e.full_name.toLowerCase().includes(q.toLowerCase())) : employees;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
          placeholder="Ketik nama pegawai..."
          className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all" />
      </div>
      <div className="max-h-56 overflow-y-auto space-y-0.5 -mx-1 px-1">
        {filtered.map(emp => (
          <button key={emp.id} onClick={() => onSelect(emp.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-all hover:bg-white/[0.06] ${emp.id === value ? "bg-violet-600/20 text-violet-200 ring-1 ring-violet-500/30" : "text-slate-300"}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {emp.full_name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{emp.full_name}</p>
              <p className="text-[10px] text-slate-500">{emp.role}</p>
            </div>
            {emp.id === value && <CheckCircle2 size={16} className="text-violet-400 shrink-0" />}
          </button>
        ))}
        {!filtered.length && <p className="text-xs text-slate-500 text-center py-6">Tidak ditemukan</p>}
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
  const [range, setRange] = useState({ start: 1, end: lastDay });
  const [days, setDays] = useState([0,1,2,3,4,5]);
  const [shiftCode, setShiftCode] = useState("PG");
  const [saving, setSaving] = useState(false);

  const toggle = (id) => setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const apply = async () => {
    if (!selectedIds.length) { toast.warning("Pilih pegawai dulu"); return; }
    if (!days.length) { toast.warning("Pilih hari dulu"); return; }
    if (range.start > range.end) { toast.warning("Tanggal awal > akhir"); return; }
    setSaving(true);
    try {
      const inserts = [];
      for (let d = range.start; d <= range.end; d++) {
        const pg = (new Date(year, month, d).getDay() + 6) % 7;
        if (!days.includes(pg)) continue;
        const ds = `${year}-${String(month + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
        for (const uid of selectedIds) inserts.push({ user_id: uid, date: ds, shift_code: shiftCode });
      }
      if (!inserts.length) { toast.warning("Tidak ada hari cocok"); setSaving(false); return; }
      const { error } = await supabase.from("employee_schedules").upsert(inserts, { onConflict: "user_id,date" });
      if (error) throw error;
      toast.success(`✅ ${inserts.length} jadwal untuk ${selectedIds.length} pegawai`);
      onDone();
    } catch (err) { toast.error("Gagal: " + err.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-gradient-to-br from-[#1a0533] to-[#2d0a4e] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl shadow-violet-900/40 animate-fade-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg">
              <Layers size={17} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Isi Cepat Jadwal</h3>
              <p className="text-[10px] text-slate-400">Atur shift untuk banyak pegawai sekaligus</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Shift */}
          <div>
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Shift</label>
            <div className="grid grid-cols-2 gap-2">
              {SHIFTS.map(s => {
                const Icon = s.icon;
                return (
                  <button key={s.code} onClick={() => setShiftCode(s.code)}
                    className={`flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-xs font-medium transition-all ${shiftCode === s.code ? "bg-violet-600/30 border border-violet-500/50 text-white shadow-lg shadow-violet-900/20" : "bg-white/[0.04] border border-white/10 text-slate-300 hover:bg-white/10"}`}>
                    <Icon size={16} className={s.color} /> {s.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Rentang Tanggal</label>
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
              <div className="flex items-center justify-center gap-3">
                <div className="text-center">
                  <span className="text-[10px] text-slate-500 block mb-1">Dari</span>
                  <input type="number" min={1} max={lastDay} value={range.start}
                    onChange={e => setRange(p => ({ ...p, start: Math.max(1, Math.min(lastDay, Number(e.target.value)))}))}
                    className="w-16 px-2 py-1.5 text-sm rounded-lg bg-white/5 border border-white/10 text-white text-center font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/50" />
                </div>
                <span className="text-slate-500 mt-5">—</span>
                <div className="text-center">
                  <span className="text-[10px] text-slate-500 block mb-1">Sampai</span>
                  <input type="number" min={1} max={lastDay} value={range.end}
                    onChange={e => setRange(p => ({ ...p, end: Math.max(1, Math.min(lastDay, Number(e.target.value)))}))}
                    className="w-16 px-2 py-1.5 text-sm rounded-lg bg-white/5 border border-white/10 text-white text-center font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/50" />
                </div>
                <span className="text-[10px] text-slate-400 mt-5 whitespace-nowrap">{MONTHS[month]} {year}</span>
              </div>
            </div>
          </div>

          {/* Days */}
          <div>
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Hari</label>
            <div className="flex flex-wrap gap-1.5">
              {DAY_SHORT.map((d, i) => (
                <button key={i} onClick={() => setDays(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i])}
                  className={`px-3.5 py-2 rounded-lg text-[10px] font-bold transition-all ${days.includes(i) ? "bg-violet-600/30 border border-violet-500/50 text-white shadow-sm" : "bg-white/[0.04] border border-white/10 text-slate-400 hover:bg-white/10"}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Employees */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Pegawai ({selectedIds.length})</label>
              <button onClick={() => { if (selectAll) { setSelectedIds([]); setSelectAll(false); } else { setSelectedIds(employees.map(e => e.id)); setSelectAll(true); } }}
                className="text-[10px] font-semibold text-violet-400 hover:text-violet-300 transition-all">{selectAll ? "Hapus semua" : "Pilih semua"}</button>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-0.5 rounded-xl bg-white/[0.02] border border-white/5 p-1">
              {employees.map(emp => (
                <label key={emp.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-xs transition-all ${selectedIds.includes(emp.id) ? "bg-violet-600/15 border border-violet-500/25" : "hover:bg-white/[0.04]"}`}>
                  <input type="checkbox" checked={selectedIds.includes(emp.id)} onChange={() => toggle(emp.id)}
                    className="accent-violet-500 w-3.5 h-3.5" />
                  <span className="text-slate-200 flex-1 font-medium">{emp.full_name}</span>
                  <span className="text-[9px] text-slate-500">{emp.role}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Apply */}
          <button onClick={apply} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-violet-900/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-900/20">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Menyimpan...</> : <><CheckCircle2 size={17} /> Terapkan Jadwal</>}
          </button>
        </div>
      </div>
    </div>
  );
}
