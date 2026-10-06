import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Peta dibuat SEKALI (tidak dihancurkan tiap render) — pan/zoom user
// dipertahankan. Marker & circle di-update in-place saat koordinat berubah;
// fitBounds hanya di muat pertama.
export default function LocationMap({ userLocation, puskesmasLocation, distance, status, fullscreen, onMapReady }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({ puskesmas: null, circle: null, user: null });
  const didFitRef = useRef(false);

  const puskesmasIcon = L.divIcon({
    className: "",
    html: `<div style="position:relative;width:40px;height:54px;">
      <div style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:18px;height:5px;border-radius:50%;background:rgba(15,23,42,0.35);filter:blur(1px);"></div>
      <div style="position:absolute;left:2px;bottom:5px;animation:pinBounce 1.2s ease-in-out infinite;filter:drop-shadow(0 4px 6px rgba(15,23,42,0.35));">
        <svg width="36" height="44" viewBox="0 0 24 30">
          <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 10.4 17.1 11.5 18 .3.3.7.3 1 0C13.6 29.1 24 20.4 24 12 24 5.4 18.6 0 12 0z" fill="#DC2626" stroke="#ffffff" stroke-width="1.2"/>
          <circle cx="12" cy="11.6" r="4.6" fill="#ffffff"/>
        </svg>
      </div>
    </div>`,
    iconSize: [40, 54],
    iconAnchor: [20, 49],
  });

  const userIcon = L.divIcon({
    className: "",
    html: `<div style="position:relative;width:22px;height:22px;">
      <div style="position:absolute;inset:-6px;border-radius:50%;background:#10b981;opacity:0.3;animation:userPulse 1.5s infinite;"></div>
      <div style="width:22px;height:22px;background:#10b981;border:3px solid white;border-radius:50%;box-shadow:0 0 15px rgba(16,185,129,0.6);"></div>
    </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

  // ── Buat peta sekali ──
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const puskesmasIcon = L.divIcon({
      className: "",
      html: `<div style="position:relative;width:40px;height:54px;">
        <div style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:18px;height:5px;border-radius:50%;background:rgba(15,23,42,0.35);filter:blur(1px);"></div>
        <div style="position:absolute;left:2px;bottom:5px;animation:pinBounce 1.2s ease-in-out infinite;filter:drop-shadow(0 4px 6px rgba(15,23,42,0.35));">
          <svg width="36" height="44" viewBox="0 0 24 30">
            <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 10.4 17.1 11.5 18 .3.3.7.3 1 0C13.6 29.1 24 20.4 24 12 24 5.4 18.6 0 12 0z" fill="#DC2626" stroke="#ffffff" stroke-width="1.2"/>
            <circle cx="12" cy="11.6" r="4.6" fill="#ffffff"/>
          </svg>
        </div>
      </div>`,
      iconSize: [40, 54],
      iconAnchor: [20, 49],
    });

    const userIcon = L.divIcon({
      className: "",
      html: `<div style="position:relative;width:22px;height:22px;">
        <div style="position:absolute;inset:-6px;border-radius:50%;background:#10b981;opacity:0.3;animation:userPulse 1.5s infinite;"></div>
        <div style="width:22px;height:22px;background:#10b981;border:3px solid white;border-radius:50%;box-shadow:0 0 15px rgba(16,185,129,0.6);"></div>
      </div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
      zoom: 16,
    });

    // Tile OSM gratis — CARTO basemaps kini mewajibkan API key
    // (peta tampil watermark "API KEY REQUIRED" bila tanpa kunci).
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    markersRef.current.circle = L.circle([0, 0], {
      radius: 200,
      color: "#ADFF2F",
      fillColor: "rgba(173,255,47,0.04)",
      weight: 1.5,
      dashArray: "6 4",
      fillOpacity: 0.2,
    }).addTo(map);

    markersRef.current.puskesmas = L.marker([0, 0], { icon: puskesmasIcon, zIndexOffset: 500 }).addTo(map);
    markersRef.current.user = L.marker([0, 0], { icon: userIcon }).addTo(map);

    mapInstanceRef.current = map;
    requestAnimationFrame(() => map.invalidateSize());
    onMapReady?.(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersRef.current = { puskesmas: null, circle: null, user: null };
      didFitRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Opsi interaksi mengikuti mode fullscreen ──
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (fullscreen) {
      map.dragging.disable();
      map.scrollWheelZoom.disable();
    } else {
      map.dragging.enable();
      map.scrollWheelZoom.enable();
    }
  }, [fullscreen]);

  // ── Update marker & radius in-place (peta tidak dibuat ulang) ──
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !userLocation || !puskesmasLocation) return;

    const p = [puskesmasLocation.latitude, puskesmasLocation.longitude];
    const u = [userLocation.latitude, userLocation.longitude];

    markersRef.current.puskesmas?.setLatLng(p);
    markersRef.current.circle?.setLatLng(p);
    markersRef.current.circle?.setRadius(puskesmasLocation.radius_meter || 200);
    markersRef.current.user?.setLatLng(u);

    // Pas tampil pertama: pas Both posisi dalam layar
    if (!didFitRef.current) {
      map.fitBounds(L.latLngBounds([u, p]), { padding: [50, 50], maxZoom: 16 });
      didFitRef.current = true;
    }
  }, [userLocation, puskesmasLocation]);

  return (
    <div ref={mapRef} className="w-full h-full" />
  );
}

// Inject global CSS once for Leaflet overrides
const styleId = "leaflet-premium-overrides";
if (!document.getElementById(styleId)) {
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    .leaflet-container { background: #f0f0f5 !important; }
    .leaflet-control-attribution { display: none !important; }
    @keyframes userPulse {
      0%, 100% { transform: scale(1); opacity: 0.3; }
      50% { transform: scale(2); opacity: 0; }
    }
    @keyframes pinBounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-9px); }
    }
  `;
  document.head.appendChild(style);
}
