import React from 'react';
import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { FilterProvider } from '../contexts/FilterContext';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FilterProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </FilterProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
