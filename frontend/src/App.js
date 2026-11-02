import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SiteProvider } from "./context/SiteContext";
import PublicBooking from "./pages/PublicBooking";
import Login from "./pages/Login";
import StaffLayout from "./components/StaffLayout";
import Dashboard from "./pages/Dashboard";
import Reservations from "./pages/Reservations";
import FloorPlan from "./pages/FloorPlan";
import Guests from "./pages/Guests";
import Settings from "./pages/Settings";

function Protected({ children }) {
  const { user } = useAuth();
  if (user === null)
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">Loading…</div>;
  if (!user) return <Navigate to="/staff/login" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <SiteProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicBooking />} />
          <Route path="/staff/login" element={<Login />} />
          <Route path="/staff" element={<Protected><StaffLayout /></Protected>}>
            <Route index element={<Dashboard />} />
            <Route path="reservations" element={<Reservations />} />
            <Route path="floor" element={<FloorPlan />} />
            <Route path="guests" element={<Guests />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </SiteProvider>
      <Toaster theme="light" position="bottom-right" richColors />
    </AuthProvider>
  );
}

export default App;
