import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { ArrowLeft, CalendarDays, Grid3x3, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatApiError } from "../lib/api";
import { btnPrimary } from "../lib/status";
import { Input } from "../components/ui/input";

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/staff" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-16 sm:px-16 lg:px-24">
        <Link to="/" data-testid="login-back-link" className="mb-16 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#120092]">
          <ArrowLeft className="h-4 w-4" /> Back to booking page
        </Link>
        <h1 className="font-display text-5xl font-bold">Welcome back</h1>
        <p className="mt-3 text-slate-500">Sign in to run tonight's service. Accounts are created by the owner.</p>
        <form onSubmit={submit} className="mt-10 max-w-sm space-y-4" data-testid="login-form">
          <Input type="email" placeholder="you@restaurant.com" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="login-email-input" className="h-12 rounded-xl" />
          <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="login-password-input" className="h-12 rounded-xl" />
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" data-testid="login-error">{error}</p>}
          <button type="submit" disabled={busy} data-testid="login-submit-btn" className={`${btnPrimary} brand-shadow w-full py-3.5`}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
      </div>
      <div className="relative hidden overflow-hidden bg-[#120092] lg:flex lg:flex-col lg:justify-end lg:p-16">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.5) 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
        <div className="relative z-10 max-w-md text-white">
          <h2 className="font-display text-4xl font-bold leading-tight">Every table, every guest — one screen.</h2>
          <div className="mt-10 space-y-3">
            {[[CalendarDays, "Reservations & online bookings"], [Grid3x3, "Live floor plan with walk-ins"], [Users, "Guest profiles, allergies & history"]].map(([Icon, t]) => (
              <div key={t} className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-md">
                <Icon className="h-4 w-4" /><span className="text-sm font-medium">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
