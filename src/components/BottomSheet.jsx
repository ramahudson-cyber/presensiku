import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// Light-mode only — per DESIGN.md
const T = {
  surface: '#FFFFFF',
  border: 'rgba(31,41,55,0.08)',
  div: '#F1F5F9',
  text: '#0F172A',
  textSec: '#475569',
  textMuted: '#94A3B8',
};

export default function BottomSheet({ open, onClose, title, subtitle, children, snap = "auto", dismissible = true }) {
  const sheetRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (dismissible && e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handler); document.body.style.overflow = ""; };
  }, [open, onClose, dismissible]);

  // Portal ke <body>: hindari sheet terjebak stacking context (mis. wrapper
  // z-10 di AdminLayout) sehingga BottomNav (z-30) menutupi bagian bawah sheet.
  return createPortal(
    <>
      {open && (
        <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center pb-0 animate-fade-in" onClick={dismissible ? onClose : undefined}>
        <div className="fixed inset-0 z-[9998] bg-[rgba(0,0,0,0.5)]" onClick={dismissible ? onClose : undefined} />

          <div ref={sheetRef} onClick={e => e.stopPropagation()}
            className={`relative z-[9999] w-full max-w-lg rounded-t-[28px] md:rounded-3xl shadow-2xl animate-slide-up md:animate-fade-in overflow-hidden flex flex-col mt-auto md:mt-0 bg-white border`}
            style={{ maxHeight: snap === "full" ? "95vh" : snap === "half" ? "60vh" : "90vh", borderColor: T.border }}>

            <div className="flex md:hidden justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-10 h-2 rounded-full bg-black/10" />
            </div>

            {(title || subtitle) && (
              <div className="flex items-center justify-between px-5 pt-2 md:pt-5 pb-3 shrink-0">
                <div className="min-w-0 flex-1">
                  {title && <h3 className="text-sm font-bold" style={{ color: T.text }}>{title}</h3>}
                  {subtitle && <p className="text-[10px] mt-0.5" style={{ color: T.textMuted }}>{subtitle}</p>}
                </div>
                {dismissible && <button onClick={onClose}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-600 w-8 h-8 flex items-center justify-center rounded-xl transition-all active:scale-90 shrink-0 ml-3">
                  <X size={16} />
                </button>}
              </div>
            )}

            {/* min-h-0: wajib agar scroller flex-child mau menyusut & benar2
                bisa di-scroll (pola sama dgn AttendanceResultSheet).
                overscroll-contain: cegah scroll chaining mengunci body. */}
            <div className="flex-1 min-h-0 overscroll-contain overflow-y-auto px-5 md:pb-6 scrollbar-thin"
              style={{ paddingBottom: "calc(100px + env(safe-area-inset-bottom, 0px))" }}>
              {children}
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
