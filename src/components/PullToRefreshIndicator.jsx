import { Loader2, ArrowDown } from "lucide-react";

// Indikator pull-to-refresh: fixed di atas viewport, turun mengikuti
// tarikan, lalu berputar saat refresh. Render di dalam halaman mana pun
// yang memakai usePullToRefresh.
export default function PullToRefreshIndicator({ pullDistance, isRefreshing }) {
  const opacity = isRefreshing ? 1 : Math.min(pullDistance / 55, 1);
  if (!isRefreshing && pullDistance <= 0) return null;

  const translateY = isRefreshing ? 44 : 8 + pullDistance;

  return (
    <div
      className="fixed left-1/2 z-[80] pointer-events-none"
      style={{
        top: 0,
        transform: `translate(-50%, ${translateY}px)`,
        opacity,
        transition: isRefreshing ? "transform 200ms ease-out" : "none",
      }}
    >
      <div className="w-10 h-10 rounded-full bg-white shadow-lg border border-gray-100 flex items-center justify-center">
        {isRefreshing ? (
          <Loader2 size={18} className="animate-spin text-electric-violet" />
        ) : (
          <ArrowDown
            size={18}
            className="text-electric-violet"
            style={{ transform: `rotate(${Math.min(pullDistance / 55, 1) * 180}deg)` }}
          />
        )}
      </div>
    </div>
  );
}
