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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { differenceInDays, format, differenceInBusinessDays } from 'date-fns';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { Swipeable } from 'react-native-gesture-handler';
import { WebView } from 'react-native-webview';

// Export notification count for tab badge - will be set from component
export let notificationCount = 0;

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

// Report interface
interface Report {
  report_id: string;
  report_type: string;
  title: string;
  date_range: string;
  created_at: string;
  is_read: boolean;
  content?: string;
}

// Status colors
const STATUS_COLORS: {[key: string]: string} = {
  applied: '#3B82F6',
  recruiter_screening: '#F59E0B',
  phone_screen: '#EF4444',
  coding_round_1: '#8B5CF6',
  coding_round_2: '#A855F7',
  system_design: '#C084FC',
  behavioural: '#06B6D4',
  hiring_manager: '#14B8A6',
  final_round: '#10B981',
  offer: '#22C55E',
  rejected: '#DC2626'
};

interface StageInfo {
  status: string;
  timestamp: string;
  daysInStage: number;
}

interface Notification {
  id: string;
  job_id: string;
  company_name: string;
  position: string;
  recruiter_email?: string;
  days_overdue: number;
  date_applied: string;
  follow_up_days: number;
  current_status: string;
  total_aging: number;
  stages: StageInfo[];
}

export default function NotificationsScreen() {
  const { sessionToken } = useAuth();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [hasViewedTab, setHasViewedTab] = useState(false);
  
  // Report viewer state
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      fetchNotifications();
      fetchReports();
      // Mark tab as viewed - badge will disappear
      if (!hasViewedTab) {
        setHasViewedTab(true);
      }
    }, [hasViewedTab])
  );

  // Update tab badge with notification count - only show if not viewed yet
  React.useEffect(() => {
    const totalCount = notifications.length + reports.filter(r => !r.is_read).length;
    // Update the exported variable for tab badge
    notificationCount = hasViewedTab ? 0 : totalCount;
    
    // Update tab bar badge using navigation - hide if viewed
    navigation.setOptions({
      tabBarBadge: (!hasViewedTab && totalCount > 0) ? totalCount : undefined,
      tabBarBadgeStyle: { 
        backgroundColor: '#EF4444', 
        fontSize: 10,
        minWidth: 18,
        height: 18,
      },
    });
  }, [notifications.length, navigation, hasViewedTab]);

  const calculateBusinessDays = (startDate: Date, endDate: Date): number => {
    let count = 0;
    let current = new Date(startDate);
    while (current < endDate) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/jobs?limit=100`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        // Handle both old array format and new paginated format
        const jobs = Array.isArray(data) ? data : data.jobs || [];
        
        const now = new Date();
        const notifs: Notification[] = [];

        jobs.forEach((job: any) => {
          if (job.follow_up_days && !dismissedNotifications.has(job.job_id)) {
            const appliedDate = new Date(job.date_applied);
            const daysSinceApplied = differenceInDays(now, appliedDate);
            const followUpDays = parseInt(job.follow_up_days);

            if (daysSinceApplied >= followUpDays) {
              // Calculate stage aging
              const stages: StageInfo[] = [];
              const jobStages = job.stages || [];
              
              for (let i = 0; i < jobStages.length; i++) {
                const stage = jobStages[i];
                const stageDate = new Date(stage.timestamp);
                const nextStageDate = i < jobStages.length - 1 
                  ? new Date(jobStages[i + 1].timestamp) 
                  : now;
                const daysInStage = calculateBusinessDays(stageDate, nextStageDate);
                
                stages.push({
                  status: stage.status,
                  timestamp: stage.timestamp,
                  daysInStage
                });
              }

              const totalAging = calculateBusinessDays(appliedDate, now);

              notifs.push({
                id: job.job_id,
                job_id: job.job_id,
                company_name: job.company_name,
                position: job.position,
                recruiter_email: job.recruiter_email,
                days_overdue: daysSinceApplied - followUpDays,
                date_applied: job.date_applied,
                follow_up_days: followUpDays,
                current_status: job.status,
                total_aging: totalAging,
                stages,
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

  const fetchReports = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/reports`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setReports(data);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  };

  const handleViewReport = async (reportId: string) => {
    setLoadingReport(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/reports/${reportId}`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        const report = await response.json();
        setSelectedReport(report);
        setReportModalVisible(true);
        // Update local state to mark as read
        setReports(prev => prev.map(r => 
          r.report_id === reportId ? { ...r, is_read: true } : r
        ));
      } else {
        Alert.alert('Error', 'Failed to load report.');
      }
    } catch (error) {
      console.error('Error loading report:', error);
      Alert.alert('Error', 'Failed to load report.');
    } finally {
      setLoadingReport(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/reports/${reportId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        setReports(prev => prev.filter(r => r.report_id !== reportId));
      } else {
        Alert.alert('Error', 'Failed to delete report.');
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      Alert.alert('Error', 'Failed to delete report.');
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

  // Toggle selection mode
  const toggleSelectMode = () => {
    setSelectMode(!selectMode);
    setSelectedNotifications(new Set());
  };

  // Toggle notification selection
  const toggleNotificationSelection = (notificationId: string) => {
    setSelectedNotifications(prev => {
      const newSet = new Set(prev);
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId);
      } else {
        newSet.add(notificationId);
      }
      return newSet;
    });
  };

  // Delete selected notifications
  const handleDeleteSelected = () => {
    if (selectedNotifications.size === 0) return;
    
    Alert.alert(
      'Delete Reminders',
      `Are you sure you want to delete ${selectedNotifications.size} reminder(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Add to dismissed and remove from notifications
            setDismissedNotifications(prev => {
              const newSet = new Set(prev);
              selectedNotifications.forEach(id => newSet.add(id));
              return newSet;
            });
            setNotifications(prev => prev.filter(n => !selectedNotifications.has(n.id)));
            setSelectedNotifications(new Set());
            setSelectMode(false);
          }
        }
      ]
    );
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

  const formatStatus = (status: string): string => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const getStatusColor = (status: string): string => {
    return STATUS_COLORS[status] || '#6B7280';
  };

  const renderNotification = (notification: Notification) => {
    const urgencyColor = getUrgencyColor(notification.days_overdue);
    const appliedDate = format(new Date(notification.date_applied), 'MMM d, yyyy');
    const isSelected = selectedNotifications.has(notification.id);

    const cardContent = (
      <View style={[styles.notificationCard, { backgroundColor: colors.card, borderLeftColor: urgencyColor }]}>
        <View style={styles.cardWithCheckbox}>
          {/* Checkbox when in select mode */}
          {selectMode && (
            <TouchableOpacity 
              style={styles.checkboxContainer}
              onPress={() => toggleNotificationSelection(notification.id)}
            >
              <Ionicons 
                name={isSelected ? 'checkbox' : 'square-outline'} 
                size={22} 
                color={isSelected ? colors.primary : colors.textSecondary} 
              />
            </TouchableOpacity>
          )}
          
          <View style={[styles.cardContent, selectMode && { flex: 1 }]}>
            {/* Row 1: Company Name + Aging Badge */}
            <View style={styles.row}>
              <Text style={[styles.companyName, { color: colors.text }]} numberOfLines={1}>
                {notification.company_name}
              </Text>
              <View style={[styles.agingBadge, { backgroundColor: urgencyColor }]}>
                <Text style={styles.agingText}>
                  {notification.total_aging}d
                </Text>
              </View>
            </View>
            
            {/* Row 2: Position Applied */}
            <View style={styles.row}>
              <Text style={[styles.positionLabel, { color: colors.textSecondary }]}>
                Position Applied: <Text style={[styles.positionValue, { color: colors.text }]}>{notification.position}</Text>
              </Text>
            </View>
            
            {/* Row 3: Applied Date + Follow-up Button (right-aligned) */}
            <View style={styles.rowSpaceBetween}>
              <Text style={[styles.appliedText, { color: colors.textSecondary }]}>
                Applied: {appliedDate}
              </Text>
              {!selectMode && (
                <TouchableOpacity
                  style={[styles.followUpButton, { backgroundColor: colors.primary + '12' }]}
                  onPress={() => handleSendEmail(notification)}
                >
                  <Ionicons name="mail-outline" size={12} color={colors.primary} />
                  <Text style={[styles.followUpText, { color: colors.primary }]}>Follow-up</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    );

    // When in select mode, don't use Swipeable
    if (selectMode) {
      return (
        <TouchableOpacity 
          key={notification.id}
          activeOpacity={0.7}
          onPress={() => toggleNotificationSelection(notification.id)}
        >
          {cardContent}
        </TouchableOpacity>
      );
    }

    return (
      <Swipeable
        key={notification.id}
        renderRightActions={() => renderRightActions(notification.id)}
        overshootRight={false}
      >
        {cardContent}
      </Swipeable>
    );
  };

  const dynamicStyles = createDynamicStyles(colors, isDark);

  if (loading) {
    return (
      <SafeAreaView style={[dynamicStyles.container]} edges={['top']}>
        <View style={dynamicStyles.titleRow}>
          <Text style={dynamicStyles.pageTitle}>Notifications</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[dynamicStyles.container]} edges={['top']}>
      {/* Title row with Notifications text and action buttons */}
      <View style={dynamicStyles.titleRow}>
        <Text style={dynamicStyles.pageTitle}>
          {selectMode ? `${selectedNotifications.size} selected` : 'Notifications'}
        </Text>
        <View style={dynamicStyles.headerButtons}>
          {selectMode ? (
            <>
              <TouchableOpacity onPress={toggleSelectMode}>
                <Text style={dynamicStyles.actionText}>Cancel</Text>
              </TouchableOpacity>
              {selectedNotifications.size > 0 && (
                <TouchableOpacity onPress={handleDeleteSelected}>
                  <Text style={dynamicStyles.deleteText}>Delete</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            notifications.length > 0 && (
              <TouchableOpacity onPress={toggleSelectMode}>
                <Text style={dynamicStyles.actionText}>Select</Text>
              </TouchableOpacity>
            )
          )}
        </View>
      </View>

      {notifications.length === 0 && reports.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No Notifications</Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            You're all caught up! Reminders and reports will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Reports Section */}
          {reports.length > 0 && (
            <>
              <Text style={[styles.sectionHeader, { color: colors.text }]}>Reports</Text>
              {reports.map((report) => (
                <Swipeable
                  key={report.report_id}
                  renderRightActions={() => (
                    <TouchableOpacity 
                      style={styles.deleteAction}
                      onPress={() => handleDeleteReport(report.report_id)}
                    >
                      <Ionicons name="trash-outline" size={24} color="#fff" />
                      <Text style={styles.deleteActionText}>Delete</Text>
                    </TouchableOpacity>
                  )}
                  overshootRight={false}
                >
                  <View style={[styles.reportCard, { backgroundColor: colors.card }]}>
                    <View style={styles.reportIconContainer}>
                      <Ionicons 
                        name={report.report_type === 'weekly' ? 'calendar-outline' : 'calendar'}
                        size={28}
                        color={report.report_type === 'weekly' ? '#3B82F6' : '#8B5CF6'}
                      />
                      {!report.is_read && (
                        <View style={styles.unreadDot} />
                      )}
                    </View>
                    <View style={styles.reportContent}>
                      <Text style={[styles.reportTitle, { color: colors.text }]} numberOfLines={1}>
                        {report.title}
                      </Text>
                      <Text style={[styles.reportDate, { color: colors.textSecondary }]}>
                        {format(new Date(report.created_at), 'MMM d, yyyy \'at\' h:mm a')}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={[styles.viewButton, { backgroundColor: colors.primary }]}
                      onPress={() => handleViewReport(report.report_id)}
                    >
                      <Text style={styles.viewButtonText}>View</Text>
                    </TouchableOpacity>
                  </View>
                </Swipeable>
              ))}
            </>
          )}
          
          {/* Follow-up Reminders Section */}
          {notifications.length > 0 && (
            <>
              <Text style={[styles.sectionHeader, { color: colors.text, marginTop: reports.length > 0 ? 20 : 0 }]}>
                Follow-up Reminders
              </Text>
              {notifications.map(renderNotification)}
            </>
          )}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      {/* Report Viewer Modal */}
      <Modal
        visible={reportModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setReportModalVisible(false)}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]} numberOfLines={1}>
              {selectedReport?.title || 'Report'}
            </Text>
            <View style={{ width: 40 }} />
          </View>
          
          {loadingReport ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : selectedReport?.content ? (
            <ScrollView style={styles.reportContentContainer}>
              <View style={styles.htmlContent}>
                {/* Render HTML content using a simplified approach */}
                {Platform.OS === 'web' ? (
                  <View style={[styles.htmlContentWeb, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
                    <div 
                      dangerouslySetInnerHTML={{ __html: selectedReport.content }}
                      style={{ 
                        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                        padding: 16,
                        color: isDark ? '#F3F4F6' : '#1F2937'
                      }}
                    />
                  </View>
                ) : (
                  <WebView
                    originWhitelist={['*']}
                    source={{ 
                      html: `
                        <!DOCTYPE html>
                        <html>
                          <head>
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <style>
                              body {
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                                padding: 16px;
                                margin: 0;
                                background-color: ${isDark ? '#1F2937' : '#FFFFFF'};
                                color: ${isDark ? '#F3F4F6' : '#1F2937'};
                              }
                              h1, h2 { color: ${isDark ? '#60A5FA' : '#2563EB'}; }
                              * { box-sizing: border-box; }
                            </style>
                          </head>
                          <body>${selectedReport.content}</body>
                        </html>
                      `
                    }}
                    style={styles.webView}
                    scrollEnabled={true}
                    showsVerticalScrollIndicator={false}
                  />
                )}
              </View>
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const createDynamicStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  scrollContent: {
    padding: 12,
  },
  notificationCard: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardWithCheckbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  cardContent: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  rowSpaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  rowRight: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 0,
  },
  companyName: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 10,
  },
  positionLabel: {
    fontSize: 12,
    flex: 1,
  },
  positionValue: {
    fontWeight: '500',
  },
  position: {
    fontSize: 13,
    flex: 1,
  },
  appliedText: {
    fontSize: 11,
  },
  agingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  agingText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  followUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    gap: 4,
  },
  followUpText: {
    fontSize: 11,
    fontWeight: '600',
  },
  deleteAction: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    marginBottom: 10,
    borderRadius: 12,
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
  // Section header
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 4,
  },
  // Report card styles
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  reportIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  reportContent: {
    flex: 1,
    marginRight: 10,
  },
  reportTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  reportDate: {
    fontSize: 12,
  },
  viewButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  reportContentContainer: {
    flex: 1,
  },
  htmlContent: {
    flex: 1,
  },
  webView: {
    flex: 1,
    minHeight: 600,
  },
  htmlContentWeb: {
    flex: 1,
    overflow: 'scroll' as any,
  },
});
