import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { Text, List, Switch, useTheme, Button, Divider, Avatar } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { useThemeStore } from '../stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

// Storage adapter for web vs native
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  },
};

export default function SettingsScreen() {
  const theme = useTheme();
  const { user, logout } = useAuth();
  const { mode, setMode } = useThemeStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(user?.preferences?.notifications ?? true);
  const [weeklyEmail, setWeeklyEmail] = useState(user?.preferences?.emailSummary?.weekly ?? true);
  const [monthlyEmail, setMonthlyEmail] = useState(user?.preferences?.emailSummary?.monthly ?? true);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: logout, style: 'destructive' },
    ]);
  };

  const handleExportCSV = async () => {
    try {
      const token = await storage.getItem('session_token');
      const url = `${API_URL}/api/jobs/export/csv`;
      
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        await Linking.openURL(url);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export CSV');
    }
  };

  const subscriptionType = user?.subscription?.type || 'free';
  const isSubscribed = subscriptionType === 'premium';

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Profile Section */}
      <View style={[styles.profileSection, { backgroundColor: theme.colors.elevation.level1 }]}>
        <Avatar.Image
          size={80}
          source={user?.picture ? { uri: user.picture } : require('../../assets/images/icon.png')}
        />
        <Text variant="headlineSmall" style={styles.userName}>
          {user?.name}
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {user?.email}
        </Text>
        {isSubscribed && (
          <View style={[styles.premiumBadge, { backgroundColor: '#F59E0B' }]}>
            <Ionicons name="star" size={16} color="#FFF" />
            <Text variant="bodySmall" style={{ color: '#FFF', marginLeft: 4, fontWeight: 'bold' }}>
              PREMIUM
            </Text>
          </View>
        )}
      </View>

      {/* Appearance */}
      <List.Section>
        <List.Subheader>Appearance</List.Subheader>
        <List.Item
          title="Light Mode"
          left={(props) => <List.Icon {...props} icon="white-balance-sunny" />}
          right={() => <Switch value={mode === 'light'} onValueChange={() => setMode('light')} />}
        />
        <List.Item
          title="Dark Mode"
          left={(props) => <List.Icon {...props} icon="moon-waning-crescent" />}
          right={() => <Switch value={mode === 'dark'} onValueChange={() => setMode('dark')} />}
        />
        <List.Item
          title="Auto (System)"
          left={(props) => <List.Icon {...props} icon="theme-light-dark" />}
          right={() => <Switch value={mode === 'auto'} onValueChange={() => setMode('auto')} />}
        />
      </List.Section>

      <Divider />

      {/* Notifications */}
      <List.Section>
        <List.Subheader>Notifications</List.Subheader>
        <List.Item
          title="Push Notifications"
          description="Get notified about application updates"
          left={(props) => <List.Icon {...props} icon="bell" />}
          right={() => (
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
            />
          )}
        />
        <List.Item
          title="Weekly Email Summary"
          description="Every Sunday at 1 AM"
          left={(props) => <List.Icon {...props} icon="email" />}
          right={() => <Switch value={weeklyEmail} onValueChange={setWeeklyEmail} />}
        />
        <List.Item
          title="Monthly Email Summary"
          description="Last day of month at 9 AM"
          left={(props) => <List.Icon {...props} icon="email-multiple" />}
          right={() => <Switch value={monthlyEmail} onValueChange={setMonthlyEmail} />}
        />
      </List.Section>

      <Divider />

      {/* Data & Export */}
      <List.Section>
        <List.Subheader>Data & Export</List.Subheader>
        <List.Item
          title="Export as CSV"
          description="Download all job applications"
          left={(props) => <List.Icon {...props} icon="download" />}
          onPress={handleExportCSV}
        />
      </List.Section>

      <Divider />

      {/* Subscription */}
      <List.Section>
        <List.Subheader>Subscription</List.Subheader>
        <List.Item
          title={isSubscribed ? 'Premium Plan' : 'Free Plan'}
          description={isSubscribed ? 'Unlimited features' : 'Upgrade to unlock all features'}
          left={(props) => <List.Icon {...props} icon="star" />}
          onPress={() => Alert.alert('Subscription', 'In-app purchase coming soon!')}
        />
      </List.Section>

      <Divider />

      {/* About */}
      <List.Section>
        <List.Subheader>About</List.Subheader>
        <List.Item
          title="Version"
          description="1.0.0"
          left={(props) => <List.Icon {...props} icon="information" />}
        />
      </List.Section>

      {/* Logout Button */}
      <View style={styles.logoutContainer}>
        <Button
          mode="contained"
          onPress={handleLogout}
          style={styles.logoutButton}
          buttonColor={theme.colors.error}
          icon="logout"
        >
          Logout
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    padding: 24,
    marginBottom: 8,
  },
  userName: {
    marginTop: 12,
    fontWeight: 'bold',
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginTop: 8,
  },
  logoutContainer: {
    padding: 16,
    marginTop: 16,
  },
  logoutButton: {
    marginBottom: 32,
  },
});
