import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatApiError } from "../lib/api";
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
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="grain relative hidden lg:block">
        <img src="/images/bar.jpg" alt="Bar" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[#120E0D]/50" />
        <div className="absolute bottom-12 left-12 z-10 max-w-sm">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-[#D4A359]">Back of house</div>
          <p className="mt-3 font-serif-d text-4xl leading-tight">Every table, every guest, at a glance.</p>
        </div>
      </div>
      <div className="flex flex-col justify-center px-6 py-16 sm:px-16 lg:px-24">
        <Link to="/" data-testid="login-back-link" className="mb-16 inline-flex items-center gap-2 text-sm text-[#786E65] hover:text-[#D4A359]">
          <ArrowLeft className="h-4 w-4" /> Public site
        </Link>
        <h1 className="font-serif-d text-5xl">Staff sign in</h1>
        <p className="mt-3 text-[#B0A59A]">Accounts are created by the owner in Settings.</p>
        <form onSubmit={submit} className="mt-12 max-w-sm space-y-5" data-testid="login-form">
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="login-email-input" className="h-12" />
          <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="login-password-input" className="h-12" />
          {error && <p className="text-sm text-rose-400" data-testid="login-error">{error}</p>}
          <button type="submit" disabled={busy} data-testid="login-submit-btn"
            className="w-full rounded-full bg-[#D4A359] py-3.5 font-outfit text-sm font-semibold uppercase tracking-[0.2em] text-[#120E0D] transition-colors hover:bg-[#E5B86C] disabled:opacity-60">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
