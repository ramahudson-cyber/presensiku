import { Users, UserCheck, UserMinus, UserX, ArrowUp, ArrowDown } from "lucide-react";

const PhotoStack = ({ users = [], max = 4 }) => {
  if (!users || users.length === 0) {
    return <div className="photo-stack"></div>;
  }

  const visibleUsers = users.slice(0, max);
  const remainingCount = users.length - max;

  const colors = ["rose", "emerald", "amber", "sky", "violet", "pink", "teal", "orange", "indigo", "lime"];
  const getColor = (char) => colors[((char?.charCodeAt(0) || 0) - 65) % colors.length];

  return (
    <div className="photo-stack">
      {visibleUsers.map((u, i) => (
        <div key={u.id || i} className={`item p-${getColor(u.full_name?.charAt(0))}`}>
          {u.full_name?.charAt(0)?.toUpperCase() || 'P'}
        </div>
      ))}
      {remainingCount > 0 && (
        <div className="more">+{remainingCount}</div>
      )}
    </div>
  );
};

export function PremiumStatCard({ title, sub, value, detail, users, trendValue, trendDirection }) {
  let trendIcon = null;
  let trendClass = 'neutral';
  if (trendDirection === 'up') {
    trendIcon = <ArrowUp size={10} />;
    trendClass = 'up';
  } else if (trendDirection === 'down') {
    trendIcon = <ArrowDown size={10} />;
    trendClass = 'down';
  }

  return (
    <div className="card">
      <div className="card-top">
        <div>
          <div className="label">{title}</div>
          <div className="sub">{sub}</div>
        </div>
      </div>
      <div className="card-value">{value}</div>
      <div className="card-bottom">
        <PhotoStack users={users} />
        {trendValue && (
          <div className={`trend ${trendClass}`}>
            {trendIcon}{trendValue}
          </div>
        )}
      </div>
    </div>
  );
}
