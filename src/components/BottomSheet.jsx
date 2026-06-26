import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function BottomSheet({ open, onClose, title, subtitle, children, snap = "auto" }) {
  const sheetRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handler); document.body.style.overflow = ""; };
  }, [open, onClose]);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in" onClick={onClose}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Sheet */}
          <div
            ref={sheetRef}
            onClick={e => e.stopPropagation()}
            style={{ maxHeight: snap === "full" ? "95vh" : snap === "half" ? "60vh" : "85vh" }}
            className="relative w-full max-w-lg bg-gradient-to-b from-[#1e0a35] to-[#12061f] border border-white/10 rounded-t-[28px] shadow-2xl shadow-violet-900/40 animate-slide-up overflow-hidden flex flex-col"
          >
            {/* Handle */}
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            {(title || subtitle) && (
              <div className="flex items-center justify-between px-5 pt-2 pb-3 shrink-0">
                <div className="min-w-0 flex-1">
                  {title && <h3 className="text-sm font-bold text-white">{title}</h3>}
                  {subtitle && <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>}
                </div>
                <button onClick={onClose}
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-all active:scale-90 shrink-0 ml-3">
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 pb-6">
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
