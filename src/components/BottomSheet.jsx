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
        <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center pb-16 md:pb-0 animate-fade-in" onClick={onClose}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          <div ref={sheetRef} onClick={e => e.stopPropagation()}
            style={{ maxHeight: snap === "full" ? "95vh" : snap === "half" ? "60vh" : "85vh" }}
            className="relative w-full max-w-lg bg-gradient-to-b from-onyx to-obsidian border border-white/10 rounded-t-[28px] md:rounded-3xl shadow-2xl animate-slide-up md:animate-fade-in overflow-hidden flex flex-col">

            <div className="flex md:hidden justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {(title || subtitle) && (
              <div className="flex items-center justify-between px-5 pt-2 md:pt-5 pb-3 shrink-0">
                <div className="min-w-0 flex-1">
                  {title && <h3 className="text-sm font-bold text-pure-white">{title}</h3>}
                  {subtitle && <p className="text-[10px] text-slate-mist mt-0.5">{subtitle}</p>}
                </div>
                <button onClick={onClose}
                  className="bg-white/10 hover:bg-white/[0.07] text-white w-8 h-8 flex items-center justify-center rounded-xl transition-all active:scale-90 shrink-0 ml-3">
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-scroll px-5 pb-6 scrollbar-thin">
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
