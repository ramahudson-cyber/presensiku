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
        <div className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm" onClick={onClose} />

          <div ref={sheetRef} onClick={e => e.stopPropagation()}
            style={{ maxHeight: snap === "full" ? "95vh" : snap === "half" ? "60vh" : "90vh" }}
            className="relative z-[9999] w-full max-w-lg bg-white border border-gray-100 rounded-t-[28px] md:rounded-3xl shadow-2xl animate-slide-up md:animate-fade-in overflow-hidden flex flex-col mt-auto md:mt-0">

            <div className="flex md:hidden justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-black/10" />
            </div>

            {(title || subtitle) && (
              <div className="flex items-center justify-between px-5 pt-2 md:pt-5 pb-3 shrink-0">
                <div className="min-w-0 flex-1">
                  {title && <h3 className="text-sm font-bold text-gray-900">{title}</h3>}
                  {subtitle && <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>}
                </div>
                <button onClick={onClose}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-600 w-8 h-8 flex items-center justify-center rounded-xl transition-all active:scale-90 shrink-0 ml-3">
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-5 pb-[120px] scrollbar-thin">
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
