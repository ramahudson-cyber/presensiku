import { AuthProvider } from "./context/AuthContext";
import AppRoutes from "./routes/AppRoutes";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useTheme } from "./context/ThemeContext";
import "./index.css";

function ToastSetup() {
  const { darkMode } = useTheme();
  return (
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
      theme={darkMode ? "dark" : "light"}
    />
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <ToastSetup />
    </AuthProvider>
  );
}

export default App;
