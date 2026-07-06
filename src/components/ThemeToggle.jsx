import { Sun, Moon } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle() {
  const { darkMode, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2.5 md:p-3 rounded-2xl text-slate-500 dark:text-slate-mist hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
      aria-label={darkMode ? "Beralih ke mode terang" : "Beralih ke mode gelap"}
    >
      <div className="relative w-[18px] h-[18px] flex items-center justify-center">
        <Sun
          size={18}
          className={`absolute transition-all duration-500 ${
            darkMode
              ? "opacity-0 rotate-90 scale-0"
              : "opacity-100 rotate-0 scale-100"
          }`}
        />
        <Moon
          size={18}
          className={`absolute transition-all duration-500 ${
            darkMode
              ? "opacity-100 rotate-0 scale-100"
              : "opacity-0 -rotate-90 scale-0"
          }`}
        />
      </div>
    </button>
  );
}
