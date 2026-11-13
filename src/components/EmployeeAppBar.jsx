import { ChevronLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * App bar ungu untuk halaman menu pegawai.
 *
 * Pola: panah kembali di kiri, judul di tengah, slot kanan opsional
 * (mis. tombol aksi). Warna memakai identitas aplikasi
 * (gradasi #BF00FF → #9900CC), bukan biru bawaan iOS.
 *
 * Catatan tata letak:
 *  - Halaman pegawai memakai `absolute top-0`, jadi app bar menempel ke tepi
 *    atas layar. paddingTop menyertakan env(safe-area-inset-top) + jarak tetap
 *    agar judul tidak mentok di tepi/status bar.
 *  - Tombol kembali berada di ALIRAN flex (bukan absolute) supaya sumbu
 *    vertikalnya selalu sejajar dengan judul, berapa pun padding atasnya.
 *  - Judul diposisikan absolute di tengah agar benar-benar center, dengan
 *    padding kiri-kanan agar tidak bertabrakan dengan tombol kembali/aksi.
 *
 * Bar ini TIDAK sticky (ikut ter-scroll) supaya posisi konten tidak berubah.
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
      className="relative w-full"
      style={{
        background: "linear-gradient(135deg, #BF00FF 0%, #9900CC 100%)",
        color: "#FFFFFF",
        // +28px memberi ruang dari status bar / tepi atas layar.
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 28px)",
        boxShadow: "0 2px 12px rgba(153,0,204,0.28)",
      }}
    >
      <div className="relative flex items-center px-2 pb-4" style={{ minHeight: 48 }}>
        <button
          type="button"
          onClick={handleBack}
          aria-label="Kembali"
          className="relative z-10 w-10 h-10 shrink-0 grid place-items-center rounded-full transition-colors active:scale-95"
          style={{ color: "#FFFFFF" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.16)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <ChevronLeft size={24} strokeWidth={2.4} />
        </button>

        <h1
          className="absolute left-1/2 -translate-x-1/2 text-[16px] font-bold tracking-tight text-center truncate px-14"
          style={{ color: "#FFFFFF" }}
        >
          {title}
        </h1>

        {right ? (
          <div className="relative z-10 ml-auto flex items-center gap-2">{right}</div>
        ) : null}
      </div>
    </header>
  );
}