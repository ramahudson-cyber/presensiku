import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";

// Pull-to-Refresh untuk APK (Android WebView tidak punya native PTR).
// Di PWA/browser, native Chrome PTR yang bekerja — hook ini sengaja
// NONAKTIF di web agar tidak menyaingi/memblokir scroll natif.
//
// Scroll container dideteksi dari ancestor elemen yang disentuh (bukan
// window): di AdminLayout, konten di-scroll oleh div inner (overflow-x:
// hidden → overflow-y: auto implisit), sehingga window.scrollY selalu 0.
//
// Konstanta mengikuti pola terbukti EmployeeSchedule: threshold 55px,
// pull maksimum 80px, divisor 2.5.
const THRESHOLD = 55;
const MAX_PULL = 80;
const DIVISOR = 2.5;

// Cari scrollable ancestor dari titik sentuh; fallback scrollingElement.
function findScroller(target) {
  let el = target instanceof Element ? target : null;
  while (el && el !== document.body && el !== document.documentElement) {
    if (el.scrollHeight > el.clientHeight + 1) return el;
    el = el.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

export default function usePullToRefresh(onRefresh, { enabled } = {}) {
  // Default: hanya APK native. Di web, native browser PTR yang mengambil peran.
  const active = enabled ?? Capacitor.isNativePlatform();

  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(null);
  const scrollerRef = useRef(null);
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
    const rounded = Math.round(value);
    if (rounded === Math.round(pullDistanceRef.current)) return; // hemat re-render
    pullDistanceRef.current = rounded;
    setPullDistance(rounded);
  }, []);

  useEffect(() => {
    if (!active) return undefined;

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
      if (e.touches.length !== 1) return;
      if (shouldIgnore(e.target)) return;
      scrollerRef.current = findScroller(e.target);
      if ((scrollerRef.current?.scrollTop ?? 0) > 0) {
        scrollerRef.current = null; // bukan di puncak — bukan gesture pull
        return;
      }
      startYRef.current = e.touches[0].clientY;
      hapticRef.current = false;
    };

    const onTouchMove = (e) => {
      if (startYRef.current === null || refreshingRef.current) return;
      const scroller = scrollerRef.current;
      const deltaY = e.touches[0].clientY - startYRef.current;

      if (deltaY <= 0) {
        // Jari bergerak ke atas — serahkan ke scroll natif
        setPull(0);
        return;
      }

      // Belum di puncak scroller (user sudah scroll sedikit)? bukan pull.
      if ((scroller?.scrollTop ?? 0) > 0) {
        setPull(0);
        startYRef.current = null;
        return;
      }

      if (e.cancelable) e.preventDefault(); // tahan scroll natif selama menarik

      setPull(Math.min(deltaY / DIVISOR, MAX_PULL));

      if (pullDistanceRef.current >= THRESHOLD && !hapticRef.current) {
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
  }, [active, setPull]);

  return { pullDistance, isRefreshing };
}
