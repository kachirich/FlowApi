import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Loader2, Mail, ArrowLeft, Zap, Database, Route, TestTube, Code } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "./context/AuthContext";

const API = import.meta.env.VITE_API_BASE_URL;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser } = useAuth();



  // ── State Machine ─────────────────────────────────────────────────────
  const [step, setStep] = useState("LOGIN"); // LOGIN | REGISTER | OTP | FORGOT_EMAIL | FORGOT_OTP | FORGOT_NEWPASS

  // ── Form State ────────────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef([]);
  const [resetOtp, setResetOtp] = useState(["", "", "", "", "", ""]);
  const resetOtpRefs = useRef([]);
  const [resetToken, setResetToken] = useState(() => sessionStorage.getItem("flowapi.pwdResetToken") || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [confirmNewPasswordTouched, setConfirmNewPasswordTouched] = useState(false);

  const [emailTouched, setEmailTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── On mount: handle redirect error params ────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "google_oauth_not_configured") {
      toast.error("Google sign-in is not configured on this server. Please use email and password.");
      params.delete("error");
      const newSearch = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (newSearch ? "?" + newSearch : ""));
    }
  }, []);

  // ── Validation ────────────────────────────────────────────────────────
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = EMAIL_REGEX.test(email);

  const hasLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const isPasswordStrong = hasLength && hasNumber && hasSpecial;
  const isPasswordsMatch = password === confirmPassword;

  const newHasLength = newPassword.length >= 8;
  const newHasNumber = /\d/.test(newPassword);
  const newHasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  const isNewPasswordStrong = newHasLength && newHasNumber && newHasSpecial;
  const isNewPasswordsMatch = newPassword === confirmNewPassword;

  const [isTosAccepted, setIsTosAccepted] = useState(false);

  const isLoginValid = isEmailValid && password.length >= 1;
  const isRegisterValid =
    isEmailValid &&
    isPasswordStrong &&
    isPasswordsMatch &&
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    isTosAccepted;
  const isOtpValid = otp.every((d) => d !== "");
  const isResetOtpValid = resetOtp.every((d) => d !== "");
  const isResetValid = isResetOtpValid && isNewPasswordStrong && isNewPasswordsMatch;

  // ── OTP Input Handling ────────────────────────────────────────────────
  const handleOtpChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      otpRefs.current[5]?.focus();
    }
  };

  const handleResetOtpChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...resetOtp];
    next[index] = value;
    setResetOtp(next);
    if (value && index < 5) resetOtpRefs.current[index + 1]?.focus();
  };

  const handleResetOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !resetOtp[index] && index > 0) {
      resetOtpRefs.current[index - 1]?.focus();
    }
  };

  const handleResetOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setResetOtp(pasted.split(""));
      resetOtpRefs.current[5]?.focus();
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!isLoginValid) return;
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || data.error || "Login failed");

      // If backend returns 2FA required
      if (data.requires2FA) {
        toast.success("2FA required. Enter your authenticator code.");
        return;
      }

      if (data.success) {
        // Hydrate auth state from the freshly-set cookie before navigating,
        // so ProtectedRoute (which reads useAuth) sees the user immediately.
        await refreshUser();
        toast.success("Welcome back!");
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordlessLogin = async () => {
    if (!isEmailValid || email.length === 0) {
      toast.error("Please enter a valid email address");
      return;
    }
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || data.error || "Failed to send OTP");

      toast.success("Passcode sent to your email!");
      setStep("OTP");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!isRegisterValid) return;
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, firstName, lastName }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || data.error || "Registration failed");

      // Send OTP for email verification
      const otpRes = await fetch(`${API}/api/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });

      if (!otpRes.ok) {
        const otpData = await otpRes.json();
        throw new Error(otpData.error || "Failed to send verification email");
      }

      toast.success("Account created! Check your email for verification code.");
      setStep("OTP");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async (e) => {
    e.preventDefault();
    if (!isOtpValid) return;
    setLoading(true);

    try {
      const code = otp.join("");
      const res = await fetch(`${API}/api/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || data.error || "Verification failed");

      toast.success("Email verified successfully!");
      // Full reload re-runs AuthContext's /api/auth/me check, hydrating the session.
      window.location.href = "/dashboard";
    } catch (err) {
      toast.error(err.message);
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!isEmailValid) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      toast.success("If an account exists, a reset code has been sent.");
      setStep("FORGOT_OTP");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyResetOtp = async (e) => {
    e.preventDefault();
    if (!isResetOtpValid) return;
    setLoading(true);
    try {
      const otp = resetOtp.join("");
      const res = await fetch(`${API}/api/auth/verify-reset-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid code");
      toast.success("Code verified! Set your new password.");
      setResetToken(data.reset_token);
      sessionStorage.setItem("flowapi.pwdResetToken", data.reset_token);
      setStep("FORGOT_NEWPASS");
    } catch (err) {
      toast.error(err.message);
      setResetOtp(["", "", "", "", "", ""]);
      resetOtpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetToken) {
      toast.error("Your reset session expired. Please request a new code.");
      sessionStorage.removeItem("flowapi.pwdResetToken");
      setResetToken("");
      setStep("FORGOT_EMAIL");
      return;
    }
    if (!isNewPasswordStrong || !isNewPasswordsMatch) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, reset_token: resetToken, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          toast.error("Your reset session expired. Please request a new code.");
          sessionStorage.removeItem("flowapi.pwdResetToken");
          setResetToken("");
          setStep("FORGOT_EMAIL");
          return;
        }
        throw new Error(data.error || "Reset failed");
      }
      toast.success("Password reset successfully! Sign in with your new password.");
      sessionStorage.removeItem("flowapi.pwdResetToken");
      setPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setResetOtp(["", "", "", "", "", ""]);
      setResetToken("");
      setStep("LOGIN");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API}/api/auth/google`;
  };

  // ── Shared Input Class ────────────────────────────────────────────────
  const inputClass =
    "w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/20";
  const inputErrorClass =
    "w-full rounded-md border border-rose-500 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20";

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="relative flex min-h-screen flex-col lg:flex-row items-center lg:justify-center bg-zinc-950 px-4 lg:px-20 font-sans text-zinc-100 gap-12 lg:gap-24 py-12 overflow-y-auto">
      {/* Left-hand column (logo, headline, and sub-headline) */}
      <div className="flex w-full max-w-2xl flex-col mt-24 lg:mt-0 pt-8 lg:pt-24 justify-center">
        {/* Brand Logo */}
        <div className="flex items-center gap-2 text-xl font-bold tracking-tight text-white mb-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-black">
            <Zap className="h-5 w-5 fill-current" />
          </div>
          FlowAPI
        </div>

        <h1 className="text-4xl lg:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
          Enterprise Lead <br/>
          <span className="text-emerald-500">Routing Infrastructure</span>
        </h1>
        <p className="text-lg text-zinc-400 max-w-lg">
          Zero data loss. Tax avoidance. Vaulted lead data. Watch how FlowGateway protects your CRM in real-time.
        </p>

        {/* Feature Highlights */}
        <div className="flex flex-col gap-6 mt-8 max-w-lg">
          {/* Feature 1 */}
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-medium text-white text-base">The Lead Ledger</h3>
              <p className="text-sm text-zinc-400 mt-1">
                Maintain an immutable, vaulted audit trail of every incoming request.
              </p>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <Route className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-medium text-white text-base">Dynamic Destination Mapping</h3>
              <p className="text-sm text-zinc-400 mt-1">
                Route and map incoming leads to custom CRM endpoints instantly.
              </p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <TestTube className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-medium text-white text-base">Sandbox Environment</h3>
              <p className="text-sm text-zinc-400 mt-1">
                Safely simulate traffic and test webhooks using isolated mock URLs.
              </p>
            </div>
          </div>

          {/* Feature 4 */}
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <Code className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-medium text-white text-base">Deep JSON Analytics</h3>
              <p className="text-sm text-zinc-400 mt-1">
                Monitor, inspect, and debug raw payload data in real-time.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950 p-8 shadow-xl">
        {/* ═══════════════════ STEP: LOGIN ═══════════════════ */}
        {step === "LOGIN" && (
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-white">Welcome back</h1>
              <p className="mt-2 text-sm text-zinc-400">
                Enter your email to sign in to your account
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white">Email</label>
                <input
                  type="email"
                  placeholder="m@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  className={
                    emailTouched && !isEmailValid && email.length > 0
                      ? inputErrorClass
                      : inputClass
                  }
                />
                {emailTouched && !isEmailValid && email.length > 0 && (
                  <p className="text-[11px] text-rose-400">
                    Please enter a valid email address
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-white">Password</label>
                  <button
                    type="button"
                    onClick={() => setStep("FORGOT_EMAIL")}
                    className="text-[11px] text-zinc-500 hover:text-white transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={loading || !isLoginValid}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-white py-2 text-sm font-medium text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={handlePasswordlessLogin}
                  disabled={loading || !isEmailValid || email.length === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-zinc-700 bg-transparent py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Email me a Login Code
                </button>
              </div>
            </form>

            {/* Google Divider */}
            <div className="relative my-6 flex items-center justify-center">
              <div className="absolute inset-x-0 h-px bg-zinc-800" />
              <span className="relative z-10 bg-zinc-950 px-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                OR CONTINUE WITH
              </span>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-zinc-800 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
            </button>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setStep("REGISTER");
                  setEmailTouched(false);
                }}
                className="text-xs text-zinc-400 hover:text-white transition-colors"
              >
                Don&apos;t have an account? Sign up
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════ STEP: REGISTER ═══════════════════ */}
        {step === "REGISTER" && (
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-white">Create an account</h1>
              <p className="mt-2 text-sm text-zinc-400">
                Enter your details to sign up
              </p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="flex gap-4">
                <div className="space-y-2 flex-1">
                  <label className="block text-sm font-medium text-white">First Name</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2 flex-1">
                  <label className="block text-sm font-medium text-white">Last Name</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-white">Email</label>
                <input
                  type="email"
                  placeholder="m@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  className={
                    emailTouched && !isEmailValid && email.length > 0
                      ? inputErrorClass
                      : inputClass
                  }
                />
                {emailTouched && !isEmailValid && email.length > 0 && (
                  <p className="text-[11px] text-rose-400">
                    Please enter a valid email address
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-white">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
                <div className="pt-1 space-y-1.5 text-xs">
                  <div className={`flex items-center gap-2 ${hasLength ? "text-emerald-500" : "text-zinc-500"} transition-colors`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${hasLength ? "bg-emerald-500" : "bg-zinc-700"}`} />
                    8+ characters
                  </div>
                  <div className={`flex items-center gap-2 ${hasNumber ? "text-emerald-500" : "text-zinc-500"} transition-colors`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${hasNumber ? "bg-emerald-500" : "bg-zinc-700"}`} />
                    1 number
                  </div>
                  <div className={`flex items-center gap-2 ${hasSpecial ? "text-emerald-500" : "text-zinc-500"} transition-colors`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${hasSpecial ? "bg-emerald-500" : "bg-zinc-700"}`} />
                    1 special character
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-white">Confirm Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onBlur={() => setConfirmPasswordTouched(true)}
                  className={
                    confirmPasswordTouched && !isPasswordsMatch && confirmPassword.length > 0
                      ? inputErrorClass
                      : inputClass
                  }
                />
                {confirmPasswordTouched && !isPasswordsMatch && confirmPassword.length > 0 && (
                  <p className="text-[11px] text-rose-400">Passwords do not match</p>
                )}
              </div>

              <div className="flex items-start gap-2 mt-4 mb-2">
                <input
                  type="checkbox"
                  id="tos"
                  checked={isTosAccepted}
                  onChange={(e) => setIsTosAccepted(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-white focus:ring-1 focus:ring-white focus:ring-offset-1 focus:ring-offset-zinc-950"
                />
                <label htmlFor="tos" className="text-xs text-zinc-400">
                  I agree to the{" "}
                  <Link to="/terms" target="_blank" className="text-white hover:underline transition-colors">
                    Terms of Service
                  </Link>
                  {" "}and{" "}
                  <Link to="/privacy" target="_blank" className="text-white hover:underline transition-colors">
                    Privacy Policy
                  </Link>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || !isRegisterValid}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-white py-2 text-sm font-medium text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Create Account
              </button>
            </form>

            {/* Google Divider */}
            <div className="relative my-6 flex items-center justify-center">
              <div className="absolute inset-x-0 h-px bg-zinc-800" />
              <span className="relative z-10 bg-zinc-950 px-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                OR CONTINUE WITH
              </span>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-zinc-800 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
            </button>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setStep("LOGIN");
                  setEmailTouched(false);
                  setConfirmPasswordTouched(false);
                }}
                className="text-xs text-zinc-400 hover:text-white transition-colors"
              >
                Already have an account? Sign in
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════ STEP: OTP ═══════════════════ */}
        {step === "OTP" && (
          <div>
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900">
                <Mail className="h-5 w-5 text-zinc-400" />
              </div>
              <h1 className="text-2xl font-bold text-white">Check your email</h1>
              <p className="mt-2 text-sm text-zinc-400">
                We sent a 6-digit verification code to{" "}
                <span className="font-medium text-white">{email}</span>
              </p>
            </div>

            <form onSubmit={handleOtpVerify} className="space-y-6">
              <div className="flex justify-center gap-2">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (otpRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    onPaste={i === 0 ? handleOtpPaste : undefined}
                    className="h-12 w-10 rounded-md border border-zinc-800 bg-zinc-900 text-center text-lg font-bold text-white outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/20"
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={loading || !isOtpValid}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-white py-2 text-sm font-medium text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Verify Email
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setStep("LOGIN")}
                className="flex items-center justify-center gap-1 mx-auto text-xs text-zinc-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to sign in
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════ STEP 1: FORGOT_EMAIL ═══════════════════ */}
        {step === "FORGOT_EMAIL" && (
          <div>
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900">
                <Mail className="h-5 w-5 text-zinc-400" />
              </div>
              <h1 className="text-2xl font-bold text-white">Reset your password</h1>
              <p className="mt-2 text-sm text-zinc-400">
                Enter the email address associated with your account. We&apos;ll send you a 6-digit reset code.
              </p>
            </div>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white">Email</label>
                <input type="email" placeholder="m@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
              </div>
              <button type="submit" disabled={loading || !isEmailValid} className="flex w-full items-center justify-center gap-2 rounded-md bg-white py-2 text-sm font-medium text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Send Reset Code
              </button>
            </form>
            <div className="mt-6 text-center">
              <button type="button" onClick={() => setStep("LOGIN")} className="flex items-center justify-center gap-1 mx-auto text-xs text-zinc-400 hover:text-white transition-colors">
                <ArrowLeft className="h-3 w-3" /> Back to sign in
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════ STEP 2: FORGOT_OTP ═══════════════════ */}
        {step === "FORGOT_OTP" && (
          <div>
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900">
                <Mail className="h-5 w-5 text-zinc-400" />
              </div>
              <h1 className="text-2xl font-bold text-white">Enter your reset code</h1>
              <p className="mt-2 text-sm text-zinc-400">
                We sent a 6-digit code to <span className="font-medium text-white">{email}</span>. Enter it below to verify your identity.
              </p>
            </div>
            <form onSubmit={handleVerifyResetOtp} className="space-y-6">
              <div className="flex justify-center gap-2">
                {resetOtp.map((digit, i) => (
                  <input key={i} ref={(el) => (resetOtpRefs.current[i] = el)} type="text" inputMode="numeric" maxLength={1} value={digit} onChange={(e) => handleResetOtpChange(i, e.target.value)} onKeyDown={(e) => handleResetOtpKeyDown(i, e)} onPaste={i === 0 ? handleResetOtpPaste : undefined} className="h-12 w-10 rounded-md border border-zinc-800 bg-zinc-900 text-center text-lg font-bold text-white outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/20" />
                ))}
              </div>
              <button type="submit" disabled={loading || !isResetOtpValid} className="flex w-full items-center justify-center gap-2 rounded-md bg-white py-2 text-sm font-medium text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Verify Code
              </button>
            </form>
            <div className="mt-6 text-center">
              <button type="button" onClick={() => setStep("FORGOT_EMAIL")} className="flex items-center justify-center gap-1 mx-auto text-xs text-zinc-400 hover:text-white transition-colors">
                <ArrowLeft className="h-3 w-3" /> Use a different email
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════ STEP 3: FORGOT_NEWPASS ═══════════════════ */}
        {step === "FORGOT_NEWPASS" && (
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-white">Set your new password</h1>
              <p className="mt-2 text-sm text-zinc-400">
                Your identity has been verified. Choose a strong new password for your account.
              </p>
            </div>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white">New Password</label>
                <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} />
                <div className="pt-1 space-y-1.5 text-xs">
                  <div className={`flex items-center gap-2 ${newHasLength ? "text-emerald-500" : "text-zinc-500"} transition-colors`}><div className={`w-1.5 h-1.5 rounded-full ${newHasLength ? "bg-emerald-500" : "bg-zinc-700"}`} /> 8+ characters</div>
                  <div className={`flex items-center gap-2 ${newHasNumber ? "text-emerald-500" : "text-zinc-500"} transition-colors`}><div className={`w-1.5 h-1.5 rounded-full ${newHasNumber ? "bg-emerald-500" : "bg-zinc-700"}`} /> 1 number</div>
                  <div className={`flex items-center gap-2 ${newHasSpecial ? "text-emerald-500" : "text-zinc-500"} transition-colors`}><div className={`w-1.5 h-1.5 rounded-full ${newHasSpecial ? "bg-emerald-500" : "bg-zinc-700"}`} /> 1 special character</div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white">Confirm New Password</label>
                <input type="password" required value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} onBlur={() => setConfirmNewPasswordTouched(true)} className={confirmNewPasswordTouched && !isNewPasswordsMatch && confirmNewPassword.length > 0 ? inputErrorClass : inputClass} />
                {confirmNewPasswordTouched && !isNewPasswordsMatch && confirmNewPassword.length > 0 && (
                  <p className="text-[11px] text-rose-400">Passwords do not match</p>
                )}
              </div>
              <button type="submit" disabled={loading || !resetToken || !isNewPasswordStrong || !isNewPasswordsMatch} className="flex w-full items-center justify-center gap-2 rounded-md bg-white py-2 text-sm font-medium text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Reset Password
              </button>
            </form>
            <div className="mt-6 text-center">
              <button type="button" onClick={() => { sessionStorage.removeItem("flowapi.pwdResetToken"); setResetToken(""); setStep("LOGIN"); }} className="flex items-center justify-center gap-1 mx-auto text-xs text-zinc-400 hover:text-white transition-colors">
                <ArrowLeft className="h-3 w-3" /> Back to sign in
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-zinc-500">
          <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
          {" "}&{" "}
          <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
        </p>
      </div>
    </div>
  );
}
