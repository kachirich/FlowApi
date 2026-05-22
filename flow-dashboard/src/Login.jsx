import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Zap,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  Loader2,
  Terminal,
  UserPlus,
  LogIn,
  ShieldCheck
} from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 2FA state variables
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [tempUserId, setTempUserId] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (requires2FA) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: tempUserId, token: twoFactorCode }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "2FA verification failed");
        }

        localStorage.setItem("flow_token", data.token);
        localStorage.removeItem("just_registered");
        navigate("/", { replace: true });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    const endpoint = isRegister
      ? `${import.meta.env.VITE_API_URL}/api/auth/register`
      : `${import.meta.env.VITE_API_URL}/api/auth/login`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Authentication failed");
      }

      if (data.requires2FA) {
        setRequires2FA(true);
        setTempUserId(data.userId);
        return;
      }

      localStorage.setItem("flow_token", data.token);
      if (isRegister) {
        localStorage.setItem("just_registered", "true");
      } else {
        localStorage.removeItem("just_registered");
      }
      
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface px-4 font-sans text-slate-100">
      {/* Ambient background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-emerald-500/[0.03] blur-[140px]" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-violet-500/[0.04] blur-[120px]" />
        <div className="absolute left-1/2 top-1/3 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-cyan-500/[0.02] blur-[100px]" />
      </div>

      {/* Grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md animate-fade-in">
        {/* Brand header */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="relative animate-float">
            <div className="absolute -inset-3 animate-pulse-slow rounded-2xl bg-emerald-500/10 blur-xl" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-raised ring-1 ring-emerald-500/20">
              <Zap className="h-8 w-8 text-emerald-400" />
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">
              {requires2FA ? "Security Handshake" : isRegister ? "Create Your Account" : "Access FlowAPI Gateway"}
            </h1>
            <p className="mt-2 flex items-center justify-center gap-2 text-xs font-medium text-slate-500">
              <Terminal className="h-3.5 w-3.5 text-emerald-500" />
              {requires2FA ? "mfa_verification_handshake()" : isRegister ? "register_new_gateway_admin()" : "session.initialize()"}
            </p>
          </div>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-slate-800/60 bg-surface-raised/80 p-8 shadow-2xl shadow-black/40 backdrop-blur-sm">
          {/* Terminal-style header bar */}
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-slate-700/40 bg-surface px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
            <span className="ml-2 font-mono text-[10px] text-slate-500">
              {requires2FA ? "mfa_challenge_console" : isRegister ? "admin_provisioning_console" : "authorization_handshake"}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error alert */}
            {error && (
              <div
                id="login-error"
                className="flex items-start gap-2.5 rounded-lg border border-rose-500/20 bg-rose-500/[0.06] px-4 py-3 animate-shake"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <p className="text-sm text-rose-300 leading-normal">{error}</p>
              </div>
            )}

            {requires2FA ? (
              /* 2FA Token input */
              <div className="space-y-3">
                <div className="text-center py-2">
                  <p className="text-xs font-semibold text-slate-400">
                    Two-Factor Authentication Shield Active
                  </p>
                  <p className="mt-1.5 text-[11px] text-slate-500 leading-normal">
                    Please submit the 6-digit validation code from your designated authenticator device.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    MFA Verification Code
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-650" />
                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="000000"
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                      className="w-full rounded-lg border border-slate-700/50 bg-surface px-10 py-3 text-center font-mono text-lg font-bold tracking-[0.5em] text-slate-200 placeholder:text-slate-650 outline-none transition focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Standard login inputs */
              <>
                {/* Email field */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-600" />
                    <input
                      type="email"
                      required
                      placeholder="admin@flowapi.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-slate-700/50 bg-surface px-10 py-3 text-sm text-slate-200 placeholder:text-slate-650 outline-none transition focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                {/* Password field */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-600" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-slate-700/50 bg-surface px-10 py-3 text-sm text-slate-200 placeholder:text-slate-650 outline-none transition focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Submit button */}
            <button
              id="auth-submit"
              type="submit"
              disabled={loading}
              className="group relative mt-2 flex w-full items-center justify-center gap-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all duration-300 hover:from-emerald-500 hover:to-teal-500 hover:shadow-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {requires2FA ? "Verifying Code…" : isRegister ? "Creating Account…" : "Initializing Session…"}
                </>
              ) : (
                <>
                  {requires2FA ? (
                    <ShieldCheck className="h-4 w-4" />
                  ) : isRegister ? (
                    <UserPlus className="h-4 w-4" />
                  ) : (
                    <LogIn className="h-4 w-4" />
                  )}
                  {requires2FA ? "Verify & Access Gateway" : isRegister ? "Create Admin Account" : "Access Admin Gateway"}
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          {/* Toggle view button */}
          {!requires2FA && (
            <div className="mt-6 border-t border-slate-800/60 pt-4 text-center">
              <button
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError("");
                }}
                className="text-xs font-semibold text-slate-400 hover:text-emerald-400 transition"
              >
                {isRegister
                  ? "Already have an account? Access admin gateway"
                  : "Need an account? Provision new gateway admin"}
              </button>
            </div>
          )}

          {requires2FA && (
            <div className="mt-6 border-t border-slate-800/60 pt-4 text-center">
              <button
                onClick={() => {
                  setRequires2FA(false);
                  setTwoFactorCode("");
                  setError("");
                }}
                className="text-xs font-semibold text-slate-400 hover:text-emerald-400 transition"
              >
                &larr; Back to login credentials
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[10px] text-slate-650">
          Secured by FlowAPI
        </p>
      </div>
    </div>
  );
}
