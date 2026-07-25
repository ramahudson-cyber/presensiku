import { ArrowUp, ArrowDown } from "lucide-react";

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
        <div key={u.id || i} className={`item w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs text-white border-2 border-[#0e0a1c] -ml-2 shadow-md flex-shrink-0 ${getColor(u.full_name?.charAt(0))}`}>
          {u.full_name?.charAt(0)?.toUpperCase() || 'P'}
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

export function PremiumStatCard({ title, sub, value, detail, users, trendValue, trendDirection }) {
  let trendIcon = null;
  let trendClass = 'bg-white/5 text-white/30 border-white/[0.04]'; // neutral
  if (trendDirection === 'up') {
    trendIcon = <ArrowUp size={10} />;
    trendClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'; // up
  } else if (trendDirection === 'down') {
    trendIcon = <ArrowDown size={10} />;
    trendClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20'; // down
  }

  return (
    <div className="card bg-[#161228]/60 backdrop-blur-2xl saturate-150 border border-white/5 rounded-2xl p-5 flex flex-col transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-violet-500/10 hover:border-violet-500/20">
      <div className="card-top relative z-10">
        <div>
          <div className="label text-[10px] font-semibold text-white/30 uppercase tracking-widest">{title}</div>
          <div className="sub text-[10px] text-white/20 mt-1 font-normal">{sub}</div>
        </div>
      </div>
      <div className="card-value text-3xl font-bold font-['Urbanist'] mt-3 relative z-10">{value}</div>
      <div className="card-bottom mt-auto pt-4 flex items-center justify-between relative z-10">
        <PhotoStack users={users} />
        {trendValue && (
          <div className={`trend flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${trendClass}`}>
            {trendIcon}{trendValue}
          </div>
        )}
      </div>
    </div>
  );
}
