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
        <div key={u.id || i} className={`item w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs text-white border-2 border-white -ml-2 shadow-md flex-shrink-0 overflow-hidden ${u.avatar_url ? "bg-white/10" : getColor(u.full_name?.charAt(0))}`}>
          {u.avatar_url ? (
            <img src={u.avatar_url} alt={u.full_name || "Pegawai"} className="w-full h-full object-cover" />
          ) : (
            u.full_name?.charAt(0)?.toUpperCase() || 'P'
          )}
        </div>
      ))}
      {remainingCount > 0 && (
        <div className="more w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs text-slate-500 bg-slate-100 border-2 border-white -ml-2 flex-shrink-0">
          +{remainingCount}
        </div>
      )}
    </div>
  );
};

export function PremiumStatCard({ title, sub, value, users, trendValue, trendDirection, loading }) {
  const meta = {
    "Total Pegawai": { icon: UsersRound, accent: "from-[#BF00FF] to-[#8A00CC]", note: `${value || 0} akun terdaftar` },
    "Hadir Hari Ini": { icon: CircleCheckBig, accent: "from-emerald-500 to-teal-600", note: value > 0 ? `${value} sudah check-in` : "Menunggu presensi pertama" },
    "Izin / Sakit": { icon: HeartPulse, accent: "from-amber-500 to-orange-600", note: value > 0 ? `${value} perlu dipantau` : "Semua aman" },
    "Cuti": { icon: CalendarDays, accent: "from-sky-500 to-blue-600", note: value > 0 ? `${value} cuti aktif` : "Tidak ada cuti aktif" },
  }[title] || { icon: UsersRound, accent: "from-[#BF00FF] to-[#8A00CC]", note: sub };
  const Icon = meta.icon;
  let trendIcon = null;
  let trendClass = 'bg-slate-100 text-slate-500 border-slate-200';
  if (trendDirection === 'up') {
    trendIcon = <ArrowUp size={10} />;
    trendClass = 'bg-emerald-50 text-emerald-600 border-emerald-200';
  } else if (trendDirection === 'down') {
    trendIcon = <ArrowDown size={10} />;
    trendClass = 'bg-rose-50 text-rose-600 border-rose-200';
  }

  if (loading) {
    return <div className="min-h-[178px] rounded-[28px] border border-slate-200/70 bg-white p-5 animate-pulse">
      <div className="flex justify-between">
        <div className="space-y-2"><div className="h-3 w-24 rounded bg-slate-100"></div><div className="h-3 w-16 rounded bg-slate-50"></div></div>
        <div className="h-11 w-11 rounded-2xl bg-slate-100"></div>
      </div>
      <div className="h-11 w-16 rounded bg-slate-100 mt-7"></div>
      <div className="h-4 w-28 rounded bg-slate-50 mt-4"></div>
    </div>
  }

  return (
    <div className="relative min-h-[178px] rounded-[28px] border border-slate-200/70 bg-white p-5 overflow-hidden shadow-[0_4px_16px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#BF00FF]/30 hover:shadow-[0_12px_32px_rgba(191,0,255,0.12)] font-['Inter',ui-sans-serif,system-ui]">
      <div className="absolute -right-12 -top-14 h-36 w-36 rounded-full bg-gradient-to-br from-[#BF00FF]/8 to-transparent blur-2xl"></div>
      <div className="relative z-10 flex justify-between items-start">
        <div>
          <div className="text-[11px] font-black text-slate-900 uppercase tracking-[0.18em]">{title}</div>
          <div className="text-xs text-slate-500 mt-1 font-semibold">{sub}</div>
        </div>
        <div className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${meta.accent} grid place-items-center shadow-lg`}>
          <Icon size={20} strokeWidth={1.9} className="text-white" />
        </div>
      </div>
      <div className="relative z-10 mt-7 flex items-end gap-2">
        <div className="text-5xl font-black leading-none tracking-tight text-slate-900">{value}</div>
        <div className="text-xs text-slate-500 mb-1.5 font-bold">{title === "Total Pegawai" ? "pegawai" : "hari ini"}</div>
      </div>
      <div className="relative z-10 mt-4 flex items-center justify-between gap-3">
        {users?.length > 0 ? <PhotoStack users={users} /> : <span className="text-xs font-medium text-slate-500">{meta.note}</span>}
        {trendValue && <div className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${trendClass}`}>{trendIcon}{trendValue}</div>}
      </div>
    </div>
  );
}