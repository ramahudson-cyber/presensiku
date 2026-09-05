import { useEffect } from "react";
import { AuthProvider } from "./context/AuthContext";
import AppRoutes from "./routes/AppRoutes";
import UpdateDialog from "./components/UpdateDialog";
import ErrorBoundary from "./components/ErrorBoundary";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./index.css";

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
        />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
