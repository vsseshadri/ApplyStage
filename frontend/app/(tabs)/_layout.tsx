import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';

// Get backend URL
const getBackendUrl = (): string => {
  const configUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL;
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  return configUrl || envUrl || '';
};
const BACKEND_URL = getBackendUrl();

export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  const { sessionToken } = useAuth();
  const router = useRouter();
  const [notificationCount, setNotificationCount] = useState(0);

  // Fetch notification count
  useEffect(() => {
    const fetchNotificationCount = async () => {
      if (!sessionToken || !BACKEND_URL) return;
      try {
        const [notifResponse, reportsResponse] = await Promise.all([
          fetch(`${BACKEND_URL}/api/jobs?limit=100`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
          }),
          fetch(`${BACKEND_URL}/api/reports`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
          })
        ]);
        
        if (notifResponse.ok && reportsResponse.ok) {
          const jobs = await notifResponse.json();
          const reports = await reportsResponse.json();
          
          // Count jobs with follow-up reminders
          const now = new Date();
          let reminderCount = 0;
          
          if (Array.isArray(jobs)) {
            jobs.forEach((job: any) => {
              if (job.follow_up_days && job.status !== 'offer' && job.status !== 'rejected') {
                const dateApplied = new Date(job.date_applied || job.created_at);
                const daysSince = Math.floor((now.getTime() - dateApplied.getTime()) / (1000 * 60 * 60 * 24));
                if (daysSince >= parseInt(job.follow_up_days)) {
                  reminderCount++;
                }
              }
            });
          }
          
          const reportCount = Array.isArray(reports) ? reports.length : 0;
          setNotificationCount(reminderCount + reportCount);
        }
      } catch (error) {
        console.log('Error fetching notification count:', error);
      }
    };

    fetchNotificationCount();
    const interval = setInterval(fetchNotificationCount, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [sessionToken]);

  const handleAddJob = () => {
    // Navigate to my-jobs and trigger add modal
    router.push('/(tabs)/my-jobs?openAdd=true');
  };

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        initialRouteName="my-jobs"
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.4)',
          tabBarStyle: {
            backgroundColor: isDark ? 'rgba(28, 28, 30, 0.75)' : 'rgba(255, 255, 255, 0.8)',
            borderTopWidth: 0.5,
            borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            height: Platform.OS === 'ios' ? 88 : 64,
            paddingBottom: Platform.OS === 'ios' ? 28 : 8,
            paddingTop: 8,
            paddingHorizontal: 4,
            position: 'absolute',
            elevation: 0,
          },
          tabBarBackground: () => (
            <BlurView
              intensity={isDark ? 50 : 80}
              tint={isDark ? 'dark' : 'light'}
              style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                right: 0, 
                bottom: 0,
              }}
            />
          ),
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: 2,
          },
          tabBarIconStyle: {
            marginTop: 4,
          },
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="stats-chart" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="my-jobs"
          options={{
            title: 'My Jobs',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="briefcase" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="add-placeholder"
          options={{
            title: '',
            tabBarIcon: () => null,
            tabBarButton: (props) => (
              <TouchableOpacity
                style={styles.addButtonContainer}
                onPress={handleAddJob}
              >
                <View style={[styles.addButton, { backgroundColor: colors.primary }]}>
                  <Ionicons name="add" size={26} color="white" />
                </View>
              </TouchableOpacity>
            ),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              handleAddJob();
            },
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Notifications',
            tabBarIcon: ({ color, size }) => (
              <View>
                <Ionicons name="notifications" size={22} color={color} />
                {notificationCount > 0 && (
                  <View style={[styles.badge, { backgroundColor: '#EF4444' }]}>
                    <Text style={styles.badgeText}>
                      {notificationCount > 99 ? '99+' : notificationCount}
                    </Text>
                  </View>
                )}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            href: null, // Hide profile tab from navigation
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  badge: {
    position: 'absolute',
    right: -8,
    top: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
});
