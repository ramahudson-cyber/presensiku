import { ChevronDown } from "lucide-react";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

// Time picker 24 jam (00:00 - 23:59) — menggantikan <input type="time">
// yang tampil 12 jam AM/PM mengikuti locale browser (jam 13-23 sulit
// dipilih). Value output "HH:MM" — kontrak sama dengan kolom TIME Postgres.
// Input toleran terhadap "HH:MM:SS" dari DB.
export default function TimeSelect({ value, onChange, disabled }) {
  const normalized = String(value || "").slice(0, 5);
  const [hh = "00", mm = "00"] = normalized.split(":");

  const base =
    "relative flex-1 min-w-0 flex items-center bg-onyx border border-white/[0.06] rounded-2xl focus-within:ring-2 focus-within:ring-electric-violet/50";

  const selectCls =
    "w-full appearance-none bg-transparent text-[11px] text-pure-white focus:outline-none cursor-pointer py-1.5 pl-2 pr-1";

  const optionCls = "bg-onyx text-pure-white";

  return (
    <div className="flex items-stretch gap-1 flex-1 min-w-0">
      <div className={base}>
        <select
          value={hh}
          disabled={disabled}
          onChange={(e) => onChange(`${e.target.value}:${mm}`)}
          className={selectCls}
          title="Jam (00-23)"
        >
          {HOURS.map((h) => (
            <option key={h} value={h} className={optionCls}>{h}</option>
          ))}
        </select>
        <ChevronDown size={11} className="text-slate-mist mr-1 shrink-0 pointer-events-none" />
      </div>
      <span className="text-[10px] text-slate-mist self-center shrink-0">:</span>
      <div className={base}>
        <select
          value={mm}
          disabled={disabled}
          onChange={(e) => onChange(`${hh}:${e.target.value}`)}
          className={selectCls}
          title="Menit (00-59)"
        >
          {MINUTES.map((m) => (
            <option key={m} value={m} className={optionCls}>{m}</option>
          ))}
        </select>
        <ChevronDown size={11} className="text-slate-mist mr-1 shrink-0 pointer-events-none" />
      </div>
    </div>
  );
}
