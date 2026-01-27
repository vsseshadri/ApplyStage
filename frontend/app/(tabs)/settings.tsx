import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Image, Alert, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function SettingsScreen() {
  const { theme, setTheme, colors, isDark } = useTheme();
  const { user, logout, sessionToken, biometricEnabled, biometricAvailable, enableBiometric, disableBiometric, refreshUser } = useAuth();
  const router = useRouter();
  
  // Profile state
  const [profilePhoto, setProfilePhoto] = useState(user?.picture || null);
  const [preferredName, setPreferredName] = useState(user?.preferred_display_name || '');
  const [isEditingName, setIsEditingName] = useState(!user?.preferred_display_name); // Start in edit mode if no name set
  const [weeklyEmail, setWeeklyEmail] = useState(user?.preferences?.weekly_email ?? true);
  const [monthlyEmail, setMonthlyEmail] = useState(user?.preferences?.monthly_email ?? true);
  
  // Settings state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Biometrics');

  React.useEffect(() => {
    checkBiometricType();
  }, []);

  // Update editing state when user data loads
  React.useEffect(() => {
    if (user?.preferred_display_name) {
      setPreferredName(user.preferred_display_name);
      setIsEditingName(false);
    } else {
      setIsEditingName(true);
    }
  }, [user?.preferred_display_name]);

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

  const handlePhotoUpload = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Please grant permission to access your photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setProfilePhoto(imageUri);
        Alert.alert('Success', 'Profile photo updated.');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to upload photo.');
    }
  };

  const handleWeeklyEmailToggle = async (value: boolean) => {
    setWeeklyEmail(value);
    // TODO: Update backend
    try {
      await fetch(`${BACKEND_URL}/api/preferences`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ weekly_email: value, monthly_email: monthlyEmail }),
      });
    } catch (error) {
      console.error('Error updating preference:', error);
    }
  };

  const handleMonthlyEmailToggle = async (value: boolean) => {
    setMonthlyEmail(value);
    // TODO: Update backend
    try {
      await fetch(`${BACKEND_URL}/api/preferences`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ weekly_email: weeklyEmail, monthly_email: value }),
      });
    } catch (error) {
      console.error('Error updating preference:', error);
    }
  };

  const handlePreferredNameChange = async (name: string) => {
    setPreferredName(name);
  };

  const handlePreferredNameSave = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/user/display-name`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preferred_display_name: preferredName.trim() }),
      });
      
      if (response.ok) {
        await refreshUser();
        setIsEditingName(false); // Switch to view mode after save
      } else {
        Alert.alert('Error', 'Failed to update display name.');
      }
    } catch (error) {
      console.error('Error updating display name:', error);
      Alert.alert('Error', 'Failed to update display name.');
    }
  };

  const handleEditName = () => {
    setIsEditingName(true);
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
          { text: 'Disable', style: 'destructive', onPress: async () => await disableBiometric() }
        ]
      );
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: async () => {
          await logout();
          router.replace('/');
        }}
      ]
    );
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
    scrollContent: {
      padding: 16,
    },
    
    // Profile Section
    profileSection: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 20,
      alignItems: 'center',
      marginBottom: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    profilePhotoContainer: {
      position: 'relative',
      marginBottom: 16,
    },
    profilePhoto: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.inputBackground,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: colors.primary,
    },
    profilePhotoPlaceholder: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.inputBackground,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: colors.primary,
    },
    editPhotoButton: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: colors.primary,
      borderRadius: 16,
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.card,
    },
    userEmail: {
      fontSize: 16,
      color: colors.text,
      marginBottom: 20,
      textAlign: 'center',
    },
    displayNameContainer: {
      width: '100%',
      marginBottom: 16,
    },
    displayNameLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    displayNameInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    displayNameViewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    displayNameValue: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
    displayNameInput: {
      flex: 1,
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    saveButtonText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '600',
    },
    editButton: {
      backgroundColor: colors.primary + '15',
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    editButtonText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '600',
    },
    notificationPrefsLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
      alignSelf: 'flex-start',
      width: '100%',
    },
    notificationRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      paddingVertical: 8,
    },
    notificationLabel: {
      fontSize: 15,
      color: colors.text,
    },
    notificationSubtext: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },

    // Section styling
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
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    themeButtonText: {
      marginTop: 8,
      fontSize: 14,
      color: colors.text,
    },
    themeButtonTextActive: {
      color: '#fff',
      fontWeight: '600',
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
    },
    settingLabel: {
      fontSize: 15,
      color: colors.text,
    },
    logoutButton: {
      backgroundColor: colors.error || '#EF4444',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 20,
    },
    logoutButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Page Title */}
        <View style={styles.pageTitleRow}>
          <Text style={styles.pageTitle}>Settings</Text>
        </View>
        
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={handlePhotoUpload} style={styles.profilePhotoContainer}>
            {profilePhoto ? (
              <Image source={{ uri: profilePhoto }} style={styles.profilePhoto} />
            ) : (
              <View style={styles.profilePhotoPlaceholder}>
                <Ionicons name="person" size={50} color={colors.textSecondary} />
              </View>
            )}
            <View style={styles.editPhotoButton}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          
          <Text style={styles.userEmail}>{user?.email || 'user@example.com'}</Text>
          
          {/* Preferred Display Name */}
          <View style={styles.displayNameContainer}>
            <Text style={styles.displayNameLabel}>Preferred Display Name</Text>
            {isEditingName ? (
              <View style={styles.displayNameInputRow}>
                <TextInput
                  style={styles.displayNameInput}
                  value={preferredName}
                  onChangeText={handlePreferredNameChange}
                  placeholder="Enter your preferred name"
                  placeholderTextColor={colors.textSecondary}
                />
                <TouchableOpacity style={styles.saveButton} onPress={handlePreferredNameSave}>
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.displayNameViewRow}>
                <Text style={styles.displayNameValue}>
                  {preferredName || 'No Input'}
                </Text>
                <TouchableOpacity style={styles.editButton} onPress={handleEditName}>
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          
          <Text style={styles.notificationPrefsLabel}>Email Summary Preferences</Text>
          
          <View style={styles.notificationRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.notificationLabel}>Weekly Summary</Text>
              <Text style={styles.notificationSubtext}>Every Sunday at 1 AM</Text>
            </View>
            <Switch
              value={weeklyEmail}
              onValueChange={handleWeeklyEmailToggle}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
          
          <View style={styles.notificationRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.notificationLabel}>Monthly Summary</Text>
              <Text style={styles.notificationSubtext}>Last day of month at 9 AM</Text>
            </View>
            <Switch
              value={monthlyEmail}
              onValueChange={handleMonthlyEmailToggle}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Theme</Text>
            <View style={styles.themeOptions}>
              <TouchableOpacity
                style={[styles.themeButton, theme === 'light' && styles.themeButtonActive]}
                onPress={() => handleThemeChange('light')}
              >
                <Ionicons 
                  name="sunny" 
                  size={24} 
                  color={theme === 'light' ? '#fff' : colors.text} 
                />
                <Text style={[styles.themeButtonText, theme === 'light' && styles.themeButtonTextActive]}>
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
                  color={theme === 'dark' ? '#fff' : colors.text} 
                />
                <Text style={[styles.themeButtonText, theme === 'dark' && styles.themeButtonTextActive]}>
                  Dark
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.themeButton, theme === 'auto' && styles.themeButtonActive]}
                onPress={() => handleThemeChange('auto')}
              >
                <Ionicons 
                  name="phone-portrait" 
                  size={24} 
                  color={theme === 'auto' ? '#fff' : colors.text} 
                />
                <Text style={[styles.themeButtonText, theme === 'auto' && styles.themeButtonTextActive]}>
                  Auto
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <View style={styles.card}>
            {biometricAvailable && (
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>{biometricType} Login</Text>
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleBiometricToggle}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
            )}
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
