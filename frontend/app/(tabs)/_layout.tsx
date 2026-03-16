import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import LiquidGlassTabBar from '../../components/LiquidGlassTabBar';

// Get backend URL
const getBackendUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (envUrl) return envUrl;
  const configUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL;
  if (configUrl) return configUrl;
  return 'https://career-topics.emergent.host';
};
const BACKEND_URL = getBackendUrl();

export default function TabsLayout() {
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
        tabBar={(props) => (
          <LiquidGlassTabBar {...props} notificationCount={notificationCount} />
        )}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
          }}
        />
        <Tabs.Screen
          name="my-jobs"
          options={{
            title: 'My Jobs',
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Notifications',
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: 'Analytics',
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
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
