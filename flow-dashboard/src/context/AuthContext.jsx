import React, { createContext, useState, useContext, useEffect } from 'react';
import { API_BASE_URL } from '../utils/apiConfig';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const setAuthenticatedUser = (u) => {
    if (u) {
      const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email?.split('@')[0] || '';
      u.name = name;
    }
    setUser(u);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include' // Must explicitly include cookies
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            setAuthenticatedUser(data.user);
            localStorage.setItem('flow_logged_in', 'true'); // Ensure sync
          }
        } else {
          // Clean up if the session is absent or expired
          localStorage.removeItem('flow_logged_in');
          setUser(null);
        }
      } catch (error) {
        console.error('[AuthContext] Network error during initialization:', error);
      } finally {
        setLoading(false);
      }
    };
    
    initAuth();
  }, []);
  const login = async (googleCredential) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credential: googleCredential }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUser(data.user);
        localStorage.setItem('flow_logged_in', 'true');
        return data;
      } else {
        throw new Error(data.error || 'Failed to login');
      }
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
      });
    } catch (error) {
      console.error('Logout API error (Kill Switch failed):', error);
    } finally {
      // Regardless of API success, clear local state
      setUser(null);
      localStorage.removeItem('flow_logged_in');
      window.location.href = '/login';
    }
  };



  return (
    <AuthContext.Provider value={{ user, setUser: setAuthenticatedUser, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
