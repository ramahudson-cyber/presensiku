import BottomSheet from "./BottomSheet";

// Light-mode only — per DESIGN.md
export default function ConfirmSheet({ open, onClose, title, message, confirmText = "Yakin", onConfirm, variant = "danger" }) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title || "Konfirmasi"}>
      <p className="text-sm text-gray-600 mb-5">{message}</p>
      <div className="flex gap-3">
        <button onClick={onClose}
          className="flex-1 py-2.5 rounded-full border border-gray-300 text-gray-600 text-sm transition-all active:scale-95 hover:bg-gray-50">Batal</button>
        <button onClick={() => { onConfirm(); onClose(); }}
          className="flex-1 py-2.5 rounded-full text-white text-sm font-semibold transition-all active:scale-95 bg-[#BF00FF] hover:bg-[#a000e6]">
          {confirmText}
        </button>
      </div>
    </BottomSheet>
  );
}
