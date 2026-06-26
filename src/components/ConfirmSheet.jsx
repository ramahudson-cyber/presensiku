import BottomSheet from "./BottomSheet";

export default function ConfirmSheet({ open, onClose, title, message, confirmText = "Yakin", onConfirm, variant = "danger" }) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title || "Konfirmasi"}>
      <p className="text-sm text-slate-300 mb-5">{message}</p>
      <div className="flex gap-3">
        <button onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-white/10 text-white text-sm hover:bg-white/5 transition-all active:scale-95">Batal</button>
        <button onClick={() => { onConfirm(); onClose(); }}
          className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-all active:scale-95 ${variant === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-violet-600 hover:bg-violet-700"}`}>
          {confirmText}
        </button>
      </div>
    </BottomSheet>
  );
}
