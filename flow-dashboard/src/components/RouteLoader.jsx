import { Loader2 } from "lucide-react";

/**
 * RouteLoader
 *
 * Full-screen skeleton shown while authentication state is resolving
 * (i.e. while AuthContext's /api/auth/me check is in flight). Prevents
 * a flash of the login page before the session cookie is validated.
 */
export default function RouteLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex min-h-screen items-center justify-center bg-zinc-950"
    >
      <Loader2 className="h-6 w-6 animate-spin text-zinc-500" aria-hidden="true" />
      <span className="sr-only">Loading your session…</span>
    </div>
  );
}
