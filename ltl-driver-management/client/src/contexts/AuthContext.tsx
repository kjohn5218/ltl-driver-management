import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { User, LoginCredentials, RegisterData, AuthResponse } from '../types';
import { api } from '../services/api';

interface UpdateProfileData {
  homeLocationId?: number | null;
}

interface SSOStatus {
  enabled: boolean;
  provider: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  loginWithSSO: () => void;
  handleSSOCallback: (token: string, user: User) => void;
  logout: () => void;
  updateProfile: (data: UpdateProfileData) => Promise<void>;
  isAuthenticated: boolean;
  ssoStatus: SSOStatus | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [ssoStatus, setSsoStatus] = useState<SSOStatus | null>(null);

  useEffect(() => {
    // Check SSO status on mount
    const checkSSOStatus = async () => {
      try {
        const { data } = await api.get<SSOStatus>('/auth/sso/status');
        setSsoStatus(data);
      } catch {
        setSsoStatus({ enabled: false, provider: null });
      }
    };

    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }

    checkSSOStatus();
    setLoading(false);
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      const { data } = await api.post<AuthResponse>('/auth/login', credentials);
      
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (registerData: RegisterData) => {
    try {
      const { data } = await api.post<AuthResponse>('/auth/register', registerData);
      
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const loginWithSSO = () => {
    // Redirect to backend SSO endpoint
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    window.location.href = `${apiUrl}/auth/sso/login`;
  };

  const handleSSOCallback = (token: string, userData: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const updateProfile = async (data: UpdateProfileData) => {
    try {
      const { data: updatedUser } = await api.put<User>('/auth/profile', data);

      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    loginWithSSO,
    handleSSOCallback,
    logout,
    updateProfile,
    isAuthenticated: !!user,
    ssoStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};