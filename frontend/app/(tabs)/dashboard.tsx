import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Dimensions, Platform, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useFilter } from '../../contexts/FilterContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { Swipeable } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';

// Get backend URL from configuration
const getBackendUrl = (): string => {
  const configUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL;
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  return configUrl || envUrl || '';
};
const BACKEND_URL = getBackendUrl();

const screenWidth = Dimensions.get('window').width;

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

// Modern pie chart colors with gradients
const PIE_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
  '#EC4899', '#06B6D4', '#14B8A6', '#F97316', '#6366F1'
];

// State abbreviation mapping
const STATE_ABBREVIATIONS: {[key: string]: string} = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
  'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
};

const getStateAbbreviation = (state: string): string => {
  return STATE_ABBREVIATIONS[state] || state.substring(0, 2).toUpperCase();
};

const formatLocationWithAbbr = (location: string): string => {
  const parts = location.split(', ');
  if (parts.length === 2) {
    const city = parts[0];
    const state = parts[1];
    return `${city}, ${getStateAbbreviation(state)}`;
  }
  return location;
};

export default function DashboardScreen() {
  const { user, sessionToken, isNewUser } = useAuth();
  const { colors, isDark } = useTheme();
  const { setFilter, dashboardRefreshTrigger } = useFilter();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [actionedFollowUps, setActionedFollowUps] = useState<Set<number>>(new Set());
  const [upcomingInterviews, setUpcomingInterviews] = useState<any[]>([]);
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  
  // Detect tablet (width > 768)
  const isTablet = screenWidth >= 768;
  
  // Listen for screen size changes
  React.useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);

  // Refresh dashboard data when triggered from My Jobs (status/work mode changes)
  React.useEffect(() => {
    if (dashboardRefreshTrigger > 0 && sessionToken) {
      fetchData();
    }
  }, [dashboardRefreshTrigger]);

  // Function to handle marking a follow-up as actioned
  const handleFollowUpAction = (index: number) => {
    setActionedFollowUps(prev => {
      const newSet = new Set(prev);
      newSet.add(index);
      return newSet;
    });
    
    // Remove from list after a brief animation delay
    setTimeout(() => {
      setFollowUps(prev => prev.filter((_, i) => i !== index));
      setActionedFollowUps(prev => {
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    }, 300);
  };

  // Function to render follow-up text with monospace for days
  const renderFollowUpText = (text: string) => {
    // Pattern to match numbers followed by 'd' or 'days'
    const parts = text.split(/(\d+d|\d+ days)/g);
    
    return (
      <Text style={dynamicStyles.followUpText}>
        {parts.map((part, idx) => {
          if (/^\d+d$/.test(part) || /^\d+ days$/.test(part)) {
            return (
              <Text key={idx} style={dynamicStyles.followUpDays}>
                {part}
              </Text>
            );
          }
          return part;
        })}
      </Text>
    );
  };

  // Check if user has a private relay email
  const isPrivateRelayUser = (): boolean => {
    const email = user?.email || '';
    return email.includes('@privaterelay.appleid.com') || user?.is_private_relay === true;
  };

  // Function to get the greeting text
  const getGreeting = (): string => {
    // For private relay users, show "Welcome" for new users, "Welcome back" for returning users
    if (isPrivateRelayUser()) {
      return isNewUser ? 'Welcome' : 'Welcome back';
    }
    // For all other users, always show "Welcome back" with their name
    return 'Welcome back,';
  };

  // Function to get a proper display name, handling generic names
  const getDisplayName = (): string | null => {
    // First priority: use preferred_display_name if set
    if (user?.preferred_display_name && user.preferred_display_name.trim()) {
      return user.preferred_display_name.trim();
    }
    
    // For private relay users without preferred name, don't show any name
    if (isPrivateRelayUser()) {
      return null;
    }
    
    const name = user?.name;
    const email = user?.email;
    
    // List of generic/placeholder names to avoid
    const genericNames = ['Apple User', 'User', 'Apple', '', null, undefined];
    
    // If we have a valid name (not generic), use the first part
    if (name && !genericNames.includes(name) && !genericNames.includes(name.split(' ')[0])) {
      return name.split(' ')[0];
    }
    
    // Try to extract a name from email
    if (email) {
      const emailPrefix = email.split('@')[0];
      // Skip if it looks like an Apple private relay or generic
      if (emailPrefix && !emailPrefix.startsWith('apple_') && emailPrefix.length > 2) {
        // Clean up email prefix: replace dots/underscores with spaces, capitalize
        const cleanName = emailPrefix
          .replace(/[._]/g, ' ')
          .split(' ')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join(' ')
          .split(' ')[0]; // Take first word
        
        if (cleanName && cleanName.length > 1) {
          return cleanName;
        }
      }
    }
    
    return 'User';
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchData();
    }, [sessionToken])
  );

  const fetchData = async () => {
    if (!sessionToken) return;
    
    try {
      const [statsRes, insightsRes, upcomingRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/dashboard/stats`, {
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        }),
        fetch(`${BACKEND_URL}/api/dashboard/ai-insights`, {
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        }),
        fetch(`${BACKEND_URL}/api/dashboard/upcoming-interviews`, {
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        })
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (insightsRes.ok) {
        const insightsData = await insightsRes.json();
        setInsights(insightsData.insights || []);
        setFollowUps(insightsData.follow_ups || []);
      }

      if (upcomingRes.ok) {
        const upcomingData = await upcomingRes.json();
        setUpcomingInterviews(upcomingData || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleStatCardPress = (filterType: 'all' | 'last_10_days' | 'final_round' | 'offers') => {
    setFilter(filterType);
    router.push('/(tabs)/my-jobs');
  };

  // Handle work mode bar press - navigate to My Jobs with filter
  const handleWorkModePress = (workMode: string) => {
    setFilter('work_mode', workMode);
    router.push('/(tabs)/my-jobs');
  };

  const dynamicStyles = createStyles(colors, isDark);

  if (loading) {
    return (
      <SafeAreaView style={dynamicStyles.container} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primary} style={dynamicStyles.loader} />
      </SafeAreaView>
    );
  }

  // Prepare bar chart data for status breakdown
  const barChartData = [
    { label: 'Applied', value: stats?.applied || 0, color: STATUS_COLORS.applied },
    { label: 'Screening', value: stats?.recruiter_screening || 0, color: STATUS_COLORS.recruiter_screening },
    { label: 'Phone', value: stats?.phone_screen || 0, color: STATUS_COLORS.phone_screen },
    { label: 'Coding 1', value: stats?.coding_round_1 || 0, color: STATUS_COLORS.coding_round_1 },
    { label: 'Coding 2', value: stats?.coding_round_2 || 0, color: STATUS_COLORS.coding_round_2 },
    { label: 'Sys Design', value: stats?.system_design || 0, color: STATUS_COLORS.system_design },
    { label: 'Behavioural', value: stats?.behavioural || 0, color: STATUS_COLORS.behavioural },
    { label: 'Hiring Mgr', value: stats?.hiring_manager || 0, color: STATUS_COLORS.hiring_manager },
    { label: 'Final', value: stats?.final_round || 0, color: STATUS_COLORS.final_round },
    { label: 'Offer', value: stats?.offer || 0, color: STATUS_COLORS.offer },
  ].filter(item => item.value > 0);

  const maxValue = Math.max(...barChartData.map(d => d.value), 1);

  // Prepare pie chart data for locations
  const locationStats = stats?.by_location || {};
  const pieChartData = Object.entries(locationStats).map(([location, count], index) => ({
    value: count as number,
    color: PIE_COLORS[index % PIE_COLORS.length],
    text: `${count}`,
    label: formatLocationWithAbbr(location),
    focused: index === 0,
    gradientCenterColor: PIE_COLORS[index % PIE_COLORS.length] + '80',
  }));

  // Prepare work mode bar chart data
  const workModeStats = stats?.by_work_mode || {};
  const workModeBarData = [
    { 
      value: workModeStats.remote || 0, 
      label: 'Remote',
      frontColor: '#10B981',
      gradientColor: '#10B98180',
      topLabelComponent: () => (
        <Text style={{ color: colors.text, fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>
          {workModeStats.remote || 0}
        </Text>
      ),
    },
    { 
      value: workModeStats.onsite || 0, 
      label: 'Onsite',
      frontColor: '#3B82F6',
      gradientColor: '#3B82F680',
      topLabelComponent: () => (
        <Text style={{ color: colors.text, fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>
          {workModeStats.onsite || 0}
        </Text>
      ),
    },
    { 
      value: workModeStats.hybrid || 0, 
      label: 'Hybrid',
      frontColor: '#8B5CF6',
      gradientColor: '#8B5CF680',
      topLabelComponent: () => (
        <Text style={{ color: colors.text, fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>
          {workModeStats.hybrid || 0}
        </Text>
      ),
    },
  ];

  const maxWorkModeValue = Math.max(...workModeBarData.map(d => d.value), 1);

  // Prepare position bar chart data (Top 6 positions)
  const positionStats = stats?.by_position || {};
  const positionChartData = Object.entries(positionStats)
    .map(([position, count]) => ({
      label: position,
      fullLabel: position,
      value: count as number,
      color: PIE_COLORS[Object.keys(positionStats).indexOf(position) % PIE_COLORS.length],
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
  
  const maxPositionValue = Math.max(...positionChartData.map(d => d.value), 1);

  // Render the Insights Only Section (used in tablet right column)
  const renderInsightsOnlySection = () => (
    <>
      {insights.length > 0 && (
        <View style={[dynamicStyles.section, isTablet && { marginBottom: 16 }]}>
          <View style={dynamicStyles.sectionHeader}>
            <Ionicons name="sparkles" size={18} color={colors.primary} />
            <Text style={dynamicStyles.sectionTitle}>Insights</Text>
          </View>
          <View style={dynamicStyles.insightsGrid}>
            {insights.slice(0, isTablet ? 6 : 4).map((insight: any, index: number) => (
              <View 
                key={index} 
                style={[
                  dynamicStyles.insightCard,
                  insight.type === 'urgent' && dynamicStyles.insightCardUrgent,
                  insight.type === 'celebration' && dynamicStyles.insightCardSuccess,
                  insight.type === 'encouragement' && dynamicStyles.insightCardEncouragement,
                ]}
              >
                <View style={[dynamicStyles.insightIconContainer, { backgroundColor: `${insight.color}20` }]}>
                  <Ionicons 
                    name={insight.icon || 'information-circle'} 
                    size={20} 
                    color={insight.color || colors.primary} 
                  />
                </View>
                <Text style={dynamicStyles.insightCardText} numberOfLines={3}>
                  {insight.text || insight}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </>
  );

  // Render the Follow-ups Only Section (used in tablet right column)
  const renderFollowUpsOnlySection = () => (
    <>
      {followUps.length > 0 && (
        <View style={[dynamicStyles.section, isTablet && { marginBottom: 16 }]}>
          <View style={dynamicStyles.sectionHeader}>
            <Ionicons name="notifications" size={18} color="#F59E0B" />
            <Text style={dynamicStyles.sectionTitle}>Follow-up Reminders</Text>
          </View>
          <View style={dynamicStyles.followUpsContainer}>
            {followUps.map((followUp: any, index: number) => {
              // Handle summary items
              if (followUp.summary) {
                return (
                  <View key={index} style={dynamicStyles.followUpSummary}>
                    <Text style={dynamicStyles.followUpSummaryText}>{followUp.text}</Text>
                  </View>
                );
              }
              
              // Regular follow-up items - Compact design
              const urgencyColors: any = {
                critical: { bg: '#FEE2E2', border: '#EF4444', text: '#991B1B' },
                high: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
                medium: { bg: '#E0E7FF', border: '#6366F1', text: '#3730A3' }
              };
              const urgencyStyle = urgencyColors[followUp.urgency] || urgencyColors.medium;
              
              // Get status color for badge
              const statusColors: any = {
                'Applied': '#3B82F6',
                'Recruiter Screening': '#8B5CF6',
                'Phone Screen': '#6366F1',
                'Coding Round 1': '#EC4899',
                'Coding Round 2': '#EC4899',
                'System Design': '#F59E0B',
                'Behavioural': '#10B981',
                'Hiring Manager': '#14B8A6',
                'Final Round': '#22C55E'
              };
              const statusColor = statusColors[followUp.status] || '#6B7280';
              
              // Handle send email - use recruiter_email if available
              const handleSendEmail = () => {
                const toEmail = followUp.recruiter_email || '';
                const subject = encodeURIComponent(`Follow-up: Application at ${followUp.company}`);
                const body = encodeURIComponent(
                  `Dear Hiring Team,\n\nI hope this email finds you well. I wanted to follow up on my application at ${followUp.company}.\n\nI remain very interested in this opportunity and would appreciate any updates on the status of my application.\n\nThank you for your time and consideration.\n\nBest regards`
                );
                const emailUrl = `mailto:${toEmail}?subject=${subject}&body=${body}`;
                Linking.openURL(emailUrl).catch(() => {
                  Alert.alert('Error', 'Unable to open email app.');
                });
              };
              
              // Handle delete on swipe
              const handleDelete = () => {
                setFollowUps(prev => prev.filter((_, i) => i !== index));
              };
              
              // Render delete action for swipe
              const renderRightActions = () => (
                <TouchableOpacity
                  style={dynamicStyles.followUpDeleteAction}
                  onPress={handleDelete}
                >
                  <Ionicons name="trash-outline" size={20} color="#FFF" />
                  <Text style={dynamicStyles.followUpDeleteActionText}>Delete</Text>
                </TouchableOpacity>
              );
              
              const isLastItem = index === followUps.length - 1;
              const cardContent = (
                <View style={[
                  dynamicStyles.followUpCardCompact,
                  { borderLeftColor: urgencyStyle.border },
                  !isLastItem && dynamicStyles.followUpCardWithBorder
                ]}>
                  <View style={dynamicStyles.followUpCardContent}>
                    <View style={dynamicStyles.followUpTopRow}>
                      <Text style={[dynamicStyles.followUpCompanyCompact, followUp.is_priority && { fontWeight: '700' }]} numberOfLines={1}>
                        {followUp.is_priority && <Text style={{ color: '#F59E0B' }}>★ </Text>}
                        {followUp.company}
                      </Text>
                      <View style={dynamicStyles.followUpRightSection}>
                        <TouchableOpacity onPress={handleSendEmail} style={dynamicStyles.followUpMailIcon}>
                          <Ionicons name="mail-outline" size={20} color={colors.primary} />
                        </TouchableOpacity>
                        <View style={[dynamicStyles.followUpDaysCounter, { backgroundColor: urgencyStyle.border }]}>
                          <Text style={dynamicStyles.followUpDaysNumber}>{followUp.overdue_days}</Text>
                          <Text style={dynamicStyles.followUpDaysLabel}>days</Text>
                        </View>
                      </View>
                    </View>
                    <View style={dynamicStyles.followUpBottomRow}>
                      <View style={[dynamicStyles.followUpStatusBadge, { backgroundColor: statusColor }]}>
                        <Text style={dynamicStyles.followUpStatusText}>{followUp.status}</Text>
                      </View>
                      <Text style={dynamicStyles.followUpOverdueText}>overdue</Text>
                    </View>
                  </View>
                </View>
              );
              
              return (
                <Swipeable
                  key={index}
                  renderRightActions={renderRightActions}
                  overshootRight={false}
                >
                  {cardContent}
                </Swipeable>
              );
            })}
          </View>
        </View>
      )}
    </>
  );

  // Render the Insights Section (used in both layouts)
  const renderInsightsSection = () => (
    <>
      {(insights.length > 0 || followUps.length > 0) && (
        <View style={[dynamicStyles.section, isTablet && { marginBottom: 16 }]}>
          {/* Insights - Beautiful Card Layout */}
          <View style={dynamicStyles.sectionHeader}>
            <Ionicons name="sparkles" size={18} color={colors.primary} />
            <Text style={dynamicStyles.sectionTitle}>Insights</Text>
          </View>
          <View style={dynamicStyles.insightsGrid}>
            {insights.slice(0, isTablet ? 6 : 4).map((insight: any, index: number) => (
              <View 
                key={index} 
                style={[
                  dynamicStyles.insightCard,
                  insight.type === 'urgent' && dynamicStyles.insightCardUrgent,
                  insight.type === 'celebration' && dynamicStyles.insightCardSuccess,
                  insight.type === 'encouragement' && dynamicStyles.insightCardEncouragement,
                ]}
              >
                <View style={[dynamicStyles.insightIconContainer, { backgroundColor: `${insight.color}20` }]}>
                  <Ionicons 
                    name={insight.icon || 'information-circle'} 
                    size={20} 
                    color={insight.color || colors.primary} 
                  />
                </View>
                <Text style={dynamicStyles.insightCardText} numberOfLines={3}>
                  {insight.text || insight}
                </Text>
              </View>
            ))}
          </View>
          
          {/* Follow-up Reminders - Compact UI with Swipe to Delete */}
          {followUps.length > 0 && (
            <View style={{ marginTop: 20 }}>
              <View style={dynamicStyles.sectionHeader}>
                <Ionicons name="notifications" size={18} color="#F59E0B" />
                <Text style={dynamicStyles.sectionTitle}>Follow-up Reminders</Text>
              </View>
              <View style={dynamicStyles.followUpsContainer}>
                {followUps.map((followUp: any, index: number) => {
                  // Handle summary items
                  if (followUp.summary) {
                    return (
                      <View key={index} style={dynamicStyles.followUpSummary}>
                        <Text style={dynamicStyles.followUpSummaryText}>{followUp.text}</Text>
                      </View>
                    );
                  }
                  
                  // Regular follow-up items - Compact design
                  const urgencyColors: any = {
                    critical: { bg: '#FEE2E2', border: '#EF4444', text: '#991B1B' },
                    high: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
                    medium: { bg: '#E0E7FF', border: '#6366F1', text: '#3730A3' }
                  };
                  const urgencyStyle = urgencyColors[followUp.urgency] || urgencyColors.medium;
                  
                  // Get status color for badge
                  const statusColors: any = {
                    'Applied': '#3B82F6',
                    'Recruiter Screening': '#8B5CF6',
                    'Phone Screen': '#6366F1',
                    'Coding Round 1': '#EC4899',
                    'Coding Round 2': '#EC4899',
                    'System Design': '#F59E0B',
                    'Behavioural': '#10B981',
                    'Hiring Manager': '#14B8A6',
                    'Final Round': '#22C55E'
                  };
                  const statusColor = statusColors[followUp.status] || '#6B7280';
                  
                  // Handle send email - use recruiter_email if available
                  const handleSendEmail = () => {
                    const toEmail = followUp.recruiter_email || '';
                    const subject = encodeURIComponent(`Follow-up: Application at ${followUp.company}`);
                    const body = encodeURIComponent(
                      `Dear Hiring Team,\n\nI hope this email finds you well. I wanted to follow up on my application at ${followUp.company}.\n\nI remain very interested in this opportunity and would appreciate any updates on the status of my application.\n\nThank you for your time and consideration.\n\nBest regards`
                    );
                    const emailUrl = `mailto:${toEmail}?subject=${subject}&body=${body}`;
                    Linking.openURL(emailUrl).catch(() => {
                      Alert.alert('Error', 'Unable to open email app.');
                    });
                  };
                  
                  // Handle delete on swipe
                  const handleDelete = () => {
                    setFollowUps(prev => prev.filter((_, i) => i !== index));
                  };
                  
                  // Render delete action for swipe
                  const renderRightActions = () => (
                    <TouchableOpacity
                      style={dynamicStyles.followUpDeleteAction}
                      onPress={handleDelete}
                    >
                      <Ionicons name="trash-outline" size={20} color="#FFF" />
                      <Text style={dynamicStyles.followUpDeleteActionText}>Delete</Text>
                    </TouchableOpacity>
                  );
                  
                  const isLastItem = index === followUps.length - 1;
                  const cardContent = (
                    <View style={[
                      dynamicStyles.followUpCardCompact,
                      { borderLeftColor: urgencyStyle.border },
                      !isLastItem && dynamicStyles.followUpCardWithBorder
                    ]}>
                      <View style={dynamicStyles.followUpCardContent}>
                        <View style={dynamicStyles.followUpTopRow}>
                          <Text style={[dynamicStyles.followUpCompanyCompact, followUp.is_priority && { fontWeight: '700' }]} numberOfLines={1}>
                            {followUp.is_priority && <Text style={{ color: '#F59E0B' }}>★ </Text>}
                            {followUp.company}
                          </Text>
                          <View style={dynamicStyles.followUpRightSection}>
                            <TouchableOpacity onPress={handleSendEmail} style={dynamicStyles.followUpMailIcon}>
                              <Ionicons name="mail-outline" size={20} color={colors.primary} />
                            </TouchableOpacity>
                            <View style={[dynamicStyles.followUpDaysCounter, { backgroundColor: urgencyStyle.border }]}>
                              <Text style={dynamicStyles.followUpDaysNumber}>{followUp.overdue_days}</Text>
                              <Text style={dynamicStyles.followUpDaysLabel}>days</Text>
                            </View>
                          </View>
                        </View>
                        <View style={dynamicStyles.followUpBottomRow}>
                          <View style={[dynamicStyles.followUpStatusBadge, { backgroundColor: statusColor }]}>
                            <Text style={dynamicStyles.followUpStatusText}>{followUp.status}</Text>
                          </View>
                          <Text style={dynamicStyles.followUpOverdueText}>overdue</Text>
                        </View>
                      </View>
                    </View>
                  );
                  
                  return (
                    <Swipeable
                      key={index}
                      renderRightActions={renderRightActions}
                      overshootRight={false}
                    >
                      {cardContent}
                    </Swipeable>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      )}
    </>
  );

  // Render the Upcoming Interviews Section (used in both layouts)
  const renderUpcomingInterviewsSection = () => (
    <>
      {upcomingInterviews.length > 0 && (
        <View style={[dynamicStyles.section, isTablet && { marginBottom: 16 }]}>
          <Text style={dynamicStyles.sectionTitle}>
            <Ionicons name="calendar" size={16} color="#8B5CF6" /> Upcoming Interviews
          </Text>
          <View style={dynamicStyles.upcomingContainer}>
            {upcomingInterviews.map((interview, index) => {
              // Get status color for badge
              const statusColors: any = {
                'applied': '#3B82F6',
                'recruiter_screening': '#8B5CF6',
                'phone_screen': '#6366F1',
                'coding_round_1': '#EC4899',
                'coding_round_2': '#EC4899',
                'system_design': '#F59E0B',
                'behavioural': '#10B981',
                'hiring_manager': '#14B8A6',
                'final_round': '#22C55E',
                'offer': '#22C55E',
                'rejected': '#EF4444'
              };
              const statusColor = statusColors[interview.status] || '#6B7280';
              const formatStatus = (status: string) => status?.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') || 'Applied';
              const isLastItem = index === upcomingInterviews.length - 1;
              
              return (
                <View key={interview.job_id || index} style={[dynamicStyles.upcomingCard, !isLastItem && dynamicStyles.upcomingCardWithBorder]}>
                  <View style={dynamicStyles.upcomingDateBadge}>
                    <Text style={dynamicStyles.upcomingDateDay}>
                      {interview.schedule_date?.split(' ')[1]?.replace(',', '') || '--'}
                    </Text>
                    <Text style={dynamicStyles.upcomingDateMonth}>
                      {interview.schedule_date?.split(' ')[0] || '--'}
                    </Text>
                  </View>
                  <View style={dynamicStyles.upcomingDetails}>
                    <Text style={dynamicStyles.upcomingCompany} numberOfLines={1}>
                      {interview.company_name}
                    </Text>
                    <Text style={dynamicStyles.upcomingPosition} numberOfLines={1}>
                      {interview.position}
                    </Text>
                  </View>
                  <View style={dynamicStyles.upcomingStageBadgeRight}>
                    <View style={[dynamicStyles.stageDot, { backgroundColor: STATUS_COLORS[interview.stage] || '#8B5CF6' }]} />
                    <Text style={dynamicStyles.upcomingStageTextRight}>
                      {interview.stage?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      {/* Header with Liquid Glass effect */}
      <BlurView 
        intensity={isDark ? 40 : 60} 
        tint={isDark ? 'dark' : 'light'}
        style={dynamicStyles.header}
      >
        <View style={dynamicStyles.headerContent}>
          <View style={dynamicStyles.headerLeft}>
            <Text style={dynamicStyles.greeting}>{getGreeting()}</Text>
            {getDisplayName() && (
              <Text style={dynamicStyles.userName}>{getDisplayName()}</Text>
            )}
          </View>
          <Text style={dynamicStyles.dateText}>{format(new Date(), 'EEE, MMM d, yyyy')}</Text>
        </View>
      </BlurView>

      {/* Tablet Layout - Split View */}
      {isTablet ? (
        <View style={dynamicStyles.tabletContainer}>
          {/* Left Column - Stats and Charts */}
          <ScrollView
            style={dynamicStyles.tabletLeftColumn}
            contentContainerStyle={dynamicStyles.tabletScrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            showsVerticalScrollIndicator={false}
          >
            {/* Summary Stats Row */}
            <View style={dynamicStyles.statsRow}>
              <TouchableOpacity style={dynamicStyles.statCard} onPress={() => handleStatCardPress('all')} activeOpacity={0.7}>
                <View style={[dynamicStyles.statIcon, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name="briefcase" size={18} color={colors.primary} />
                </View>
                <Text style={dynamicStyles.statNumber}>{stats?.total || 0}</Text>
                <Text style={dynamicStyles.statLabel}>Total</Text>
              </TouchableOpacity>
              <TouchableOpacity style={dynamicStyles.statCard} onPress={() => handleStatCardPress('last_10_days')} activeOpacity={0.7}>
                <View style={[dynamicStyles.statIcon, { backgroundColor: '#10B98120' }]}>
                  <Ionicons name="trending-up" size={18} color="#10B981" />
                </View>
                <Text style={dynamicStyles.statNumber}>{stats?.last_10_days || 0}</Text>
                <Text style={dynamicStyles.statLabel}>Last 10 Days</Text>
              </TouchableOpacity>
              <TouchableOpacity style={dynamicStyles.statCard} onPress={() => handleStatCardPress('final_round')} activeOpacity={0.7}>
                <View style={[dynamicStyles.statIcon, { backgroundColor: '#8B5CF620' }]}>
                  <Ionicons name="flag" size={18} color="#8B5CF6" />
                </View>
                <Text style={dynamicStyles.statNumber}>{stats?.final_round || 0}</Text>
                <Text style={dynamicStyles.statLabel}>Final Round</Text>
              </TouchableOpacity>
              <TouchableOpacity style={dynamicStyles.statCard} onPress={() => handleStatCardPress('offers')} activeOpacity={0.7}>
                <View style={[dynamicStyles.statIcon, { backgroundColor: '#22C55E20' }]}>
                  <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
                </View>
                <Text style={dynamicStyles.statNumber}>{stats?.offer || 0}</Text>
                <Text style={dynamicStyles.statLabel}>Offers</Text>
              </TouchableOpacity>
              <TouchableOpacity style={dynamicStyles.statCard} onPress={() => handleStatCardPress('rejected')} activeOpacity={0.7}>
                <View style={[dynamicStyles.statIcon, { backgroundColor: '#EF444420' }]}>
                  <Ionicons name="close-circle" size={18} color="#EF4444" />
                </View>
                <Text style={dynamicStyles.statNumber}>{stats?.rejected || 0}</Text>
                <Text style={dynamicStyles.statLabel}>Rejected</Text>
              </TouchableOpacity>
            </View>

            {/* Application Status Chart */}
            <View style={dynamicStyles.section}>
              <Text style={dynamicStyles.sectionTitle}>By Application Status</Text>
              {barChartData.length > 0 ? (
                <View style={dynamicStyles.chartCard}>
                  {barChartData.map((item, index) => (
                    <View key={index} style={dynamicStyles.barRow}>
                      <Text style={dynamicStyles.barLabel}>{item.label}</Text>
                      <View style={dynamicStyles.barContainer}>
                        <View style={[dynamicStyles.bar, { width: `${(item.value / maxValue) * 100}%`, backgroundColor: item.color }]} />
                      </View>
                      <Text style={dynamicStyles.barValue}>{item.value}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={dynamicStyles.emptyChart}>
                  <Ionicons name="bar-chart-outline" size={48} color={colors.textSecondary} />
                  <Text style={dynamicStyles.emptyText}>No applications yet</Text>
                  <Text style={dynamicStyles.emptySubtext}>Add your first job to see stats</Text>
                </View>
              )}
            </View>

            {/* Two Column Layout for Work Mode and Position */}
            <View style={dynamicStyles.tabletChartsRow}>
              {/* Work Mode Chart - Compact */}
              <View style={[dynamicStyles.section, { flex: 0.35, marginRight: 8 }]}>
                <Text style={dynamicStyles.sectionTitle}>By Work Mode</Text>
                <View style={dynamicStyles.chartCard}>
                  {maxWorkModeValue > 0 ? (
                    <View style={dynamicStyles.workModeContainerCompact}>
                      {workModeBarData.map((item, index) => (
                        <TouchableOpacity key={index} style={dynamicStyles.workModeRowCompact} onPress={() => handleWorkModePress(item.label.toLowerCase())} activeOpacity={0.7}>
                          <View style={dynamicStyles.workModeBarWrapperCompact}>
                            <View style={[dynamicStyles.workModeBar, { height: `${(item.value / maxWorkModeValue) * 100}%`, backgroundColor: item.frontColor }]} />
                          </View>
                          <Text style={dynamicStyles.workModeValueCompact}>{item.value}</Text>
                          <Text style={dynamicStyles.workModeLabelCompact}>{item.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <View style={dynamicStyles.emptyChartSmall}>
                      <Ionicons name="analytics-outline" size={32} color={colors.textSecondary} />
                      <Text style={dynamicStyles.emptySubtext}>No work mode data</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Position Chart - Expanded */}
              {positionChartData.length > 0 && (
                <View style={[dynamicStyles.section, { flex: 0.65, marginLeft: 8 }]}>
                  <Text style={dynamicStyles.sectionTitle}>By Position</Text>
                  <View style={dynamicStyles.chartCard}>
                    {positionChartData.map((item, index) => (
                      <View key={index} style={dynamicStyles.barRow}>
                        <Text style={dynamicStyles.barLabelWide} numberOfLines={1}>{item.label}</Text>
                        <View style={dynamicStyles.barContainer}>
                          <View style={[dynamicStyles.bar, { width: `${(item.value / maxPositionValue) * 100}%`, backgroundColor: item.color }]} />
                        </View>
                        <Text style={dynamicStyles.barValue}>{item.value}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Location Chart */}
            {pieChartData.length > 0 && (
              <View style={dynamicStyles.section}>
                <Text style={dynamicStyles.sectionTitle}>By Location</Text>
                <View style={dynamicStyles.chartCard}>
                  <View style={dynamicStyles.donutContainer}>
                    <Svg width={160} height={160} viewBox="0 0 160 160">
                      <G rotation={-90} origin="80, 80">
                        {(() => {
                          const total = pieChartData.reduce((sum, item) => sum + item.value, 0);
                          let currentAngle = 0;
                          const radius = 60;
                          const strokeWidth = 24;
                          const circumference = 2 * Math.PI * radius;
                          return pieChartData.map((item, index) => {
                            const percentage = item.value / total;
                            const strokeDasharray = `${percentage * circumference} ${circumference}`;
                            const strokeDashoffset = -currentAngle * circumference;
                            currentAngle += percentage;
                            return (
                              <Circle key={index} cx="80" cy="80" r={radius} stroke={item.color} strokeWidth={strokeWidth} fill="transparent" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
                            );
                          });
                        })()}
                      </G>
                      <Circle cx="80" cy="80" r="36" fill={colors.card} />
                    </Svg>
                    <View style={dynamicStyles.donutCenterText}>
                      <Text style={[dynamicStyles.donutNumber, { color: colors.text }]}>{stats?.total || 0}</Text>
                      <Text style={[dynamicStyles.donutLabel, { color: colors.textSecondary }]}>Total</Text>
                    </View>
                  </View>
                  <View style={dynamicStyles.legendContainer}>
                    {pieChartData.map((item, index) => (
                      <View key={index} style={dynamicStyles.legendItem}>
                        <View style={[dynamicStyles.legendDot, { backgroundColor: item.color }]} />
                        <Text style={dynamicStyles.legendText} numberOfLines={1}>{item.label}</Text>
                        <Text style={dynamicStyles.legendValue}>{item.value}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>

          {/* Right Column - Follow-ups, Upcoming, then Insights */}
          <ScrollView
            style={dynamicStyles.tabletRightColumn}
            contentContainerStyle={dynamicStyles.tabletScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {renderFollowUpsOnlySection()}
            {renderUpcomingInterviewsSection()}
            {renderInsightsOnlySection()}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      ) : (
        /* Mobile Layout - Single Column */
        <ScrollView
          style={dynamicStyles.scrollView}
          contentContainerStyle={dynamicStyles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* Summary Stats Row */}
          <View style={dynamicStyles.statsRow}>
            <TouchableOpacity style={dynamicStyles.statCard} onPress={() => handleStatCardPress('all')} activeOpacity={0.7}>
              <View style={[dynamicStyles.statIcon, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="briefcase" size={18} color={colors.primary} />
              </View>
              <Text style={dynamicStyles.statNumber}>{stats?.total || 0}</Text>
              <Text style={dynamicStyles.statLabel}>Total</Text>
            </TouchableOpacity>
            <TouchableOpacity style={dynamicStyles.statCard} onPress={() => handleStatCardPress('last_10_days')} activeOpacity={0.7}>
              <View style={[dynamicStyles.statIcon, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="trending-up" size={18} color="#10B981" />
              </View>
              <Text style={dynamicStyles.statNumber}>{stats?.last_10_days || 0}</Text>
              <Text style={dynamicStyles.statLabel}>Last 10 Days</Text>
            </TouchableOpacity>
            <TouchableOpacity style={dynamicStyles.statCard} onPress={() => handleStatCardPress('final_round')} activeOpacity={0.7}>
              <View style={[dynamicStyles.statIcon, { backgroundColor: '#8B5CF620' }]}>
                <Ionicons name="flag" size={18} color="#8B5CF6" />
              </View>
              <Text style={dynamicStyles.statNumber}>{stats?.final_round || 0}</Text>
              <Text style={dynamicStyles.statLabel}>Final Round</Text>
            </TouchableOpacity>
            <TouchableOpacity style={dynamicStyles.statCard} onPress={() => handleStatCardPress('offers')} activeOpacity={0.7}>
              <View style={[dynamicStyles.statIcon, { backgroundColor: '#22C55E20' }]}>
                <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
              </View>
              <Text style={dynamicStyles.statNumber}>{stats?.offer || 0}</Text>
              <Text style={dynamicStyles.statLabel}>Offers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={dynamicStyles.statCard} onPress={() => handleStatCardPress('rejected')} activeOpacity={0.7}>
              <View style={[dynamicStyles.statIcon, { backgroundColor: '#EF444420' }]}>
                <Ionicons name="close-circle" size={18} color="#EF4444" />
              </View>
              <Text style={dynamicStyles.statNumber}>{stats?.rejected || 0}</Text>
              <Text style={dynamicStyles.statLabel}>Rejected</Text>
            </TouchableOpacity>
          </View>

          {/* Application Status Chart */}
          <View style={dynamicStyles.section}>
            <Text style={dynamicStyles.sectionTitle}>By Application Status</Text>
            {barChartData.length > 0 ? (
              <View style={dynamicStyles.chartCard}>
                {barChartData.map((item, index) => (
                  <View key={index} style={dynamicStyles.barRow}>
                    <Text style={dynamicStyles.barLabel}>{item.label}</Text>
                    <View style={dynamicStyles.barContainer}>
                      <View style={[dynamicStyles.bar, { width: `${(item.value / maxValue) * 100}%`, backgroundColor: item.color }]} />
                    </View>
                    <Text style={dynamicStyles.barValue}>{item.value}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={dynamicStyles.emptyChart}>
                <Ionicons name="bar-chart-outline" size={48} color={colors.textSecondary} />
                <Text style={dynamicStyles.emptyText}>No applications yet</Text>
                <Text style={dynamicStyles.emptySubtext}>Add your first job to see stats</Text>
              </View>
            )}
          </View>

          {/* Work Mode Chart */}
          <View style={dynamicStyles.section}>
            <Text style={dynamicStyles.sectionTitle}>By Work Mode</Text>
            <View style={dynamicStyles.chartCard}>
              {maxWorkModeValue > 0 ? (
                <View style={dynamicStyles.workModeContainer}>
                  {workModeBarData.map((item, index) => (
                    <TouchableOpacity key={index} style={dynamicStyles.workModeRow} onPress={() => handleWorkModePress(item.label.toLowerCase())} activeOpacity={0.7}>
                      <View style={dynamicStyles.workModeBarWrapper}>
                        <View style={[dynamicStyles.workModeBar, { height: `${(item.value / maxWorkModeValue) * 100}%`, backgroundColor: item.frontColor }]} />
                      </View>
                      <Text style={dynamicStyles.workModeValue}>{item.value}</Text>
                      <Text style={dynamicStyles.workModeLabel}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={dynamicStyles.emptyChartSmall}>
                  <Ionicons name="analytics-outline" size={32} color={colors.textSecondary} />
                  <Text style={dynamicStyles.emptySubtext}>No work mode data</Text>
                </View>
              )}
            </View>
          </View>

          {/* Position Chart */}
          {positionChartData.length > 0 && (
            <View style={dynamicStyles.section}>
              <Text style={dynamicStyles.sectionTitle}>By Position</Text>
              <View style={dynamicStyles.chartCard}>
                {positionChartData.map((item, index) => (
                  <View key={index} style={dynamicStyles.barRow}>
                    <Text style={dynamicStyles.barLabelWide} numberOfLines={1}>{item.label}</Text>
                    <View style={dynamicStyles.barContainer}>
                      <View style={[dynamicStyles.bar, { width: `${(item.value / maxPositionValue) * 100}%`, backgroundColor: item.color }]} />
                    </View>
                    <Text style={dynamicStyles.barValue}>{item.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Location Chart */}
          {pieChartData.length > 0 && (
            <View style={dynamicStyles.section}>
              <Text style={dynamicStyles.sectionTitle}>By Location</Text>
              <View style={dynamicStyles.chartCard}>
                <View style={dynamicStyles.locationChartRow}>
                  {/* Donut Chart - Left Side */}
                  <View style={dynamicStyles.donutContainerLeft}>
                    <Svg width={140} height={140} viewBox="0 0 160 160">
                      <G rotation={-90} origin="80, 80">
                        {(() => {
                          const total = pieChartData.reduce((sum, item) => sum + item.value, 0);
                          let currentAngle = 0;
                          const radius = 60;
                          const strokeWidth = 24;
                          const circumference = 2 * Math.PI * radius;
                          return pieChartData.map((item, index) => {
                            const percentage = item.value / total;
                            const strokeDasharray = `${percentage * circumference} ${circumference}`;
                            const strokeDashoffset = -currentAngle * circumference;
                            currentAngle += percentage;
                            return (
                              <Circle key={index} cx="80" cy="80" r={radius} stroke={item.color} strokeWidth={strokeWidth} fill="transparent" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
                            );
                          });
                        })()}
                      </G>
                      <Circle cx="80" cy="80" r="36" fill={colors.card} />
                    </Svg>
                    <View style={dynamicStyles.donutCenterTextSmall}>
                      <Text style={[dynamicStyles.donutNumber, { color: colors.text, fontSize: 20 }]}>{stats?.total || 0}</Text>
                      <Text style={[dynamicStyles.donutLabel, { color: colors.textSecondary, fontSize: 10 }]}>Total</Text>
                    </View>
                  </View>
                  {/* Legend - Right Side */}
                  <View style={dynamicStyles.legendContainerRight}>
                    {pieChartData.map((item, index) => (
                      <View key={index} style={dynamicStyles.legendItemRight}>
                        <View style={[dynamicStyles.legendDot, { backgroundColor: item.color }]} />
                        <Text style={dynamicStyles.legendTextRight} numberOfLines={1}>{item.label}</Text>
                        <Text style={dynamicStyles.legendValueRight}>{item.value}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Insights and Follow-ups */}
          {renderInsightsSection()}

          {/* Upcoming Interviews */}
          {renderUpcomingInterviewsSection()}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: colors.background,
  },
  loader: { 
    flex: 1 
  },
  header: { 
    backgroundColor: isDark ? 'rgba(28, 28, 30, 0.7)' : 'rgba(255, 255, 255, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.6)',
    opacity: 0.8,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: isDark ? '#FFFFFF' : '#000000',
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: isDark ? 'rgba(255, 255, 255, 0.9)' : colors.primary,
    opacity: 0.95,
  },
  scrollView: { 
    flex: 1 
  },
  scrollContent: { 
    padding: 16 
  },
  // Tablet Layout Styles
  tabletContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  tabletLeftColumn: {
    flex: 0.6,
    borderRightWidth: 1,
    borderRightColor: isDark ? '#333' : '#E5E7EB',
  },
  tabletRightColumn: {
    flex: 0.4,
    backgroundColor: isDark ? '#1C1C1E' : '#F9FAFB',
  },
  tabletScrollContent: {
    padding: 16,
  },
  tabletChartsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  // Stats Row - All cards in single row with Liquid Glass effect
  statsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: isDark ? 'rgba(44, 44, 46, 0.6)' : 'rgba(255, 255, 255, 0.8)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.3 : 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 0.5,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  // Section
  section: {
    marginBottom: 20,
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: '600', 
    marginBottom: 12,
    color: colors.text,
  },
  // Chart Card with Liquid Glass effect
  chartCard: { 
    backgroundColor: isDark ? 'rgba(44, 44, 46, 0.6)' : 'rgba(255, 255, 255, 0.85)',
    borderRadius: 18, 
    padding: 16, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: isDark ? 0.25 : 0.08, 
    shadowRadius: 12, 
    elevation: 4,
    borderWidth: 0.5,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  barLabel: {
    width: 65,
    fontSize: 11,
    color: colors.textSecondary,
  },
  barLabelWide: {
    width: 140,
    fontSize: 11,
    color: colors.textSecondary,
  },
  barContainer: {
    flex: 1,
    height: 18,
    backgroundColor: isDark ? '#2C2C2E' : '#F3F4F6',
    borderRadius: 9,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 9,
    minWidth: 4,
  },
  barValue: {
    width: 24,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyChart: { 
    backgroundColor: colors.card,
    borderRadius: 16, 
    padding: 32, 
    alignItems: 'center', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 6, 
    elevation: 3,
  },
  emptyChartSmall: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: { 
    fontSize: 16, 
    marginTop: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  // Bar Chart Container
  barChartContainer: {
    alignItems: 'center',
    paddingTop: 10,
  },
  // Pie Chart
  pieChartContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  pieCenterLabel: {
    alignItems: 'center',
  },
  pieCenterNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  pieCenterText: {
    fontSize: 11,
  },
  // Legend
  legendContainer: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    marginBottom: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    flex: 1,
    fontSize: 12,
    color: colors.text,
  },
  legendValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  // Insights
  insightsCard: { 
    backgroundColor: colors.card,
    borderRadius: 16, 
    padding: 16, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 6, 
    elevation: 3,
  },
  insightRow: { 
    marginBottom: 10,
  },
  insightText: { 
    fontSize: 14, 
    lineHeight: 20,
    color: colors.text,
  },
  followUpRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  followUpCheckbox: {
    marginRight: 10,
    marginTop: 1,
  },
  followUpContent: {
    flex: 1,
  },
  followUpText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },
  followUpDays: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
  },
  // Work Mode Chart Styles
  workModeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 120,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  workModeRow: {
    alignItems: 'center',
    flex: 1,
  },
  workModeBarWrapper: {
    height: 80,
    width: 30,
    backgroundColor: isDark ? '#2C2C2E' : '#F3F4F6',
    borderRadius: 15,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginBottom: 8,
  },
  workModeBar: {
    width: '100%',
    borderRadius: 15,
    minHeight: 4,
  },
  workModeValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  workModeLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // Compact Work Mode Chart Styles (for tablet)
  workModeContainerCompact: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 100,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  workModeRowCompact: {
    alignItems: 'center',
    flex: 1,
  },
  workModeBarWrapperCompact: {
    height: 60,
    width: 24,
    backgroundColor: isDark ? '#2C2C2E' : '#F3F4F6',
    borderRadius: 12,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginBottom: 6,
  },
  workModeValueCompact: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  workModeLabelCompact: {
    fontSize: 9,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // Donut Chart Styles
  donutContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    position: 'relative',
  },
  donutCenterText: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Location Chart Row Layout
  locationChartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  donutContainerLeft: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flex: 0,
  },
  donutCenterTextSmall: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendContainerRight: {
    flex: 1,
    marginLeft: 16,
    gap: 6,
  },
  legendItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendTextRight: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  legendValueRight: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    minWidth: 24,
    textAlign: 'right',
  },
  donutOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  donutInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  donutNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  donutLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  // Upcoming Interviews Styles
  upcomingContainer: {
    gap: 10,
  },
  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
  },
  upcomingCardWithBorder: {
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#333' : '#E5E7EB',
    marginBottom: 8,
  },
  upcomingDateBadge: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  upcomingDateDay: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  upcomingDateMonth: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFF',
    opacity: 0.9,
    textTransform: 'uppercase',
  },
  upcomingDetails: {
    flex: 1,
  },
  upcomingCompany: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  upcomingPosition: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  upcomingStageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  upcomingStageBadgeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 10,
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  upcomingStageText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  upcomingStageTextRight: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B5CF6',
    textTransform: 'capitalize',
  },
  upcomingStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  upcomingStatusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.3,
  },
  upcomingDaysContainer: {
    marginLeft: 10,
    alignItems: 'center',
  },
  upcomingToday: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
    textTransform: 'uppercase',
  },
  upcomingTomorrow: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F59E0B',
  },
  upcomingDays: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  // Enhanced Insights Grid
  insightsGrid: {
    gap: 10,
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  insightCardUrgent: {
    backgroundColor: isDark ? '#3F1B1B' : '#FEE2E2',
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  insightCardSuccess: {
    backgroundColor: isDark ? '#1B3F2D' : '#D1FAE5',
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  insightCardEncouragement: {
    backgroundColor: isDark ? '#3F1B3F' : '#FCE7F3',
    borderLeftWidth: 3,
    borderLeftColor: '#EC4899',
  },
  insightIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  insightCardText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  // Enhanced Follow-ups
  followUpsContainer: {
    gap: 10,
  },
  followUpCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  followUpCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  followUpCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  followUpCompany: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  followUpStatus: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  followUpBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  followUpBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFF',
  },
  followUpCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: isDark ? '#333' : '#F3F4F6',
    gap: 6,
  },
  followUpHint: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  followUpSummary: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  followUpSummaryText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  // Compact Follow-up Card styles
  followUpCardCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
  },
  followUpCardWithBorder: {
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#333' : '#E5E7EB',
    marginBottom: 8,
  },
  followUpCardContent: {
    flex: 1,
  },
  followUpTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  followUpCompanyCompact: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  followUpRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  followUpMailIcon: {
    padding: 4,
  },
  followUpStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  followUpStatusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.3,
  },
  followUpDaysCounter: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  followUpDaysNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  followUpDaysLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
  },
  followUpBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  followUpOverdueText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  followUpDeleteAction: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 10,
    marginLeft: 8,
  },
  followUpDeleteActionText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});
