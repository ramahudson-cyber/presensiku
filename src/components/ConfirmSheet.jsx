import BottomSheet from "./BottomSheet";

export default function ConfirmSheet({ open, onClose, title, message, confirmText = "Yakin", onConfirm, variant = "danger" }) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title || "Konfirmasi"}>
      <p className="text-sm text-slate-300 mb-5">{message}</p>
      <div className="flex gap-3">
        <button onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border-gradient bg-transparent text-white border-0 text-sm transition-all active:scale-95">Batal</button>
        <button onClick={() => { onConfirm(); onClose(); }}
          className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-all active:scale-95 ${variant === "danger" ? "border-gradient bg-transparent" : "border-gradient bg-transparent"}`}>
          {confirmText}
        </button>
      </div>
    </BottomSheet>
  );
}
