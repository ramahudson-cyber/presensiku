import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function LocationMap({ userLocation, puskesmasLocation, distance, status }) {
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
      dragging: false,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    const puskesmas = [puskesmasLocation.latitude, puskesmasLocation.longitude];
    const user = [userLocation.latitude, userLocation.longitude];

    const puskesmasIcon = L.divIcon({
      className: "",
      html: `<div style="width:32px;height:32px;background:#8b5cf6;border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(139,92,246,0.5);font-size:14px;">🏥</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const userIcon = L.divIcon({
      className: "",
      html: `<div style="width:20px;height:20px;background:#10b981;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(16,185,129,0.5);"></div>
             <div style="position:absolute;top:-8px;left:2px;width:16px;height:16px;background:#10b981;border-radius:50%;opacity:0.4;animation:pulse 1.5s infinite;"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
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
  }, [userLocation, puskesmasLocation]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/10" style={{ height: 200 }}>
      <div ref={mapRef} className="w-full h-full" />
      <div className="absolute top-3 left-3 z-[1000] px-2.5 py-1.5 bg-black/60 backdrop-blur-sm rounded-lg flex items-center gap-1.5 text-white text-[11px] font-medium">
        <span className={`w-1.5 h-1.5 rounded-full ${status === "valid" ? "bg-green-yellow" : status === "invalid" ? "bg-red-400" : "bg-green-yellow"}`} />
        {status === "valid" ? `Dalam radius (${distance}m)` : status === "invalid" ? `Di luar radius (${distance}m)` : "Mendeteksi..."}
      </div>
      <style>{`
        @keyframes pulse { 0%,100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(2.5); opacity: 0; } }
        .leaflet-control-attribution { display: none !important; }
      `}</style>
    </div>
  );
}
