import { ArrowUp, ArrowDown, UsersRound, CircleCheckBig, HeartPulse, CalendarDays } from "lucide-react";

const PhotoStack = ({ users = [], max = 4 }) => {
  if (!users || users.length === 0) {
    return <div className="flex flex-row-reverse items-center flex-shrink-0"></div>;
  }

  const visibleUsers = users.slice(0, max);
  const remainingCount = users.length - max;

  const colors = ["rose", "emerald", "amber", "sky", "violet", "pink", "teal", "orange", "indigo", "lime"];
  const getColor = (char) => `p-${colors[((char?.charCodeAt(0) || 0) - 65) % colors.length]}`;

  return (
    <div className="flex flex-row-reverse items-center flex-shrink-0">
      {visibleUsers.map((u, i) => (
        <div key={u.id || i} className={`item w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs text-white border-2 border-[#0e0a1c] -ml-2 shadow-md flex-shrink-0 overflow-hidden ${u.avatar_url ? "bg-white/10" : getColor(u.full_name?.charAt(0))}`}>
          {u.avatar_url ? (
            <img src={u.avatar_url} alt={u.full_name || "Pegawai"} className="w-full h-full object-cover" />
          ) : (
            u.full_name?.charAt(0)?.toUpperCase() || 'P'
          )}
        </div>
      ))}
      {remainingCount > 0 && (
        <div className="more w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs text-white/40 bg-white/5 border-2 border-[#0e0a1c] -ml-2 flex-shrink-0">
          +{remainingCount}
        </div>
      )}
    </div>
  );
};

export function PremiumStatCard({ title, sub, value, users, trendValue, trendDirection, loading }) {
  const meta = {
    "Total Pegawai": { icon: UsersRound, accent: "from-violet-500/80 to-fuchsia-500/20", note: `${value || 0} akun terdaftar` },
    "Hadir Hari Ini": { icon: CircleCheckBig, accent: "from-emerald-400/45 to-violet-500/15", note: value > 0 ? `${value} sudah check-in` : "Menunggu presensi pertama" },
    "Izin / Sakit": { icon: HeartPulse, accent: "from-amber-400/45 to-violet-500/15", note: value > 0 ? `${value} perlu dipantau` : "Semua aman" },
    "Cuti": { icon: CalendarDays, accent: "from-pink-400/45 to-violet-500/15", note: value > 0 ? `${value} cuti aktif` : "Tidak ada cuti aktif" },
  }[title] || { icon: UsersRound, accent: "from-violet-500/70 to-fuchsia-500/20", note: sub };
  const Icon = meta.icon;
  let trendIcon = null;
  let trendClass = 'bg-white/5 text-white/35 border-white/[0.06]';
  if (trendDirection === 'up') {
    trendIcon = <ArrowUp size={10} />;
    trendClass = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
  } else if (trendDirection === 'down') {
    trendIcon = <ArrowDown size={10} />;
    trendClass = 'bg-rose-500/10 text-rose-300 border-rose-500/20';
  }

  if (loading) {
    return <div className="min-h-[178px] rounded-[28px] border border-white/10 bg-white/[0.05] p-5 animate-pulse">
      <div className="flex justify-between">
        <div className="space-y-2"><div className="h-3 w-24 rounded bg-white/10"></div><div className="h-3 w-16 rounded bg-white/5"></div></div>
        <div className="h-11 w-11 rounded-2xl bg-white/10"></div>
      </div>
      <div className="h-11 w-16 rounded bg-white/10 mt-7"></div>
      <div className="h-4 w-28 rounded bg-white/5 mt-4"></div>
    </div>
  }

  return (
    <div className={`relative min-h-[178px] rounded-[28px] border border-white/10 bg-gradient-to-br ${meta.accent} p-5 overflow-hidden shadow-2xl shadow-black/20 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/18 hover:shadow-violet-500/15 font-['Inter',ui-sans-serif,system-ui]`}>
      <div className="absolute inset-0 bg-[#12071f]/55"></div>
      <div className="absolute -right-12 -top-14 h-36 w-36 rounded-full bg-white/10 blur-2xl"></div>
      <div className="relative z-10 flex justify-between items-start">
        <div>
          <div className="text-[11px] font-black text-white uppercase tracking-[0.18em]">{title}</div>
          <div className="text-xs text-white/60 mt-1 font-semibold">{sub}</div>
        </div>
        <div className="h-11 w-11 rounded-2xl bg-white/[0.08] border border-white/10 grid place-items-center shadow-lg shadow-black/20">
          <Icon size={20} strokeWidth={1.9} className="text-white/86" />
        </div>
      </div>
      <div className="relative z-10 mt-7 flex items-end gap-2">
        <div className="text-5xl font-black leading-none tracking-tight text-white">{value}</div>
        <div className="text-xs text-white/75 mb-1.5 font-bold">{title === "Total Pegawai" ? "pegawai" : "hari ini"}</div>
      </div>
      <div className="relative z-10 mt-4 flex items-center justify-between gap-3">
        {users?.length > 0 ? <PhotoStack users={users} /> : <span className="text-xs font-medium text-white/55">{meta.note}</span>}
        {trendValue && <div className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${trendClass}`}>{trendIcon}{trendValue}</div>}
      </div>
    </div>
  );
}
