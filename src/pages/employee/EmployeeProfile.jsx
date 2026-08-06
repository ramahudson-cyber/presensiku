import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

// Light-mode tokens — per DESIGN.md
const T = {
  bg: '#F4F2FB',
  surface: '#FFFFFF',
  border: 'rgba(31,41,55,0.08)',
  div: '#F1F5F9',
  text: '#0F172A',
  textSec: '#475569',
  textMuted: '#94A3B8',
  sub: '#6B7280',
  shadow: '0 4px 16px rgba(15,23,42,0.06)',
  rowBg: 'rgba(15,23,42,0.02)',
  rowShadow: '0 1px 3px rgba(0,0,0,0.06)',
  iconBg: '#F5F3FF',
};

// ── Lucide-compatible inline SVGs (stroke #BF00FF) ──
const icons = {
  user:       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  atSign:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 .6 2.2l1.6 1.6a4 4 0 0 1-2.8 1.2H17"/></svg>,
  idCard:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
  building:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>,
  edit:       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>,
  lock:       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  shield:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  bell:       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>,
  globe:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  info:       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  logOut:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  chevron:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
};

// ── Indicator bar ──
const IndicatorBar = () => (
  <div className="w-1 h-4 rounded-full shrink-0"
    style={{ background: 'linear-gradient(180deg, #BF00FF, #3B82F6)' }} />
);

// ── Card Header ──
const CardHeader = ({ title, subtitle }) => (
  <div className="flex items-center justify-between px-5 pt-5 pb-1">
    <div className="flex items-center gap-2.5">
      <IndicatorBar />
      <span className="text-xs font-bold tracking-wide" style={{ color: T.text }}>{title}</span>
    </div>
    <span className="text-[10px] font-medium" style={{ color: T.sub }}>{subtitle}</span>
  </div>
);

// ── Info Row ──
const InfoRow = ({ icon, label, desc, value, active = true }) => (
  <div
    className="flex items-center gap-3 rounded-xl px-4 py-3.5 transition-all duration-300 hover:translate-x-1"
    style={{
      background: active ? `linear-gradient(90deg, #BF00FF10, transparent)` : "transparent",
      borderLeft: `2px solid ${active ? "transparent" : "#BF00FF33"}`,
      opacity: active ? 1 : 0.5,
      boxShadow: T.rowShadow,
    }}
  >
    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: T.iconBg }}>
      <div style={{ color: '#BF00FF' }}>{icon}</div>
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-semibold" style={{ color: T.text }}>{label}</div>
      <div className="text-[9px]" style={{ color: T.sub }}>{desc}</div>
    </div>
    <div className="text-right shrink-0">
      <div className="text-sm font-semibold" style={{ color: T.text }}>{value}</div>
    </div>
  </div>
);

// ── Menu Row ──
const MenuRow = ({ icon, title, desc, right, onClick }) => (
  <div
    className="flex items-center gap-3 rounded-xl px-4 py-3.5 transition-all duration-300 hover:translate-x-1 cursor-pointer"
    style={{ boxShadow: T.rowShadow }}
    onClick={onClick}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
  >
    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: T.iconBg }}>
      <div style={{ color: '#BF00FF' }}>{icon}</div>
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-semibold" style={{ color: T.text }}>{title}</div>
      <div className="text-[9px]" style={{ color: T.sub }}>{desc}</div>
    </div>
    {right || (
      <div className="shrink-0" style={{ color: T.textMuted }}>
        {icons.chevron}
      </div>
    )}
  </div>
);

// ── Toggle ──
const Toggle = ({ on }) => (
  <div className="w-[40px] h-[22px] rounded-[11px] shrink-0 relative cursor-pointer"
    style={{ background: 'linear-gradient(135deg, #BF00FF, #6366f1)' }}>
    <div className="w-4 h-4 rounded-full bg-white absolute top-[3px] left-[21px]"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
  </div>
);

// ── Card container ──
const Card = ({ children }) => (
  <div className="rounded-3xl relative overflow-hidden"
    style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
    {children}
  </div>
);

