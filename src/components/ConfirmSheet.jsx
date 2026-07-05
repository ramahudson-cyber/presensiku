import BottomSheet from "./BottomSheet";

export default function ConfirmSheet({ open, onClose, title, message, confirmText = "Yakin", onConfirm, variant = "danger" }) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title || "Konfirmasi"}>
      <p className="text-sm text-slate-mist mb-5">{message}</p>
      <div className="flex gap-3">
        <button onClick={onClose}
          className="flex-1 py-2.5 rounded-full border border-pure-white/20 text-pure-white text-sm transition-all active:scale-95 hover:bg-pure-white/10">Batal</button>
        <button onClick={() => { onConfirm(); onClose(); }}
          className={`flex-1 py-2.5 rounded-full text-pure-white text-sm font-semibold transition-all active:scale-95 ${variant === "danger" ? "bg-electric-violet" : "bg-electric-violet"}`}>
          {confirmText}
        </button>
      </div>
    </BottomSheet>
  );
}
