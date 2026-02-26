import Constants from 'expo-constants';

// Production backend URL - this is the deployed backend
const PRODUCTION_BACKEND_URL = 'https://repo-preview-43.emergent.host';

/**
 * Get the backend URL from configuration
 * Priority:
 * 1. EAS build env variable (EXPO_PUBLIC_BACKEND_URL)
 * 2. app.json extra config
 * 3. Production fallback
 */
export const getBackendUrl = (): string => {
  // From EAS build environment
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (envUrl) {
    console.log('Using EXPO_PUBLIC_BACKEND_URL from env:', envUrl);
    return envUrl;
  }
  
  // From app.json extra via Constants
  const configUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL;
  if (configUrl) {
    console.log('Using EXPO_PUBLIC_BACKEND_URL from config:', configUrl);
    return configUrl;
  }
  
  // From manifest (older Expo versions)
  const manifestUrl = (Constants.manifest as any)?.extra?.EXPO_PUBLIC_BACKEND_URL;
  if (manifestUrl) {
    console.log('Using EXPO_PUBLIC_BACKEND_URL from manifest:', manifestUrl);
    return manifestUrl;
  }
  
  // Production fallback
  console.log('Using production fallback URL:', PRODUCTION_BACKEND_URL);
  return PRODUCTION_BACKEND_URL;
};

export const BACKEND_URL = getBackendUrl();
