import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

// ── Lucide-compatible inline SVGs ──
const icons = {
  user:       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  atSign:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 .6 2.2l1.6 1.6a4 4 0 0 1-2.8 1.2H17"/></svg>,
  idCard:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
  building:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>,
  mapPin:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>,
  edit:       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>,
  lock:       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  shield:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  bell:       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>,
  moon:       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>,
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
      <span className="text-xs font-bold text-white tracking-wide">{title}</span>
    </div>
    <span className="text-[10px] font-medium text-white/30">{subtitle}</span>
  </div>
);

// ── Stat Row (info row) ──
const InfoRow = ({ icon, label, desc, value, active = true }) => (
  <div
    className="flex items-center gap-3 rounded-xl px-4 py-3.5 transition-all duration-300 hover:translate-x-1"
    style={{
      background: active ? 'linear-gradient(90deg, rgba(191,0,255,0.06), transparent)' : 'transparent',
      borderLeft: `2px solid ${active ? 'transparent' : 'rgba(191,0,255,0.15)'}`,
      borderLeftStyle: 'solid',
      opacity: active ? 1 : 0.5,
      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
    }}
  >
    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
      style={{ background: 'transparent', boxShadow: 'none' }}>
      <div style={{ color: '#BF00FF' }}>{icon}</div>
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-semibold text-white">{label}</div>
      <div className="text-[9px] text-white/40">{desc}</div>
    </div>
    <div className="text-right shrink-0">
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  </div>
);

// ── Menu Row ──
const MenuRow = ({ icon, title, desc, right, onClick }) => (
  <div
    className="flex items-center gap-3 rounded-xl px-4 py-3.5 transition-all duration-300 hover:translate-x-1 cursor-pointer"
    style={{
      borderLeft: '2px solid transparent',
      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
    }}
    onClick={onClick}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
  >
    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
      style={{ background: 'transparent', boxShadow: 'none' }}>
      <div style={{ color: '#BF00FF' }}>{icon}</div>
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="text-[9px] text-white/40">{desc}</div>
    </div>
    {right || (
      <div className="shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }}>
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

// ── Glass Container ──
const glassCard = {
  background: 'rgba(30,30,50,0.6)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: '24px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  overflow: 'hidden',
};

// ==============================
// EMPLOYEE PROFILE PAGE
// ==============================
export default function EmployeeProfile() {
  const { user } = useAuth();
  const { darkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

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
    <div className="min-h-screen w-full bg-transparent text-white font-sans absolute top-0 left-0 pb-24">
      {/* Hero Header */}
      <div
        className="w-full pt-12 pb-10 shadow-2xl border-b border-white/5 rounded-b-[40px] text-center"
        style={{ background: 'linear-gradient(160deg, #BF40FF 0%, #6600CC 35%, #2B0066 65%, #000000 100%)' }}
      >
        {/* Avatar Ring */}
        <div className="relative w-[110px] h-[110px] mx-auto mb-4 rounded-full p-[3px]"
          style={{ background: 'linear-gradient(135deg, #BF00FF, #9900CC, #7066ed)',
                   boxShadow: '0 0 24px rgba(191,0,255,0.25), 0 0 48px rgba(191,0,255,0.08)' }}>
          <div className="w-full h-full rounded-full flex items-center justify-center relative overflow-hidden"
            style={{ background: '#161320' }}>
            <div className="absolute inset-0 rounded-full"
              style={{ background: 'linear-gradient(135deg, rgba(191,0,255,0.12), rgba(153,0,204,0.04))' }} />
            <span className="relative text-[40px] font-extrabold text-white"
              style={{ fontFamily: "'Urbanist', sans-serif" }}>
              {initial}
            </span>
            {/* Status dot */}
            <div className="absolute bottom-[5px] right-[5px] w-5 h-5 rounded-full border-[2.5px]"
              style={{ background: '#adff2f', borderColor: '#161320',
                       boxShadow: '0 0 6px rgba(173,255,47,0.3)' }} />
          </div>
        </div>

        <h1 className="text-[22px] font-bold text-white mb-1"
          style={{ fontFamily: "'Urbanist', sans-serif", letterSpacing: '-0.3px' }}>
          {user?.full_name || '-'}
        </h1>

        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.5px]"
          style={{ background: 'rgba(191,0,255,0.12)', border: '1px solid rgba(191,0,255,0.2)', color: '#7066ed' }}>
          {icons.shield}
          {user?.role === 'pegawai' ? 'Pegawai' : user?.role || '-'}
        </div>

        <p className="mt-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {user?.position || '-'}
        </p>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto space-y-4 px-4 mt-6 pb-6">

        {/* ─── INFORMASI AKUN ─── */}
        <div style={glassCard}>
          <CardHeader title="Informasi Akun" subtitle={user?.role || 'Pegawai'} />
          <div className="px-1 pb-2 pt-0.5">
            <InfoRow icon={icons.user} label="Nama Lengkap" desc="Nama sesuai identitas"
              value={user?.full_name || '-'} active />
            <InfoRow icon={icons.atSign} label="Username" desc="ID akun login"
              value={user?.username || user?.email?.split('@')[0] || '-'} active />
            <InfoRow icon={icons.idCard} label="NIP" desc="Nomor Induk Pegawai"
              value={nip} active />
            <InfoRow icon={icons.building} label="Unit Kerja" desc="Departemen / Instansi"
              value={user?.department || 'Puskesmas Ampenan'} active={false} />
          </div>
        </div>

        {/* ─── PENGATURAN ─── */}
        <div style={glassCard}>
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
              right={
                <span className="shrink-0 text-[9px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.08)', color: '#9ba1ae' }}>
                  3
                </span>
              }
              onClick={() => {}} />
            <MenuRow icon={icons.moon} title="Tema"
              desc="Tampilan gelap / terang"
              right={<Toggle on />}
              onClick={toggleTheme} />
          </div>
        </div>

        {/* ─── LAINNYA ─── */}
        <div style={glassCard}>
          <CardHeader title="Lainnya" subtitle="Sistem" />
          <div className="px-1 pb-2 pt-0.5">
            <MenuRow icon={icons.globe} title="Bahasa"
              desc="Bahasa tampilan aplikasi"
              right={<span className="text-[12px] font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Indonesia</span>} />
            <MenuRow icon={icons.info} title="Tentang Aplikasi"
              desc="Versi, syarat & ketentuan"
              onClick={() => {}} />
            <MenuRow icon={icons.shield} title="Kebijakan Privasi"
              desc="Perlindungan data pribadi"
              onClick={() => {}} />
          </div>
        </div>

        {/* ─── LOGOUT ─── */}
        <div style={glassCard}>
          <div className="p-4">
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:translate-x-1 active:scale-[0.98]"
              style={{
                background: 'rgba(251,113,133,0.08)',
                border: '1px solid rgba(251,113,133,0.15)',
                borderLeft: '2px solid transparent',
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
          <div className="border-t flex items-center justify-between px-5 py-3"
            style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            <span className="text-[9px] font-medium" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Hadir.Kuy v1.6.6
            </span>
            <span className="text-[9px] font-medium" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Build 18
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
