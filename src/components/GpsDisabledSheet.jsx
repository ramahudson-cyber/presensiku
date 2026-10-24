import BottomSheet from "./BottomSheet";
import { MapPinOff } from "lucide-react";
import { isNativePlatform } from "../lib/devicePlatform";
import { openLocationSettings } from "../services/geoService";

// Sheet "Aktifkan Lokasi" — muncul saat GPS/layanan lokasi HP mati.
// Native: CTA membuka UI pengaturan Lokasi bawaan OS (sheet tetap terbuka
// agar user kembali dan menekan "Coba Lagi"). Web: instruksi teks saja.
export default function GpsDisabledSheet({ open, onClose, onRetry }) {
  const native = isNativePlatform();

  const handleOpenSettings = async () => {
    // Sheet sengaja TIDAK ditutup: user kembali dari Settings lalu "Coba Lagi".
    await openLocationSettings();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Lokasi Belum Aktif"
      subtitle="Layanan lokasi/GPS dinonaktifkan di perangkat ini"
    >
      <div className="pb-2">
        <div className="flex flex-col items-center text-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-[linear-gradient(135deg,rgba(191,0,255,0.14)_0%,rgba(139,0,204,0.10)_100%)] border border-[rgba(191,0,255,0.25)]">
            <MapPinOff size={26} className="text-[#BF00FF]" />
          </div>
          <p className="text-sm text-gray-600 leading-relaxed max-w-[300px]">
            Absen membutuhkan lokasi GPS. Aktifkan <b>Layanan Lokasi</b> di pengaturan HP Anda, lalu coba lagi.
          </p>
          {!native && (
            <p className="text-xs text-gray-500 leading-relaxed max-w-[300px]">
              Buka menu <b>Pengaturan</b> HP &rarr; <b>Lokasi</b>, nyalakan layanan lokasi, lalu kembali ke aplikasi ini.
            </p>
          )}
        </div>

        {native && (
          <button
            onClick={handleOpenSettings}
            className="w-full py-2.5 rounded-full text-white text-sm font-semibold transition-all active:scale-95 bg-[#BF00FF] hover:bg-[#a000e6] mb-3"
          >
            Aktifkan Lokasi
          </button>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-full border border-gray-300 text-gray-600 text-sm transition-all active:scale-95 hover:bg-gray-50"
          >
            Nanti
          </button>
          <button
            onClick={onRetry}
            className="flex-1 py-2.5 rounded-full border border-gray-300 bg-white text-[#BF00FF] text-sm font-semibold transition-all active:scale-95 hover:bg-gray-50"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
