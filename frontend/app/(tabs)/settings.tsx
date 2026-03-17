import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Image, Alert, TextInput, Linking, Modal, FlatList, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import Constants from 'expo-constants';
import { COUNTRIES } from '../../utils/countries';

// Get backend URL from configuration
const getBackendUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (envUrl) return envUrl;
  const configUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL;
  if (configUrl) return configUrl;
  return 'https://career-topics.emergent.host';
};
const BACKEND_URL = getBackendUrl();

// ─── Liquid Glass Theme Toggle ───────────────────────────────
const THEME_OPTIONS = [
  { key: 'light' as const, label: 'Light', icon: 'sunny' },
  { key: 'dark' as const, label: 'Dark', icon: 'moon' },
  { key: 'auto' as const, label: 'Auto', icon: 'phone-portrait' },
];

const TOGGLE_HEIGHT = 44;
const TOGGLE_RADIUS = 22;
const CAPSULE_INSET = 3;

function GlassThemeToggle({
  theme,
  onThemeChange,
  isDark,
  colors,
}: {
  theme: string;
  onThemeChange: (t: 'light' | 'dark' | 'auto') => void;
  isDark: boolean;
  colors: any;
}) {
  const activeIndex = THEME_OPTIONS.findIndex((o) => o.key === theme);
  const capsuleX = useSharedValue(0);
  const capsuleScaleX = useSharedValue(1);

  // Calculate option width based on container
  const TOGGLE_WIDTH = Dimensions.get('window').width * 0.65;
  const OPTION_WIDTH = (TOGGLE_WIDTH - CAPSULE_INSET * 2) / THEME_OPTIONS.length;

  useEffect(() => {
    if (activeIndex < 0) return;
    const targetX = CAPSULE_INSET + activeIndex * OPTION_WIDTH;
    capsuleScaleX.value = withSequence(
      withTiming(1.08, { duration: 70, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 18, stiffness: 200, mass: 0.7 }),
    );
    capsuleX.value = withSpring(targetX, {
      damping: 20,
      stiffness: 200,
      mass: 0.8,
    });
  }, [activeIndex, OPTION_WIDTH]);

  const capsuleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: capsuleX.value },
      { scaleX: capsuleScaleX.value },
    ],
  }));

  const glassBg = isDark
    ? 'rgba(255, 255, 255, 0.08)'
    : 'rgba(0, 0, 0, 0.06)';

  const glassBorder = isDark
    ? 'rgba(255, 255, 255, 0.12)'
    : 'rgba(0, 0, 0, 0.08)';

  const capsuleBg = isDark
    ? 'rgba(255, 255, 255, 0.16)'
    : 'rgba(255, 255, 255, 0.95)';

  const capsuleShadow = isDark ? 0 : 0.1;

  return (
    <View style={{ alignItems: 'center', marginTop: 8 }}>
      <View
        style={{
          width: TOGGLE_WIDTH,
          height: TOGGLE_HEIGHT,
          borderRadius: TOGGLE_RADIUS,
          overflow: 'hidden',
          borderWidth: 0.5,
          borderColor: glassBorder,
          backgroundColor: glassBg,
        }}
      >
        {/* Blur backdrop */}
        {Platform.OS !== 'web' ? (
          <BlurView
            intensity={isDark ? 30 : 50}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: isDark
                  ? 'rgba(40, 40, 44, 0.9)'
                  : 'rgba(240, 240, 244, 0.9)',
              },
            ]}
          />
        )}

        {/* Sliding capsule */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: CAPSULE_INSET,
              bottom: CAPSULE_INSET,
              width: OPTION_WIDTH,
              borderRadius: TOGGLE_RADIUS - CAPSULE_INSET,
              zIndex: 0,
              ...Platform.select({
                ios: {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: capsuleShadow,
                  shadowRadius: 6,
                },
                android: { elevation: isDark ? 0 : 3 },
                web: {
                  boxShadow: isDark
                    ? 'none'
                    : '0px 2px 6px rgba(0,0,0,0.1)',
                },
              } as any),
            },
            capsuleStyle,
          ]}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: capsuleBg,
              borderRadius: TOGGLE_RADIUS - CAPSULE_INSET,
            }}
          />
        </Animated.View>

        {/* Options */}
        <View style={{ flex: 1, flexDirection: 'row', zIndex: 1 }}>
          {THEME_OPTIONS.map((opt) => {
            const isActive = opt.key === theme;
            const iconColor = isActive
              ? colors.primary
              : isDark
                ? 'rgba(255,255,255,0.5)'
                : 'rgba(60,60,67,0.5)';
            const textColor = isActive
              ? colors.text
              : isDark
                ? 'rgba(255,255,255,0.5)'
                : 'rgba(60,60,67,0.5)';

            return (
              <TouchableOpacity
                key={opt.key}
                activeOpacity={0.7}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  onThemeChange(opt.key);
                }}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                }}
              >
                <Ionicons name={opt.icon as any} size={16} color={iconColor} />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? '600' : '500',
                    color: textColor,
                  }}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const { theme, setTheme, colors, isDark } = useTheme();
  const { user, logout, sessionToken, biometricEnabled, biometricAvailable, enableBiometric, disableBiometric, refreshUser } = useAuth();
  const router = useRouter();
  
  // Profile state
  const [profilePhoto, setProfilePhoto] = useState(user?.picture || null);
  const [preferredName, setPreferredName] = useState(user?.preferred_display_name || '');
  const [isEditingName, setIsEditingName] = useState(!user?.preferred_display_name); // Start in edit mode if no name set
  // Domicile Country state
  const [domicileCountry, setDomicileCountry] = useState(user?.domicile_country || '');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  
  // Settings state
  const [biometricType, setBiometricType] = useState<string>('Biometrics');
  
  // Target Goals state
  const [weeklyTarget, setWeeklyTarget] = useState<string>('10');
  const [savingTargets, setSavingTargets] = useState(false);
  const [isEditingTargets, setIsEditingTargets] = useState(true); // Start in edit mode until goals are fetched
  
  // Auto-calculate monthly target from weekly (weekly * 4.33 rounded)
  const monthlyTarget = Math.round((parseInt(weeklyTarget) || 0) * 4.33).toString();

  React.useEffect(() => {
    checkBiometricType();
    fetchTargetGoals();
  }, []);

  // Fetch target goals from backend (via dashboard stats which includes target_progress)
  const fetchTargetGoals = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/dashboard/stats`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.target_progress) {
          setWeeklyTarget(data.target_progress.weekly.target?.toString() || '10');
          // Monthly is auto-calculated, no need to set it
          setIsEditingTargets(false); // Show in view mode after fetching
        }
      }
    } catch (error) {
      console.log('Error fetching target goals:', error);
    }
  };

  // Save target goals to backend
  const saveTargetGoals = async () => {
    setSavingTargets(true);
    try {
      const weeklyVal = parseInt(weeklyTarget) || 10;
      const monthlyVal = Math.round(weeklyVal * 4.33); // Auto-calculate monthly
      
      const response = await fetch(
        `${BACKEND_URL}/api/user/target-goals`, 
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            weekly_target: weeklyVal,
            monthly_target: monthlyVal
          })
        }
      );
      if (response.ok) {
        setIsEditingTargets(false); // Switch to view mode after successful save
      } else {
        Alert.alert('Error', 'Failed to save target goals');
      }
    } catch (error) {
      console.log('Error saving target goals:', error);
      Alert.alert('Error', 'Failed to save target goals');
    } finally {
      setSavingTargets(false);
    }
  };

  // Update editing state when user data loads
  React.useEffect(() => {
    if (user?.preferred_display_name) {
      setPreferredName(user.preferred_display_name);
      setIsEditingName(false);
    } else {
      setIsEditingName(true);
    }
  }, [user?.preferred_display_name]);

  // Update domicile country when user loads
  React.useEffect(() => {
    if (user?.domicile_country) {
      setDomicileCountry(user.domicile_country);
    }
  }, [user?.domicile_country]);

  // Filtered countries for search
  const filteredCountries = COUNTRIES.filter(country =>
    country.toLowerCase().includes(countrySearch.toLowerCase())
  );

  // Handle domicile country selection
  const handleDomicileCountrySelect = async (country: string) => {
    setDomicileCountry(country);
    setShowCountryDropdown(false);
    setCountrySearch('');
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/user/domicile-country`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domicile_country: country }),
      });
      
      if (response.ok) {
        await refreshUser();
      } else {
        Alert.alert('Error', 'Failed to update domicile country.');
      }
    } catch (error) {
      console.error('Error updating domicile country:', error);
      Alert.alert('Error', 'Failed to update domicile country.');
    }
  };

  // Open Help and Feedback email
  const handleHelpAndFeedback = async () => {
    const emailUrl = 'mailto:careerflowfeedback@gmail.com?subject=CareerFlow%20Feedback';
    
    try {
      const canOpen = await Linking.canOpenURL(emailUrl);
      if (canOpen) {
        await Linking.openURL(emailUrl);
      } else {
        Alert.alert('Error', 'Unable to open email app. Please email us at careerflowfeedback@gmail.com');
      }
    } catch (error) {
      console.error('Error opening email:', error);
      Alert.alert('Error', 'Unable to open email app. Please email us at careerflowfeedback@gmail.com');
    }
  };

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
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: async () => {
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
    pageTitleRow: {
      paddingBottom: 12,
    },
    pageTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 120,
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
    },
    displayNameLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
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
      paddingHorizontal: 4,
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
    
    // Target Goals styles
    targetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    targetHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    targetSectionLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    targetInputContainer: {
      flex: 1,
      alignItems: 'center',
    },
    targetLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    targetInput: {
      width: '100%',
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    targetValueDisplay: {
      width: '100%',
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 18,
      fontWeight: '700',
      color: colors.textSecondary,
      textAlign: 'center',
    },
    targetUnit: {
      fontSize: 10,
      color: colors.textSecondary,
      marginTop: 4,
    },
    targetActionText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
      paddingVertical: 6,
      paddingHorizontal: 4,
    },
    
    // Email field styles
    emailFieldContainer: {
      width: '100%',
      marginBottom: 16,
    },
    emailFieldLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    emailInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    emailInput: {
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
    emailInputError: {
      borderColor: '#EF4444',
    },
    emailDisplayRow: {
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
    emailDisplayValue: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
    saveEmailButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    saveEmailButtonText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '600',
    },
    cancelEmailButton: {
      backgroundColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    cancelEmailButtonText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
    },
    emailErrorText: {
      color: '#EF4444',
      fontSize: 12,
      marginTop: 4,
    },
    summaryActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    sendNowButton: {
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      minWidth: 80,
      alignItems: 'center',
    },
    sendNowButtonText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '600',
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
    signOutButton: {
      padding: 4,
      alignItems: 'center',
    },
    signOutButtonText: {
      color: '#FF3B30',
      fontSize: 17,
      fontWeight: '400',
    },
    // Country dropdown styles
    countryDropdownButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderRadius: 10,
      margin: 16,
      paddingHorizontal: 12,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      padding: 12,
      fontSize: 16,
      color: colors.text,
    },
    countryItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      paddingHorizontal: 20,
    },
    countryItemSelected: {
      backgroundColor: colors.primary + '15',
    },
    countryItemText: {
      fontSize: 16,
      color: colors.text,
    },
    countryItemTextSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
    countrySeparator: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: 16,
    },
    emptyContainer: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    feedbackRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
    },
    feedbackLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    feedbackText: {
      fontSize: 16,
      color: colors.text,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
          
          {/* Preferences Label */}
          <Text style={styles.notificationPrefsLabel}>Preferences</Text>
          
          {/* Preferred Display Name - Edit button INSIDE card */}
          <View style={styles.displayNameContainer}>
            <View style={styles.displayNameLabelRow}>
              <Text style={styles.displayNameLabel}>Preferred Display Name</Text>
              {!isEditingName && (
                <TouchableOpacity style={styles.editButton} onPress={handleEditName}>
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>
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
              </View>
            )}
          </View>
          
          {/* Domicile Country */}
          <View style={styles.displayNameContainer}>
            <Text style={styles.displayNameLabel}>Domicile Country</Text>
            <TouchableOpacity
              style={styles.countryDropdownButton}
              onPress={() => setShowCountryDropdown(true)}
            >
              <Text style={[styles.displayNameValue, !domicileCountry && { color: colors.textSecondary }]}>
                {domicileCountry || 'Select your country'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Target Goals Section - Edit button INSIDE card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Application Targets</Text>
          <View style={styles.card}>
            <View style={styles.targetHeaderRow}>
              <Text style={styles.targetSectionLabel}>Weekly & Monthly Goals</Text>
              <TouchableOpacity 
                style={styles.editButton}
                onPress={isEditingTargets ? saveTargetGoals : () => setIsEditingTargets(true)}
                disabled={savingTargets}
              >
                <Text style={[styles.editButtonText, savingTargets && { opacity: 0.5 }]}>
                  {savingTargets ? 'Saving...' : (isEditingTargets ? 'Save' : 'Edit')}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.targetRow}>
              <View style={styles.targetInputContainer}>
                <Text style={styles.targetLabel}>Weekly</Text>
                {isEditingTargets ? (
                  <TextInput
                    style={styles.targetInput}
                    value={weeklyTarget}
                    onChangeText={setWeeklyTarget}
                    keyboardType="number-pad"
                    placeholder="10"
                    placeholderTextColor={colors.textSecondary}
                  />
                ) : (
                  <Text style={styles.targetValueDisplay}>{weeklyTarget}</Text>
                )}
                <Text style={styles.targetUnit}>apps/week</Text>
              </View>
              
              <View style={styles.targetInputContainer}>
                <Text style={styles.targetLabel}>Monthly</Text>
                {/* Monthly is always read-only - auto-calculated from weekly */}
                <Text style={[styles.targetValueDisplay, { color: colors.textSecondary }]}>{monthlyTarget}</Text>
                <Text style={styles.targetUnit}>auto-calculated</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Theme</Text>
            <GlassThemeToggle
              theme={theme}
              onThemeChange={handleThemeChange}
              isDark={isDark}
              colors={colors}
            />
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

        {/* Help and Feedback Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.feedbackRow} onPress={handleHelpAndFeedback}>
              <View style={styles.feedbackLeft}>
                <Ionicons name="mail-outline" size={22} color={colors.primary} />
                <Text style={styles.feedbackText}>Help and Feedback</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out Button - Apple-style with red text on card */}
        <View style={styles.section}>
          <View style={styles.card}>
            <TouchableOpacity style={styles.signOutButton} onPress={handleLogout}>
              <Text style={styles.signOutButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Country Selection Modal */}
      <Modal
        visible={showCountryDropdown}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Country</Text>
            <TouchableOpacity onPress={() => {
              setShowCountryDropdown(false);
              setCountrySearch('');
            }}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search countries..."
              placeholderTextColor={colors.textSecondary}
              value={countrySearch}
              onChangeText={setCountrySearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {countrySearch.length > 0 && (
              <TouchableOpacity onPress={() => setCountrySearch('')}>
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.countryItem,
                  domicileCountry === item && styles.countryItemSelected
                ]}
                onPress={() => handleDomicileCountrySelect(item)}
              >
                <Text style={[
                  styles.countryItemText,
                  domicileCountry === item && styles.countryItemTextSelected
                ]}>
                  {item}
                </Text>
                {domicileCountry === item && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.countrySeparator} />}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No countries found</Text>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
