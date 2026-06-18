/**
 * Safely resolves the API Base URL by stripping any trailing `/api` 
 * that might accidentally be included in the VITE_API_BASE_URL environment variable.
 * This prevents double-routing bugs (e.g., /api/api/auth).
 */
const rawUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
export const API_BASE_URL = rawUrl.replace(/\/api\/?$/, "");
