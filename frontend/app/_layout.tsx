import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { View, Text, StyleSheet, ActivityIndicator, Linking, Platform, AppState, AppStateStatus } from 'react-native';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { FilterProvider } from '../contexts/FilterContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import ShareJobModal from '../components/ShareJobModal';
import { checkForSharedContent, setupShareListener, SharedJobData, storeSharedData } from '../utils/shareReceiver';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore errors - splash screen might already be hidden
});

// Error Boundary Component to prevent crashes
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>Something went wrong</Text>
          <Text style={errorStyles.message}>
            Please restart the app. If the problem persists, please contact support.
          </Text>
          <Text style={errorStyles.errorText}>
            {this.state.error?.message || 'Unknown error'}
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F5F5F5',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});

// App initialization component
function AppInitializer({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Add any initialization logic here
        // For example, loading fonts, checking auth state, etc.
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        console.warn('App initialization error:', e);
      } finally {
        setIsReady(true);
        // Hide splash screen
        SplashScreen.hideAsync().catch(() => {
          // Ignore errors
        });
      }
    }

    prepare();
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#007AFF' }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return <>{children}</>;
}

// Share handler component - handles incoming shared content
function ShareHandler({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [sharedUrl, setSharedUrl] = useState('');
  const [sharedText, setSharedText] = useState<string | undefined>();

  // Handle shared data
  const handleSharedData = (data: SharedJobData) => {
    if (data.url) {
      console.log('Received shared content:', data);
      setSharedUrl(data.url);
      setSharedText(data.text);
      
      // Only show modal if user is authenticated
      if (isAuthenticated) {
        setShareModalVisible(true);
      } else {
        // Store for later and navigate to login
        storeSharedData(data);
        console.log('User not authenticated, storing share data for later');
      }
    }
  };

  // Check for shared content on mount and app state changes
  useEffect(() => {
    // Check initial URL (app launched from share)
    const checkInitialUrl = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          handleDeepLink(initialUrl);
        }
      } catch (error) {
        console.error('Error checking initial URL:', error);
      }
    };

    // Handle deep link URL
    const handleDeepLink = (url: string) => {
      console.log('Deep link received:', url);
      
      if (url.startsWith('careerflow://share')) {
        try {
          const params = new URLSearchParams(url.split('?')[1]);
          const sharedUrlParam = params.get('url');
          const textParam = params.get('text');
          
          if (sharedUrlParam) {
            handleSharedData({
              url: decodeURIComponent(sharedUrlParam),
              text: textParam ? decodeURIComponent(textParam) : undefined,
              timestamp: Date.now(),
            });
          }
        } catch (error) {
          console.error('Error parsing share URL:', error);
        }
      }
    };

    // Check for pending shared data from AsyncStorage (from extension)
    const checkPendingShareData = async () => {
      try {
        const storedData = await AsyncStorage.getItem('SHARED_JOB_DATA');
        if (storedData && isAuthenticated) {
          const data = JSON.parse(storedData);
          await AsyncStorage.removeItem('SHARED_JOB_DATA');
          handleSharedData(data);
        }
      } catch (error) {
        console.error('Error checking pending share data:', error);
      }
    };

    checkInitialUrl();
    
    // Check pending data when auth state changes
    if (isAuthenticated) {
      checkPendingShareData();
    }

    // Setup URL listener for when app is already running
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    // Check for shared data when app comes to foreground
    const appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active' && isAuthenticated) {
        checkPendingShareData();
      }
    });

    return () => {
      subscription.remove();
      appStateSubscription.remove();
    };
  }, [isAuthenticated]);

  // Handle job created callback
  const handleJobCreated = () => {
    // Navigate to My Jobs tab to show the new job
    router.push('/(tabs)/my-jobs');
  };

  return (
    <>
      {children}
      <ShareJobModal
        visible={shareModalVisible}
        sharedUrl={sharedUrl}
        sharedText={sharedText}
        onClose={() => {
          setShareModalVisible(false);
          setSharedUrl('');
          setSharedText(undefined);
        }}
        onJobCreated={handleJobCreated}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <AuthProvider>
            <FilterProvider>
              <AppInitializer>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="onboarding" />
                  <Stack.Screen name="(tabs)" />
                </Stack>
              </AppInitializer>
            </FilterProvider>
          </AuthProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
