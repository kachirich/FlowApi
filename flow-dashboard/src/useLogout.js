import { API_BASE_URL } from "./utils/apiConfig";

export default function useLogout() {
  return async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      console.error("Logout API error:", err);
    } finally {
      window.location.href = "/login";
    }
  };
}
