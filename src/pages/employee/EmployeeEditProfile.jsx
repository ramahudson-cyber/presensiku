import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { supabase } from "../../lib/supabase";
import { toast } from "react-toastify";

export default function EmployeeEditProfile() {
  const { user, refreshUser } = useAuth();
  const { darkMode } = useTheme();
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
    setAvatarFile(file);
    // Preview local
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result);
    reader.readAsDataURL(file);
  };

  const uploadAvatar = async (file) => {
    const fileExt = file.name.split(".").pop() || "jpg";
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, file, { upsert: true });

    if (uploadError) throw uploadError;

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

  return (
    <div className="min-h-screen w-full bg-transparent text-white font-sans absolute top-0 left-0 pb-24">
      {/* Header */}
      <div
        className="w-full pt-14 pb-8 px-6 shadow-2xl border-b border-white/5 rounded-b-[40px]"
        style={{ background: "linear-gradient(160deg, #BF40FF 0%, #6600CC 35%, #2B0066 65%, #000000 100%)" }}
      >
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-[11px] font-semibold mb-6"
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Kembali
        </button>
        <h1 className="text-lg font-bold text-white" style={{ fontFamily: "'Urbanist', sans-serif" }}>
          Edit Profil
        </h1>
        <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
          Perbarui data diri Anda
        </p>
      </div>

      {/* Form */}
      <div className="max-w-md mx-auto px-4 mt-6">
        {/* Avatar */}
        <div className="text-center mb-8">
          <div
            className="relative w-24 h-24 mx-auto rounded-full p-[3px]"
            style={{
              background: "linear-gradient(135deg, #BF00FF, #9900CC, #7066ed)",
              boxShadow: "0 0 24px rgba(191,0,255,0.2)",
            }}
          >
            <div
              className="w-full h-full rounded-full flex items-center justify-center text-3xl font-extrabold overflow-hidden"
              style={{ background: preview ? 'transparent' : '#161320', fontFamily: "'Urbanist', sans-serif" }}
            >
              {preview ? (
                <img src={preview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                user?.full_name?.charAt(0)?.toUpperCase() || "?"
              )}
            </div>
          </div>
          <div className="mt-3">
            <label htmlFor="avatar-upload" className="text-[11px] font-semibold cursor-pointer px-4 py-1.5 rounded-full"
              style={{ background: "rgba(191,0,255,0.12)", color: "#7066ed", border: "1px solid rgba(191,0,255,0.2)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1">
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
            <p className="text-[9px] mt-1.5" style={{ color: "rgba(255,255,255,0.2)" }}>
              Upload foto dari galeri atau kamera
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Nama Lengkap */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.5px] mb-2"
              style={{ color: "rgba(255,255,255,0.4)" }}>
              Nama Lengkap
            </label>
            <input
              type="text"
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              placeholder="Nama lengkap Anda"
              className="w-full px-4 py-3.5 rounded-2xl text-sm font-medium text-white outline-none transition-all duration-200 focus:ring-2"
              style={{
                background: "rgba(30,30,50,0.6)",
                border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(20px)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              }}
            />
          </div>

          {/* Email (readonly) */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.5px] mb-2"
              style={{ color: "rgba(255,255,255,0.4)" }}>
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
                background: "rgba(30,30,50,0.3)",
                border: "1px solid rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.35)",
                cursor: "not-allowed",
              }}
              disabled
            />
            <p className="text-[9px] mt-1.5" style={{ color: "rgba(255,255,255,0.2)" }}>
              Email tidak dapat diubah. Hubungi admin untuk perubahan.
            </p>
          </div>

          {/* Username (readonly) */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.5px] mb-2"
              style={{ color: "rgba(255,255,255,0.4)" }}>
              Username
            </label>
            <input
              type="text"
              value={user?.username || "-"}
              className="w-full px-4 py-3.5 rounded-2xl text-sm font-medium outline-none"
              style={{
                background: "rgba(30,30,50,0.3)",
                border: "1px solid rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.35)",
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
                  Menyimpan...
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
