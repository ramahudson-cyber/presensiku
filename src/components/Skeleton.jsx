// Skeleton loading bersama — shimmer halus untuk semua state loading halaman.
// Prop `dark` untuk permukaan gelap (admin), default untuk permukaan terang.
export default function Skeleton({
  width = "100%",
  height = 12,
  radius = 8,
  dark = false,
  className = "",
  style,
}) {
  return (
    <span
      aria-hidden="true"
      className={`skeleton-block${dark ? " skeleton-block-dark" : ""} ${className}`.trim()}
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}

// Beberapa baris teks sekaligus; baris terakhir lebih pendek agar terasa natural.
export function SkeletonLines({
  lines = 2,
  height = 10,
  gap = 8,
  radius = 999,
  dark = false,
  lastWidth = "62%",
  style,
}) {
  return (
    <span className="block" style={{ display: "grid", gap, ...style }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          dark={dark}
          height={height}
          radius={radius}
          width={i === lines - 1 && lines > 1 ? lastWidth : "100%"}
        />
      ))}
    </span>
  );
}
