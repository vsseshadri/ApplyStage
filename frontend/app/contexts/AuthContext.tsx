import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Storage adapter for web vs native
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  subscription: {
    type: string;
    expiresAt?: string;
  };
  preferences: {
    theme: string;
    notifications: boolean;
    emailSummary: {
      weekly: boolean;
      monthly: boolean;
    };
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkExistingSession();
    
    // Handle deep links (cold start)
    Linking.getInitialURL().then(url => {
      if (url) {
        handleAuthRedirect(url);
      }
    });

    // Handle deep links (hot link)
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleAuthRedirect(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleAuthRedirect = async (url: string) => {
    // Check for session_id in hash or query
    const sessionIdMatch = url.match(/[#?&]session_id=([^&]+)/);
    if (sessionIdMatch) {
      const sessionId = sessionIdMatch[1];
      await exchangeSessionId(sessionId);
    }
  };

  const exchangeSessionId = async (sessionId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/session`, {
        method: 'POST',
        headers: {
          'X-Session-ID': sessionId,
        },
      });

      if (response.ok) {
        const data = await response.json();
        await SecureStore.setItemAsync('session_token', data.session_token);
        setUser(data.user);
      }
    } catch (error) {
      console.error('Session exchange error:', error);
    }
  };

  const checkExistingSession = async () => {
    try {
      const sessionToken = await SecureStore.getItemAsync('session_token');
      if (sessionToken) {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          },
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          await SecureStore.deleteItemAsync('session_token');
        }
      }
    } catch (error) {
      console.error('Session check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    try {
      const redirectUrl = Platform.OS === 'web'
        ? `${API_URL}/`
        : Linking.createURL('/');

      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

      if (Platform.OS === 'web') {
        window.location.href = authUrl;
      } else {
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
        if (result.type === 'success' && result.url) {
          await handleAuthRedirect(result.url);
        }
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const logout = async () => {
    try {
      const sessionToken = await SecureStore.getItemAsync('session_token');
      if (sessionToken) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          },
        });
      }
      await SecureStore.deleteItemAsync('session_token');
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const refreshUser = async () => {
    await checkExistingSession();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