// ==============================
// EMPLOYEE PROFILE PAGE
// ==============================
export default function EmployeeProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const avatarUrl = user?.avatar_url || user?.user_metadata?.avatar_url || null;
  const initial = user?.full_name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '--';
  const nip = user?.nip || user?.user_metadata?.nip || '-';

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    } catch {
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen w-full font-sans absolute top-0 left-0 right-0 pb-24" style={{ background: T.bg, color: T.text }}>
      {/* ── HEADER — simple elegant (sama dengan Riwayat) ── */}
      <div className="pt-14 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-[17px] font-bold tracking-tight" style={{ color: T.text }}>Profil Saya</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover border" style={{ borderColor: 'rgba(191,0,255,0.15)' }} />
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold"
                style={{ background: T.iconBg, color: '#BF00FF', border: '1px solid rgba(191,0,255,0.15)' }}>
                {initial?.charAt(0) || 'P'}
              </div>
            )}
            <span className="text-[9px] font-medium leading-none max-w-[72px] truncate text-center" style={{ color: T.sub }}>
              {user?.position || user?.role || "Pegawai"}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto space-y-4 px-4 mt-6 pb-6">

        {/* ─── IDENTITY CARD ─── */}
        <Card>
          <div className="flex items-center gap-4 px-5 pt-5 pb-4">
            {/* Avatar */}
            <div className="relative w-20 h-20 shrink-0 rounded-2xl p-[2.5px]"
              style={{ background: 'linear-gradient(135deg, #BF00FF, #9900CC, #7066ed)' }}>
              <div className="w-full h-full rounded-[14px] flex items-center justify-center overflow-hidden"
                style={{ background: avatarUrl ? 'transparent' : T.iconBg }}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[26px] font-extrabold" style={{ color: '#BF00FF' }}>{initial}</span>
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-extrabold tracking-tight truncate" style={{ color: T.text }}>
                {user?.full_name || '-'}
              </h1>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-[0.5px] mt-1.5"
                style={{ background: T.iconBg, border: '1px solid rgba(191,0,255,0.2)', color: '#BF00FF' }}>
                {icons.shield}
                {user?.role === 'pegawai' ? 'Pegawai' : user?.role || '-'}
              </div>
              <p className="mt-1 text-[10px] truncate" style={{ color: T.sub }}>{user?.position || '-'}</p>
            </div>
          </div>
        </Card>

        {/* ─── INFORMASI AKUN ─── */}
        <Card>
          <CardHeader title="Informasi Akun" subtitle={user?.role || 'Pegawai'} />
          <div className="px-1 pb-2 pt-0.5">
            <InfoRow icon={icons.user} label="Nama Lengkap" desc="Nama sesuai identitas"
              value={user?.full_name || '-'} active />
            <InfoRow icon={icons.atSign} label="Username" desc="ID akun login"
              value={user?.username || user?.email?.split('@')[0] || '-'} active />
            <InfoRow icon={icons.idCard} label="NIP" desc="Nomor Induk Pegawai"
              value={nip} active />
            <InfoRow icon={icons.building} label="Unit Kerja" desc="Departemen / Instansi"
              value={user?.department || '-'} active={false} />
          </div>
        </Card>

        {/* ─── PENGATURAN ─── */}
        <Card>
          <CardHeader title="Pengaturan" subtitle="Akun" />
          <div className="px-1 pb-2 pt-0.5">
            <MenuRow icon={icons.edit} title="Edit Profil"
              desc="Ubah foto, nama, dan informasi pribadi"
              onClick={() => navigate('/employee/profile/edit')} />
            <MenuRow icon={icons.lock} title="Keamanan"
              desc="Ubah password & verifikasi identitas"
              right={
                <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.5px] px-2.5 py-1 rounded-full text-white"
                  style={{ background: 'linear-gradient(135deg, #BF00FF, #9900CC)' }}>
                  BARU
                </span>
              }
              onClick={() => {}} />
            <MenuRow icon={icons.shield} title="Sidik Jari & Face ID"
              desc="Akses cepat dengan biometrik"
              right={<Toggle on />} />
            <MenuRow icon={icons.bell} title="Notifikasi"
              desc="Pengingat & pemberitahuan"
              onClick={() => {}} />
          </div>
        </Card>

        {/* ─── LAINNYA ─── */}
        <Card>
          <CardHeader title="Lainnya" subtitle="Sistem" />
          <div className="px-1 pb-2 pt-0.5">
            <MenuRow icon={icons.globe} title="Bahasa"
              desc="Bahasa tampilan aplikasi"
              right={<span className="text-[12px] font-medium" style={{ color: T.sub }}>Indonesia</span>} />
            <MenuRow icon={icons.info} title="Tentang Aplikasi"
              desc="Versi, syarat & ketentuan"
              onClick={() => {}} />
            <MenuRow icon={icons.shield} title="Kebijakan Privasi"
              desc="Perlindungan data pribadi"
              onClick={() => {}} />
          </div>
        </Card>

        {/* ─── LOGOUT ─── */}
        <Card>
          <div className="p-4">
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:translate-x-1 active:scale-[0.98]"
              style={{
                background: 'rgba(251,113,133,0.08)',
                border: '1px solid rgba(251,113,133,0.15)',
                color: '#fb7185',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(251,113,133,0.15)';
                e.currentTarget.style.borderColor = 'rgba(251,113,133,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(251,113,133,0.08)';
                e.currentTarget.style.borderColor = 'rgba(251,113,133,0.15)';
              }}
            >
              {loggingOut ? (
                <div className="w-4 h-4 border-2 border-rose-300 border-t-transparent rounded-full animate-spin" />
              ) : (
                icons.logOut
              )}
              {loggingOut ? 'Keluar...' : 'Keluar dari Akun'}
            </button>
          </div>

          {/* Footer */}
          <div className="border-t flex items-center justify-between px-5 py-3" style={{ borderColor: T.div }}>
            <span className="text-[9px] font-medium" style={{ color: T.sub }}>Hadir.Kuy v1.6.6</span>
            <span className="text-[9px] font-medium" style={{ color: T.sub }}>Build 18</span>
          </div>
        </Card>

      </div>
    </div>
  );
}
