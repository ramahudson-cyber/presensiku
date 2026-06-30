import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import {
  MapPin, Clock, Users, FileText, Save, RefreshCw,
  Plus, Pencil, Trash2, Search, Key, Shield,
  CheckCircle2, AlertTriangle, Activity, Eye, Smartphone,
  Mail, Clock as ClockIcon, XCircle, Inbox, MapPinned,
  Briefcase, User, IdCard, Calendar, Bell, Sun,
} from "lucide-react";
import TabShift from "./ShiftManagement";
import BottomSheet from "../../components/BottomSheet";
import ConfirmSheet from "../../components/ConfirmSheet";

/* ──────────────────────────────────────────────────────────────────────────
   SHARED THEME TOKENS
   ────────────────────────────────────────────────────────────────────────── */
const cardBase =
  "bg-violet-400/20 backdrop-blur-sm border border-white/10 rounded-2xl transition-all";

const inputBase =
  "w-full px-3 py-2.5 text-sm rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all";

const labelBase =
  "block text-xs font-medium text-violet-100/70 mb-1.5 uppercase tracking-wider";

const sectionTitle =
  "text-xl md:text-2xl font-bold text-white tracking-tight";

const sectionSub = "text-sm text-slate-200 mt-1";

const btnPrimary =
  "flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-violet-900/30 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed";

const btnGhost =
  "p-2 rounded-xl border border-white/10 bg-white/5 text-violet-100/70 hover:text-violet-200 hover:bg-white/10 hover:scale-105 transition-all";

