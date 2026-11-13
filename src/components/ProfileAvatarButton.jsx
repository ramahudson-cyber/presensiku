import { useState } from "react";
import ProfileSheet from "./ProfileSheet";

// Foto profil yang bisa diklik → buka ProfileSheet (info akun + keluar).
// Markup avatar identik dengan render lama; hanya dibungkus <button>.
// variant "hero": avatar besar dashboard (rounded-2xl, glass di atas gradasi violet)
// variant "sm"  : avatar mini header halaman pegawai (rounded-full, w-9)
export default function ProfileAvatarButton({ user, initials, variant = "sm" }) {
  const [open, setOpen] = useState(false);
  const avatarUrl = user?.avatar_url || user?.user_metadata?.avatar_url || null;

  const avatar =
    variant === "hero" ? (
      avatarUrl ? (
        <img src={avatarUrl} alt="" className="w-16 h-16 rounded-2xl object-cover border border-white/30 shadow-md" />
      ) : (
        <div className="w-16 h-16 rounded-2xl bg-white/15 border border-white/30 flex items-center justify-center font-bold text-2xl text-white shadow-inner">
          {initials}
        </div>
      )
    ) : (
      avatarUrl ? (
        <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover border" style={{ borderColor: 'rgba(47,139,248,0.15)' }} />
      ) : (
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold"
          style={{ background: '#EEF6FF', color: '#2F8BF8', border: '1px solid rgba(47,139,248,0.15)' }}>
          {initials}
        </div>
      )
    );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menu foto profil"
        className={`shrink-0 cursor-pointer rounded-full outline-none transition-all duration-200 active:scale-95 focus-visible:ring-2 focus-visible:ring-[#2F8BF8] ${
          variant === "hero" ? "hover:ring-2 hover:ring-white/40" : "hover:ring-2 hover:ring-[rgba(47,139,248,0.25)]"
        }`}
      >
        {avatar}
      </button>
      <ProfileSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
