import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { toast } from "react-toastify";

// Light-mode tokens — per DESIGN.md
const T = {
  bg: '#F4F2FB',
  surface: '#FFFFFF',
  border: 'rgba(31,41,55,0.08)',
  text: '#0F172A',
  textSec: '#475569',
  textMuted: '#94A3B8',
  sub: '#6B7280',
  shadow: '0 4px 16px rgba(15,23,42,0.06)',
  iconBg: '#F5F3FF',
};

export default function EmployeeEditProfile() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: user?.full_name || "",
    email: user?.email || "",
  });
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [preview, setPreview] = useState(user?.avatar_url || null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Kompres dulu jika lebih dari 500KB
    if (file.size > 500 * 1024) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX = 512;
          let w = img.width, h = img.height;
          if (w > h) { h = (MAX / w) * h; w = MAX; } else { w = (MAX / h) * w; h = MAX; }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob((blob) => {
            if (!blob) { setAvatarFile(file); setPreview(ev.target.result); return; }
            const compressed = new File([blob], file.name, { type: "image/jpeg" });
            setAvatarFile(compressed);
            setPreview(ev.target.result);
          }, "image/jpeg", 0.8);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    } else {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const uploadAvatar = async (file) => {
    const fileExt = file.name.split(".").pop() || "jpg";
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      if (uploadError.message?.includes("exceeded") || uploadError.message?.includes("size")) {
        throw new Error("Ukuran foto terlalu besar. Silakan pilih foto yang lebih kecil (max 500KB).");
      }
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("avatars")
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error("Nama lengkap tidak boleh kosong");
      return;
    }
    setSaving(true);
    try {
      let finalAvatarUrl = avatarUrl;

      // Upload file ke storage dulu (kalau ada file baru)
      if (avatarFile) {
        setUploading(true);
        finalAvatarUrl = await uploadAvatar(avatarFile);
        setUploading(false);
      }

      const updateData = { full_name: form.full_name.trim() };
      if (finalAvatarUrl) {
        updateData.avatar_url = finalAvatarUrl;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", user.id);

      if (error) throw error;

      await refreshUser();
      toast.success("Profil berhasil diperbarui");
      navigate("/employee/profile");
    } catch (err) {
      toast.error("Gagal menyimpan: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => navigate("/employee/profile");
  const initials = user?.full_name?.charAt(0)?.toUpperCase() || "P";

  return (
    <div className="min-h-screen w-full font-sans absolute top-0 left-0 right-0 pb-24" style={{ background: T.bg, color: T.text }}>
      {/* ── HEADER — simple elegant (sama dengan Riwayat) ── */}
      <div className="pt-14 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button onClick={goBack} aria-label="Kembali"
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 hover:bg-white hover:shadow-sm active:scale-90"
              style={{ color: T.text }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className="text-[17px] font-bold tracking-tight" style={{ color: T.text }}>Edit Profil</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover border" style={{ borderColor: 'rgba(191,0,255,0.15)' }} />
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold"
                style={{ background: T.iconBg, color: '#BF00FF', border: '1px solid rgba(191,0,255,0.15)' }}>
                {initials}
              </div>
            )}
            <span className="text-[9px] font-medium leading-none max-w-[72px] truncate text-center" style={{ color: T.sub }}>
              {user?.position || user?.role || "Pegawai"}
            </span>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-md mx-auto px-4 mt-6">
        {/* Avatar */}
        <div className="text-center mb-8">
          <div
            className="relative w-24 h-24 mx-auto rounded-full p-[3px]"
            style={{ background: "linear-gradient(135deg, #BF00FF, #9900CC, #7066ed)" }}
          >
            <div
              className="w-full h-full rounded-full flex items-center justify-center text-3xl font-extrabold overflow-hidden"
              style={{ background: preview ? 'transparent' : T.iconBg }}
            >
              {preview ? (
                <img src={preview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span style={{ color: '#BF00FF' }}>{initials}</span>
              )}
            </div>
          </div>
          <div className="mt-3">
            <label htmlFor="avatar-upload" className="text-[11px] font-semibold cursor-pointer px-4 py-1.5 rounded-full inline-flex items-center gap-1.5"
              style={{ background: T.iconBg, color: '#BF00FF', border: "1px solid rgba(191,0,255,0.2)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Ganti Foto
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <p className="text-[9px] mt-1.5" style={{ color: T.sub }}>
              Upload foto dari galeri atau kamera
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Nama Lengkap */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.5px] mb-2" style={{ color: T.textSec }}>
              Nama Lengkap
            </label>
            <input
              type="text"
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              placeholder="Nama lengkap Anda"
              className="w-full px-4 py-3.5 rounded-2xl text-sm font-medium outline-none transition-all duration-200 focus:ring-2 focus:ring-[#BF00FF]/30"
              style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                color: T.text,
                boxShadow: T.shadow,
              }}
            />
          </div>

          {/* Email (readonly) */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.5px] mb-2" style={{ color: T.textSec }}>
              Email
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Email"
              className="w-full px-4 py-3.5 rounded-2xl text-sm font-medium outline-none"
              style={{
                background: T.rowBg,
                border: `1px solid ${T.border}`,
                color: T.sub,
                cursor: "not-allowed",
              }}
              disabled
            />
            <p className="text-[9px] mt-1.5" style={{ color: T.sub }}>
              Email tidak dapat diubah. Hubungi admin untuk perubahan.
            </p>
          </div>

          {/* Username (readonly) */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.5px] mb-2" style={{ color: T.textSec }}>
              Username
            </label>
            <input
              type="text"
              value={user?.username || "-"}
              className="w-full px-4 py-3.5 rounded-2xl text-sm font-medium outline-none"
              style={{
                background: T.rowBg,
                border: `1px solid ${T.border}`,
                color: T.sub,
                cursor: "not-allowed",
              }}
              disabled
            />
          </div>

          {/* Save Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #BF00FF, #9900CC)",
                boxShadow: "0 4px 16px rgba(191,0,255,0.3)",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {uploading ? "Mengunggah..." : "Menyimpan..."}
                </span>
              ) : (
                "Simpan Perubahan"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
