import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';

export default function LoginScreen() {
  const { user, loading, login, loginWithApple } = useAuth();
  const router = useRouter();
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);

  useEffect(() => {
    checkAppleAvailability();
  }, []);

  useEffect(() => {
    if (!loading && user) {
      router.replace('/(tabs)/dashboard');
    }
  }, [user, loading]);

  const checkAppleAvailability = async () => {
    if (Platform.OS === 'ios') {
      const available = await AppleAuthentication.isAvailableAsync();
      setIsAppleAvailable(available);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="briefcase" size={80} color="#007AFF" />
        <Text style={styles.title}>Job Applications Tracker</Text>
        <Text style={styles.subtitle}>Track your job applications with ease</Text>
        
        <View style={styles.features}>
          <View style={styles.feature}>
            <Ionicons name="stats-chart" size={24} color="#007AFF" />
            <Text style={styles.featureText}>Dashboard Analytics</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="list" size={24} color="#007AFF" />
            <Text style={styles.featureText}>Track Applications</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="notifications" size={24} color="#007AFF" />
            <Text style={styles.featureText}>Set Reminders</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="shield-checkmark" size={24} color="#007AFF" />
            <Text style={styles.featureText}>Face ID / Biometric Login</Text>
          </View>
        </View>

        {/* Google Sign In */}
        <TouchableOpacity style={styles.googleButton} onPress={login}>
          <Ionicons name="logo-google" size={24} color="white" style={styles.buttonIcon} />
          <Text style={styles.buttonText}>Sign in with Google</Text>
        </TouchableOpacity>

        {/* Apple Sign In - Only show on iOS */}
        {isAppleAvailable && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={12}
            style={styles.appleButton}
            onPress={loginWithApple}
          />
        )}

        {/* Show Apple button placeholder for non-iOS (won't work but shows UI) */}
        {Platform.OS !== 'ios' && (
          <TouchableOpacity style={styles.appleButtonFallback} onPress={() => Alert.alert('Apple Sign-In', 'Apple Sign-In is only available on iOS devices.')}>
            <Ionicons name="logo-apple" size={24} color="white" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Sign in with Apple</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.trialText}>Start with a 7-day free trial</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginTop: 24,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  features: {
    width: '100%',
    marginTop: 40,
    marginBottom: 32,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 16,
  },
  googleButton: {
    flexDirection: 'row',
    backgroundColor: '#4285F4',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    marginBottom: 12,
  },
  buttonIcon: {
    marginRight: 12,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  appleButton: {
    width: '100%',
    height: 54,
  },
  appleButtonFallback: {
    flexDirection: 'row',
    backgroundColor: '#000',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  trialText: {
    marginTop: 20,
    fontSize: 14,
    color: '#666',
  },
});
