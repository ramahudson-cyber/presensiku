import BottomSheet from "./BottomSheet";
import { CheckCircle2 } from "lucide-react";

const SHIFT_NAMES = { PG: "Pagi", SR: "Sore", SI: "Siang", ML: "Malam" };

function formatTime(isoString) {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function calcDuration(clockIn, clockOut) {
  if (!clockIn || !clockOut) return null;
  const diff = new Date(clockOut) - new Date(clockIn);
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hours}j ${mins}m`;
}

export default function AttendanceResultSheet({ open, onClose, data, type }) {
  if (!data) return null;
  const isCheckIn = type === "in";

  const clockIn = formatTime(data.clock_in_time);
  const clockOut = formatTime(data.clock_out_time);
  const dateStr = formatDate(data.clock_in_time);
  const shiftName = SHIFT_NAMES[data.shift_code] || data.shift_code;
  const duration = calcDuration(data.clock_in_time, data.clock_out_time);
  const shiftLabel = data.shift_code ? `${shiftName} (${data.shift_code})` : "-";
  const statusText = data.is_late ? `Terlambat ${data.late_minutes} menit` : "Hadir";
  const distance = data.location_in?.distance_from_puskesmas || null;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex flex-col items-center text-center pt-4 pb-5">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${isCheckIn ? "bg-green-yellow" : "bg-electric-violet"}`}>
          <CheckCircle2 size={28} className="text-black" />
        </div>
        <h3 className="text-lg font-bold text-[#0a0a14] tracking-tight">
          {isCheckIn ? "Absen Masuk Berhasil!" : "Absen Pulang Berhasil!"}
        </h3>
        <p className="text-[11px] text-[rgba(0,0,0,0.3)] mt-1 font-medium">{dateStr}</p>
      </div>

      {/* Detail Card — Light Mode Premium */}
      <div className="bg-[rgba(245,245,250,0.8)] backdrop-blur-xl rounded-[18px] p-3.5 border border-[rgba(0,0,0,0.03)] shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        {/* Clock In */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[8px] bg-electric-violet/8 flex items-center justify-center">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#BF00FF" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[rgba(0,0,0,0.25)] uppercase tracking-wider">Masuk</p>
              <p className="text-[13px] font-bold text-[#0a0a14] mt-0.5">{clockIn}</p>
            </div>
          </div>
          {!isCheckIn && data.is_late && (
            <span className="text-[10px] font-bold text-[#FF4757]">Terlambat</span>
          )}
          {!data.is_late && (
            <span className="text-[10px] font-bold text-electric-violet">Tepat Waktu</span>
          )}
        </div>

        <div className="h-px bg-[rgba(0,0,0,0.03)]" />

        {/* Clock Out */}
        {!isCheckIn && (
          <>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-[8px] bg-electric-violet/8 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#BF00FF" strokeWidth="2" strokeLinecap="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[rgba(0,0,0,0.25)] uppercase tracking-wider">Pulang</p>
                  <p className="text-[13px] font-bold text-[#0a0a14] mt-0.5">{clockOut}</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-electric-violet">Selesai</span>
            </div>
            <div className="h-px bg-[rgba(0,0,0,0.03)]" />
          </>
        )}

        {/* Total Jam */}
        {duration && (
          <>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-[8px] bg-electric-violet/8 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#BF00FF" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[rgba(0,0,0,0.25)] uppercase tracking-wider">Total Jam</p>
                  <p className="text-[13px] font-bold text-[#0a0a14] mt-0.5">{duration}</p>
                </div>
              </div>
            </div>
            <div className="h-px bg-[rgba(0,0,0,0.03)]" />
          </>
        )}

        {/* Shift */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[8px] bg-electric-violet/8 flex items-center justify-center">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#BF00FF" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[rgba(0,0,0,0.25)] uppercase tracking-wider">Shift</p>
              <p className="text-[13px] font-bold text-[#0a0a14] mt-0.5">{shiftLabel}</p>
            </div>
          </div>
        </div>

        <div className="h-px bg-[rgba(0,0,0,0.03)]" />

        {/* Status */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-[8px] flex items-center justify-center ${data.is_late ? "bg-[rgba(255,71,87,0.08)]" : "bg-green-yellow/10"}`}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke={data.is_late ? "#FF4757" : "#ADFF2F"} strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[rgba(0,0,0,0.25)] uppercase tracking-wider">Status</p>
              <p className={`text-[13px] font-bold mt-0.5 ${data.is_late ? "text-[#FF4757]" : "text-[#ADFF2F]"}`}>{statusText}</p>
            </div>
          </div>
          {data.is_late && (
            <span className="text-[10px] font-bold text-[#FF4757]">Telat</span>
          )}
        </div>

        {/* Location */}
        {distance && (
          <>
            <div className="h-px bg-[rgba(0,0,0,0.03)]" />
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-[8px] bg-electric-violet/8 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#BF00FF" strokeWidth="2" strokeLinecap="round">
                    <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[rgba(0,0,0,0.25)] uppercase tracking-wider">Lokasi</p>
                  <p className="text-[13px] font-bold text-[#0a0a14] mt-0.5">{distance}m dari Puskesmas</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-electric-violet">Valid</span>
            </div>
          </>
        )}
      </div>

      <button
        onClick={onClose}
        className="w-full mt-4 py-3.5 bg-gradient-to-r from-electric-violet to-[#9900CC] text-white rounded-full font-bold text-[13px] hover:brightness-110 active:scale-[0.98] transition-all duration-200 shadow-[0_4px_16px_rgba(191,0,255,0.2)]"
      >
        Tutup
      </button>
    </BottomSheet>
  );
}
