import React, { createContext, useState, useContext } from 'react';
import { API_BASE_URL } from '../utils/apiConfig';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);

  const login = async (googleCredential) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: googleCredential }),
      });
      
      const data = await response.json();
      
      if (data.success && data.token) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
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
      if (token) {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
        });
      }
    } catch (error) {
      console.error('Logout API error (Kill Switch failed):', error);
    } finally {
      // Regardless of API success, clear local state
      setToken(null);
      setUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('flow_token');
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
    <AuthContext.Provider value={{ user, setUser: setAuthenticatedUser, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
