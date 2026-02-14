import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Centralized API configuration for production builds
 * 
 * IMPORTANT FOR iOS BUILD:
 * Before building for production/TestFlight, update the EXPO_PUBLIC_BACKEND_URL
 * in app.json extra section to your production backend URL.
 * 
 * The fallback URL is only for development and WILL NOT work in production.
 */

// Get the backend URL from environment/config
const getBackendUrl = (): string => {
  // Priority 1: app.json extra config (set at build time)
  const configUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL;
  if (configUrl) {
    return configUrl;
  }
  
  // Priority 2: Environment variable
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (envUrl) {
    return envUrl;
  }
  
  // Priority 3: For development only - use fallback
  if (__DEV__) {
    return 'https://apptracker-19.preview.emergentagent.com';
  }
  
  // For production builds without a configured URL, return empty string
  return '';
};

export const BACKEND_URL = getBackendUrl();

// Validate that we have a proper backend URL
export const isBackendConfigured = (): boolean => {
  if (!BACKEND_URL) return false;
  // In production, preview URLs won't work
  if (!__DEV__ && BACKEND_URL.includes('preview.emergentagent.com')) {
    return false;
  }
  return true;
};

// Helper to make API calls with proper error handling
export const apiCall = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null }> => {
  if (!isBackendConfigured()) {
    return {
      data: null,
      error: 'Backend not configured. Please contact support.',
    };
  }

  try {
    const url = `${BACKEND_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        data: null,
        error: `Server error: ${response.status}`,
      };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error: any) {
    // Network errors
    if (error.message?.includes('Network request failed')) {
      return {
        data: null,
        error: 'Network error. Please check your connection.',
      };
    }
    return {
      data: null,
      error: error.message || 'An unexpected error occurred.',
    };
  }
};

// Log configuration on app start (only in development)
if (__DEV__) {
  console.log('API Configuration:');
  console.log('  BACKEND_URL:', BACKEND_URL);
  console.log('  isBackendConfigured:', isBackendConfigured());
}
