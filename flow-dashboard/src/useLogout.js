
/**
 * useLogout
 *
 * Returns a `logout` function that clears the stored JWT
 * and redirects the user to the login page.
 *
 * Usage:
 *   const logout = useLogout();
 *   <button onClick={logout}>Sign out</button>
 */
export default function useLogout() {
  return () => {
    localStorage.removeItem("flow_token");
    localStorage.removeItem("token");
    window.location.href = "/login";
  };
}
