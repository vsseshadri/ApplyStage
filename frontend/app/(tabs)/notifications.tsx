import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { differenceInDays, format } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import { Swipeable } from 'react-native-gesture-handler';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Notification {
  id: string;
  job_id: string;
  company_name: string;
  position: string;
  recruiter_email?: string;
  days_overdue: number;
  date_applied: string;
  follow_up_days: number;
}

export default function NotificationsScreen() {
  const { sessionToken } = useAuth();
  const { colors, isDark } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(new Set());

  useFocusEffect(
    React.useCallback(() => {
      fetchNotifications();
    }, [])
  );

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/jobs`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        const jobs = await response.json();
        
        const now = new Date();
        const notifs: Notification[] = [];

        jobs.forEach((job: any) => {
          if (job.follow_up_days && !dismissedNotifications.has(job.job_id)) {
            const appliedDate = new Date(job.date_applied);
            const daysSinceApplied = differenceInDays(now, appliedDate);
            const followUpDays = parseInt(job.follow_up_days);

            if (daysSinceApplied >= followUpDays) {
              notifs.push({
                id: job.job_id,
                job_id: job.job_id,
                company_name: job.company_name,
                position: job.position,
                recruiter_email: job.recruiter_email,
                days_overdue: daysSinceApplied - followUpDays,
                date_applied: job.date_applied,
                follow_up_days: followUpDays,
              });
            }
          }
        });

        notifs.sort((a, b) => b.days_overdue - a.days_overdue);
        setNotifications(notifs);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async (notification: Notification) => {
    const subject = encodeURIComponent(`Follow-up: ${notification.position} at ${notification.company_name}`);
    const body = encodeURIComponent(
      `Dear Hiring Team,\n\nI hope this email finds you well. I wanted to follow up on my application for the ${notification.position} position at ${notification.company_name}.\n\nI applied on ${format(new Date(notification.date_applied), 'MMMM dd, yyyy')} and remain very interested in this opportunity. I would appreciate any updates on the status of my application.\n\nThank you for your time and consideration.\n\nBest regards`
    );

    let emailUrl = `mailto:${notification.recruiter_email || ''}?subject=${subject}&body=${body}`;

    try {
      const canOpen = await Linking.canOpenURL(emailUrl);
      if (canOpen) {
        await Linking.openURL(emailUrl);
      } else {
        Alert.alert('Error', 'Unable to open email app.');
      }
    } catch (error) {
      console.error('Error opening email:', error);
      Alert.alert('Error', 'Failed to open email app.');
    }
  };

  const handleDismissNotification = (notificationId: string) => {
    setDismissedNotifications(prev => new Set([...prev, notificationId]));
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const renderRightActions = (notificationId: string) => {
    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => handleDismissNotification(notificationId)}
      >
        <Ionicons name="trash-outline" size={20} color="#FFF" />
        <Text style={styles.deleteText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  const getUrgencyColor = (daysOverdue: number) => {
    if (daysOverdue > 7) return '#EF4444';
    if (daysOverdue > 3) return '#F59E0B';
    return '#3B82F6';
  };

  const renderNotification = (notification: Notification) => {
    const urgencyColor = getUrgencyColor(notification.days_overdue);

    return (
      <Swipeable
        key={notification.id}
        renderRightActions={() => renderRightActions(notification.id)}
        overshootRight={false}
      >
        <View style={[styles.notificationCard, { backgroundColor: colors.card, borderLeftColor: urgencyColor }]}>
          <View style={styles.notificationRow}>
            <View style={styles.notificationInfo}>
              <Text style={[styles.companyName, { color: colors.text }]} numberOfLines={1}>
                {notification.company_name}
              </Text>
              <Text style={[styles.position, { color: colors.textSecondary }]} numberOfLines={1}>
                {notification.position}
              </Text>
              <Text style={[styles.overdueText, { color: urgencyColor }]}>
                {notification.days_overdue === 0 ? `Due today` : `${notification.days_overdue}d overdue`}
              </Text>
            </View>
            
            <TouchableOpacity
              style={[styles.followUpButton, { borderColor: colors.primary }]}
              onPress={() => handleSendEmail(notification)}
            >
              <Ionicons name="mail-outline" size={16} color={colors.primary} />
              <Text style={[styles.followUpText, { color: colors.primary }]}>Follow-up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Swipeable>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          {notifications.length} reminder{notifications.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No Notifications</Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            You're all caught up! Reminders will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {notifications.map(renderNotification)}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  scrollContent: {
    padding: 12,
  },
  notificationCard: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationInfo: {
    flex: 1,
    marginRight: 12,
  },
  companyName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  position: {
    fontSize: 13,
    marginBottom: 4,
  },
  overdueText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  followUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  followUpText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  deleteAction: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    marginBottom: 10,
    borderRadius: 10,
  },
  deleteText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 13,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
