import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Dimensions, Platform, TouchableOpacity } from 'react-native';
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

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

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
  const { user, sessionToken } = useAuth();
  const { colors, isDark } = useTheme();
  const { setFilter } = useFilter();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [actionedFollowUps, setActionedFollowUps] = useState<Set<number>>(new Set());

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

  useFocusEffect(
    React.useCallback(() => {
      fetchData();
    }, [sessionToken])
  );

  const fetchData = async () => {
    if (!sessionToken) return;
    
    try {
      const [statsRes, insightsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/dashboard/stats`, {
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        }),
        fetch(`${BACKEND_URL}/api/dashboard/ai-insights`, {
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

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      {/* Header with integrated date including day */}
      <View style={dynamicStyles.header}>
        <View style={dynamicStyles.headerContent}>
          <View style={dynamicStyles.headerLeft}>
            <Text style={dynamicStyles.greeting}>Welcome back,</Text>
            <Text style={dynamicStyles.userName}>{user?.name?.split(' ')[0] || 'User'}</Text>
          </View>
          <Text style={dynamicStyles.dateText}>{format(new Date(), 'EEE, MMM d, yyyy')}</Text>
        </View>
      </View>

      <ScrollView
        style={dynamicStyles.scrollView}
        contentContainerStyle={dynamicStyles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Summary Stats Row - Interactive with Navigation */}
        <View style={dynamicStyles.statsRow}>
          <TouchableOpacity 
            style={dynamicStyles.statCard}
            onPress={() => handleStatCardPress('all')}
            activeOpacity={0.7}
          >
            <View style={[dynamicStyles.statIcon, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="briefcase" size={18} color={colors.primary} />
            </View>
            <Text style={dynamicStyles.statNumber}>{stats?.total || 0}</Text>
            <Text style={dynamicStyles.statLabel}>Total</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={dynamicStyles.statCard}
            onPress={() => handleStatCardPress('last_10_days')}
            activeOpacity={0.7}
          >
            <View style={[dynamicStyles.statIcon, { backgroundColor: '#10B98120' }]}>
              <Ionicons name="trending-up" size={18} color="#10B981" />
            </View>
            <Text style={dynamicStyles.statNumber}>{stats?.last_10_days || 0}</Text>
            <Text style={dynamicStyles.statLabel}>Last 10 Days</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={dynamicStyles.statCard}
            onPress={() => handleStatCardPress('final_round')}
            activeOpacity={0.7}
          >
            <View style={[dynamicStyles.statIcon, { backgroundColor: '#8B5CF620' }]}>
              <Ionicons name="flag" size={18} color="#8B5CF6" />
            </View>
            <Text style={dynamicStyles.statNumber}>{stats?.final_round || 0}</Text>
            <Text style={dynamicStyles.statLabel}>Final Round</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={dynamicStyles.statCard}
            onPress={() => handleStatCardPress('offers')}
            activeOpacity={0.7}
          >
            <View style={[dynamicStyles.statIcon, { backgroundColor: '#22C55E20' }]}>
              <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
            </View>
            <Text style={dynamicStyles.statNumber}>{stats?.offer || 0}</Text>
            <Text style={dynamicStyles.statLabel}>Offers</Text>
          </TouchableOpacity>
        </View>

        {/* Horizontal Bar Chart - By Status */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>By Status</Text>
          
          {barChartData.length > 0 ? (
            <View style={dynamicStyles.chartCard}>
              {barChartData.map((item, index) => (
                <View key={index} style={dynamicStyles.barRow}>
                  <Text style={dynamicStyles.barLabel}>{item.label}</Text>
                  <View style={dynamicStyles.barContainer}>
                    <View 
                      style={[
                        dynamicStyles.bar, 
                        { 
                          width: `${(item.value / maxValue) * 100}%`,
                          backgroundColor: item.color 
                        }
                      ]} 
                    />
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

        {/* Work Mode Statistics - Simple Bar Chart */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>By Work Mode</Text>
          <View style={dynamicStyles.chartCard}>
            {maxWorkModeValue > 0 ? (
              <View style={dynamicStyles.workModeContainer}>
                {workModeBarData.map((item, index) => (
                  <View key={index} style={dynamicStyles.workModeRow}>
                    <View style={dynamicStyles.workModeBarWrapper}>
                      <View 
                        style={[
                          dynamicStyles.workModeBar, 
                          { 
                            height: `${(item.value / maxWorkModeValue) * 100}%`,
                            backgroundColor: item.frontColor 
                          }
                        ]} 
                      />
                    </View>
                    <Text style={dynamicStyles.workModeValue}>{item.value}</Text>
                    <Text style={dynamicStyles.workModeLabel}>{item.label}</Text>
                  </View>
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

        {/* Location Statistics - SVG Donut Chart */}
        {pieChartData.length > 0 && (
          <View style={dynamicStyles.section}>
            <Text style={dynamicStyles.sectionTitle}>By Location</Text>
            <View style={dynamicStyles.chartCard}>
              {/* SVG Donut Chart */}
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
                          <Circle
                            key={index}
                            cx="80"
                            cy="80"
                            r={radius}
                            stroke={item.color}
                            strokeWidth={strokeWidth}
                            fill="transparent"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                          />
                        );
                      });
                    })()}
                  </G>
                  {/* Center circle for donut effect */}
                  <Circle cx="80" cy="80" r="36" fill={colors.card} />
                </Svg>
                {/* Center text overlay */}
                <View style={dynamicStyles.donutCenterText}>
                  <Text style={[dynamicStyles.donutNumber, { color: colors.text }]}>
                    {stats?.total || 0}
                  </Text>
                  <Text style={[dynamicStyles.donutLabel, { color: colors.textSecondary }]}>
                    Total
                  </Text>
                </View>
              </View>
              
              {/* Legend */}
              <View style={dynamicStyles.legendContainer}>
                {pieChartData.map((item, index) => (
                  <View key={index} style={dynamicStyles.legendItem}>
                    <View style={[dynamicStyles.legendDot, { backgroundColor: item.color }]} />
                    <Text style={dynamicStyles.legendText} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <Text style={dynamicStyles.legendValue}>{item.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Insights - Split into Strategic and Follow-ups */}
        {(insights.length > 0 || followUps.length > 0) && (
          <View style={dynamicStyles.section}>
            {/* Strategic Insights */}
            <Text style={dynamicStyles.sectionTitle}>
              <Ionicons name="sparkles" size={16} color={colors.primary} /> Strategic Insights
            </Text>
            <View style={dynamicStyles.insightsCard}>
              {insights.map((insight, index) => (
                <View key={index} style={[dynamicStyles.insightRow, index === insights.length - 1 && { marginBottom: 0 }]}>
                  <Text style={dynamicStyles.insightText}>{insight}</Text>
                </View>
              ))}
            </View>
            
            {/* Follow-up Reminders */}
            {followUps.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={dynamicStyles.sectionTitle}>
                  <Ionicons name="notifications" size={16} color="#F59E0B" /> Follow-up Reminders
                </Text>
                <View style={[dynamicStyles.insightsCard, { borderLeftWidth: 3, borderLeftColor: '#F59E0B' }]}>
                  {followUps.map((followUp, index) => (
                    <View key={index} style={[dynamicStyles.followUpRow, index === followUps.length - 1 && { marginBottom: 0 }]}>
                      <Text style={dynamicStyles.followUpText}>{followUp}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

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
  loader: { 
    flex: 1 
  },
  header: { 
    backgroundColor: colors.headerBackground,
    paddingHorizontal: 20,
    paddingVertical: 16,
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
    color: colors.headerText,
    opacity: 0.8,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.headerText,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    opacity: 0.95,
  },
  scrollView: { 
    flex: 1 
  },
  scrollContent: { 
    padding: 16 
  },
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statLabel: {
    fontSize: 10,
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
  // Chart Card
  chartCard: { 
    backgroundColor: colors.card,
    borderRadius: 16, 
    padding: 16, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 6, 
    elevation: 3,
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
    marginBottom: 8,
  },
  followUpText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
});
