import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Crosshair, Check, Search, Loader2 } from "lucide-react";
import BottomSheet from "./BottomSheet";

export default function LocationPicker({ open, onClose, onConfirm, initialLat = -8.5697, initialLng = 116.0821 }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (!open || !mapRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
      zoom: 17,
      center: [lat, lng],
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    const icon = L.divIcon({
      className: "",
      html: `<div style="width:28px;height:28px;background:#8b5cf6;border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(139,92,246,0.5);font-size:14px;">📍</div>`,
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
      if (markerRef.current) {
        markerRef.current.setLatLng(e.latlng);
      }
      setLat(parseFloat(e.latlng.lat.toFixed(6)));
      setLng(parseFloat(e.latlng.lng.toFixed(6)));
    });

    requestAnimationFrame(() => map.invalidateSize());

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, [open]);

  const handleSearch = async (q) => {
    setSearch(q);
    if (!q.trim()) { setSearchResults([]); setShowResults(false); return; }
    setSearching(true);
    setShowResults(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&accept-language=id`
      );
      const data = await res.json();
      setSearchResults(data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const goToResult = (result) => {
    const newLat = parseFloat(result.lat);
    const newLng = parseFloat(result.lon);
    setLat(newLat);
    setLng(newLng);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([newLat, newLng], 17);
      if (markerRef.current) {
        markerRef.current.setLatLng([newLat, newLng]);
      }
    }
    setShowResults(false);
    setSearch(result.display_name);
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation || !mapInstanceRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapInstanceRef.current.setView([latitude, longitude], 17);
        if (markerRef.current) {
          markerRef.current.setLatLng([latitude, longitude]);
        }
        setLat(parseFloat(latitude.toFixed(6)));
        setLng(parseFloat(longitude.toFixed(6)));
      },
      () => {},
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  const handleConfirm = () => {
    onConfirm(lat, lng);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Pilih Lokasi di Peta">
      <div className="space-y-4">
        <div className="relative">
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-mist" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Cari alamat atau tempat..."
              className="w-full pl-9 pr-9 py-2.5 bg-obsidian border border-white/10 rounded-xl text-sm text-pure-white placeholder-slate-mist/60 focus:outline-none focus:border-electric-violet/40"
            />
            {searching && <Loader2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-periwinkle-glow animate-spin" />}
          </div>
          {showResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-[2000] mt-1 bg-onyx border border-white/10 rounded-xl overflow-hidden shadow-xl max-h-48 overflow-y-auto">
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goToResult(r)}
                  className="w-full text-left px-3.5 py-2.5 text-xs text-pure-white hover:bg-white/5 border-b border-white/[0.04] last:border-0 transition-colors"
                >
                  <span className="line-clamp-2">{r.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative rounded-2xl overflow-hidden border border-white/10" style={{ height: 350 }}>
          <div ref={mapRef} className="w-full h-full" />
          <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
            <button
              type="button"
              onClick={handleLocateMe}
              className="p-2.5 bg-black/70 backdrop-blur-sm rounded-full text-white hover:bg-black/90 transition-all"
              title="Pakai lokasi saya"
            >
              <Crosshair size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-slate-mist uppercase tracking-wider">Latitude</label>
            <p className="font-mono text-sm text-pure-white">{lat}</p>
          </div>
          <div>
            <label className="text-[10px] text-slate-mist uppercase tracking-wider">Longitude</label>
            <p className="font-mono text-sm text-pure-white">{lng}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-white/10 text-slate-mist rounded-full text-sm font-medium hover:text-pure-white transition-all"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-2.5 bg-electric-violet text-pure-white rounded-full text-sm font-medium hover:brightness-110 transition-all flex items-center justify-center gap-2"
          >
            <Check size={14} /> Konfirmasi
          </button>
        </div>

        <p className="text-[10px] text-slate-mist/60 text-center">
          Klik di peta, seret marker, atau cari alamat untuk memilih lokasi
        </p>
      </div>
    </BottomSheet>
  );
}
