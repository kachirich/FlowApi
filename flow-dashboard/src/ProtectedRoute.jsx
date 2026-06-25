import { Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import RouteLoader from "./components/RouteLoader";

/**
 * ProtectedRoute
 *
 * Wraps child routes that require authentication. The HttpOnly session
 * cookie is the single source of truth — validated server-side by
 * AuthContext via GET /api/auth/me. We gate on that result, never on a
 * client-writable localStorage flag (which is trivially forged in DevTools).
 *
 *   loading       → render skeleton while /api/auth/me is in flight
 *   user === null → not authenticated, redirect to /login
 *   user          → render protected children
 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <RouteLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
