import { Navigate } from "react-router-dom";

/**
 * ProtectedRoute
 *
 * Wraps child routes that require authentication.
 * Checks for a valid JWT in localStorage — if absent, redirects to /login.
 */
export default function ProtectedRoute({ children }) {
  const isLoggedIn = localStorage.getItem("flow_logged_in") === "true";

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
