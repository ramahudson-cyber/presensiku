import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { getAttendanceHistory } from "../../services/attendanceService";

export default function EmployeeHistory() {
  const { user } = useAuth();
  const { darkMode } = useTheme();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      getAttendanceHistory(user.id)
        .then(setHistory)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [user?.id]);

  const statusBadge = (status) => {
    const colors = {
      hadir: { bg: 'transparent', text: '#BF00FF' },
      terlambat: { bg: 'rgba(251,146,60,0.15)', text: '#fb923c' },
      izin: { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24' },
      sakit: { bg: 'rgba(251,114,133,0.15)', text: '#fb7185' },
      alpha: { bg: 'rgba(244,63,94,0.15)', text: '#fca5a5' },
    };
    const c = colors[status] || { bg: 'rgba(255,255,255,0.08)', text: '#9ba1ae' };
    const labelMap = { hadir: 'Tepat Waktu', terlambat: 'Terlambat', izin: 'Izin', sakit: 'Sakit', alpha: 'Alpha' };
    return (
      <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
        style={{ background: c.bg, color: c.text }}>
        {labelMap[status] || status?.charAt(0).toUpperCase() + status?.slice(1) || '-'}
      </span>
    );
  };

  // ── Card style matching STATISTICS-CARD-DESIGN.md ──
  const cardStyle = {
    background: darkMode ? 'rgba(30,30,50,0.6)' : 'rgba(255,255,255,0.05)',
    backdropFilter: darkMode ? 'blur(20px)' : undefined,
    border: darkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.03)',
    borderRadius: '24px',
    boxShadow: darkMode ? '0 8px 32px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.06)',
  };

  return (
    <div className="min-h-screen w-full bg-transparent absolute top-0 left-0 pb-24">
      {/* Header */}
      <div className="w-full pt-12 pb-8 px-6 shadow-2xl border-b border-white/5 rounded-b-[40px]"
        style={{ background: 'linear-gradient(160deg, #BF40FF 0%, #6600CC 35%, #2B0066 65%, #000000 100%)' }}>
        <h1 className="text-lg font-bold" style={{ fontFamily: "'Urbanist', sans-serif", color: '#FFFFFF' }}>Riwayat Absensi</h1>
        <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.8)' }}>Riwayat 30 hari terakhir</p>
      </div>

      <div className="max-w-md mx-auto px-4 mt-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#660099] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3 opacity-30">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={darkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <p className="text-sm font-medium" style={{ color: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>Belum ada riwayat absensi</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((item, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all duration-300"
                style={cardStyle}>
                <div className="flex-1">
                  <div className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {item.date ? new Date(item.date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' }) : '-'}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                    Masuk {item.clock_in_time?.substring(0,5) || '--:--'} — Pulang {item.clock_out_time?.substring(0,5) || '--:--'}
                  </div>
                </div>
                {statusBadge(item.attendance_status || 'alpha')}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
