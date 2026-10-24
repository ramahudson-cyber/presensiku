import { useEffect } from "react";
import { AuthProvider } from "./context/AuthContext";
import AppRoutes from "./routes/AppRoutes";
import UpdateDialog from "./components/UpdateDialog";
import ErrorBoundary from "./components/ErrorBoundary";
import { ToastContainer, cssTransition } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./index.css";

/* ═══ PREMIUM TOAST — Light Glass (design: preview-toast-premium.html) ═══
   cssTransition v11 tidak menerima opsi `duration` — durasi (0.7s masuk,
   0.45s keluar) didefinisikan di keyframes .pz-toast-enter/.pz-toast-exit
   pada index.css; react-toastify menyinkronkannya lewat event animationend. */
const pzToastTransition = cssTransition({
  enter: "pz-toast-enter",
  exit: "pz-toast-exit",
});

/* SVG ikon chip — persis dari ICONS di preview-toast-premium.html
   (stroke-width 1.6, stroke currentColor, fill none, round cap/join) */
const chipSvg = {
  success: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01M12 11.5V16" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.3 4.1L3.6 15.6a2 2 0 001.7 3h13.4a2 2 0 001.7-3L13.7 4.1a2 2 0 00-3.4 0z" />
      <path d="M12 9.5v4M12 16.5h.01" />
    </svg>
  ),
};

/* type bisa "success"|"error"|"warning"|"info"|"default" — default → info */
const ChipIcon = ({ type }) => {
  const t = chipSvg[type] ? type : "info";
  return (
    <span className="pz-chip" data-type={t}>
      {chipSvg[t]}
    </span>
  );
};

function App() {
  useEffect(() => {
    document.body.style.overflow = "";
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <UpdateDialog />
        <AppRoutes />
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={true}
          closeOnClick={true}
          rtl={false}
          pauseOnFocusLoss={true}
          draggable={true}
          pauseOnHover={true}
          theme="light"
          transition={pzToastTransition}
          icon={({ type }) => <ChipIcon type={type} />}
        />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
