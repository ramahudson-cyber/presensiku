import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function LocationMap({ userLocation, puskesmasLocation, distance, status, fullscreen, onMapReady }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!userLocation || !mapRef.current) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: !fullscreen,
      scrollWheelZoom: !fullscreen,
      zoom: 16,
    });

    // Tile OSM gratis — CARTO basemaps kini mewajibkan API key
    // (peta tampil watermark "API KEY REQUIRED" bila tanpa kunci).
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    const puskesmas = [puskesmasLocation.latitude, puskesmasLocation.longitude];
    const user = [userLocation.latitude, userLocation.longitude];

    // Radius circle — pakai radius_meter lokasi dari DB (bukan hardcoded)
    L.circle(puskesmas, {
      radius: puskesmasLocation.radius_meter || 200,
      color: "#ADFF2F",
      fillColor: "rgba(173,255,47,0.04)",
      weight: 1.5,
      dashArray: "6 4",
      fillOpacity: 0.2,
    }).addTo(map);

    // Pin lokasi — teardrop panah ke bawah, animasi naik-turun menunjukan
    // titik lokasi presensi (menggantikan icon lingkaran hijau)
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

    L.marker(puskesmas, { icon: puskesmasIcon, zIndexOffset: 500 }).addTo(map);

    const bounds = L.latLngBounds([user, puskesmas]);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });

    requestAnimationFrame(() => map.invalidateSize());

    mapInstanceRef.current = map;
    onMapReady?.(map);

	    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [userLocation, puskesmasLocation, fullscreen]);

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
    @keyframes pinBounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-9px); }
    }
  `;
  document.head.appendChild(style);
}
