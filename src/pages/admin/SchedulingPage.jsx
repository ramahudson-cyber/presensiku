import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import {
  ChevronLeft, ChevronRight, RefreshCw, Upload,
  Download, Calendar, Users, Sun, Moon, Sunset, CloudSun,
  Loader2, X, CheckCircle2, Layers, Trash2, Copy,
  Search, CalendarRange, Clock, UserCheck, AlertTriangle
} from "lucide-react";
import BottomSheet from "../../components/BottomSheet";
import ConfirmSheet from "../../components/ConfirmSheet";
import usePullToRefresh from "../../hooks/usePullToRefresh";
import PullToRefreshIndicator from "../../components/PullToRefreshIndicator";
import Skeleton from "../../components/Skeleton";

// Visual per kode shift ikut master DB (instansi bebas membuat kode sendiri:
// PG/SG/MLM, dsb). Kode tak dikenal dapat visual netral.
const SHIFT_VISUALS = {
  PG: { icon: Sun, premiumClass: "cal-premium-pg", badgeClass: "cal-badge-pg", color: "text-amber-500" },
  SR: { icon: Sunset, premiumClass: "cal-premium-sr", badgeClass: "cal-badge-sr", color: "text-orange-500" },
  SI: { icon: CloudSun, premiumClass: "cal-premium-si", badgeClass: "cal-badge-si", color: "text-sky-500" },
  SG: { icon: CloudSun, premiumClass: "cal-premium-si", badgeClass: "cal-badge-si", color: "text-sky-500" },
  ML: { icon: Moon, premiumClass: "cal-premium-ml", badgeClass: "cal-badge-ml", color: "text-blue-400" },
  MLM: { icon: Moon, premiumClass: "cal-premium-ml", badgeClass: "cal-badge-ml", color: "text-blue-400" },
};
const shiftVisual = (code) => SHIFT_VISUALS[code] ||
  { icon: Clock, premiumClass: "cal-premium-si", badgeClass: "cal-badge-si", color: "text-slate-500" };

