import axios from 'axios';
import toast from 'react-hot-toast';

axios.defaults.withCredentials = true;

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  withCredentials: true, // CRITICAL: Forces browser to send cookies in dev and prod
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth is carried exclusively by the HttpOnly session cookie (withCredentials).
// No Bearer token is read from localStorage — keeping a JS-readable JWT would
// expose it to any XSS payload and create a second, drift-prone auth path.

// Response Interceptor for global error handling
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;

      // 401 Unauthorized: session expired/invalid — surface a message, then redirect.
      if (status === 401) {
        console.error(`[Axios Interceptor] 401 Unauthorized on route: ${error.config?.url}`);
        localStorage.removeItem('trusted_device_token');

        // Prevent infinite redirect loops on the initial session check
        if (!error.config?.url?.includes('/api/auth/me') && window.location.pathname !== '/login') {
          toast.error('Session expired — please sign in again');
          // Brief delay so the user sees why they're being redirected.
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        }
      } else if (!error.config?.skipToast) {
        // Extract standardized error message from backend
        const errorMessage = data?.message || data?.error || error.message || 'An error occurred';
        toast.error(errorMessage);
      }
    } else if (error.request) {
      // Request was made but no response was received
      toast.error('Network error: No response received from server.');
    } else {
      // Something went wrong setting up the request
      toast.error(error.message || 'An unexpected error occurred.');
    }

    return Promise.reject(error);
  }
);

export default apiClient;
