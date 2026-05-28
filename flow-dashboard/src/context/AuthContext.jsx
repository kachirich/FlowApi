import React, { createContext, useState, useContext } from 'react';
import { API_BASE_URL } from '../utils/apiConfig';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
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

  const setAuthenticatedUser = (u) => {
    if (u) {
      const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email?.split('@')[0] || '';
      u.name = name;
    }
    setUser(u);
  };

  return (
    <AuthContext.Provider value={{ user, setUser: setAuthenticatedUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
