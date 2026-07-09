import BottomSheet from "./BottomSheet";
import { Clock, LogOut, MapPin, CheckCircle2 } from "lucide-react";

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
      <div className="flex flex-col items-center text-center pt-2 pb-4">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 ${isCheckIn ? "bg-green-yellow" : "bg-electric-violet"}`}>
          <CheckCircle2 size={32} className="text-black" />
        </div>
        <h3 className="text-base font-bold text-pure-white">
          {isCheckIn ? "Absen Masuk Berhasil!" : "Absen Pulang Berhasil!"}
        </h3>
        <p className="text-xs text-slate-mist mt-1">{dateStr}</p>
      </div>

      <div className="design-card p-4 space-y-0">
        {/* Clock In */}
        <div className="flex items-center justify-between py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-green-yellow flex items-center justify-center">
              <LogOut size={14} className="text-black" />
            </div>
            <span className="text-xs text-slate-mist">Absen Masuk</span>
          </div>
          <span className="text-sm font-semibold text-pure-white">{clockIn}</span>
        </div>

        <div className="border-t border-white/[0.06]" />

        {/* Clock Out */}
        {!isCheckIn && (
          <>
            <div className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-electric-violet flex items-center justify-center">
                  <LogOut size={14} className="text-black" />
                </div>
                <span className="text-xs text-slate-mist">Absen Pulang</span>
              </div>
              <span className="text-sm font-semibold text-pure-white">{clockOut}</span>
            </div>
            <div className="border-t border-white/[0.06]" />
          </>
        )}

        {/* Total Jam */}
        {duration && (
          <>
            <div className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="url(#gradTotal)" strokeWidth="2" width="14" height="14">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <span className="text-xs text-slate-mist">Total Jam</span>
              </div>
              <span className="text-sm font-semibold bg-gradient-to-r from-green-yellow to-electric-violet bg-clip-text text-transparent">{duration}</span>
            </div>
            <div className="border-t border-white/[0.06]" />
          </>
        )}

        {/* Shift */}
        <div className="flex items-center justify-between py-2.5">
          <span className="text-xs text-slate-mist">Shift</span>
          <span className="text-sm font-semibold text-pure-white">{shiftLabel}</span>
        </div>

        <div className="border-t border-white/[0.06]" />

        {/* Status */}
        <div className="flex items-center justify-between py-2.5">
          <span className="text-xs text-slate-mist">Status</span>
          <span className={`text-sm font-semibold ${data.is_late ? "text-green-yellow" : "text-green-yellow"}`}>
            {statusText}
          </span>
        </div>

        {/* Location */}
        {distance && (
          <>
            <div className="border-t border-white/[0.06]" />
            <div className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-green-yellow flex items-center justify-center">
                  <MapPin size={14} className="text-black" />
                </div>
                <span className="text-xs text-slate-mist">Lokasi</span>
              </div>
              <span className="text-sm font-semibold text-pure-white">{distance}m</span>
            </div>
          </>
        )}
      </div>

      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="gradTotal" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#adff2f" />
            <stop offset="100%" stopColor="#BF00FF" />
          </linearGradient>
        </defs>
      </svg>

      <button
        onClick={onClose}
        className="w-full mt-5 py-3.5 bg-electric-violet text-pure-white rounded-full font-semibold text-sm hover:brightness-110 active:brightness-90 transition-all duration-200"
      >
        Tutup
      </button>
    </BottomSheet>
  );
}
