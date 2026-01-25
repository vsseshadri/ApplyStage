import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import * as LocalAuthentication from 'expo-local-authentication';

export default function SettingsScreen() {
  const { theme, setTheme, colors, isDark } = useTheme();
  const { biometricEnabled, biometricAvailable, enableBiometric, disableBiometric } = useAuth();
  const [twoFactorEnabled, setTwoFactorEnabled] = React.useState(false);
  const [biometricType, setBiometricType] = React.useState<string>('Biometrics');

  React.useEffect(() => {
    checkBiometricType();
  }, []);

  const checkBiometricType = async () => {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType('Face ID');
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType('Fingerprint');
      } else {
        setBiometricType('Biometrics');
      }
    } catch (error) {
      console.error('Error checking biometric type:', error);
    }
  };

  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'auto') => {
    await setTheme(newTheme);
  };

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      await enableBiometric();
    } else {
      Alert.alert(
        `Disable ${biometricType}`,
        `Are you sure you want to disable ${biometricType} login?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              await disableBiometric();
            }
          }
        ]
      );
    }
  };

  const handleTwoFactorToggle = (value: boolean) => {
    if (value) {
      Alert.alert(
        'Enable 2FA',
        'Two-factor authentication adds an extra layer of security to your account.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enable',
            onPress: () => {
              setTwoFactorEnabled(true);
              Alert.alert('Success', '2FA has been enabled for your account');
            }
          }
        ]
      );
    } else {
      Alert.alert(
        'Disable 2FA',
        'Are you sure you want to disable two-factor authentication?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: () => {
              setTwoFactorEnabled(false);
              Alert.alert('Disabled', '2FA has been disabled');
            }
          }
        ]
      );
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      backgroundColor: colors.headerBackground,
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.headerText,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    cardLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    themeOptions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    themeButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      marginHorizontal: 4,
    },
    themeButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    themeText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 8,
    },
    themeTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    settingInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    settingLabel: {
      fontSize: 16,
      color: colors.text,
      fontWeight: '500',
    },
    settingDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 12,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
    },
    infoText: {
      marginLeft: 12,
      flex: 1,
    },
    infoLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    infoValue: {
      fontSize: 14,
      color: colors.text,
    },
    unavailableText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontStyle: 'italic',
      marginTop: 4,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Theme Mode</Text>
            <View style={styles.themeOptions}>
              <TouchableOpacity
                style={[styles.themeButton, theme === 'light' && styles.themeButtonActive]}
                onPress={() => handleThemeChange('light')}
              >
                <Ionicons 
                  name="sunny" 
                  size={24} 
                  color={theme === 'light' ? colors.primary : colors.textSecondary} 
                />
                <Text style={[styles.themeText, theme === 'light' && styles.themeTextActive]}>
                  Light
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.themeButton, theme === 'dark' && styles.themeButtonActive]}
                onPress={() => handleThemeChange('dark')}
              >
                <Ionicons 
                  name="moon" 
                  size={24} 
                  color={theme === 'dark' ? colors.primary : colors.textSecondary} 
                />
                <Text style={[styles.themeText, theme === 'dark' && styles.themeTextActive]}>
                  Dark
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.themeButton, theme === 'auto' && styles.themeButtonActive]}
                onPress={() => handleThemeChange('auto')}
              >
                <Ionicons 
                  name="contrast" 
                  size={24} 
                  color={theme === 'auto' ? colors.primary : colors.textSecondary} 
                />
                <Text style={[styles.themeText, theme === 'auto' && styles.themeTextActive]}>
                  Auto
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <View style={styles.card}>
            {/* Biometric Login Setting */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.iconContainer}>
                  <Ionicons 
                    name={Platform.OS === 'ios' ? 'scan' : 'finger-print'} 
                    size={22} 
                    color={colors.primary} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>{biometricType} Login</Text>
                  <Text style={styles.settingDescription}>
                    Quick login using {biometricType.toLowerCase()}
                  </Text>
                  {!biometricAvailable && (
                    <Text style={styles.unavailableText}>
                      {biometricType} not available on this device
                    </Text>
                  )}
                </View>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleBiometricToggle}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="white"
                disabled={!biometricAvailable}
              />
            </View>

            <View style={styles.divider} />

            {/* Two-Factor Authentication */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.iconContainer}>
                  <Ionicons name="shield-checkmark" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>Two-Factor Authentication</Text>
                  <Text style={styles.settingDescription}>
                    Add an extra layer of security
                  </Text>
                </View>
              </View>
              <Switch
                value={twoFactorEnabled}
                onValueChange={handleTwoFactorToggle}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="white"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>App Version</Text>
                <Text style={styles.infoValue}>1.0.0</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
