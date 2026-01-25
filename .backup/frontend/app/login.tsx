import React from 'react';
import { View, StyleSheet, Image, Dimensions } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { useAuth } from './contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const theme = useTheme();
  const { login } = useAuth();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        {/* App Logo/Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="briefcase" size={80} color="#3B82F6" />
        </View>

        {/* App Name */}
        <Text variant="displayMedium" style={styles.appName}>
          Job Journey
        </Text>
        <Text variant="titleMedium" style={[styles.tagline, { color: theme.colors.onSurfaceVariant }]}>
          Track your job applications with ease
        </Text>

        {/* Features */}
        <View style={styles.features}>
          <View style={styles.feature}>
            <Ionicons name="stats-chart" size={24} color="#3B82F6" />
            <Text variant="bodyLarge" style={styles.featureText}>
              Rich dashboard with analytics
            </Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="bulb" size={24} color="#F59E0B" />
            <Text variant="bodyLarge" style={styles.featureText}>
              AI-powered job categorization
            </Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="notifications" size={24} color="#10B981" />
            <Text variant="bodyLarge" style={styles.featureText}>
              Weekly & monthly summaries
            </Text>
          </View>
        </View>

        {/* Login Button */}
        <Button
          mode="contained"
          onPress={login}
          style={styles.loginButton}
          contentStyle={styles.loginButtonContent}
          labelStyle={styles.loginButtonLabel}
          icon={() => <Ionicons name="logo-google" size={20} color="#FFF" />}
        >
          Continue with Google
        </Button>

        <Text variant="bodySmall" style={[styles.disclaimer, { color: theme.colors.onSurfaceVariant }]}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: width > 768 ? 400 : width - 64,
    alignItems: 'center',
    padding: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#3B82F6' + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  appName: {
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  tagline: {
    marginBottom: 48,
    textAlign: 'center',
  },
  features: {
    width: '100%',
    marginBottom: 48,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureText: {
    marginLeft: 16,
    flex: 1,
  },
  loginButton: {
    width: '100%',
    marginBottom: 16,
  },
  loginButtonContent: {
    height: 56,
  },
  loginButtonLabel: {
    fontSize: 16,
  },
  disclaimer: {
    textAlign: 'center',
    fontSize: 12,
  },
});
