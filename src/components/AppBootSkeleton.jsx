// Kerangka skeleton app-shell saat sesi/izin dicek (boot aplikasi).
// Netral: cocok untuk admin maupun pegawai sebelum peran diketahui.
import Skeleton from "./Skeleton";

export default function AppBootSkeleton({ label = "Memuat..." }) {
  return (
    <div className="min-h-screen bg-slate-100" role="status" aria-label={label}>
      <div className="mx-auto w-full max-w-3xl px-4 pt-6">
        <div className="flex items-center gap-3">
          <Skeleton width={42} height={42} radius={999} />
          <div style={{ display: "grid", gap: 8 }}>
            <Skeleton width={128} height={12} />
            <Skeleton width={84} height={9} />
          </div>
          <Skeleton width={64} height={28} radius={999} style={{ marginLeft: "auto" }} />
        </div>

        <div className="mt-7" style={{ display: "grid", gap: 14 }}>
          <Skeleton width="100%" height={148} radius={26} />
          <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 12 }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} width="100%" height={112} radius={20} />
            ))}
          </div>
          <div className="grid md:grid-cols-3" style={{ gap: 14 }}>
            <div className="md:col-span-2">
              <Skeleton width="100%" height={220} radius={22} />
            </div>
            <Skeleton width="100%" height={220} radius={22} />
          </div>
          <Skeleton width="100%" height={120} radius={22} />
        </div>
      </div>
    </div>
  );
}
