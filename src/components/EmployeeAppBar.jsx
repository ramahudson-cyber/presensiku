import { ChevronLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * App bar ungu untuk halaman menu pegawai.
 *
 * Pola: panah kembali di kiri, judul di tengah, slot kanan opsional
 * (avatar / tombol aksi). Warna memakai identitas aplikasi
 * (gradasi #BF00FF → #9900CC), bukan biru bawaan iOS.
 *
 * Catatan penting: halaman pegawai memakai `absolute top-0` sehingga app bar
 * menempel ke tepi atas layar. Karena itu padding atas menyertakan
 * env(safe-area-inset-top) agar area status bar ikut berwarna ungu dan judul
 * tidak tertutup notch/status bar.
 *
 * Bar ini TIDAK sticky (ikut ter-scroll) supaya posisi konten yang sudah ada
 * tidak berubah.
 */
export default function EmployeeAppBar({ title, right = null, onBack }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    if (onBack) return onBack();
    // Halaman dibuka langsung (deep link / refresh) tidak punya riwayat
    // internal → kembalikan ke beranda pegawai, bukan keluar aplikasi.
    if (location.key && location.key !== "default") return navigate(-1);
    navigate("/employee");
  };

  return (
    <header
      className="relative w-full flex items-center justify-center px-3 pb-3.5"
      style={{
        background: "linear-gradient(135deg, #BF00FF 0%, #9900CC 100%)",
        color: "#FFFFFF",
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)",
        minHeight: 56,
        boxShadow: "0 2px 12px rgba(153,0,204,0.28)",
      }}
    >
      <button
        type="button"
        onClick={handleBack}
        aria-label="Kembali"
        className="absolute left-1.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full grid place-items-center transition-colors active:scale-95"
        style={{ color: "#FFFFFF" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.16)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        <ChevronLeft size={22} strokeWidth={2.2} />
      </button>

      <h1
        className="text-[16px] font-bold tracking-tight text-center truncate px-12"
        style={{ color: "#FFFFFF" }}
      >
        {title}
      </h1>

      {right ? (
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {right}
        </div>
      ) : null}
    </header>
  );
}