// Role pengelola — tidak menjalani shift, jadi tidak pernah muncul sebagai
// peserta penjadwalan maupun absensi.
const ADMIN_ROLES = ["super_admin", "admin", "admin_puskesmas"];

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
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const [employees, setEmployees] = useState([]);
  // Multi-pilih: jadwal bisa dibuat untuk banyak pegawai sekaligus (checklist
  // di sheet Cari Pegawai). Kalender menampilkan jadwal pegawai pertama.
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [schedules, setSchedules] = useState({});
  const [loading, setLoading] = useState(true);
  const [showShiftPicker, setShowShiftPicker] = useState(null);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [confirmClear, setConfirmClear] = useState(null);
  const [shifts, setShifts] = useState([]);
  const inactiveShiftCodesRef = useRef(new Set());
  // Kode shift nonaktif — ditolak saat import Excel (pola produksi:
  // penugasan baru hanya boleh memakai shift aktif).
  const [shiftsLoading, setShiftsLoading] = useState(true);
  const fileInputRef = useRef(null);

  // Daftar pegawai + status jadwal bulan ini. Sebelumnya halaman kosong
  // sebelum admin memilih pegawai; sekarang semua pegawai terlihat beserta
  // berapa hari yang sudah dijadwalkan (data asli employee_schedules).
  const [monthOverview, setMonthOverview] = useState({}); // user_id -> { days, shifts[] }
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [listQuery, setListQuery] = useState("");
  const [listFilter, setListFilter] = useState("all"); // all | full | part | none
  const [listOpen, setListOpen] = useState(true);
  // Master shift instansi — dari DB (RLS org-scoped; ikut switch super_admin)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.from("shifts").select("code, name, is_active").order("code");
        if (error) throw error;
        // Hanya shift AKTIF yang bisa dipilih untuk penugasan baru.
        // Baris DB hanya code+name — visual (icon/badge/color) di-merge di sini
        // supaya legend, shift picker, dan bulk dialog punya komponen ikon yang valid.
        if (!cancelled) {
          setShifts((data || []).filter(s => s.is_active !== false).map(s => ({ ...s, ...shiftVisual(s.code) })));
          inactiveShiftCodesRef.current = new Set(
            (data || []).filter(s => s.is_active === false).map(s => s.code)
          );
        }
      } catch {
        if (!cancelled) setShifts([]);
      } finally {
        if (!cancelled) setShiftsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const SHIFT_MAP = Object.fromEntries(
    shifts.map(s => [s.code, { code: s.code, name: s.name, ...shiftVisual(s.code) }])
  );

  const days = getDaysInMonth(year, month);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const dateStr = (d) => d ? `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;

  const selectedUser = selectedUsers[0] || ""; // pegawai utama yang jadwalnya tampil di kalender
  const selectedEmployee = employees.find(e => e.id === selectedUser);
  const assignedCount = Object.keys(schedules).length;

  useEffect(() => {
    let query = supabase
      .from("profiles")
      .select("id, full_name, role, position, created_by, organization_id")
      .order("full_name");

    if (!isSuperAdmin && user?.id) {
      query = query.or(`id.eq.${user.id},created_by.eq.${user.id}`);
    }

    query.then(({ data, error }) => {
      if (error) {
        toast.error("Gagal memuat daftar pegawai\n" + error.message);
        return;
      }
      // Admin tidak mengikuti shift/absensi, jadi tidak boleh muncul di daftar
      // penugasan jadwal (sheet Cari Pegawai, Isi Cepat, upload Excel).
      const attendanceUsers = (data || []).filter(item => !ADMIN_ROLES.includes(item.role));
      setEmployees(attendanceUsers);
      if (!selectedUsers.length && user?.id && attendanceUsers.some(item => item.id === user.id)) {
        setSelectedUsers([user.id]);
      }
    });
  }, [isSuperAdmin, user?.id]);

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
    } catch { toast.error("Gagal memuat jadwal\nPeriksa koneksi Anda, lalu coba lagi."); } finally { setLoading(false); }
  }, [selectedUser, year, month, lastDay]);

  useEffect(() => { loadSchedules(); }, [loadSchedules]);

  // Muat ringkasan jadwal SEMUA pegawai untuk bulan tampil (satu query).
  // Sumber: employee_schedules — bukan data contoh.
  const loadMonthOverview = useCallback(async () => {
    if (!employees.length) { setOverviewLoading(false); return; }
    setOverviewLoading(true);
    try {
      const s = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const e = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const { data, error } = await supabase
        .from("employee_schedules")
        .select("user_id, date, shift_code")
        .gte("date", s)
        .lte("date", e);
      if (error) throw error;

      const map = {};
      (data || []).forEach((row) => {
        const cur = map[row.user_id] || { days: 0, shifts: {} };
        cur.days += 1;
        if (row.shift_code) cur.shifts[row.shift_code] = (cur.shifts[row.shift_code] || 0) + 1;
        map[row.user_id] = cur;
      });
      // Normalisasi: shifts -> array kode terurut frekuensi
      Object.keys(map).forEach((k) => {
        map[k].shifts = Object.entries(map[k].shifts)
          .sort((a, b) => b[1] - a[1])
          .map(([code]) => code);
      });
      setMonthOverview(map);
    } catch {
      toast.error("Gagal memuat ringkasan jadwal\nPeriksa koneksi Anda, lalu coba lagi.");
      setMonthOverview({});
    } finally {
      setOverviewLoading(false);
    }
  }, [employees.length, year, month, lastDay]);

  useEffect(() => {
    // setTimeout: muat lewat task terpisah — setState tidak sinkron di dalam
    // body effect (pola yang sama dipakai halaman admin lainnya).
    const kick = setTimeout(loadMonthOverview, 0);
    return () => clearTimeout(kick);
  }, [loadMonthOverview]);

  // Baris daftar pegawai: status kelengkapan + shift yang dipakai.
  // Penyebut = jumlah hari dalam bulan tampil (jujur, bukan asumsi hari kerja).
  const employeeRows = useMemo(() => {
    const rows = employees.map((emp) => {
      const info = monthOverview[emp.id] || { days: 0, shifts: [] };
      const days = info.days;
      const state = days === 0 ? "none" : days >= lastDay ? "full" : "part";
      return {
        id: emp.id,
        name: emp.full_name || "–",
        position: emp.position || emp.role || "",
        days,
        shifts: info.shifts.slice(0, 3),
        state,
      };
    });
    return rows.sort((a, b) => a.days - b.days || a.name.localeCompare(b.name));
  }, [employees, monthOverview, lastDay]);

  const listCounts = useMemo(() => ({
    total: employeeRows.length,
    full: employeeRows.filter((r) => r.state === "full").length,
    part: employeeRows.filter((r) => r.state === "part").length,
    none: employeeRows.filter((r) => r.state === "none").length,
  }), [employeeRows]);

  const visibleRows = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    return employeeRows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && !String(r.position).toLowerCase().includes(q)) return false;
      if (listFilter === "full" && r.state !== "full") return false;
      if (listFilter === "part" && r.state !== "part") return false;
      if (listFilter === "none" && r.state !== "none") return false;
      return true;
    });
  }, [employeeRows, listQuery, listFilter]);

  // Pilih satu pegawai dari daftar → kalender pegawai itu terbuka di bawah.
  const pickEmployee = (id) => {
    setSelectedUsers([id]);
  };

  const { pullDistance, isRefreshing } = usePullToRefresh(() => loadSchedules());

  const nav = (dir) => {
    let m = month + dir;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  };

  return (
    <div className="space-y-5 animate-fade-in min-w-0 pb-24 md:pb-6">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      {/* HEADER */}
      <div className="relative design-card p-5 md:p-6 overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-electric-violet/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-deep-indigo/10 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-end gap-4">
          <div className="flex flex-wrap gap-2">
            <button onClick={handleDownloadTemplate}
              className="flex items-center gap-2 px-3.5 py-2 bg-electric-violet text-pure-white rounded-full text-xs hover:brightness-110 active:brightness-90 transition-all duration-200">
              <Download size={14} /> Template
            </button>
            <button onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3.5 py-2 bg-electric-violet text-pure-white rounded-full text-xs hover:brightness-110 active:brightness-90 transition-all duration-200">
              <Upload size={14} /> Upload Excel
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
          </div>
        </div>
      </div>

      {/* CONTROLS */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Users size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-mist z-10" />
          <div onClick={() => setShowSearchModal(true)}
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-2xl bg-onyx border border-white/[0.06] text-pure-white cursor-pointer flex items-center gap-2 hover:bg-white/[0.03] transition-all">
            {selectedUsers.length === 1 && selectedEmployee ? (
              <>
                <span className="flex-1 truncate font-medium">{selectedEmployee.full_name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-onyx text-slate-mist">{selectedEmployee.role}</span>
              </>
            ) : selectedUsers.length > 1 ? (
              <>
                <span className="flex-1 truncate font-medium">{selectedUsers.length} pegawai dipilih</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2F8BF8]/20 text-[#2F8BF8] font-semibold">multi</span>
              </>
            ) : (
              <span className="text-slate-mist flex-1">Pilih pegawai...</span>
            )}
            <Search size={14} className="text-slate-mist shrink-0" />
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-onyx border border-white/[0.06] rounded-2xl px-2.5 py-1.5">
          <button onClick={() => nav(-1)} className="p-1.5 rounded-full hover:bg-white/[0.03] text-slate-mist hover:text-pure-white transition-all"><ChevronLeft size={17} /></button>
          <span className="text-sm font-semibold text-pure-white w-[136px] text-center select-none">{MONTHS[month]} {year}</span>
          <button onClick={() => nav(1)} className="p-1.5 rounded-full hover:bg-white/[0.03] text-slate-mist hover:text-pure-white transition-all"><ChevronRight size={17} /></button>
        </div>
      </div>

      {/* QUICK ACTIONS + STATS */}
      {selectedUser && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowBulkAssign(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border-gradient bg-transparent text-pure-white text-xs font-medium transition-all active:scale-95 shadow-sm">
              <Layers size={14} /> Isi Cepat
            </button>
            <button onClick={handleCopyPrevMonth}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border-gradient bg-transparent text-pure-white text-xs font-medium transition-all active:scale-95">
              <Copy size={14} /> Copy Bulan Lalu
            </button>
            <button onClick={handleClearMonth}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border-gradient bg-transparent text-pure-white text-xs font-medium transition-all active:scale-95">
              <Trash2 size={14} /> Hapus Bulan
            </button>
          </div>
          <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-2xl bg-onyx border border-white/[0.06] text-[11px] text-slate-mist">
            <span className="flex items-center gap-1"><Calendar size={12} /> {assignedCount}/{lastDay} hari</span>
            <span className="w-px h-3 bg-white/10" />
            <span className="flex items-center gap-1"><Clock size={12} /> {MONTHS[month]}</span>
          </div>
        </div>
      )}

      {/* PERINGATAN: instansi belum punya master shift */}
      {!shiftsLoading && shifts.length === 0 && (
        <div className="flex items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">Belum ada master shift</p>
            <p className="text-xs mt-0.5">
              Buat dulu shift instansi di <b>Pengaturan → Kelola Shift</b> (mis. Pagi, Siang, Malam),
              lalu kembali ke sini untuk mengisi jadwal pegawai.
            </p>
          </div>
        </div>
      )}

      {/* LEGEND */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[9px] font-semibold text-slate-mist uppercase tracking-wider mr-1">Shift</span>
        {shifts.map(s => {
          const Icon = s.icon;
          return (
            <span key={s.code} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium ${s.badgeClass}`}>
              <Icon size={11} /> {s.name}
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-onyx text-slate-mist ring-1 ring-white/5">
          <X size={11} /> Kosong
        </span>
      </div>

      {/* DAFTAR PEGAWAI + STATUS JADWAL BULAN INI */}
      <div className="design-card overflow-hidden">
        <button type="button" onClick={() => setListOpen((v) => !v)}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors">
          <span className="w-8 h-8 rounded-xl bg-electric-violet/15 flex items-center justify-center shrink-0">
            <UserCheck size={15} className="text-electric-violet" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-pure-white">Daftar Pegawai &amp; Jadwal</span>
            <span className="block text-[10.5px] text-slate-mist mt-0.5">
              {MONTHS[month]} {year} · {listCounts.total} pegawai
            </span>
          </span>
          <ChevronRight size={16}
            className={`text-slate-mist shrink-0 transition-transform duration-200 ${listOpen ? "rotate-90" : ""}`} />
        </button>

        {listOpen && (
          <div className="border-t border-white/[0.06]">
            {/* Ringkasan status — angka asli dari employee_schedules */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3">
              {[
                { key: "total", label: "Total pegawai", value: listCounts.total, color: "text-periwinkle-glow" },
                { key: "full", label: "Lengkap", value: listCounts.full, color: "text-emerald-400" },
                { key: "part", label: "Sebagian", value: listCounts.part, color: "text-amber-300" },
                { key: "none", label: "Belum ada", value: listCounts.none, color: "text-rose-400" },
              ].map((c) => (
                <div key={c.key} className="rounded-xl bg-onyx border border-white/[0.06] px-3 py-2">
                  <p className={`text-lg font-extrabold leading-none tabular-nums ${c.color}`}>{c.value}</p>
                  <p className="text-[10.5px] font-semibold text-slate-mist mt-1">{c.label}</p>
                </div>
              ))}
            </div>

            {/* Pencarian + filter */}
            <div className="px-3 pb-2 space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-mist" />
                <input
                  value={listQuery}
                  onChange={(e) => setListQuery(e.target.value)}
                  placeholder="Cari nama atau jabatan…"
                  className="w-full pl-8.5 pr-3 py-2 text-xs rounded-xl bg-onyx border border-white/[0.06] text-pure-white placeholder:text-slate-mist focus:outline-none focus:border-electric-violet/50"
                  style={{ paddingLeft: 32 }}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: "all", label: "Semua" },
                  { key: "full", label: "Lengkap" },
                  { key: "part", label: "Sebagian" },
                  { key: "none", label: "Belum ada" },
                ].map((f) => (
                  <button key={f.key} type="button" onClick={() => setListFilter(f.key)}
                    className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold transition-all ${
                      listFilter === f.key
                        ? "bg-electric-violet/25 text-pure-white ring-1 ring-electric-violet/50"
                        : "bg-white/[0.04] text-slate-mist hover:bg-white/[0.07]"
                    }`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Baris pegawai */}
            {overviewLoading ? (
              <div className="p-3 space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <Skeleton dark width={34} height={34} radius={999} />
                    <div className="flex-1" style={{ display: "grid", gap: 6 }}>
                      <Skeleton dark width="42%" height={10} />
                      <Skeleton dark width="28%" height={8} />
                    </div>
                    <Skeleton dark width={56} height={20} radius={999} />
                  </div>
                ))}
              </div>
            ) : visibleRows.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-mist">
                Tidak ada pegawai yang cocok dengan pencarian/filter ini.
              </p>
            ) : (
              <div className="max-h-[340px] overflow-y-auto">
                {visibleRows.map((r) => {
                  const isActive = selectedUsers.includes(r.id);
                  const stateStyle = r.state === "full"
                    ? { bg: "bg-emerald-500/15", text: "text-emerald-300", label: "Lengkap" }
                    : r.state === "part"
                      ? { bg: "bg-amber-500/15", text: "text-amber-300", label: "Sebagian" }
                      : { bg: "bg-rose-500/15", text: "text-rose-300", label: "Belum ada" };
                  return (
                    <button key={r.id} type="button" onClick={() => pickEmployee(r.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-t border-white/[0.05] transition-colors ${
                        isActive ? "bg-electric-violet/10" : "hover:bg-white/[0.03]"
                      }`}>
                      <span className="w-[34px] h-[34px] rounded-full bg-gradient-to-br from-[#2F8BF8] to-[#1F74E0] flex items-center justify-center text-[11px] font-extrabold text-white shrink-0">
                        {r.name.trim().charAt(0).toUpperCase()}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[12.5px] font-bold text-pure-white truncate">{r.name}</span>
                        {r.position && (
                          <span className="block text-[10.5px] text-slate-mist truncate mt-0.5">{r.position}</span>
                        )}
                      </span>
                      <span className="hidden sm:flex items-center gap-1 shrink-0">
                        {r.shifts.map((code) => {
                          const sv = SHIFT_MAP[code];
                          return (
                            <span key={code}
                              className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-full ${sv ? sv.badgeClass : "bg-white/[0.06] text-slate-mist"}`}>
                              {sv?.name || code}
                            </span>
                          );
                        })}
                      </span>
                      <span className="text-[11px] font-extrabold tabular-nums text-pure-white shrink-0 w-[58px] text-right">
                        {r.days}<span className="text-slate-mist font-bold">/{lastDay}</span>
                      </span>
                      <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full shrink-0 ${stateStyle.bg} ${stateStyle.text}`}>
                        {stateStyle.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center justify-between gap-3 flex-wrap">
              <p className="text-[10.5px] text-slate-mist">
                Klik pegawai untuk membuka kalender &amp; mengisi jadwalnya.
              </p>
              <button type="button" onClick={() => setShowBulkAssign(true)}
                className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-electric-violet hover:brightness-125 transition-all">
                <Layers size={11} /> Isi Cepat
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CALENDAR */}
      {!selectedUser ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-electric-violet/20 to-deep-indigo/20 flex items-center justify-center mb-4 ring-1 ring-white/[0.06]">
            <Calendar size={32} className="text-periwinkle-glow" />
          </div>
          <p className="text-slate-mist font-medium">Pilih pegawai untuk mulai</p>
          <p className="text-slate-mist text-sm mt-1">Klik kolom pencarian di atas, lalu cari nama pegawai</p>
        </div>
      ) : loading ? (
        <div className="design-card p-3 md:p-5">
          <div className="grid grid-cols-7 gap-1.5 md:gap-2 mb-2">
            {[...Array(7)].map((_, i) => (
              <Skeleton key={i} dark width="55%" height={8} style={{ margin: "4px auto" }} />
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5 md:gap-2">
            {[...Array(35)].map((_, i) => (
              <Skeleton key={i} dark width="100%" height={54} radius={12} />
            ))}
          </div>
        </div>
      ) : (
        <div className="design-card p-3 md:p-5 overflow-x-auto">
          <div className="min-w-0">
            <div className="grid grid-cols-7 gap-1.5 md:gap-2 mb-2">
              {DAY_SHORT.map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-slate-mist uppercase tracking-widest py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5 md:gap-2">
              {days.map((day, i) => {
                const key = dateStr(day);
                const sched = key ? schedules[key] : undefined;
                const shiftInfo = sched ? SHIFT_MAP[sched.shift_code] : null;
                const now = new Date();
                const isToday = day && year === now.getFullYear() && month === now.getMonth() && day === now.getDate();
                return (
                  <button key={i} onClick={() => handleDayClick(day)} disabled={!day}
                    className={`group relative aspect-square md:aspect-[4/3] rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 text-xs
                      ${!day ? "invisible" : "cursor-pointer active:scale-95"}
                      ${isToday ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-white" : ""}
                      ${!shiftInfo
                        ? "bg-white/[0.02] hover:bg-white/[0.06] hover:shadow-lg"
                        : `${shiftInfo.premiumClass} hover:brightness-110 hover:shadow-lg`
                      }
                    `}>
                    <span className={`text-[11px] font-bold leading-none ${isToday ? "text-blue-300" : "text-slate-mist"}`}>{day}</span>
                    {shiftInfo && (
                      <div className="flex items-center gap-0.5 mt-0.5">
                        <shiftInfo.icon size={9} />
                        <span className="text-[7px] font-bold tracking-wider">{shiftInfo.name}</span>
                      </div>
                    )}
                    <div className={`absolute inset-0 rounded-2xl transition-opacity duration-300 opacity-0 group-hover:opacity-100 bg-gradient-to-t from-white/[0.06] to-transparent pointer-events-none`} />
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
          {shifts.map(s => {
            const Icon = s.icon;
            const isActive = schedules[showShiftPicker]?.shift_code === s.code;
            return (
              <button key={s.code} onClick={() => assignShift(s.code)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl transition-all text-sm
                  ${isActive ? "bg-[#2F8BF8]/10 border border-[#2F8BF8]/40 text-gray-900 shadow-sm" : "bg-gray-50 border border-transparent text-gray-600 hover:bg-gray-100 hover:border-gray-200"}`}>
                <div className={`w-8 h-8 rounded-2xl flex items-center justify-center ${s.badgeClass}`}>
                  <Icon size={16} />
                </div>
                <span className="flex-1 text-left font-medium">{s.name}</span>
                {isActive && <CheckCircle2 size={16} className="text-[#2F8BF8]" />}
              </button>
            );
          })}
        </div>
        {schedules[showShiftPicker] && (
          <button onClick={() => assignShift(schedules[showShiftPicker].shift_code)}
            className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full border border-red-200 bg-transparent text-red-600 text-xs font-medium hover:bg-red-50 transition-all active:scale-95">
            <Trash2 size={13} /> Hapus Jadwal
          </button>
        )}
      </BottomSheet>

      {/* BULK ASSIGN */}
      {showBulkAssign && (
        <BulkAssignDialog
          employees={employees}
          shifts={shifts}
          year={year} month={month} lastDay={lastDay}
          onClose={() => setShowBulkAssign(false)}
          onDone={() => { setShowBulkAssign(false); if (selectedUser) loadSchedules(); }}
        />
      )}

      {/* EMPLOYEE SEARCH — Bottom Sheet (multi-pilih via checklist).
          bottomPad kecil: sheet ini punya tombol "Selesai" sendiri, jadi tidak
          perlu ruang 100px untuk bottom nav (dulu menyisakan gap kosong besar). */}
      <BottomSheet open={showSearchModal} onClose={() => setShowSearchModal(false)}
        bottomPad="calc(1rem + env(safe-area-inset-bottom, 0px))"
        title="Cari Pegawai" subtitle={employees.length + " pegawai terdaftar"}>
        <EmployeeSearchContent
          employees={employees} selectedIds={selectedUsers}
          onToggle={(id) => setSelectedUsers(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
          onToggleAll={(ids, allSel) => setSelectedUsers(p => allSel
            ? p.filter(x => !ids.includes(x))
            : Array.from(new Set([...p, ...ids])))}
          onDone={() => setShowSearchModal(false)} />
      </BottomSheet>

      {/* CONFIRM CLEAR */}
      <ConfirmSheet open={!!confirmClear} onClose={() => setConfirmClear(null)}
        title="Hapus Jadwal Bulan Ini"
        message={`Hapus semua jadwal ${confirmClear?.name} bulan ${MONTHS[month]} ${year}?`}
        confirmText="Ya, Hapus" onConfirm={confirmClearMonth} />

      {/* FOOTER INFO */}
      <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-gradient-to-r from-sky-500/5 to-blue-500/5 border border-sky-500/10 text-[11px] text-slate-mist">
          <div className="w-6 h-6 rounded-2xl bg-sky-500/10 flex items-center justify-center shrink-0">
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
    if (!selectedUsers.length) { toast.warning("Pilih pegawai dulu\nBuka daftar pegawai di atas untuk mulai mengisi jadwal."); return; }
    setShowShiftPicker(dateStr(day));
  }

  async function assignShift(shiftCode) {
    if (!showShiftPicker || !selectedUsers.length) return;
    const key = showShiftPicker;
    try {
      if (schedules[key]?.shift_code === shiftCode) {
        // Toggle-off: hapus shift yang sama untuk SEMUA pegawai terpilih;
        // pegawai dengan shift lain di tanggal itu tidak tersentuh.
        await supabase.from("employee_schedules").delete()
          .in("user_id", selectedUsers).eq("date", key).eq("shift_code", shiftCode);
        setSchedules(prev => { const n = { ...prev }; delete n[key]; return n; });
        toast.success("Jadwal dihapus\nShift pada tanggal tersebut sudah dikosongkan.");
      } else {
        const rows = selectedUsers.map(uid => ({ user_id: uid, date: key, shift_code: shiftCode }));
        const { error } = await supabase.from("employee_schedules").upsert(rows, { onConflict: "user_id,date" });
        if (error) throw error;
        setSchedules(prev => ({ ...prev, [key]: { date: key, shift_code: shiftCode } }));
        toast.success(`Jadwal berhasil ditambahkan\nShift ${shifts.find(s => s.code === shiftCode)?.name || shiftCode} · ${selectedUsers.length} pegawai`);
      }
    } catch (err) { toast.error("Gagal menyimpan jadwal\n" + err.message); }
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
        if (inactiveShiftCodesRef.current.has(sc)) { fail++; continue; }
        let pd; if (/^\d{4}-\d{2}-\d{2}$/.test(tgl)) pd = tgl;
        else if (/^\d{2}\/\d{2}\/\d{4}$/.test(tgl)) { const [d,m,y] = tgl.split("/"); pd = `${y}-${m}-${d}`; }
        else { fail++; continue; }
        const normalizedName = nama.toLowerCase();
        const matchedEmployee = employees.find(employee =>
          employee.full_name?.toLowerCase() === normalizedName
        ) || employees.find(employee =>
          employee.full_name?.toLowerCase().includes(normalizedName)
        );
        if (!matchedEmployee) { fail++; continue; }
        const { error } = await supabase.from("employee_schedules").upsert(
          { user_id: matchedEmployee.id, date: pd, shift_code: sc }, { onConflict: "user_id,date" }
        );
        if (error) fail++; else ok++;
      }
      toast.success(`Import Excel selesai\n${ok} baris berhasil${fail ? ` · ${fail} baris dilewati` : ""}`);
      if (selectedUser) loadSchedules();
    } catch { toast.error("Gagal membaca file\nPastikan format Excel sesuai template."); }
    e.target.value = "";
  }

  async function handleCopyPrevMonth() {
    if (!selectedUsers.length) return;
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    const pDays = Math.min(new Date(py, pm + 1, 0).getDate(), lastDay);
    setLoading(true);
    try {
      const { data: prev } = await supabase.from("employee_schedules").select("user_id, date, shift_code")
        .in("user_id", selectedUsers)
        .gte("date", `${py}-${String(pm + 1).padStart(2,"0")}-01`)
        .lte("date", `${py}-${String(pm + 1).padStart(2,"0")}-${String(pDays).padStart(2,"0")}`);
      if (!prev?.length) { toast.info("Tidak ada jadwal bulan lalu"); setLoading(false); return; }
      const inserts = prev.map(s => ({
        user_id: s.user_id,
        date: `${year}-${String(month + 1).padStart(2,"0")}-${s.date.split("-")[2].padStart(2,"0")}`,
        shift_code: s.shift_code
      }));
      const { error } = await supabase.from("employee_schedules").upsert(inserts, { onConflict: "user_id,date" });
      if (error) throw error;
      toast.success(`Jadwal bulan lalu disalin\n${inserts.length} jadwal untuk ${new Set(prev.map(p => p.user_id)).size} pegawai`);
      await loadSchedules();
    } catch (err) { toast.error("Gagal menyalin jadwal\n" + err.message); }
    setLoading(false);
  }

  function handleClearMonth() {
    if (!selectedUsers.length) return;
    const name = selectedUsers.length === 1
      ? employees.find(e => e.id === selectedUsers[0])?.full_name
      : `${selectedUsers.length} pegawai`;
    setConfirmClear({ name });
  }

  async function confirmClearMonth() {
    if (!selectedUsers.length) return;
    const s = `${year}-${String(month + 1).padStart(2,"0")}-01`;
    const e = `${year}-${String(month + 1).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
    await supabase.from("employee_schedules").delete().in("user_id", selectedUsers).gte("date", s).lte("date", e);
    setSchedules({});
    setConfirmClear(null);
    toast.success("Jadwal bulan ini dihapus\nSeluruh jadwal pegawai terpilih sudah dikosongkan.");
  }
}

/* ============================================================
   EMPLOYEE SEARCH CONTENT — multi-pilih (checklist + pilih semua)
   ============================================================ */
function EmployeeSearchContent({ employees, selectedIds, onToggle, onToggleAll, onDone }) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 200); }, []);

  const filtered = q ? employees.filter(e => e.full_name.toLowerCase().includes(q.toLowerCase())) : employees;
  const allFilteredSelected = filtered.length > 0 && filtered.every(e => selectedIds.includes(e.id));

  return (
    <div className="pb-1">
      {/* Blok pencarian + aksi "pilih semua" menempel di atas scroller.
          latar putih solid supaya tidak tampak tertutup judul sheet saat
          daftar pegawai di-scroll. -mx-5/px-5 menutup gutter px-5 milik
          container BottomSheet. */}
      <div className="sticky top-0 z-10 -mx-5 px-5 pt-1 pb-2 bg-white space-y-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
            placeholder="Ketik nama pegawai..."
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-2xl bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2F8BF8]/40 transition-all" />
        </div>
        <div className="flex items-center justify-between px-1">
          <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
            Pegawai ({selectedIds.length} dipilih)
          </span>
          <button onClick={() => onToggleAll(filtered.map(e => e.id), allFilteredSelected)}
            className="text-[10px] font-semibold text-[#2F8BF8] hover:text-[#1F74E0] transition-all">
            {allFilteredSelected ? "Hapus semua" : "Pilih semua"}
          </button>
        </div>
      </div>
      {/* Tanpa scroller bersarang: satu-satunya area scroll adalah milik
          BottomSheet, sehingga header pencarian yang sticky benar-benar
          menempel dan daftar panjang tidak "bertengkar" dengan sheet. */}
      <div className="space-y-0.5 -mx-1 px-1">
        {filtered.map(emp => (
          <label key={emp.id}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm text-left cursor-pointer transition-all ${selectedIds.includes(emp.id) ? "bg-[#2F8BF8]/10 text-gray-900 ring-1 ring-[#2F8BF8]/40" : "text-gray-600 hover:bg-gray-50"}`}>
            <input type="checkbox" checked={selectedIds.includes(emp.id)} onChange={() => onToggle(emp.id)}
              className="accent-[#2F8BF8] w-4 h-4 shrink-0" />
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2F8BF8] to-[#39C0DF] flex items-center justify-center text-xs font-bold text-white shrink-0">
              {emp.full_name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{emp.full_name}</p>
              <p className="text-[10px] text-gray-400">{emp.role}</p>
            </div>
          </label>
        ))}
        {!filtered.length && <p className="text-xs text-gray-400 text-center py-6">Tidak ditemukan</p>}
      </div>
      {/* Aksi penutup menempel di bawah: daftar panjang tetap bisa digulir
          tanpa tombol "Selesai" hilang, dan tidak ada ruang kosong di bawahnya. */}
      <div className="sticky bottom-0 -mx-5 px-5 pt-2 pb-1 bg-white">
        <button onClick={onDone}
          className="w-full py-2.5 bg-[#2F8BF8] hover:bg-[#1F74E0] text-white rounded-full text-sm font-semibold shadow-lg active:scale-[0.98] transition-all">
          Selesai{selectedIds.length ? ` (${selectedIds.length} dipilih)` : ""}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   BULK ASSIGN DIALOG
   ============================================================ */
function BulkAssignDialog({ employees, year, month, lastDay, shifts = [], onClose, onDone }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [range, setRange] = useState({ start: 1, end: lastDay });
  const [days, setDays] = useState([0,1,2,3,4,5]);
  const [shiftCode, setShiftCode] = useState(shifts[0]?.code || "");
  const [saving, setSaving] = useState(false);

  const toggle = (id) => setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const apply = async () => {
    if (!selectedIds.length) { toast.warning("Pilih pegawai dulu\nCentang minimal satu pegawai untuk diisi jadwalnya."); return; }
    if (!days.length) { toast.warning("Pilih hari dulu\nTentukan hari kerja yang ingin diisi."); return; }
    if (range.start > range.end) { toast.warning("Rentang tanggal terbalik\nTanggal awal harus sebelum tanggal akhir."); return; }
    setSaving(true);
    try {
      const inserts = [];
      for (let d = range.start; d <= range.end; d++) {
        const pg = (new Date(year, month, d).getDay() + 6) % 7;
        if (!days.includes(pg)) continue;
        const ds = `${year}-${String(month + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
        for (const uid of selectedIds) inserts.push({ user_id: uid, date: ds, shift_code: shiftCode });
      }
      if (!inserts.length) { toast.warning("Tidak ada hari yang cocok\nPeriksa kembali pilihan hari dan rentang tanggal."); setSaving(false); return; }
      const { error } = await supabase.from("employee_schedules").upsert(inserts, { onConflict: "user_id,date" });
      if (error) throw error;
      toast.success(`Isi cepat berhasil\n${inserts.length} jadwal untuk ${selectedIds.length} pegawai`);
      onDone();
    } catch (err) { toast.error("Gagal mengisi jadwal\n" + err.message); }
    setSaving(false);
  };

  return createPortal(
    // Portal ke body: modal keluar dari konteks stacking AdminLayout agar
    // selalu di atas BottomNav; data-no-ptr mematikan pull-to-refresh di
    // dalam modal agar scroll native tetap bekerja di mobile.
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-lg shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto" data-no-ptr onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#2F8BF8]/10 flex items-center justify-center shadow-sm">
              <Layers size={17} className="text-[#2F8BF8]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Isi Cepat Jadwal</h3>
              <p className="text-[10px] text-gray-400">Atur shift untuk banyak pegawai sekaligus</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Shift */}
          <div>
            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Shift</label>
            <div className="grid grid-cols-2 gap-2">
              {shifts.map(s => {
                const Icon = s.icon;
                return (
                  <button key={s.code} onClick={() => setShiftCode(s.code)}
                    className={`flex items-center gap-2.5 px-3.5 py-3 rounded-2xl text-xs font-medium transition-all ${shiftCode === s.code ? "bg-[#2F8BF8]/10 border border-[#2F8BF8]/40 text-gray-900 shadow-sm" : "bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100"}`}>
                    <Icon size={16} className={s.color} /> {s.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Rentang Tanggal</label>
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3">
              <div className="flex items-center justify-center gap-3">
                <div className="text-center">
                  <span className="text-[10px] text-gray-500 block mb-1">Dari</span>
                  <input type="number" min={1} max={lastDay} value={range.start}
                    onChange={e => setRange(p => ({ ...p, start: Math.max(1, Math.min(lastDay, Number(e.target.value)))}))}
                    className="w-16 px-2 py-1.5 text-sm rounded-2xl bg-white border border-gray-200 text-gray-900 text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#2F8BF8]/50" />
                </div>
                <span className="text-gray-400 mt-5">—</span>
                <div className="text-center">
                  <span className="text-[10px] text-gray-500 block mb-1">Sampai</span>
                  <input type="number" min={1} max={lastDay} value={range.end}
                    onChange={e => setRange(p => ({ ...p, end: Math.max(1, Math.min(lastDay, Number(e.target.value)))}))}
                    className="w-16 px-2 py-1.5 text-sm rounded-2xl bg-white border border-gray-200 text-gray-900 text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#2F8BF8]/50" />
                </div>
                <span className="text-[10px] text-gray-400 mt-5 whitespace-nowrap">{MONTHS[month]} {year}</span>
              </div>
            </div>
          </div>

          {/* Days */}
          <div>
            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Hari</label>
            <div className="flex flex-wrap gap-1.5">
              {DAY_SHORT.map((d, i) => (
                <button key={i} onClick={() => setDays(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i])}
                  className={`px-3.5 py-2 rounded-full text-[10px] font-bold transition-all ${days.includes(i) ? "bg-[#2F8BF8]/10 border border-[#2F8BF8]/40 text-[#2F8BF8] shadow-sm" : "bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100"}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Employees */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Pegawai ({selectedIds.length})</label>
              <button onClick={() => { if (selectAll) { setSelectedIds([]); setSelectAll(false); } else { setSelectedIds(employees.map(e => e.id)); setSelectAll(true); } }}
                className="text-[10px] font-semibold text-[#2F8BF8] hover:text-[#1F74E0] transition-all">{selectAll ? "Hapus semua" : "Pilih semua"}</button>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-0.5 rounded-2xl bg-gray-50 border border-gray-200 p-1">
              {employees.map(emp => (
                <label key={emp.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer text-xs transition-all ${selectedIds.includes(emp.id) ? "bg-[#2F8BF8]/10 border border-[#2F8BF8]/30" : "hover:bg-gray-100"}`}>
                  <input type="checkbox" checked={selectedIds.includes(emp.id)} onChange={() => toggle(emp.id)}
                    className="accent-[#2F8BF8] w-3.5 h-3.5" />
                  <span className="text-gray-700 flex-1 font-medium">{emp.full_name}</span>
                  <span className="text-[9px] text-gray-500">{emp.role}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Apply */}
          <button onClick={apply} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#2F8BF8] hover:bg-[#a000e0] text-white rounded-full text-sm font-semibold hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Menyimpan...</> : <><CheckCircle2 size={17} /> Terapkan Jadwal</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
