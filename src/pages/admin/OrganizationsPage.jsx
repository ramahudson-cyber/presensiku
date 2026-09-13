import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import Swal from "sweetalert2";
import { Building2, Plus, Loader2, CheckCircle2, XCircle, AlertCircle, Trash2 } from "lucide-react";

const T = {
  text: "#0F172A",
  textSec: "#475569",
  textMuted: "#94A3B8",
  border: "rgba(31,41,55,0.08)",
};

function OrganizationsPage() {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(user?.role === "super_admin");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    orgName: "", slug: "", adminUsername: "", adminFullName: "", adminEmail: "", adminPassword: "",
  });

  const isPlatformAdmin = user?.role === "super_admin";

  const loadOrgs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      setOrgs(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isPlatformAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("organizations")
          .select("*")
          .order("created_at", { ascending: true });
        if (!cancelled) {
          if (error) throw error;
          setOrgs(data || []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPlatformAdmin]);

  const autoSlug = (name) =>
    name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 41);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc("create_organization_with_admin", {
        p_org_name: form.orgName.trim(),
        p_slug: form.slug.trim(),
        p_admin_username: form.adminUsername.trim(),
        p_admin_full_name: form.adminFullName.trim(),
        p_admin_email: form.adminEmail.trim() || null,
        p_admin_password: form.adminPassword,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Gagal membuat instansi");

      // Kirim kredensial admin via email (non-blocking: instansi tetap jadi
      // walau SMTP gagal — admin bisa login dengan password yang diinput)
      let emailNote = "";
      if (form.adminEmail) {
        try {
          const resp = await fetch(window.location.origin + "/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: form.adminEmail.trim(),
              username: form.adminUsername.trim(),
              full_name: form.adminFullName.trim(),
              password: form.adminPassword,
              org_name: form.orgName.trim(),
            }),
          });
          if (!resp.ok) {
            const errBody = await resp.json().catch(() => ({}));
            throw new Error(errBody.error || `HTTP ${resp.status}`);
          }
          emailNote = ` Kredensial dikirim ke ${form.adminEmail.trim()}.`;
        } catch (emailErr) {
          emailNote = ` GAGAL kirim email (${emailErr.message}) — cek alamat email, atau berikan kredensial langsung: ${data.login}`;
        }
      } else {
        emailNote = ` Berikan kredensial langsung ke admin: ${data.login}`;
      }

      setSuccess(`Instansi "${form.orgName}" dibuat.${emailNote}`);
      setForm({ orgName: "", slug: "", adminUsername: "", adminFullName: "", adminEmail: "", adminPassword: "" });
      setShowForm(false);
      loadOrgs();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (org) => {
    setError("");
    const { error } = await supabase
      .from("organizations")
      .update({ is_active: !org.is_active })
      .eq("id", org.id);
    if (error) setError(error.message);
    else loadOrgs();
  };

  const handleDelete = async (org) => {
    const result = await Swal.fire({
      title: "Hapus instansi?",
      html: `<b>${org.name}</b> dan <b>SELURUH datanya</b> akan dihapus permanen:<br>
             akun semua pegawai, absensi, jadwal, izin, device, dan pengaturan.<br>
             <span style="color:#ef4444">Tindakan ini tidak bisa dibatalkan.</span>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, hapus permanen",
      cancelButtonText: "Batal",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      focusCancel: true,
    });
    if (!result.isConfirmed) return;

    setDeletingId(org.id);
    setError("");
    try {
      const { data, error } = await supabase.rpc("delete_organization", {
        p_org_id: org.id,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Gagal menghapus instansi");
      Swal.fire({
        title: "Terhapus",
        text: `${org.name} beserta ${data.deleted_users} akun penggunanya telah dihapus.`,
        icon: "success",
        timer: 3000,
        showConfirmButton: false,
      });
      loadOrgs();
    } catch (err) {
      Swal.fire({ title: "Gagal", text: err.message, icon: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  if (!isPlatformAdmin) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-3xl p-8 border text-center" style={{ borderColor: T.border }}>
          <AlertCircle size={32} className="mx-auto mb-3 text-red-500" />
          <h2 className="font-bold text-lg" style={{ color: T.text }}>Akses Terbatas</h2>
          <p className="text-sm mt-1" style={{ color: T.textSec }}>
            Halaman ini khusus platform super_admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: T.text }}>
            Kelola Instansi
          </h1>
          <p className="text-sm mt-0.5" style={{ color: T.textSec }}>
            Daftarkan instansi baru beserta akun admin pertamanya
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-electric-violet text-white text-sm font-semibold hover:brightness-110 active:scale-[0.98] transition-all"
        >
          <Plus size={16} /> Instansi Baru
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-600 flex items-center gap-2">
          <AlertCircle size={15} /> {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle2 size={15} /> {success}
        </div>
      )}

      {/* Form instansi baru */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl border p-6 space-y-4" style={{ borderColor: T.border }}>
          <h3 className="font-bold" style={{ color: T.text }}>Instansi Baru</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wide mb-1.5" style={{ color: T.textSec }}>Nama Instansi</label>
              <input
                type="text" required value={form.orgName}
                onChange={(e) => setForm({ ...form, orgName: e.target.value, slug: autoSlug(e.target.value) })}
                placeholder="Contoh: Klinik Sehat Sentosa"
                className="w-full px-4 py-2.5 rounded-2xl border text-sm focus:outline-none focus:border-electric-violet"
                style={{ borderColor: T.border, color: T.text }}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wide mb-1.5" style={{ color: T.textSec }}>Kode Instansi (slug)</label>
              <input
                type="text" required value={form.slug}
                onChange={(e) => setForm({ ...form, slug: autoSlug(e.target.value) })}
                placeholder="klinik-sehat-sentosa"
                className="w-full px-4 py-2.5 rounded-2xl border text-sm focus:outline-none focus:border-electric-violet"
                style={{ borderColor: T.border, color: T.text }}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wide mb-1.5" style={{ color: T.textSec }}>Username Admin</label>
              <input
                type="text" required value={form.adminUsername}
                onChange={(e) => setForm({ ...form, adminUsername: e.target.value })}
                placeholder="admin"
                className="w-full px-4 py-2.5 rounded-2xl border text-sm focus:outline-none focus:border-electric-violet"
                style={{ borderColor: T.border, color: T.text }}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wide mb-1.5" style={{ color: T.textSec }}>Nama Lengkap Admin</label>
              <input
                type="text" required value={form.adminFullName}
                onChange={(e) => setForm({ ...form, adminFullName: e.target.value })}
                placeholder="Nama admin"
                className="w-full px-4 py-2.5 rounded-2xl border text-sm focus:outline-none focus:border-electric-violet"
                style={{ borderColor: T.border, color: T.text }}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wide mb-1.5" style={{ color: T.textSec }}>Email Admin (untuk kirim kredensial)</label>
              <input
                type="email" value={form.adminEmail}
                onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                placeholder="admin@instansi.com"
                className="w-full px-4 py-2.5 rounded-2xl border text-sm focus:outline-none focus:border-electric-violet"
                style={{ borderColor: T.border, color: T.text }}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wide mb-1.5" style={{ color: T.textSec }}>Password Awal Admin</label>
              <input
                type="text" required minLength={8} value={form.adminPassword}
                onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                placeholder="Min. 8 karakter"
                className="w-full px-4 py-2.5 rounded-2xl border text-sm focus:outline-none focus:border-electric-violet"
                style={{ borderColor: T.border, color: T.text }}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit" disabled={creating}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-electric-violet text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition-all"
            >
              {creating ? <Loader2 size={15} className="animate-spin" /> : <Building2 size={15} />}
              {creating ? "Membuat..." : "Buat Instansi"}
            </button>
            <button
              type="button" onClick={() => setShowForm(false)}
              className="px-5 py-2.5 rounded-full border text-sm"
              style={{ borderColor: T.border, color: T.textSec }}
            >
              Batal
            </button>
            <p className="text-[11px]" style={{ color: T.textMuted }}>
              Admin login dengan: <b>{form.adminUsername || "admin"}@{form.slug || "slug"}</b>
            </p>
          </div>
        </form>
      )}

      {/* Daftar instansi */}
      <div className="bg-white rounded-3xl border overflow-hidden" style={{ borderColor: T.border }}>
        {loading ? (
          <div className="p-10 flex items-center justify-center gap-2 text-sm" style={{ color: T.textMuted }}>
            <Loader2 size={16} className="animate-spin" /> Memuat instansi...
          </div>
        ) : orgs.length === 0 ? (
          <div className="p-10 text-center text-sm" style={{ color: T.textMuted }}>
            Belum ada instansi terdaftar.
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: T.border }}>
            {orgs.map((org) => (
              <div key={org.id} className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-electric-violet/10 flex items-center justify-center shrink-0">
                    <Building2 size={18} className="text-electric-violet" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: T.text }}>{org.name}</p>
                    <p className="text-[11px]" style={{ color: T.textMuted }}>
                      kode: {org.slug} · dibuat {new Date(org.created_at).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full ${
                    org.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}>
                    {org.is_active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    {org.is_active ? "Aktif" : "Nonaktif"}
                  </span>
                  <button
                    onClick={() => toggleActive(org)}
                    className="text-xs px-4 py-1.5 rounded-full border hover:bg-slate-50 transition-colors"
                    style={{ borderColor: T.border, color: T.textSec }}
                  >
                    {org.is_active ? "Suspend" : "Aktifkan"}
                  </button>
                  <button
                    onClick={() => handleDelete(org)}
                    disabled={deletingId === org.id}
                    className="inline-flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-full border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    title={`Hapus ${org.name} permanen`}
                  >
                    {deletingId === org.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default OrganizationsPage;