const avatarGradient = (name = "") => {
  const grads = [
    "from-violet-500 to-purple-700",
    "from-sky-500 to-blue-700",
    "from-emerald-500 to-teal-700",
    "from-amber-500 to-orange-700",
    "from-rose-500 to-pink-700",
    "from-fuchsia-500 to-purple-700",
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return grads[sum % grads.length];
};

const initials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

/* ============================================================
   TAB 1: PROFIL PUSKESMAS & LOKASI GPS
   ============================================================ */
function TabProfilPuskesmas() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    latitude: "",
    longitude: "",
    radius_meter: 200,
    is_active: true,
  });

  const [confirmDeleteLoc, setConfirmDeleteLoc] = useState(null);

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("attendance_locations")
        .select("*")
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLocations(data || []);
    } catch (err) {
      console.error("❌ Fetch locations:", err);
      toast.error("Gagal memuat data lokasi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLocations(); }, []);

  const resetForm = () => {
    setFormData({
      name: "",
      address: "",
      latitude: "",
      longitude: "",
      radius_meter: 200,
      is_active: true,
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (loc) => {
    setFormData({
      name: loc.name,
      address: loc.address || "",
      latitude: loc.latitude,
      longitude: loc.longitude,
      radius_meter: loc.radius_meter,
      is_active: loc.is_active,
    });
    setEditingId(loc.id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (formData.is_active) {
        await supabase
          .from("attendance_locations")
          .update({ is_active: false })
          .neq("id", editingId || "00000000-0000-0000-0000-000000000000");
      }

      if (editingId) {
        const { error } = await supabase
          .from("attendance_locations")
          .update({
            name: formData.name,
            address: formData.address,
            latitude: parseFloat(formData.latitude),
            longitude: parseFloat(formData.longitude),
            radius_meter: parseInt(formData.radius_meter),
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId);

        if (error) throw error;
        toast.success("✅ Lokasi berhasil diperbarui");

        await supabase.rpc("log_audit", {
          p_action: "UPDATE_LOCATION",
          p_description: `Update lokasi: ${formData.name}`,
          p_entity_type: "attendance_locations",
          p_entity_id: editingId,
        });
      } else {
        const { data, error } = await supabase
          .from("attendance_locations")
          .insert({
            name: formData.name,
            address: formData.address,
            latitude: parseFloat(formData.latitude),
            longitude: parseFloat(formData.longitude),
            radius_meter: parseInt(formData.radius_meter),
            is_active: formData.is_active,
          })
          .select()
          .single();

        if (error) throw error;
        toast.success("✅ Lokasi baru berhasil ditambahkan");

        await supabase.rpc("log_audit", {
          p_action: "CREATE_LOCATION",
          p_description: `Tambah lokasi baru: ${formData.name}`,
          p_entity_type: "attendance_locations",
          p_entity_id: data.id,
        });
      }

      resetForm();
      fetchLocations();
    } catch (err) {
      console.error("❌ Submit error:", err);
      toast.error("Gagal: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id, name) => {
    setConfirmDeleteLoc({ id, name });
  };

  const confirmDeleteLocation = async () => {
    if (!confirmDeleteLoc) return;
    const { id, name } = confirmDeleteLoc;
    setConfirmDeleteLoc(null);
    try {
      const { error } = await supabase
        .from("attendance_locations")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Lokasi berhasil dihapus");

      await supabase.rpc("log_audit", {
        p_action: "DELETE_LOCATION",
        p_description: `Hapus lokasi: ${name}`,
        p_entity_type: "attendance_locations",
        p_entity_id: id,
      });

      fetchLocations();
    } catch (err) {
      toast.error("Gagal menghapus: " + err.message);
    }
  };

  const handleSetActive = async (id, name) => {
    try {
      await supabase
        .from("attendance_locations")
        .update({ is_active: false })
        .neq("id", id);

      await supabase
        .from("attendance_locations")
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq("id", id);

      toast.success(`✅ ${name} dijadikan lokasi aktif`);

      await supabase.rpc("log_audit", {
        p_action: "SET_ACTIVE_LOCATION",
        p_description: `Set lokasi aktif: ${name}`,
        p_entity_type: "attendance_locations",
        p_entity_id: id,
      });

      fetchLocations();
    } catch (err) {
      toast.error("Gagal: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={28} className="animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className={sectionTitle}>Lokasi Puskesmas</h2>
          <p className={sectionSub}>Kelola lokasi puskesmas & radius absensi GPS</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className={btnPrimary}
        >
          <Plus size={16} /> Tambah Lokasi
        </button>
      </div>

      <BottomSheet open={showForm} onClose={resetForm}
        title={editingId ? "Edit Lokasi" : "Tambah Lokasi Baru"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelBase}>
              <MapPin size={11} className="inline mr-1" />
              Nama Lokasi *
            </label>
            <input
              type="text" required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Contoh: Puskesmas Ampenan"
              className={inputBase}
            />
          </div>

          <div>
            <label className={labelBase}>
              <MapPinned size={11} className="inline mr-1" />
              Alamat
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Jl. ..."
              className={inputBase}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelBase}>Latitude *</label>
              <input
                type="number" step="any" required
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                placeholder="-8.5697"
                className={`${inputBase} font-mono`}
              />
            </div>
            <div>
              <label className={labelBase}>Longitude *</label>
              <input
                type="number" step="any" required
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                placeholder="116.0821"
                className={`${inputBase} font-mono`}
              />
            </div>
          </div>

          <div>
            <label className={labelBase}>
              <MapPin size={11} className="inline mr-1" />
              Radius Absensi (meter) *
            </label>
            <input
              type="number" required min="10" max="2000"
              value={formData.radius_meter}
              onChange={(e) => setFormData({ ...formData, radius_meter: e.target.value })}
              className={inputBase}
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 rounded accent-violet-500"
            />
            <span className="text-sm text-violet-100/90">
              Jadikan lokasi aktif (untuk absensi)
            </span>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="button" onClick={resetForm}
              className="flex-1 py-2.5 border border-white/10 text-violet-200/80 rounded-xl text-sm font-medium hover:bg-white/5 transition-all"
            >
              Batal
            </button>
            <button
              type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-violet-900/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              {editingId ? "Update" : "Simpan"}
            </button>
          </div>
        </form>
      </BottomSheet>

      <div className={`${cardBase} overflow-hidden`}>
        {locations.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center gap-3">
            <div className="p-4 rounded-2xl bg-white/5">
              <MapPin size={32} className="text-slate-400" />
            </div>
            <div>
              <p className="text-violet-200/60 font-medium">Belum ada lokasi</p>
              <p className="text-slate-400 text-xs mt-1">Klik "Tambah Lokasi" untuk menambahkan</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {locations.map((loc) => (
              <div key={loc.id} className="p-4 md:p-5 hover:bg-white/5 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`p-2.5 rounded-xl shrink-0 ${loc.is_active ? "bg-emerald-500/15" : "bg-white/5"}`}>
                      <MapPin size={18} className={loc.is_active ? "text-emerald-300" : "text-slate-300"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-semibold text-white">{loc.name}</h4>
                        {loc.is_active && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/15 text-emerald-300 text-xs font-medium rounded-full ring-1 ring-emerald-500/30">
                            <CheckCircle2 size={10} /> AKTIF
                          </span>
                        )}
                      </div>
                      {loc.address && <p className="text-sm text-violet-200/60 mb-1 break-words">{loc.address}</p>}
                      <div className="flex flex-wrap gap-3 text-xs text-slate-300 mt-1">
                        <span className="font-mono break-all">📍 {loc.latitude}, {loc.longitude}</span>
                        <span>📏 {loc.radius_meter}m</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 justify-end sm:justify-start">
                    {!loc.is_active && (
                      <button
                        onClick={() => handleSetActive(loc.id, loc.name)}
                        title="Jadikan aktif"
                        className="p-2 text-emerald-300 hover:bg-emerald-500/15 rounded-lg transition-all hover:scale-110"
                      >
                        <CheckCircle2 size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(loc)}
                      className="p-2 text-sky-300 hover:bg-sky-500/15 rounded-lg transition-all hover:scale-110"
                      title="Edit"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(loc.id, loc.name)}
                      className="p-2 text-rose-300 hover:bg-rose-500/15 rounded-lg transition-all hover:scale-110"
                      title="Hapus"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-4">
        <div className="flex gap-3">
          <AlertTriangle size={18} className="text-sky-300 shrink-0 mt-0.5" />
          <div className="text-sm text-sky-200/90">
            <p className="font-semibold mb-1">Tips Mendapatkan Koordinat GPS</p>
            <p className="text-sky-300/70 text-xs">
              Buka{" "}
              <a href="https://www.google.com/maps" target="_blank" rel="noreferrer" className="underline text-sky-300">
                Google Maps
              </a>
              , klik kanan di lokasi puskesmas, copy koordinatnya (format: -8.569700, 116.082100).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   TAB 2: JAM KERJA & SETTINGS
   ============================================================ */
const DEFAULT_SETTINGS = {
  work_start_time: "07:30",
  work_end_time: "14:00",
  late_tolerance_minutes: "5",
  default_radius_meter: "200",
  selfie_retention_days: "30",
  annual_leave_quota_asn: "12",
  annual_leave_quota_pppk: "12",
  annual_leave_quota_tpk: "12",
  default_password: "puskesmas123",
  password_min_length: "6",
};

const SETTING_KEYS = [
  { key: "work_start_time", label: "Jam Mulai Kerja", type: "time", category: "attendance", icon: Clock, desc: "Waktu mulai jam kerja" },
  { key: "work_end_time", label: "Jam Selesai Kerja", type: "time", category: "attendance", icon: Clock, desc: "Waktu selesai jam kerja" },
  { key: "late_tolerance_minutes", label: "Toleransi Terlambat (menit)", type: "number", category: "attendance", icon: AlertTriangle, desc: "Batas toleransi keterlambatan" },
  { key: "default_radius_meter", label: "Radius Default (meter)", type: "number", category: "attendance", icon: MapPin, desc: "Radius GPS default untuk absensi" },
  { key: "selfie_retention_days", label: "Retensi Foto Selfie (hari)", type: "number", category: "attendance", icon: FileText, desc: "Lama penyimpanan foto selfie" },
  { key: "annual_leave_quota_asn", label: "Kuota Cuti ASN (hari/tahun)", type: "number", category: "leave", icon: Users, desc: "Kuota cuti tahunan ASN" },
  { key: "annual_leave_quota_pppk", label: "Kuota Cuti PPPK (hari/tahun)", type: "number", category: "leave", icon: Users, desc: "Kuota cuti tahunan PPPK" },
  { key: "annual_leave_quota_tpk", label: "Kuota Cuti TPK (hari/tahun)", type: "number", category: "leave", icon: Users, desc: "Kuota cuti tahunan TPK" },
  { key: "default_password", label: "Password Default Pegawai Baru", type: "text", category: "security", icon: Key, desc: "Password awal pegawai baru" },
  { key: "password_min_length", label: "Panjang Minimal Password", type: "number", category: "security", icon: Shield, desc: "Jumlah karakter minimal password" },
];

function TabJamKerja() {
  const [saving, setSaving] = useState(false);
  const [dbReady, setDbReady] = useState(true);
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem("siap_jam_kerja");
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });

  const saveToLocal = (vals) => {
    try { localStorage.setItem("siap_jam_kerja", JSON.stringify(vals)); } catch {}
  };

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("system_settings")
          .select("*")
          .in("setting_key", SETTING_KEYS.map(s => s.key));
        if (!error && data) {
          const map = {};
          data.forEach(s => { map[s.setting_key] = s.value; });
          if (Object.keys(map).length > 0) {
            setSettings(prev => ({ ...prev, ...map }));
            saveToLocal({ ...DEFAULT_SETTINGS, ...map });
          }
        }
      } catch (e) {
        console.warn("Jam kerja DB not available, using local defaults:", e);
        setDbReady(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    saveToLocal(settings);
    setSaving(true);
    try {
      if (dbReady) {
        for (const item of SETTING_KEYS) {
          const value = settings[item.key];
          if (value === undefined || value === "") continue;
          await supabase.rpc("set_system_setting", {
            p_setting_key: item.key,
            p_value: String(value),
            p_category: item.category,
          });
        }
        toast.success("Semua settings berhasil disimpan");
      } else {
        toast.success("Disimpan secara lokal (DB tidak tersedia)");
      }
    } catch (err) {
      console.error("Save error:", err);
      toast.warn("Disimpan lokal, gagal sync ke DB: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const categories = [...new Set(SETTING_KEYS.map(s => s.category))];
  const categoryLabels = {
    attendance: "Pengaturan Absensi",
    leave: "Pengaturan Cuti",
    security: "Keamanan",
  };
  const categoryIcons = {
    attendance: Clock,
    leave: Calendar,
    security: Shield,
  };

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className={sectionTitle}>Jam Kerja & Konfigurasi</h2>
          <p className={sectionSub}>Atur jam kerja, radius, kuota cuti, dll</p>
        </div>
        <button
          onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-emerald-900/30 hover:scale-105 transition-all disabled:opacity-50"
        >
          {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
          Simpan Semua
        </button>
      </div>

      {!dbReady && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
          <AlertTriangle size={13} className="shrink-0" />
          Database belum siap. Pengaturan disimpan lokal. Jalankan <code className="px-1 py-0.5 bg-black/30 rounded font-mono">scripts/create-system-settings.sql</code> di Supabase.
        </div>
      )}

      {categories.map(cat => {
        const CatIcon = categoryIcons[cat];
        return (
          <div key={cat} className={`${cardBase} p-5 md:p-6`}>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-violet-500/15">
                <CatIcon size={16} className="text-violet-100" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                {categoryLabels[cat]}
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SETTING_KEYS.filter(s => s.category === cat).map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.key} className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <label className="flex items-center gap-2 text-xs font-medium text-violet-100/70 mb-1 uppercase tracking-wider">
                      <Icon size={12} className="text-violet-400" />
                      {item.label}
                    </label>
                    <p className="text-xs text-slate-400 mb-2">{item.desc}</p>
                    <input
                      type={item.type}
                      value={(settings[item.key] ?? DEFAULT_SETTINGS[item.key]) || ""}
                      onChange={(e) => setSettings({ ...settings, [item.key]: e.target.value })}
                      className={inputBase + (item.type === "time" || item.type === "date" ? " [color-scheme:dark]" : "")}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Sticky save button (mobile bottom) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 p-3 bg-[#0f0524]/90 backdrop-blur-md border-t border-white/10">
        <button
          onClick={handleSave} disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-violet-900/30 transition-all disabled:opacity-50"
        >
          {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
          Simpan Semua Perubahan
        </button>
      </div>

    </div>
  );
}

/* ============================================================
   TAB 3: MANAJEMEN USER
   ============================================================ */
function TabManajemenUser() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [resettingId, setResettingId] = useState(null);
  const [resettingDeviceId, setResettingDeviceId] = useState(null);
  const [expandedUser, setExpandedUser] = useState(null);
  const [deviceSheetUser, setDeviceSheetUser] = useState(null);
  const [userDevices, setUserDevices] = useState({});
  const [confirmResetDevice, setConfirmResetDevice] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error("❌ Fetch users:", err);
      toast.error("Gagal memuat data user");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDevices = async (userId) => {
    try {
      const { data, error } = await supabase
        .from("user_devices")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("last_login_at", { ascending: false });

      if (error) throw error;
      setUserDevices((prev) => ({ ...prev, [userId]: data || [] }));
    } catch (err) {
      console.error("❌ Fetch devices:", err);
      toast.error("Gagal memuat device user");
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleExpand = (userId) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
    } else {
      setExpandedUser(userId);
      if (!userDevices[userId]) {
        fetchUserDevices(userId);
      }
    }
  };

  const openDeviceSheet = (user) => {
    setDeviceSheetUser(user);
    if (!userDevices[user.id]) {
      fetchUserDevices(user.id);
    }
  };

  const [resetModal, setResetModal] = useState({ show: false, user: null, password: "" });

  const handleResetPassword = async (user) => {
    setResetModal({ show: true, user, password: "" });
  };

  const confirmResetPassword = async () => {
    const { user, password: newPassword } = resetModal;
    if (newPassword.length < 6) {
      toast.error("Password minimal 6 karakter");
      return;
    }

    setResettingId(user.id);
    try {
      const { error } = await supabase.rpc("reset_user_password", {
        user_email: user.email,
        new_password: newPassword,
      });

      if (error) throw error;
      toast.success(`✅ Password ${user.full_name} berhasil diubah`);

      await supabase.rpc("log_audit", {
        p_action: "RESET_PASSWORD",
        p_description: `Reset password user: ${user.full_name} (${user.email}) oleh admin`,
        p_entity_type: "profiles",
        p_entity_id: user.id,
      });
      setResetModal({ show: false, user: null, password: "" });
    } catch (err) {
      toast.error("Gagal reset: " + err.message);
    } finally {
      setResettingId(null);
    }
  };

  const handleResetDevice = async (user, visitorId = null) => {
    setConfirmResetDevice({ user, visitorId });
  };

  const confirmResetDeviceAction = async () => {
    if (!confirmResetDevice) return;
    const { user, visitorId } = confirmResetDevice;
    setConfirmResetDevice(null);
    setResettingDeviceId(visitorId || user.id);
    try {
      const { data, error } = await supabase.rpc("reset_user_device", {
        p_user_id: user.id,
        p_visitor_id: visitorId,
      });

      if (error) throw error;

      toast.success(`✅ ${data} device berhasil direset`);

      await supabase.rpc("log_audit", {
        p_action: "RESET_DEVICE",
        p_description: `Reset device untuk: ${user.full_name} (${user.email})`,
        p_entity_type: "user_devices",
        p_entity_id: null,
        p_metadata: { visitor_id: visitorId, count: data },
      });

      fetchUserDevices(user.id);
    } catch (err) {
      console.error("❌ Reset device:", err);
      toast.error("Gagal reset device: " + err.message);
    } finally {
      setResettingDeviceId(null);
    }
  };

  const roleBadge = (role) => {
    const map = {
      super_admin: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
      admin_puskesmas: "bg-purple-500/15 text-purple-300 ring-purple-500/30",
      kepala_unit: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
      pegawai: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    };
    return map[role] || "bg-white/5 text-slate-200 ring-white/10";
  };

  const filtered = users.filter(u =>
    (u.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.username || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.email || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={28} className="animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className={sectionTitle}>Manajemen User</h2>
        <p className={sectionSub}>
          Reset password & device binding ({users.length} user)
        </p>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Cari nama, username, atau email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`w-full pl-10 pr-4 py-2.5 ${inputBase}`}
        />
      </div>

      <BottomSheet open={resetModal.show} onClose={() => setResetModal({ show: false, user: null, password: "" })}
        title="Reset Password" subtitle={resetModal.user?.full_name}>
        <p className="text-sm text-slate-300 mb-4">Masukkan password baru</p>
        <input type="text" value={resetModal.password}
          onChange={(e) => setResetModal({ ...resetModal, password: e.target.value })}
          placeholder="Masukkan password baru..."
          className={inputBase + " mb-4"} autoFocus />
        <div className="flex gap-3">
          <button onClick={() => setResetModal({ show: false, user: null, password: "" })}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-white text-sm hover:bg-white/5 transition-all">Batal</button>
          <button onClick={confirmResetPassword}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-all">Konfirmasi</button>
        </div>
      </BottomSheet>

      <div className={`${cardBase} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-200 text-xs uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-200 text-xs uppercase tracking-wider hidden md:table-cell">Username</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-200 text-xs uppercase tracking-wider hidden lg:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-200 text-xs uppercase tracking-wider">Role</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-200 text-xs uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map(u => (
                <>
                  <tr key={u.id} className="hover:bg-white/5 transition-all">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => { if (window.innerWidth < 768) openDeviceSheet(u); else toggleExpand(u.id); }}
                          className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarGradient(u.full_name)} flex items-center justify-center text-white text-xs font-bold shadow-lg shrink-0 hover:scale-110 transition-all`}
                        >
                          {initials(u.full_name)}
                        </button>
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">{u.full_name || "-"}</p>
                          <p className="text-xs text-slate-400 md:hidden truncate">{u.username || "-"} • {u.email || "-"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-violet-200/60 font-mono text-xs hidden md:table-cell">{u.username || "-"}</td>
                    <td className="px-4 py-3 text-violet-200/60 text-xs hidden lg:table-cell">{u.email || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${roleBadge(u.role)}`}>{u.role || "-"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => handleResetPassword(u)}
                          disabled={resettingId === u.id}
                          title="Reset password ke default"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                        >
                          {resettingId === u.id ? <RefreshCw size={11} className="animate-spin" /> : <Key size={11} />}
                          Password
                        </button>
                        <button
                          onClick={() => { if (window.innerWidth < 768) openDeviceSheet(u); else toggleExpand(u.id); }}
                          title="Lihat & kelola device"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25 rounded-lg text-xs font-medium transition-all"
                        >
                          <Smartphone size={11} />
                          Device
                        </button>
                      </div>
                    </td>
                  </tr>

                  {expandedUser === u.id && (
                    <tr key={u.id + "-devices"} className="bg-white/[0.03]">
                      <td colSpan={5} className="px-4 py-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                              <Smartphone size={14} className="text-violet-100" />
                              Device Terdaftar untuk {u.full_name}
                            </h4>
                            <button
                              onClick={() => handleResetDevice(u)}
                              disabled={resettingDeviceId === u.id}
                              className="text-xs px-3 py-1.5 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 rounded-lg transition-all disabled:opacity-50 flex items-center gap-1.5"
                            >
                              {resettingDeviceId === u.id ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
                              Reset Semua Device
                            </button>
                          </div>

                          {!userDevices[u.id] ? (
                            <div className="text-center py-4 text-slate-300 text-sm flex flex-col items-center gap-2">
                              <RefreshCw size={20} className="animate-spin" />
                              Memuat device...
                            </div>
                          ) : userDevices[u.id].length === 0 ? (
                            <div className="text-center py-4 text-slate-400 text-sm flex flex-col items-center gap-2">
                              <Smartphone size={28} className="opacity-40" />
                              Belum ada device terdaftar. User belum pernah login.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {userDevices[u.id].map((device, idx) => (
                                <div
                                  key={device.id}
                                  className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 gap-3"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className={`p-2 rounded-lg ${device.is_trusted ? "bg-emerald-500/15" : "bg-rose-500/15"}`}>
                                      <Smartphone size={16} className={device.is_trusted ? "text-emerald-300" : "text-rose-300"} />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-white truncate">{device.device_name || "Unknown Device"}</p>
                                      <p className="text-xs text-slate-300 font-mono mt-0.5 truncate">ID: {device.visitor_id?.substring(0, 20)}…</p>
                                      <p className="text-xs text-slate-400 mt-0.5">Login terakhir: {new Date(device.last_login_at).toLocaleString("id-ID")}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {device.is_trusted ? (
                                      <span className="text-xs px-2 py-1 bg-emerald-500/15 text-emerald-300 rounded-full font-medium">Trusted</span>
                                    ) : (
                                      <span className="text-xs px-2 py-1 bg-rose-500/15 text-rose-300 rounded-full font-medium">Blocked</span>
                                    )}
                                    <button
                                      onClick={() => handleResetDevice(u, device.visitor_id)}
                                      disabled={resettingDeviceId === device.visitor_id}
                                      className="p-1.5 text-rose-300 hover:bg-rose-500/15 rounded-lg transition-all disabled:opacity-50"
                                      title="Hapus device ini"
                                    >
                                      {resettingDeviceId === device.visitor_id ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 flex flex-col items-center gap-3">
            <div className="p-4 rounded-2xl bg-white/5">
              <Users size={32} className="text-slate-400" />
            </div>
            <p className="text-violet-200/60">Tidak ada user ditemukan</p>
          </div>
        )}
      </div>

      <BottomSheet open={!!deviceSheetUser} onClose={() => setDeviceSheetUser(null)}
        title="Device Terdaftar" subtitle={deviceSheetUser?.full_name}>
        <div className="space-y-3">
          <button
            onClick={() => handleResetDevice(deviceSheetUser)}
            disabled={resettingDeviceId === deviceSheetUser?.id}
            className="w-full py-2.5 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 rounded-xl text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {resettingDeviceId === deviceSheetUser?.id ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Reset Semua Device
          </button>

          {!deviceSheetUser ? null : !userDevices[deviceSheetUser.id] ? (
            <div className="text-center py-10 text-slate-300 text-sm flex flex-col items-center gap-2">
              <RefreshCw size={24} className="animate-spin" />
              Memuat device...
            </div>
          ) : userDevices[deviceSheetUser.id].length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm flex flex-col items-center gap-2">
              <Smartphone size={36} className="opacity-40" />
              Belum ada device terdaftar
            </div>
          ) : (
            <div className="space-y-2">
              {userDevices[deviceSheetUser.id].map((device) => (
                <div key={device.id}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg ${device.is_trusted ? "bg-emerald-500/15" : "bg-rose-500/15"}`}>
                      <Smartphone size={16} className={device.is_trusted ? "text-emerald-300" : "text-rose-300"} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{device.device_name || "Unknown Device"}</p>
                      <p className="text-xs text-slate-300 font-mono mt-0.5 truncate">ID: {device.visitor_id?.substring(0, 20)}…</p>
                      <p className="text-xs text-slate-400 mt-0.5">Login terakhir: {new Date(device.last_login_at).toLocaleString("id-ID")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {device.is_trusted ? (
                      <span className="text-xs px-2 py-1 bg-emerald-500/15 text-emerald-300 rounded-full font-medium">Trusted</span>
                    ) : (
                      <span className="text-xs px-2 py-1 bg-rose-500/15 text-rose-300 rounded-full font-medium">Blocked</span>
                    )}
                    <button
                      onClick={() => handleResetDevice(deviceSheetUser, device.visitor_id)}
                      disabled={resettingDeviceId === device.visitor_id}
                      className="p-1.5 text-rose-300 hover:bg-rose-500/15 rounded-lg transition-all disabled:opacity-50"
                      title="Hapus device ini"
                    >
                      {resettingDeviceId === device.visitor_id ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </BottomSheet>

      <ConfirmSheet open={!!confirmResetDevice} onClose={() => setConfirmResetDevice(null)}
        title="Reset Device"
        message={confirmResetDevice?.visitorId
          ? `Hapus device ini dari ${confirmResetDevice?.user?.full_name}? Pegawai perlu login ulang di device tersebut.`
          : `Hapus SEMUA device terdaftar dari ${confirmResetDevice?.user?.full_name}? Pegawai perlu login ulang di semua device.`}
        confirmText="Ya, Reset" onConfirm={confirmResetDeviceAction} />
    </div>
  );
}

/* ============================================================
   TAB 4: APPROVAL DEVICE (BARU)
   ============================================================ */
function TabApprovalDevice() {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [processingId, setProcessingId] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(null);
  const [confirmApprove, setConfirmApprove] = useState(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_pending_device_requests");
      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error("❌ Fetch requests:", err);
      toast.error("Gagal memuat data request");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleApprove = (requestId, userName) => {
    setConfirmApprove({ requestId, userName });
  };

  const confirmApproveAction = async () => {
    if (!confirmApprove) return;
    const { requestId, userName } = confirmApprove;
    setConfirmApprove(null);
    setProcessingId(requestId);
    try {
      const { error } = await supabase.rpc("approve_device_request", {
        p_request_id: requestId,
      });
      if (error) throw error;

      toast.success(`✅ Device ${userName} berhasil di-approve`);
      fetchRequests();
    } catch (err) {
      toast.error("Gagal approve: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId, reason) => {
    setProcessingId(requestId);
    try {
      const { error } = await supabase.rpc("reject_device_request", {
        p_request_id: requestId,
        p_reason: reason,
      });
      if (error) throw error;

      toast.success(`❌ Device request ditolak`);
      setShowRejectModal(null);
      fetchRequests();
    } catch (err) {
      toast.error("Gagal reject: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={28} className="animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className={sectionTitle}>Approval Device Baru</h2>
          <p className={sectionSub}>
            {requests.length} request menunggu approval
          </p>
        </div>
        <button
          onClick={fetchRequests}
          className={btnGhost}
          aria-label="Refresh"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {requests.length === 0 ? (
        <div className={`${cardBase} p-12 text-center flex flex-col items-center gap-3`}>
          <div className="p-4 rounded-2xl bg-emerald-500/15">
            <CheckCircle2 size={36} className="text-emerald-300" />
          </div>
          <p className="text-violet-200/60 font-medium">Tidak ada request device yang menunggu approval</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div
              key={req.id}
              className={`${cardBase} border-amber-500/30 p-4 md:p-5`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="p-2.5 rounded-xl bg-amber-500/15 shrink-0">
                    <Smartphone size={20} className="text-amber-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-semibold text-white">{req.user_name}</p>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/15 text-amber-300 text-xs font-medium rounded-full ring-1 ring-amber-500/30">
                        <Clock size={10} /> PENDING
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mb-2 flex items-center gap-1">
                      <Mail size={11} /> {req.user_email}
                    </p>
                    <div className="space-y-1 text-xs">
                      <p className="text-violet-200/70">
                        <strong className="text-violet-100">Device:</strong> {req.device_name || "Unknown"}
                      </p>
                      <p className="text-violet-200/70">
                        <strong className="text-violet-100">OS:</strong> {req.device_os || "Unknown"}
                      </p>
                      <p className="text-slate-300 font-mono break-all">
                        <strong className="text-violet-200/70">ID:</strong> {req.visitor_id?.substring(0, 30)}…
                      </p>
                      <p className="text-slate-300 mt-2 flex items-center gap-1">
                        <ClockIcon size={11} />
                        Request: {new Date(req.created_at).toLocaleString("id-ID")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => handleApprove(req.id, req.user_name)}
                    disabled={processingId === req.id}
                    className="px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-lg text-xs font-medium hover:shadow-lg hover:shadow-emerald-900/30 transition-all disabled:opacity-50 flex items-center gap-1.5 justify-center"
                  >
                    {processingId === req.id ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                    Approve
                  </button>
                  <button
                    onClick={() => setShowRejectModal(req)}
                    disabled={processingId === req.id}
                    className="px-3 py-2 bg-rose-500/15 text-rose-300 rounded-lg text-xs font-medium hover:bg-rose-500/25 transition-all flex items-center gap-1.5 justify-center"
                  >
                    <XCircle size={12} />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showRejectModal && (
        <RejectReasonModal
          request={showRejectModal}
          onClose={() => setShowRejectModal(null)}
          onConfirm={(reason) => handleReject(showRejectModal.id, reason)}
          processing={processingId === showRejectModal.id}
        />
      )}
    </div>
  );
}

function RejectReasonModal({ request, onClose, onConfirm, processing }) {
  const [reason, setReason] = useState("");

  const reasons = [
    "Bukan permintaan dari pegawai yang bersangkutan",
    "Device tidak dikenali",
    "Pegawai tidak mengajukan ganti HP",
    "Lainnya (isi di bawah)",
  ];

  return (
    <BottomSheet open={!!request} onClose={onClose}
      title="Tolak Request Device" subtitle={request?.user_name}>
      <p className="text-sm text-violet-200/70 mb-4">
        Tolak request dari <strong className="text-white">{request?.user_name}</strong>?
      </p>

      <div className="space-y-2 mb-4">
        {reasons.map((r) => (
          <label
            key={r}
            className="flex items-center gap-2 cursor-pointer p-2.5 rounded-lg hover:bg-white/5 transition-all"
          >
            <input
              type="radio"
              name="reason"
              value={r}
              checked={reason === r}
              onChange={(e) => setReason(e.target.value)}
              className="w-4 h-4 accent-rose-500"
            />
            <span className="text-sm text-violet-100/90">{r}</span>
          </label>
        ))}
      </div>

      <textarea
        value={reason === "Lainnya (isi di bawah)" ? "" : reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Alasan penolakan (opsional)..."
        rows={2}
        className={`${inputBase} resize-none mb-4`}
      />

      <div className="flex gap-3">
        <button onClick={onClose}
          className="flex-1 py-2.5 border border-white/10 text-violet-200/80 rounded-xl text-sm font-medium hover:bg-white/5 transition-all">
          Batal
        </button>
        <button onClick={() => onConfirm(reason)} disabled={processing}
          className="flex-1 py-2.5 bg-gradient-to-r from-rose-600 to-pink-700 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-rose-900/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {processing ? <RefreshCw size={14} className="animate-spin" /> : <XCircle size={14} />}
          Tolak Request
        </button>
      </div>
    </BottomSheet>
  );
}

/* ============================================================
   TAB 5: AUDIT LOG
   ============================================================ */
function TabAuditLog() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error("❌ Fetch logs:", err);
      toast.error("Gagal memuat audit log");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const actionBadge = (action) => {
    const map = {
      CREATE: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
      UPDATE: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
      DELETE: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
      CLOCK_IN: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
      CLOCK_OUT: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
      RESET_PASSWORD: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
      UPDATE_SETTING: "bg-purple-500/15 text-purple-300 ring-purple-500/30",
      SET_ACTIVE_LOCATION: "bg-cyan-500/15 text-cyan-300 ring-cyan-500/30",
    };

    const prefix = action?.split("_")[0];
    return map[action] || map[prefix] || "bg-white/5 text-slate-200 ring-white/10";
  };

  const filtered = logs.filter(l =>
    (l.action || "").toLowerCase().includes(filter.toLowerCase()) ||
    (l.user_email || "").toLowerCase().includes(filter.toLowerCase()) ||
    (l.description || "").toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={28} className="animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className={sectionTitle}>Audit Log</h2>
          <p className={sectionSub}>
            100 aktivitas terakhir ({logs.length} log)
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className={btnGhost}
          aria-label="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Cari berdasarkan aksi, email, atau deskripsi..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={`w-full pl-10 pr-4 py-2.5 ${inputBase}`}
        />
      </div>

      <div className={`${cardBase} p-4`}>
        {filtered.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center gap-3">
            <div className="p-4 rounded-2xl bg-white/5">
              <Activity size={32} className="text-slate-400" />
            </div>
            <p className="text-violet-200/60">Belum ada aktivitas tercatat</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(log => (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 transition-all">
                <div className="p-2 rounded-lg bg-white/5 shrink-0">
                  <Activity size={14} className="text-slate-200" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${actionBadge(log.action)}`}>
                      {log.action}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(log.created_at).toLocaleString("id-ID", {
                        day: "numeric", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit"
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-violet-100/90">{log.description || "-"}</p>
                  {log.user_email && (
                    <p className="text-xs text-slate-400 mt-0.5">oleh: {log.user_email}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmSheet open={!!confirmApprove} onClose={() => setConfirmApprove(null)}
        title="Approve Device Request"
        message={`Approve device request dari ${confirmApprove?.userName}?`}
        confirmText="Ya, Setujui" onConfirm={confirmApproveAction} variant="primary" />
    </div>
  );
}

/* ============================================================
   MAIN PAGE
   ============================================================ */
export default function PengaturanPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("profil");

  // Cek role (double safety)
  if (user?.role !== "super_admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 animate-fade-in">
        <div className="p-5 rounded-3xl bg-rose-500/10 mb-4">
          <Shield size={48} className="text-rose-300" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Akses Ditolak</h2>
        <p className="text-slate-200">Halaman ini hanya untuk Super Admin.</p>
      </div>
    );
  }

  const tabs = [
    { id: "profil", label: "Profil & Lokasi", icon: MapPin },
    { id: "jam-kerja", label: "Jam Kerja & Settings", icon: Clock },
    { id: "shift", label: "Kelola Shift", icon: Sun },
    { id: "user", label: "Manajemen User", icon: Users },
    { id: "approval", label: "Approval Device", icon: Smartphone },
    { id: "audit", label: "Audit Log", icon: Activity },
  ];

  const renderTab = () => {
    switch (activeTab) {
      case "profil": return <TabProfilPuskesmas />;
      case "jam-kerja": return <TabJamKerja />;
      case "user": return <TabManajemenUser />;
      case "approval": return <TabApprovalDevice />;
      case "audit": return <TabAuditLog />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-fade-in min-w-0">
      <div className="min-w-0">
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Pengaturan Sistem</h1>
        <p className="text-slate-200 mt-1.5 text-sm">
          Kelola konfigurasi aplikasi, lokasi, user, dan audit log
        </p>
      </div>

      {/* Tab nav — elegant mobile-first design */}
      <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all ${
                isActive
                  ? "bg-violet-600/20 border-violet-500/50 text-white shadow-lg shadow-violet-900/20"
                  : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
              }`}
            >
              <Icon size={24} className={isActive ? "text-violet-400" : "text-slate-400"} />
              <span className="text-[11px] font-semibold text-center leading-tight">{tab.label.split(" &")[0]}</span>
            </button>
          );
        })}
      </div>

      <div>
        {activeTab === "profil" && <TabProfilPuskesmas />}
        {activeTab === "jam-kerja" && <TabJamKerja />}
        {activeTab === "shift" && <TabShift />}
        {activeTab === "user" && <TabManajemenUser />}
        {activeTab === "approval" && <TabApprovalDevice />}
        {activeTab === "audit" && <TabAuditLog />}
      </div>
    </div>
  );
}

