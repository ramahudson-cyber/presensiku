import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import BottomSheet from "../../components/BottomSheet";
import {
  Megaphone, Plus, Loader2, Pencil, Trash2, Power,
  CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react";

const T = {
  text: "#0F172A",
  textSec: "#475569",
  textMuted: "#94A3B8",
  border: "rgba(31,41,55,0.08)",
};

const PRIORITY_BADGE = {
  normal:   { label: "Normal",  cls: "bg-slate-100 text-slate-600" },
  penting:  { label: "Penting", cls: "bg-amber-100 text-amber-700" },
  urgent:   { label: "Urgent",  cls: "bg-rose-100 text-rose-700" },
};
const PRIORITY_OPTIONS = ["normal", "penting", "urgent"];

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "–";

const emptyForm = { title: "", content: "", priority: "normal", is_active: true, expires_at: "" };

export default function AnnouncementsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title || "",
      content: item.content || "",
      priority: PRIORITY_OPTIONS.includes(item.priority) ? item.priority : "normal",
      is_active: item.is_active ?? true,
      expires_at: item.expires_at ? item.expires_at.slice(0, 10) : "",
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Judul dan isi pengumuman wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        priority: form.priority,
        is_active: form.is_active,
        expires_at: form.expires_at ? new Date(form.expires_at + "T23:59:59+08:00").toISOString() : null,
      };
      let error;
      if (editingId) {
        ({ error } = await supabase.from("announcements").update(payload).eq("id", editingId));
      } else {
        ({ error } = await supabase.from("announcements").insert(payload));
      }
      if (error) throw error;
      toast.success(editingId ? "Pengumuman diperbarui" : "Pengumuman dipublikasikan");
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item) => {
    try {
      const { error } = await supabase
        .from("announcements")
        .update({ is_active: !item.is_active })
        .eq("id", item.id);
      if (error) throw error;
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (item) => {
    const result = await Swal.fire({
      title: "Hapus pengumuman?",
      text: `"${item.title}" akan dihapus permanen.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: "#dc2626",
      focusCancel: true,
    });
    if (!result.isConfirmed) return;
    setDeletingId(item.id);
    try {
      const { error } = await supabase.from("announcements").delete().eq("id", item.id);
      if (error) throw error;
      toast.success("Pengumuman dihapus");
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: T.text }}>Pengumuman</h1>
          <p className="text-sm mt-0.5" style={{ color: T.textSec }}>
            Tampil hanya untuk pegawai instansi Anda di dashboard mereka
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-electric-violet text-white text-sm font-semibold hover:brightness-110 active:scale-[0.98] transition-all"
        >
          <Plus size={15} /> Buat Pengumuman
        </button>
      </div>

      {/* Form dalam BottomSheet */}
      <BottomSheet open={showForm} onClose={() => setShowForm(false)}
        title={editingId ? "Edit Pengumuman" : "Buat Pengumuman"}
        subtitle="Ditampilkan di dashboard pegawai instansi Anda">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: T.textMuted }}>Judul *</label>
            <input
              type="text" required maxLength={120} value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Contoh: Rapat bulanan pegawai"
              className="w-full px-4 py-2.5 rounded-2xl border text-sm focus:outline-none focus:border-electric-violet"
              style={{ borderColor: T.border, color: T.text }}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: T.textMuted }}>Isi Pengumuman *</label>
            <textarea
              required rows={5} maxLength={2000} value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Tulis isi pengumuman..."
              className="w-full px-4 py-2.5 rounded-2xl border text-sm focus:outline-none focus:border-electric-violet resize-none"
              style={{ borderColor: T.border, color: T.text }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: T.textMuted }}>Prioritas</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full px-4 py-2.5 rounded-2xl border text-sm focus:outline-none focus:border-electric-violet"
                style={{ borderColor: T.border, color: T.text }}
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p} className="capitalize">{PRIORITY_BADGE[p]?.label || p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: T.textMuted }}>Kedaluwarsa (opsional)</label>
              <input
                type="date" value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                className="w-full px-4 py-2.5 rounded-2xl border text-sm focus:outline-none focus:border-electric-violet"
                style={{ borderColor: T.border, color: T.text }}
              />
            </div>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox" checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="w-4 h-4 accent-[#BF00FF]"
            />
            <span className="text-sm" style={{ color: T.text }}>Aktifkan (tampilkan di dashboard pegawai)</span>
          </label>
          <div className="flex gap-3 pt-1">
            <button
              type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-full bg-electric-violet text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Megaphone size={15} />}
              {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Publikasikan"}
            </button>
            <button
              type="button" onClick={() => setShowForm(false)}
              className="px-5 py-2.5 rounded-full border text-sm"
              style={{ borderColor: T.border, color: T.textSec }}
            >
              Batal
            </button>
          </div>
        </form>
      </BottomSheet>

      {/* Daftar */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-3xl border p-10 flex items-center justify-center gap-2 text-sm" style={{ color: T.textMuted, borderColor: T.border }}>
            <Loader2 size={16} className="animate-spin" /> Memuat pengumuman...
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-3xl border p-10 text-center space-y-2" style={{ borderColor: T.border }}>
            <Megaphone size={26} className="mx-auto text-slate-300" />
            <p className="text-sm" style={{ color: T.textSec }}>Belum ada pengumuman.</p>
            <p className="text-[11px]" style={{ color: T.textMuted }}>Buat yang pertama untuk pegawai instansi Anda.</p>
          </div>
        ) : (
          items.map((item) => {
            const badge = PRIORITY_BADGE[item.priority] || PRIORITY_BADGE.normal;
            const expired = item.expires_at && new Date(item.expires_at) < new Date();
            return (
              <div key={item.id} className="bg-white rounded-3xl border p-4 sm:p-5" style={{ borderColor: T.border }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-bold text-sm" style={{ color: T.text }}>{item.title}</h3>
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${badge.cls}`}>
                        {badge.label}
                      </span>
                      {item.is_active && !expired ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                          <CheckCircle2 size={10} /> Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          {expired ? <><XCircle size={10} /> Kedaluwarsa</> : <><XCircle size={10} /> Nonaktif</>}
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: T.textSec }}>
                      {item.content}
                    </p>
                    <p className="text-[10px] mt-2" style={{ color: T.textMuted }}>
                      Dipublikasikan {fmtDate(item.published_at || item.created_at)}
                      {item.expires_at ? ` · berlaku s.d. ${fmtDate(item.expires_at)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleActive(item)}
                      className={`p-2 rounded-full border transition-colors ${
                        item.is_active ? "border-emerald-200 text-emerald-600 hover:bg-emerald-50" : "border-slate-200 text-slate-400 hover:bg-slate-50"
                      }`}
                      title={item.is_active ? "Nonaktifkan" : "Aktifkan"}
                    >
                      <Power size={13} />
                    </button>
                    <button
                      onClick={() => openEdit(item)}
                      className="p-2 rounded-full border hover:bg-gray-50 transition-colors"
                      style={{ borderColor: T.border, color: T.textSec }}
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      disabled={deletingId === item.id}
                      className="p-2 rounded-full border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                      title="Hapus"
                    >
                      {deletingId === item.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Catatan kecil */}
      <div className="flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-[11px] text-sky-700">
        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
        <span>Pengumuman hanya tampil untuk pegawai instansi Anda. Pengumuman kedaluwarsa otomatis berhenti tampil di dashboard.</span>
      </div>
    </div>
  );
}
