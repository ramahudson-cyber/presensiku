import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function LocationMap({ userLocation, puskesmasLocation, distance, status, fullscreen }) {
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

    // CartoDB dark tiles
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);

    // Dark zoom controls
    const zoomControl = L.control.zoom({ position: "topright" });
    zoomControl.addTo(map);

    const puskesmas = [puskesmasLocation.latitude, puskesmasLocation.longitude];
    const user = [userLocation.latitude, userLocation.longitude];

    // Radius circle
    L.circle(puskesmas, {
      radius: 200,
      color: "#ADFF2F",
      fillColor: "rgba(173,255,47,0.04)",
      weight: 1.5,
      dashArray: "6 4",
      fillOpacity: 0.2,
    }).addTo(map);

    // Puskesmas marker
    const puskesmasIcon = L.divIcon({
      className: "",
      html: `<div style="width:38px;height:38px;background:#ADFF2F;border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 25px rgba(173,255,47,0.5);font-size:18px;">🏥</div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });

    // User marker with pulse ring
    const userIcon = L.divIcon({
      className: "",
      html: `<div style="position:relative;width:22px;height:22px;">
        <div style="position:absolute;inset:-6px;border-radius:50%;background:#10b981;opacity:0.3;animation:userPulse 1.5s infinite;"></div>
        <div style="width:22px;height:22px;background:#10b981;border:3px solid white;border-radius:50%;box-shadow:0 0 15px rgba(16,185,129,0.6);"></div>
      </div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    L.marker(puskesmas, { icon: puskesmasIcon }).addTo(map);
    L.marker(user, { icon: userIcon }).addTo(map);

    const bounds = L.latLngBounds([user, puskesmas]);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });

    requestAnimationFrame(() => map.invalidateSize());

    mapInstanceRef.current = map;

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
    .leaflet-control-zoom {
      border: none !important;
      box-shadow: none !important;
    }
    .leaflet-control-zoom a {
      background: rgba(30,30,40,0.85) !important;
      backdrop-filter: blur(12px) !important;
      -webkit-backdrop-filter: blur(12px) !important;
      color: white !important;
      border: 1px solid rgba(255,255,255,0.08) !important;
      width: 40px !important;
      height: 40px !important;
      line-height: 40px !important;
      font-size: 18px !important;
      border-radius: 12px !important;
      margin-bottom: 6px !important;
      transition: 0.2s !important;
    }
    .leaflet-control-zoom a:hover {
      background: rgba(60,60,80,0.9) !important;
    }
    @keyframes userPulse {
      0%, 100% { transform: scale(1); opacity: 0.3; }
      50% { transform: scale(2); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}
