import { ChevronLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * App bar biru untuk halaman menu pegawai.
 *
 * Pola: panah kembali di kiri, judul di tengah, slot kanan opsional
 * (mis. tombol aksi). Warna memakai identitas aplikasi
 * (gradasi #2F8BF8 → #1F74E0), bukan warna bawaan iOS.
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
export default function EmployeeAppBar({ title, right = null, onBack, size = "md" }) {
  const navigate = useNavigate();
  const location = useLocation();
  // size="compact" menyamakan tinggi total header (58px + safe-area) dengan
  // header halaman Izin & Sakit: 10 (atas) + 36 (baris) + 12 (bawah).
  const compact = size === "compact";

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
        background: "linear-gradient(135deg, #2F8BF8 0%, #1F74E0 100%)",
        color: "#FFFFFF",
        // +28px memberi ruang dari status bar / tepi atas layar.
        paddingTop: compact ? "calc(env(safe-area-inset-top, 0px) + 10px)" : "calc(env(safe-area-inset-top, 0px) + 28px)",
        boxShadow: "0 1px 2px rgba(153,0,204,0.12)",
      }}
    >
      <div className="relative flex items-center px-2" style={{ minHeight: compact ? 36 : 48, paddingBottom: compact ? 12 : 16 }}>
        <button
          type="button"
          onClick={handleBack}
          aria-label="Kembali"
          className="relative z-10 shrink-0 grid place-items-center rounded-full transition-colors active:scale-95"
          style={{
            width: compact ? 36 : 40,
            height: compact ? 36 : 40,
            color: "#FFFFFF",
            ...(compact ? { border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.15)" } : {}),
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.16)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = compact ? "rgba(255,255,255,0.15)" : "transparent"; }}
        >
          <ChevronLeft size={compact ? 20 : 24} strokeWidth={2.4} />
        </button>

        <h1
          className={`absolute left-1/2 -translate-x-1/2 tracking-tight text-center truncate px-14 ${compact ? "text-[14.5px] font-extrabold" : "text-[16px] font-bold"}`}
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