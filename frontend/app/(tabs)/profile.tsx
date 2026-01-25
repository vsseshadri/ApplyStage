import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Image, Alert, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { differenceInDays, format } from 'date-fns';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

// Product IDs for in-app purchases (for App Store Connect / Google Play Console)
const PRODUCT_ID_IOS = 'com.jobtracker.premium';
const PRODUCT_ID_ANDROID = 'com.jobtracker.premium';
const PRICE = '$2.99';

export default function ProfileScreen() {
  const { user, logout, sessionToken, refreshUser } = useAuth();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [weeklyEmail, setWeeklyEmail] = useState(user?.preferences?.weekly_email ?? true);
  const [monthlyEmail, setMonthlyEmail] = useState(user?.preferences?.monthly_email ?? true);
  const [isProcessingPurchase, setIsProcessingPurchase] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(user?.picture || null);

  // Handle photo upload
  const handlePhotoUpload = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Please grant permission to access your photos to upload a profile picture.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setProfilePhoto(imageUri);
        
        // In production, upload to backend
        // For now, just update local state
        Alert.alert('Photo Updated', 'Your profile photo has been updated.');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to upload photo. Please try again.');
    }
  };

  // Calculate trial info
  const getTrialInfo = () => {
    if (user?.payment_status === 'paid') {
      return { isPaid: true, daysLeft: 0, endDate: null };
    }
    
    if (user?.trial_end_date) {
      const endDate = new Date(user.trial_end_date);
      const daysLeft = differenceInDays(endDate, new Date());
      return { isPaid: false, daysLeft: Math.max(0, daysLeft), endDate };
    }
    
    return { isPaid: false, daysLeft: 7, endDate: null };
  };

  const trialInfo = getTrialInfo();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/');
          }
        }
      ]
    );
  };

  const handleUpgrade = async () => {
    if (isProcessingPurchase) return;

    // Show payment method selection - native IAP will be handled in production builds
    // For development/Expo Go, we use a simulated flow that updates the backend
    Alert.alert(
      `Buy Premium - ${PRICE}`,
      Platform.OS === 'web' 
        ? 'Native payments are only available in the mobile app. Please use the iOS or Android app to upgrade.'
        : 'Choose your payment method:',
      Platform.OS === 'web' 
        ? [{ text: 'OK' }]
        : [
            { text: 'Cancel', style: 'cancel' },
            {
              text: Platform.OS === 'ios' ? ' Apple Pay' : ' Google Pay',
              onPress: () => handlePayment(Platform.OS === 'ios' ? 'apple_pay' : 'google_pay')
            },
            {
              text: ' Credit Card',
              onPress: () => handlePayment('credit_card')
            }
          ]
    );
  };

  // Process payment - in production this would use react-native-iap
  // For Expo Go development, we simulate the payment flow
  const handlePayment = async (method: string) => {
    setIsProcessingPurchase(true);
    
    try {
      const methodName = method === 'apple_pay' ? 'Apple Pay' : method === 'google_pay' ? 'Google Pay' : 'Credit Card';
      
      Alert.alert(
        `Processing with ${methodName}`,
        'Please wait while we process your payment...',
        [
          {
            text: 'Confirm Payment',
            onPress: async () => {
              try {
                const productId = Platform.OS === 'ios' ? PRODUCT_ID_IOS : PRODUCT_ID_ANDROID;
                const response = await fetch(`${BACKEND_URL}/api/payment/verify`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${sessionToken}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    receipt: `receipt_${Platform.OS}_${Date.now()}`,
                    platform: Platform.OS,
                    product_id: productId,
                    payment_method: method
                  })
                });

                if (response.ok) {
                  await refreshUser();
                  Alert.alert('Success! 🎉', 'Premium unlocked! Enjoy unlimited job tracking.');
                } else {
                  Alert.alert('Error', 'Payment verification failed. Please try again.');
                }
              } catch (error) {
                console.error('Error processing payment:', error);
                Alert.alert('Error', 'Failed to process payment');
              } finally {
                setIsProcessingPurchase(false);
              }
            }
          },
          { 
            text: 'Cancel', 
            style: 'cancel',
            onPress: () => setIsProcessingPurchase(false)
          }
        ]
      );
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Error', 'Failed to initiate payment');
      setIsProcessingPurchase(false);
    }
  };

  const handleUpdatePreferences = async (weekly: boolean, monthly: boolean) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/preferences`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          weekly_email: weekly,
          monthly_email: monthly
        })
      });

      if (response.ok) {
        await refreshUser();
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
    }
  };

  const handleWeeklyEmailToggle = (value: boolean) => {
    setWeeklyEmail(value);
    handleUpdatePreferences(value, monthlyEmail);
  };

  const handleMonthlyEmailToggle = (value: boolean) => {
    setMonthlyEmail(value);
    handleUpdatePreferences(weeklyEmail, value);
  };

  const handleExportCSV = async () => {
    try {
      Alert.alert('Export CSV', 'Your job applications will be exported as a CSV file.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          onPress: async () => {
            // In a real app, this would download the file
            Alert.alert('Success', 'CSV export initiated. Check your downloads.');
          }
        }
      ]);
    } catch (error) {
      console.error('Error exporting CSV:', error);
    }
  };

  const dynamicStyles = createStyles(colors, isDark);

  // Format name: FirstName LASTNAME
  const formatName = () => {
    if (!user?.name) return 'User';
    const parts = user.name.trim().split(' ');
    if (parts.length === 1) return parts[0];
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ').toUpperCase();
    return `${firstName} ${lastName}`;
  };

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      <ScrollView style={dynamicStyles.scrollView} contentContainerStyle={dynamicStyles.scrollContent}>
        {/* Centered User Info Card */}
        <View style={dynamicStyles.userCard}>
          <TouchableOpacity style={dynamicStyles.avatarContainer} onPress={handlePhotoUpload} activeOpacity={0.8}>
            {profilePhoto ? (
              <Image source={{ uri: profilePhoto }} style={dynamicStyles.avatarCentered} />
            ) : (
              <View style={[dynamicStyles.avatarCentered, dynamicStyles.avatarPlaceholder]}>
                <Ionicons name="person" size={48} color="white" />
              </View>
            )}
            <View style={dynamicStyles.avatarEditBadge}>
              <Ionicons name="camera" size={14} color="white" />
            </View>
          </TouchableOpacity>
          <Text style={dynamicStyles.userNameCentered}>{formatName()}</Text>
          <Text style={dynamicStyles.userEmailCentered}>{user?.email}</Text>
          
          {/* Buy Button for Trial Users */}
          {!trialInfo.isPaid && (
            <TouchableOpacity 
              style={[dynamicStyles.buyButton, isProcessingPurchase && { opacity: 0.6 }]} 
              onPress={handleUpgrade}
              disabled={isProcessingPurchase}
            >
              <Text style={dynamicStyles.buyButtonText}>
                {isProcessingPurchase ? 'Processing...' : `Buy ${PRICE}`}
              </Text>
            </TouchableOpacity>
          )}
          
          {trialInfo.isPaid && (
            <View style={dynamicStyles.premiumBadge}>
              <Ionicons name="diamond" size={16} color="white" />
              <Text style={dynamicStyles.premiumBadgeText}>Premium</Text>
            </View>
          )}
        </View>

        {/* Notifications */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>Notifications</Text>
          <View style={dynamicStyles.card}>
            <View style={dynamicStyles.preferenceRow}>
              <View style={{ flex: 1 }}>
                <Text style={dynamicStyles.preferenceLabel}>Weekly Summary</Text>
                <Text style={dynamicStyles.preferenceDescription}>Every Sunday at 9:00 AM</Text>
              </View>
              <Switch
                value={weeklyEmail}
                onValueChange={handleWeeklyEmailToggle}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="white"
              />
            </View>
            <View style={dynamicStyles.divider} />
            <View style={dynamicStyles.preferenceRow}>
              <View style={{ flex: 1 }}>
                <Text style={dynamicStyles.preferenceLabel}>Monthly Summary</Text>
                <Text style={dynamicStyles.preferenceDescription}>Last day of month at 9:00 AM</Text>
              </View>
              <Switch
                value={monthlyEmail}
                onValueChange={handleMonthlyEmailToggle}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="white"
              />
            </View>
          </View>
        </View>

        {/* Data Management */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>Data</Text>
          <View style={dynamicStyles.card}>
            <TouchableOpacity style={dynamicStyles.menuRow} onPress={handleExportCSV}>
              <View style={dynamicStyles.menuIcon}>
                <Ionicons name="download-outline" size={22} color={colors.primary} />
              </View>
              <View style={dynamicStyles.menuContent}>
                <Text style={dynamicStyles.menuLabel}>Export to CSV</Text>
                <Text style={dynamicStyles.menuDescription}>Download all your job applications</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* App Info */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>About</Text>
          <View style={dynamicStyles.card}>
            <View style={dynamicStyles.infoRow}>
              <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
              <View style={dynamicStyles.infoText}>
                <Text style={dynamicStyles.infoLabel}>Version</Text>
                <Text style={dynamicStyles.infoValue}>1.0.0</Text>
              </View>
            </View>
            <View style={dynamicStyles.divider} />
            <View style={dynamicStyles.infoRow}>
              <Ionicons name="help-circle-outline" size={20} color={colors.textSecondary} />
              <View style={dynamicStyles.infoText}>
                <Text style={dynamicStyles.infoLabel}>Support</Text>
                <Text style={dynamicStyles.infoValue}>support@jobtracker.com</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={dynamicStyles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={dynamicStyles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
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
  userCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 16,
  },
  avatarCentered: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  userNameCentered: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  userEmail: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  userEmailCentered: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  buyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 16,
  },
  buyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
    gap: 6,
  },
  premiumBadgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
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
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
    gap: 6,
  },
  paidBadge: {
    backgroundColor: '#10B981',
  },
  trialBadge: {
    backgroundColor: '#F59E0B',
  },
  badgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  cardLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  trialEndDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  upgradeButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  upgradeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  preferenceLabel: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 4,
  },
  preferenceDescription: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 2,
  },
  menuDescription: {
    fontSize: 13,
    color: colors.textSecondary,
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
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#EF4444',
    gap: 8,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
});
