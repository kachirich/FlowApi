import axios from 'axios';
import toast from 'react-hot-toast';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  withCredentials: true, // CRITICAL: Forces browser to send cookies in dev and prod
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response Interceptor for global error handling
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;

      // 401 Unauthorized: automatically trigger logout and redirect to /login
      if (status === 401) {
        localStorage.removeItem('flow_logged_in');
        localStorage.removeItem('trusted_device_token');
        window.location.href = '/login';
      } else {
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
