import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, Check, Search, Loader2, AlertTriangle } from "lucide-react";

// Light-mode tokens — per DESIGN.md
const T = {
  surface: '#FFFFFF',
  border: 'rgba(31,41,55,0.08)',
  text: '#0F172A',
  textSec: '#475569',
  textMuted: '#94A3B8',
  rowBg: 'rgba(15,23,42,0.02)',
};

export default function LocationPicker({ onCancel, onConfirm, initialLat = -8.5697, initialLng = 116.0821 }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [manualLat, setManualLat] = useState(initialLat.toString());
  const [manualLng, setManualLng] = useState(initialLng.toString());

  useEffect(() => {
    if (!mapRef.current) return;

    setMapError(false);

    const timer = setTimeout(() => {
      if (!mapRef.current) return;

      const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
        zoom: 17,
        center: [lat, lng],
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      map.on("tileerror", () => setMapError(true));

      const icon = L.divIcon({
        className: "",
        html: `<div style="width:28px;height:28px;background:#BF00FF;border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(191,0,255,0.4);font-size:14px;">📍</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      markerRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(map);

      markerRef.current.on("dragend", () => {
        const pos = markerRef.current.getLatLng();
        setLat(parseFloat(pos.lat.toFixed(6)));
        setLng(parseFloat(pos.lng.toFixed(6)));
      });

      map.on("click", (e) => {
        if (markerRef.current) markerRef.current.setLatLng(e.latlng);
        setLat(parseFloat(e.latlng.lat.toFixed(6)));
        setLng(parseFloat(e.latlng.lng.toFixed(6)));
      });

      map.invalidateSize();
      mapInstanceRef.current = map;
    }, 350);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setManualLat(lat.toString());
    setManualLng(lng.toString());
  }, [lat, lng]);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchResults([]);
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&accept-language=id`
        );
        const data = await res.json();
        setSearchResults(data || []);
        setShowResults(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const goToResult = (result) => {
    const newLat = parseFloat(result.lat);
    const newLng = parseFloat(result.lon);
    setLat(newLat);
    setLng(newLng);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([newLat, newLng], 17);
      if (markerRef.current) markerRef.current.setLatLng([newLat, newLng]);
    }
    setShowResults(false);
    setSearchQuery(result.display_name);
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation || !mapInstanceRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapInstanceRef.current.setView([latitude, longitude], 17);
        if (markerRef.current) markerRef.current.setLatLng([latitude, longitude]);
        setLat(parseFloat(latitude.toFixed(6)));
        setLng(parseFloat(longitude.toFixed(6)));
      },
      () => {},
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  const handleManualInput = () => {
    const newLat = parseFloat(manualLat);
    const newLng = parseFloat(manualLng);
    if (isNaN(newLat) || isNaN(newLng)) return;
    setLat(newLat);
    setLng(newLng);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([newLat, newLng], 17);
      if (markerRef.current) markerRef.current.setLatLng([newLat, newLng]);
    }
  };

  const handleConfirm = () => {
    onConfirm(lat, lng);
    onCancel();
  };

  const inputBase = `w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#BF00FF]/50`;
  const ghostBtn = "flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-full text-sm font-medium hover:bg-gray-50 transition-all";

  return (
    <div className="border-t pt-4 mt-4 space-y-4" style={{ borderColor: T.border }}>
      <div>
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari alamat atau tempat..."
            className={`${inputBase} pl-9 pr-9`}
          />
          {searching && <Loader2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#BF00FF] animate-spin" />}
        </div>

        {showResults && searchResults.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xl mt-1">
            <div className="overflow-y-auto" style={{ maxHeight: 192 }}>
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goToResult(r)}
                  className="w-full text-left px-3.5 py-2.5 text-xs text-gray-700 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"
                >
                  <span className="line-clamp-2">{r.display_name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {!mapError ? (
        <div className="relative rounded-2xl overflow-hidden border border-gray-200" style={{ height: 350, touchAction: "none" }}>
          <div ref={mapRef} className="w-full h-full" />
          <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
            <button
              type="button"
              onClick={handleLocateMe}
              className="p-2.5 bg-white shadow-lg rounded-full text-[#BF00FF] border border-gray-200 hover:bg-gray-50 transition-all"
              title="Pakai lokasi saya"
            >
              <Crosshair size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-600 text-sm">
            <AlertTriangle size={16} />
            <span>Peta tidak dapat dimuat. Masukkan koordinat manual:</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Latitude</label>
              <input
                type="number"
                step="any"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                className={inputBase}
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Longitude</label>
              <input
                type="number"
                step="any"
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
                className={inputBase}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleManualInput}
            className="w-full py-2 border border-gray-300 text-gray-600 rounded-full text-sm font-medium hover:bg-gray-50 transition-all"
          >
            Terapkan Koordinat
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider">Latitude</label>
          <p className="font-mono text-sm font-semibold text-gray-900">{lat}</p>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider">Longitude</label>
          <p className="font-mono text-sm font-semibold text-gray-900">{lng}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className={ghostBtn}
        >
          Batal
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="flex-1 py-2.5 bg-[#BF00FF] hover:bg-[#a000e6] text-white rounded-full text-sm font-medium transition-all flex items-center justify-center gap-2"
        >
          <Check size={14} /> Konfirmasi
        </button>
      </div>

      <p className="text-[10px] text-gray-400 text-center">
        Klik di peta, seret marker, atau cari alamat untuk memilih lokasi
      </p>
    </div>
  );
}
