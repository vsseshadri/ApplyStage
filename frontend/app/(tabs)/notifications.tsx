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
import { SafeAreaView } from 'react-native-safe-area-context';
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
        
        // Calculate notifications based on follow-up days
        const now = new Date();
        const notifs: Notification[] = [];

        jobs.forEach((job: any) => {
          if (job.follow_up_days && !dismissedNotifications.has(job.job_id)) {
            const appliedDate = new Date(job.date_applied);
            const daysSinceApplied = differenceInDays(now, appliedDate);
            const followUpDays = parseInt(job.follow_up_days);

            // If days since applied is greater than follow-up days, create notification
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

        // Sort by days overdue (most overdue first)
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
        Alert.alert('Error', 'Unable to open email app. Please check your email settings.');
      }
    } catch (error) {
      console.error('Error opening email:', error);
      Alert.alert('Error', 'Failed to open email app.');
    }
  };

  const handleDismissNotification = (notificationId: string) => {
    Alert.alert(
      'Dismiss Notification',
      'Are you sure you want to dismiss this reminder?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dismiss',
          style: 'destructive',
          onPress: () => {
            setDismissedNotifications(prev => new Set([...prev, notificationId]));
            setNotifications(prev => prev.filter(n => n.id !== notificationId));
          },
        },
      ]
    );
  };

  const renderRightActions = (notificationId: string) => {
    return (
      <TouchableOpacity
        style={[styles.deleteButton, { backgroundColor: colors.error || '#EF4444' }]}
        onPress={() => handleDismissNotification(notificationId)}
      >
        <Ionicons name="trash-outline" size={24} color="#FFF" />
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  const renderNotification = (notification: Notification) => {
    const dynamicStyles = StyleSheet.create({
      notificationCard: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: notification.days_overdue > 7 ? '#EF4444' : notification.days_overdue > 3 ? '#F59E0B' : '#3B82F6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
      companyName: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 4,
      },
      position: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 8,
      },
      overdueText: {
        fontSize: 14,
        fontWeight: '600',
        color: notification.days_overdue > 7 ? '#EF4444' : notification.days_overdue > 3 ? '#F59E0B' : '#3B82F6',
        marginBottom: 8,
      },
      dateText: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 12,
      },
      emailButton: {
        backgroundColor: colors.primary,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
      },
      emailButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 8,
      },
    });

    return (
      <Swipeable
        key={notification.id}
        renderRightActions={() => renderRightActions(notification.id)}
        overshootRight={false}
      >
        <View style={dynamicStyles.notificationCard}>
          <Text style={dynamicStyles.companyName}>{notification.company_name}</Text>
          <Text style={dynamicStyles.position}>{notification.position}</Text>
          
          <Text style={dynamicStyles.overdueText}>
            {notification.days_overdue === 0
              ? `Follow-up reminder: Today is the day!`
              : `Follow-up overdue by ${notification.days_overdue} day${notification.days_overdue !== 1 ? 's' : ''}`}
          </Text>
          
          <Text style={dynamicStyles.dateText}>
            Applied: {format(new Date(notification.date_applied), 'MMM dd, yyyy')} • 
            Follow-up due: Every {notification.follow_up_days} days
          </Text>

          {notification.recruiter_email && (
            <Text style={[dynamicStyles.dateText, { marginBottom: 12 }]}>
              <Ionicons name="mail" size={12} /> {notification.recruiter_email}
            </Text>
          )}

          <TouchableOpacity
            style={dynamicStyles.emailButton}
            onPress={() => handleSendEmail(notification)}
          >
            <Ionicons name="mail-outline" size={18} color="#FFF" />
            <Text style={dynamicStyles.emailButtonText}>Send Follow-up Email</Text>
          </TouchableOpacity>
        </View>
      </Swipeable>
    );
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      padding: 20,
      paddingTop: Platform.OS === 'ios' ? 60 : 40,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
    },
    headerSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    },
    scrollContent: {
      padding: 16,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 100,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 40,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  if (loading) {
    return (
      <SafeAreaView style={dynamicStyles.container}>
        <View style={dynamicStyles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.headerTitle}>Notifications</Text>
        <Text style={dynamicStyles.headerSubtitle}>
          {notifications.length} follow-up reminder{notifications.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {notifications.length === 0 ? (
        <View style={dynamicStyles.emptyContainer}>
          <Ionicons
            name="notifications-off-outline"
            size={64}
            color={colors.textSecondary}
            style={dynamicStyles.emptyIcon}
          />
          <Text style={dynamicStyles.emptyText}>No Notifications</Text>
          <Text style={dynamicStyles.emptySubtext}>
            You're all caught up! Follow-up reminders will appear here when it's time to reach out.
          </Text>
        </View>
      ) : (
        <ScrollView style={dynamicStyles.scrollContent} showsVerticalScrollIndicator={false}>
          {notifications.map(renderNotification)}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    marginBottom: 12,
    borderRadius: 12,
  },
  deleteButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});
