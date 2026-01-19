import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useThemeStore } from './stores/themeStore';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

function RootLayoutContent() {
  const { user, loading } = useAuth();
  const { actualTheme, initTheme } = useThemeStore();

  useEffect(() => {
    initTheme();
  }, []);

  const theme = actualTheme === 'dark' ? MD3DarkTheme : MD3LightTheme;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <PaperProvider theme={theme}>
      <Stack screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="add-job" options={{ presentation: 'modal', title: 'Add Job' }} />
            <Stack.Screen name="job-details" options={{ title: 'Job Details' }} />
          </>
        ) : (
          <Stack.Screen name="login" options={{ headerShown: false }} />
        )}
      </Stack>
    </PaperProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
