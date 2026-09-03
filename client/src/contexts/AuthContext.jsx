import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from '../hooks/useToast';

const AuthContext = createContext();
const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('fw-token') || null);
  const [loading, setLoading] = useState(true);

  // Axios interceptor for authorization header
  useEffect(() => {
    const interceptor = axios.interceptors.request.use(
      (config) => {
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
    return () => axios.interceptors.request.eject(interceptor);
  }, [token]);

  // Load user profile if we have a token
  useEffect(() => {
    const loadUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await axios.get(`${API}/auth/me`);
        setUser(res.data);
      } catch (err) {
        console.error('Failed to load user', err);
        setToken(null);
        localStorage.removeItem('fw-token');
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [token]);

  const login = async (email, password) => {
    try {
      const res = await axios.post(`${API}/auth/login`, { email, password });
      const { token: newToken, ...userData } = res.data;
      setToken(newToken);
      localStorage.setItem('fw-token', newToken);
      setUser(userData);
      toast.success('Welcome back!', `Logged in as ${userData.fullName}`);
      return true;
    } catch (err) {
      toast.error('Login Failed', err.response?.data?.message || 'Invalid credentials');
      return false;
    }
  };

  const register = async (fullName, email, phone, password) => {
    try {
      const res = await axios.post(`${API}/auth/register`, { fullName, email, phone, password });
      const { token: newToken, ...userData } = res.data;
      setToken(newToken);
      localStorage.setItem('fw-token', newToken);
      setUser(userData);
      toast.success('Registration successful!', 'Welcome to FreshWave');
      return true;
    } catch (err) {
      toast.error('Registration Failed', err.response?.data?.message || 'Something went wrong');
      return false;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('fw-token');
    toast.info('Logged out', 'You have been successfully logged out.');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
