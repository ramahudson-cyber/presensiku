// src/pages/employee/overtime/OvertimeRulesPage.jsx
// Ketentuan lembur. Isi pernyataan statis dan tanpa card; config tetap dimuat
// supaya perilaku halaman (loading/error) tidak berubah.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getOvertimeConfig } from "../../../services/overtimeService";
import { OT, Icon, LightAppBar, Loader } from "./overtimeUi";

export default function OvertimeRulesPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setConfig(await getOvertimeConfig());
    } catch (e) {
      setError(e.message || "Gagal memuat ketentuan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const kick = setTimeout(load, 0);
    return () => clearTimeout(kick);
  }, []);

  const steps = config ? [
    "Pengajuan lembur dilakukan melalui aplikasi ini sebelum kegiatan dimulai.",
    "Durasi lembur disesuaikan dengan kebutuhan kegiatan.",
    "Lembur harus sesuai dengan tugas dan kebutuhan organisasi, serta disetujui atasan.",
    "Uang lembur ditentukan oleh admin.",
    "Uang lembur hanya dibayar bila Anda tetap melakukan absen pulang pada hari lembur.",
  ] : [];

  return (
    <div className="absolute inset-x-0 top-0" style={{ minHeight: "100vh", background: OT.bg, color: OT.text }}>
      <div className="mx-auto w-full max-w-md">
        <LightAppBar title="Ketentuan Lembur" onBack={() => navigate(-1)} />

        <div className="px-4 pb-10">
          {loading ? (
            <Loader label="Memuat ketentuan..." variant="rules" />
          ) : error ? (
            <div style={{
              background: "#fff", border: `1px solid ${OT.border}`, borderRadius: 20,
              padding: 16, fontSize: 12, color: "#EF4444",
            }}>{error}</div>
          ) : (
            <>
              <div className="flex items-center justify-center" style={{
                height: 150, borderRadius: 24, background: OT.iconBg,
                border: `1px solid ${OT.border}`, marginTop: 4,
              }}>
                <svg width="130" height="112" viewBox="0 0 130 112" fill="none" aria-hidden="true">
                  <ellipse cx="65" cy="102" rx="46" ry="6" fill="#D8E7FC" />
                  <rect x="38" y="20" width="52" height="72" rx="8" fill="#fff" stroke="#9DBFF3" strokeWidth="3" />
                  <rect x="52" y="13" width="24" height="12" rx="6" fill="#2F8BF8" />
                  <path d="M46 40l4 4 7-8" stroke="#10B981" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M64 42h22" stroke="#C9DBF6" strokeWidth="4" strokeLinecap="round" />
                  <path d="M46 58l4 4 7-8" stroke="#10B981" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M64 60h22" stroke="#C9DBF6" strokeWidth="4" strokeLinecap="round" />
                  <circle cx="94" cy="76" r="17" fill="#fff" stroke="#2F8BF8" strokeWidth="3.6" />
                  <path d="M94 67v9l6 3.5" stroke="#1F74E0" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="104" cy="24" r="5" fill="#BFDBFE" />
                </svg>
              </div>

              <p style={{ fontSize: 14, fontWeight: 800, margin: "20px 0 8px" }}>Informasi Penting</p>
              <div style={{ position: "relative" }}>
                <span aria-hidden="true" style={{
                  position: "absolute", left: 13, top: 14, bottom: 14, width: 1,
                  background: "linear-gradient(to bottom, rgba(47,139,248,0.30), rgba(47,139,248,0.08))",
                }} />
                <ol style={{ listStyle: "none", margin: 0, padding: 0, position: "relative" }}>
                  {steps.map((text, i) => (
                    <li key={text} style={{
                      display: "flex", gap: 14, alignItems: "flex-start",
                      paddingBottom: i === steps.length - 1 ? 0 : 20,
                    }}>
                      <span className="flex items-center justify-center shrink-0" style={{
                        position: "relative", zIndex: 1,
                        width: 28, height: 28, borderRadius: "50%", background: "#fff",
                        border: "1px solid rgba(47,139,248,0.24)", color: OT.brand,
                        fontSize: 11, fontWeight: 800, boxShadow: "0 1px 3px rgba(15,23,42,0.05)",
                      }}>{i + 1}</span>
                      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: OT.textSec, paddingTop: 4 }}>{text}</p>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="flex items-start gap-2.5" style={{
                marginTop: 14, background: OT.iconBg, borderRadius: 14, padding: "12px 14px",
              }}>
                <Icon.info style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, lineHeight: 1.55, color: "#1D4ED8", fontWeight: 600 }}>
                  Jika ada kendala pengajuan lembur, silakan hubungi bagian kepegawaian.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
