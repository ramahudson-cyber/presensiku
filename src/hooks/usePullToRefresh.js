import { useCallback, useEffect, useRef, useState } from "react";

// Pull-to-Refresh dokumen untuk APK (Android WebView tidak punya native PTR)
// dan PWA. Mendengarkan touch di level document agar bekerja seragam untuk
// halaman admin (dalam <main>) maupun halaman pegawai (root absolute).
//
// Konstanta mengikuti pola terbukti EmployeeSchedule: threshold 55px,
// pull maksimum 80px, divisor 2.5.
const THRESHOLD = 55;
const MAX_PULL = 80;
const DIVISOR = 2.5;

export default function usePullToRefresh(onRefresh, { enabled = true } = {}) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(null);
  const hapticRef = useRef(false);
  const refreshingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    refreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  const setPull = useCallback((value) => {
    pullDistanceRef.current = value;
    setPullDistance(value);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    const shouldIgnore = (target) => {
      if (!(target instanceof Element)) return true;
      // Peta Leaflet (swipe/drag), input, dan elemen opt-out [data-no-ptr]
      return Boolean(
        target.closest(".leaflet-container")
        || target.closest("input, textarea, select, [contenteditable='true']")
        || target.closest("[data-no-ptr]")
      );
    };

    const onTouchStart = (e) => {
      if (refreshingRef.current) return;
      if (window.scrollY > 0) return;
      if (e.touches.length !== 1) return;
      if (shouldIgnore(e.target)) return;
      startYRef.current = e.touches[0].clientY;
      hapticRef.current = false;
    };

    const onTouchMove = (e) => {
      if (startYRef.current === null || refreshingRef.current) return;
      const deltaY = e.touches[0].clientY - startYRef.current;
      if (deltaY <= 0) {
        setPull(0);
        return;
      }
      // Hanya proses pull bila dokumen benar-benar di paling atas
      if (window.scrollY > 0) {
        setPull(0);
        startYRef.current = null;
        return;
      }
      if (e.cancelable) e.preventDefault(); // supresi native PTR Chrome + edge-glow WebView

      const distance = Math.min(deltaY / DIVISOR, MAX_PULL);
      setPull(distance);

      if (distance >= THRESHOLD && !hapticRef.current) {
        hapticRef.current = true;
        try { navigator.vibrate?.(10); } catch { /* vibrate opsional */ }
      }
    };

    const onTouchEnd = () => {
      startYRef.current = null;
      if (refreshingRef.current) return;

      if (pullDistanceRef.current >= THRESHOLD && typeof onRefreshRef.current === "function") {
        setPull(THRESHOLD);
        setIsRefreshing(true);
        Promise.resolve()
          .then(() => onRefreshRef.current())
          .catch(() => {})
          .finally(() => {
            setIsRefreshing(false);
            setPull(0);
          });
        return;
      }
      setPull(0);
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [enabled, setPull]);

  return { pullDistance, isRefreshing };
}
