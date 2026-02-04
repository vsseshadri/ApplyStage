import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as LocalAuthentication from 'expo-local-authentication';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';

WebBrowser.maybeCompleteAuthSession();

interface User {
  user_id: string;
  email: string;
  name?: string | null;
  picture?: string;
  payment_status: string;
  applications_count: number;
  preferences: any;
  trial_end_date?: string;
  is_private_relay?: boolean;
  is_new_user?: boolean;
  preferred_display_name?: string | null;
  domicile_country?: string | null;
  onboarding_completed?: boolean;
  communication_email?: string;
}

interface AuthContextType {
  user: User | null;
  sessionToken: string | null;
  loading: boolean;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  isNewUser: boolean;
  login: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  loginWithBiometric: () => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Get backend URL with proper fallbacks
const getBackendUrl = (): string => {
  const configUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL;
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  return configUrl || envUrl || '';
};

const BACKEND_URL = getBackendUrl();

if (__DEV__) {
  console.log('AuthContext BACKEND_URL:', BACKEND_URL);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    checkBiometricAvailability();
    loadSession();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(compatible && enrolled);
    } catch (error) {
      console.error('Biometric check error:', error);
      setBiometricAvailable(false);
    }
  };

  const loadSession = async () => {
    try {
      // Check for test mode in URL (for development testing)
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const testMode = urlParams.get('test_mode');
        if (testMode === 'true') {
          const testToken = 'test_token_abc123';
          setSessionToken(testToken);
          await fetchUser(testToken);
          setLoading(false);
          return;
        }
      }

      // Check if biometric is enabled
      const biometricPref = await AsyncStorage.getItem('biometric_enabled');
      const isBiometricEnabled = biometricPref === 'true';
      setBiometricEnabled(isBiometricEnabled);

      const token = await AsyncStorage.getItem('session_token');
      
      if (token) {
        // If biometric is enabled, try auto-login with biometric
        if (isBiometricEnabled && biometricAvailable) {
          const biometricSuccess = await authenticateWithBiometric();
          if (biometricSuccess) {
            setSessionToken(token);
            await fetchUser(token);
          } else {
            // Biometric failed, clear tokens and require fresh login
            await AsyncStorage.removeItem('session_token');
            setSessionToken(null);
            setUser(null);
            setLoading(false);
            return;
          }
        } else {
          // No biometric, just load the session
          setSessionToken(token);
          await fetchUser(token);
        }
      }
    } catch (error) {
      console.error('Error loading session:', error);
      // Clear potentially corrupt session data
      await AsyncStorage.removeItem('session_token');
      setSessionToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const authenticateWithBiometric = async (): Promise<boolean> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Login to CareerFlow',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        fallbackLabel: 'Use passcode',
      });
      return result.success;
    } catch (error) {
      console.error('Biometric auth error:', error);
      return false;
    }
  };

  const fetchUser = async (token: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        await AsyncStorage.removeItem('session_token');
        setSessionToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const login = async () => {
    try {
      console.log('Starting Google Sign-In...');
      console.log('BACKEND_URL:', BACKEND_URL);
      
      let redirectUrl: string;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        redirectUrl = `${window.location.origin}/`;
      } else {
        redirectUrl = Linking.createURL('/');
      }

      console.log('Redirect URL:', redirectUrl);
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      console.log('Auth URL:', authUrl);

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = authUrl;
      } else {
        console.log('Opening auth session...');
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
        console.log('Auth session result:', result.type);

        if (result.type === 'success' && result.url) {
          console.log('Auth successful, handling redirect...');
          await handleAuthRedirect(result.url);
        } else if (result.type === 'cancel') {
          console.log('Auth cancelled by user');
        } else {
          console.log('Auth result:', result);
        }
      }
    } catch (error: any) {
      console.error('Login error:', error.message || error);
      Alert.alert('Error', `Sign-in failed: ${error.message || 'Unknown error'}`);
    }
  };

  const loginWithApple = async () => {
    try {
      console.log('Starting Apple Sign-In...');
      console.log('BACKEND_URL:', BACKEND_URL);
      
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      console.log('Apple credential received, user:', credential.user);

      // Send Apple credential to backend for verification and user creation
      // Note: identityToken may be null on subsequent sign-ins (Apple only provides it on first sign-in)
      const requestBody = {
        identityToken: credential.identityToken || null,
        email: credential.email || null,
        fullName: credential.fullName ? {
          givenName: credential.fullName.givenName || '',
          familyName: credential.fullName.familyName || '',
        } : null,
        user: credential.user,
      };
      
      console.log('Sending to backend:', `${BACKEND_URL}/api/auth/apple`);
      
      const response = await fetch(`${BACKEND_URL}/api/auth/apple`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Backend response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Apple auth success, session token received');
        const token = data.session_token;
        const newUser = data.is_new_user || false;
        
        await AsyncStorage.setItem('session_token', token);
        setSessionToken(token);
        setIsNewUser(newUser);
        await fetchUser(token);
        
        // Prompt for biometric after successful login
        await promptBiometricSetup();
      } else {
        const errorData = await response.text();
        console.error('Apple auth failed:', response.status, errorData);
        Alert.alert('Error', `Failed to sign in with Apple (${response.status}). Please try again.`);
      }
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED' || error.code === 'ERR_CANCELED') {
        // User cancelled the sign-in
        console.log('Apple Sign-In cancelled by user');
        return;
      }
      console.error('Apple login error:', error.message || error);
      Alert.alert('Error', `Apple Sign-In failed: ${error.message || 'Unknown error'}. Please try again.`);
    }
  };

  const loginWithBiometric = async (showAlerts: boolean = false): Promise<boolean> => {
    try {
      // First, attempt biometric authentication to show Face ID / Touch ID prompt
      const biometricSuccess = await authenticateWithBiometric();
      
      if (!biometricSuccess) {
        // User cancelled or biometric failed - silent return
        return false;
      }
      
      // Biometric succeeded, now check for stored token
      let token = await AsyncStorage.getItem('biometric_session_token');
      
      // Fall back to regular session token
      if (!token) {
        token = await AsyncStorage.getItem('session_token');
      }
      
      if (!token) {
        // No token available - biometric worked but no stored session
        // Silent return - user will see the login screen and can use Google/Apple
        console.log('Biometric succeeded but no stored token found');
        return false;
      }

      // Verify the token is still valid with the backend
      const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        // Token is valid - restore session
        await AsyncStorage.setItem('session_token', token);
        setSessionToken(token);
        await fetchUser(token);
        return true;
      } else {
        // Token expired - clear everything silently
        await AsyncStorage.removeItem('session_token');
        await AsyncStorage.removeItem('biometric_session_token');
        await AsyncStorage.setItem('biometric_enabled', 'false');
        setBiometricEnabled(false);
        console.log('Biometric token expired');
        return false;
      }
    } catch (error) {
      console.error('Biometric login error:', error);
      return false;
    }
  };

  const handleAuthRedirect = async (url: string) => {
    try {
      const sessionId = extractSessionId(url);
      if (!sessionId) return;

      const response = await fetch(`${BACKEND_URL}/api/auth/exchange-session?session_id=${sessionId}`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        const token = data.session_token;
        
        await AsyncStorage.setItem('session_token', token);
        setSessionToken(token);
        await fetchUser(token);
        
        // Prompt for biometric after successful login
        await promptBiometricSetup();
      }
    } catch (error) {
      console.error('Auth redirect error:', error);
    }
  };

  const promptBiometricSetup = async () => {
    if (!biometricAvailable) return;
    
    const alreadyPrompted = await AsyncStorage.getItem('biometric_prompted');
    if (alreadyPrompted === 'true') return;

    // Mark as prompted so we don't ask again
    await AsyncStorage.setItem('biometric_prompted', 'true');

    // Get the type of biometric available
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const hasFaceId = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const biometricName = hasFaceId ? 'Face ID' : 'Biometric';

    Alert.alert(
      `Enable ${biometricName}?`,
      `Would you like to enable ${biometricName} for faster login?`,
      [
        {
          text: 'Not Now',
          style: 'cancel',
        },
        {
          text: 'Enable',
          onPress: async () => {
            await enableBiometric();
          },
        },
      ]
    );
  };

  const extractSessionId = (url: string): string | null => {
    const hashMatch = url.match(/#session_id=([^&]+)/);
    if (hashMatch) return hashMatch[1];
    
    const queryMatch = url.match(/[?&]session_id=([^&]+)/);
    if (queryMatch) return queryMatch[1];
    
    return null;
  };

  const logout = async () => {
    try {
      if (sessionToken) {
        await fetch(`${BACKEND_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
      }
      
      // Keep biometric_session_token for future biometric logins if biometric is enabled
      // Only remove the active session_token
      await AsyncStorage.removeItem('session_token');
      setSessionToken(null);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const refreshUser = async () => {
    if (sessionToken) {
      await fetchUser(sessionToken);
    }
  };

  const enableBiometric = async () => {
    try {
      // Verify biometric first
      const success = await authenticateWithBiometric();
      if (success) {
        await AsyncStorage.setItem('biometric_enabled', 'true');
        // Also store the current session token for biometric re-login after logout
        if (sessionToken) {
          await AsyncStorage.setItem('biometric_session_token', sessionToken);
        }
        setBiometricEnabled(true);
        Alert.alert('Success', 'Biometric login enabled!');
      }
    } catch (error) {
      console.error('Enable biometric error:', error);
      Alert.alert('Error', 'Failed to enable biometric login');
    }
  };

  const disableBiometric = async () => {
    try {
      await AsyncStorage.setItem('biometric_enabled', 'false');
      await AsyncStorage.removeItem('biometric_session_token');
      setBiometricEnabled(false);
      Alert.alert('Success', 'Biometric login disabled');
    } catch (error) {
      console.error('Disable biometric error:', error);
    }
  };

  // Handle web auth redirect
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
      const hash = window.location.hash;
      if (hash.includes('session_id')) {
        handleAuthRedirect(window.location.href);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      sessionToken, 
      loading, 
      biometricEnabled,
      biometricAvailable,
      isNewUser,
      login, 
      loginWithApple,
      loginWithBiometric,
      logout, 
      refreshUser,
      enableBiometric,
      disableBiometric
    }}>
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
