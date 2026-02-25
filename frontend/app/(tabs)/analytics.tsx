import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useFilter } from '../../contexts/FilterContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import Svg, { Path, Circle, G, Rect, Line } from 'react-native-svg';

// Get backend URL from configuration
const getBackendUrl = (): string => {
  const configUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL;
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  return configUrl || envUrl || '';
};
const BACKEND_URL = getBackendUrl();

const { width: screenWidth } = Dimensions.get('window');

// Types
interface HeroKPI {
  pipeline_health: number;
  health_label: string;
  total_applications: number;
  active_in_pipeline: number;
}

interface Metrics {
  response_rate: number;
  response_trend: number;
  interview_rate: number;
  interview_trend: number;
  offer_rate: number;
  velocity: number;
  velocity_change: number;
}

interface FunnelStage {
  stage: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

interface Insight {
  id: string;
  maturity_level: number;
  maturity_label: string;
  title: string;
  message: string;
  icon: string;
  color: string;
  confidence: number;
  action: string | null;
}

interface OfferProbability {
  probability: number;
  confidence: number;
  label: string;
}

interface AnalyticsData {
  hero_kpi: HeroKPI;
  metrics: Metrics;
  funnel: FunnelStage[];
  insight: Insight;
  offer_probability: OfferProbability;
  sparkline: number[];
  status_breakdown: Record<string, number>;
}

export default function AnalyticsScreen() {
  const { sessionToken } = useAuth();
  const { isDark } = useTheme();
  const { setFilter } = useFilter();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddJobModal, setShowAddJobModal] = useState(false);

  const colors = {
    background: isDark ? '#000000' : '#F8FAFC',
    card: isDark ? '#1C1C1E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#1F2937',
    textSecondary: isDark ? '#8E8E93' : '#6B7280',
    border: isDark ? '#2C2C2E' : '#E5E7EB',
    primary: '#3B82F6',
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
  };

  // Navigate to My Jobs with filter
  const navigateToMyJobs = (filterType: 'all' | 'active') => {
    if (filterType === 'active') {
      setFilter('active', 'all');
    } else {
      setFilter('all', 'all');
    }
    router.push('/(tabs)/my-jobs');
  };

  const fetchAnalytics = useCallback(async () => {
    if (!sessionToken) return;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/analytics/summary`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Analytics fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionToken]);

  useFocusEffect(
    useCallback(() => {
      fetchAnalytics();
    }, [fetchAnalytics])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Hero Progress Ring Component
  const HeroProgressRing = ({ health, label }: { health: number; label: string }) => {
    const size = 140;
    const strokeWidth = 12;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const progress = (health / 100) * circumference;
    
    const getHealthColor = (h: number) => {
      if (h >= 80) return colors.success;
      if (h >= 60) return '#22C55E';
      if (h >= 40) return colors.warning;
      if (h >= 20) return '#F97316';
      return colors.danger;
    };
    
    return (
      <View style={styles.heroRingContainer}>
        <Svg width={size} height={size}>
          {/* Background circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={isDark ? '#2C2C2E' : '#E5E7EB'}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={getHealthColor(health)}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${progress} ${circumference}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={styles.heroRingContent}>
          <Text style={[styles.heroRingValue, { color: colors.text }]}>{Math.round(health)}</Text>
          <Text style={[styles.heroRingLabel, { color: colors.textSecondary }]}>{label}</Text>
        </View>
      </View>
    );
  };

  // Metric Card Component
  const MetricCard = ({ 
    title, 
    value, 
    suffix = '%',
    trend,
    icon,
    color 
  }: { 
    title: string; 
    value: number; 
    suffix?: string;
    trend?: number;
    icon: string;
    color: string;
  }) => (
    <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.metricIconContainer, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={[styles.metricValue, { color: colors.text }]}>
        {value}{suffix}
      </Text>
      <Text style={[styles.metricTitle, { color: colors.textSecondary }]}>{title}</Text>
      {trend !== undefined && (
        <View style={styles.trendContainer}>
          <Ionicons 
            name={trend >= 0 ? 'trending-up' : 'trending-down'} 
            size={12} 
            color={trend >= 0 ? colors.success : colors.danger} 
          />
          <Text style={[
            styles.trendText, 
            { color: trend >= 0 ? colors.success : colors.danger }
          ]}>
            {trend >= 0 ? '+' : ''}{trend}%
          </Text>
        </View>
      )}
    </View>
  );

  // Pipeline Funnel Component
  const PipelineFunnel = ({ funnel }: { funnel: FunnelStage[] }) => {
    const maxCount = Math.max(...funnel.map(f => f.count), 1);
    // Filter to show only stages with activity or key stages
    const displayStages = funnel.filter(f => 
      f.count > 0 || ['applied', 'offer', 'rejected'].includes(f.stage)
    );
    
    return (
      <View style={[styles.funnelContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.funnelHeader}>
          <Ionicons name="funnel" size={18} color={colors.primary} />
          <Text style={[styles.funnelTitle, { color: colors.text }]}>Pipeline Funnel</Text>
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.funnelBars}
        >
          {funnel.map((stage, index) => (
            <View key={stage.stage} style={[styles.funnelStage, { minWidth: 50 }]}>
              <View style={styles.funnelBarContainer}>
                <View 
                  style={[
                    styles.funnelBar, 
                    { 
                      backgroundColor: stage.count > 0 ? stage.color : (isDark ? '#2C2C2E' : '#E5E7EB'),
                      height: Math.max(4, (stage.count / maxCount) * 60)
                    }
                  ]} 
                />
              </View>
              <Text style={[styles.funnelCount, { color: colors.text }]}>{stage.count}</Text>
              <Text style={[styles.funnelLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                {stage.label}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Sparkline Component (Canvas-based using SVG)
  const Sparkline = ({ data }: { data: number[] }) => {
    const width = screenWidth - 64;
    const height = 60;
    const padding = 8;
    const maxValue = Math.max(...data, 1);
    
    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
      const y = height - padding - (value / maxValue) * (height - 2 * padding);
      return { x, y, value };
    });
    
    const pathData = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');
    
    // Area path
    const areaPath = pathData + 
      ` L ${points[points.length - 1].x} ${height - padding}` +
      ` L ${padding} ${height - padding} Z`;
    
    return (
      <View style={[styles.sparklineContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sparklineHeader}>
          <Ionicons name="pulse" size={18} color={colors.primary} />
          <Text style={[styles.sparklineTitle, { color: colors.text }]}>7-Day Activity</Text>
        </View>
        <Svg width={width} height={height}>
          {/* Area fill */}
          <Path
            d={areaPath}
            fill={`${colors.primary}20`}
          />
          {/* Line */}
          <Path
            d={pathData}
            stroke={colors.primary}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Data points */}
          {points.map((point, index) => (
            <Circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={point.value > 0 ? 4 : 2}
              fill={point.value > 0 ? colors.primary : colors.textSecondary}
            />
          ))}
        </Svg>
        <View style={styles.sparklineLegend}>
          {['6d', '5d', '4d', '3d', '2d', '1d', 'Today'].map((label, i) => (
            <Text key={i} style={[styles.sparklineLegendText, { color: colors.textSecondary }]}>
              {label}
            </Text>
          ))}
        </View>
      </View>
    );
  };

  // Insight Card Component
  const InsightCard = ({ insight }: { insight: Insight }) => {
    const maturityBadgeColors: Record<string, string> = {
      activity: '#3B82F6',
      diagnostic: '#8B5CF6',
      coaching: '#F59E0B',
      predictive: '#22C55E',
    };
    
    return (
      <View style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Top row: Icon + Title + Maturity Badge */}
        <View style={styles.insightHeader}>
          <View style={[styles.insightIconContainer, { backgroundColor: `${insight.color}20` }]}>
            <Ionicons name={insight.icon as any} size={20} color={insight.color} />
          </View>
          <Text style={[styles.insightTitle, { color: colors.text, flex: 1, marginLeft: 10 }]}>{insight.title}</Text>
          <View style={[
            styles.maturityBadge, 
            { backgroundColor: `${maturityBadgeColors[insight.maturity_label]}20` }
          ]}>
            <Text style={[
              styles.maturityBadgeText, 
              { color: maturityBadgeColors[insight.maturity_label] }
            ]}>
              {insight.maturity_label.charAt(0).toUpperCase() + insight.maturity_label.slice(1)}
            </Text>
          </View>
        </View>
        
        {/* Message */}
        <Text style={[styles.insightMessage, { color: colors.textSecondary }]}>
          {insight.message}
        </Text>
        
        {/* Footer with confidence only */}
        <View style={styles.insightFooter}>
          <View style={styles.confidenceContainer}>
            <Ionicons name="shield-checkmark" size={14} color={colors.textSecondary} />
            <Text style={[styles.confidenceText, { color: colors.textSecondary }]}>
              {insight.confidence}% confidence
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // Offer Probability Component
  const OfferProbabilityCard = ({ probability }: { probability: OfferProbability }) => {
    const getColor = (p: number) => {
      if (p >= 70) return colors.success;
      if (p >= 40) return colors.warning;
      return colors.primary;
    };
    
    return (
      <View style={[styles.probabilityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.probabilityHeader}>
          <Ionicons name="trophy" size={18} color={getColor(probability.probability)} />
          <Text style={[styles.probabilityTitle, { color: colors.text }]}>Offer Probability</Text>
        </View>
        <View style={styles.probabilityContent}>
          <Text style={[styles.probabilityValue, { color: getColor(probability.probability) }]}>
            {probability.probability}%
          </Text>
          <View style={[styles.probabilityBadge, { backgroundColor: `${getColor(probability.probability)}15` }]}>
            <Text style={[styles.probabilityBadgeText, { color: getColor(probability.probability) }]}>
              {probability.label}
            </Text>
          </View>
        </View>
        <View style={styles.probabilityBar}>
          <View 
            style={[
              styles.probabilityBarFill, 
              { 
                width: `${probability.probability}%`,
                backgroundColor: getColor(probability.probability)
              }
            ]} 
          />
        </View>
        <Text style={[styles.probabilityConfidence, { color: colors.textSecondary }]}>
          Based on {probability.confidence}% data confidence
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Computing insights...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Analytics</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Self-improving insights
          </Text>
        </View>

        {analytics && (
          <>
            {/* Hero Progress KPI */}
            <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <HeroProgressRing 
                health={analytics.hero_kpi.pipeline_health} 
                label={analytics.hero_kpi.health_label}
              />
              <View style={styles.heroStats}>
                <TouchableOpacity style={styles.heroStat} onPress={() => navigateToMyJobs('all')}>
                  <Text style={[styles.heroStatValue, { color: colors.primary }]}>
                    {analytics.hero_kpi.total_applications}
                  </Text>
                  <Text style={[styles.heroStatLabel, { color: colors.textSecondary }]}>
                    Total Apps
                  </Text>
                </TouchableOpacity>
                <View style={[styles.heroStatDivider, { backgroundColor: colors.border }]} />
                <TouchableOpacity style={styles.heroStat} onPress={() => navigateToMyJobs('active')}>
                  <Text style={[styles.heroStatValue, { color: colors.primary }]}>
                    {analytics.hero_kpi.active_in_pipeline}
                  </Text>
                  <Text style={[styles.heroStatLabel, { color: colors.textSecondary }]}>
                    Active
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Metrics Row */}
            <View style={styles.metricsRow}>
              <MetricCard 
                title="Response" 
                value={analytics.metrics.response_rate}
                trend={analytics.metrics.response_trend}
                icon="mail-open"
                color="#8B5CF6"
              />
              <MetricCard 
                title="Interview" 
                value={analytics.metrics.interview_rate}
                trend={analytics.metrics.interview_trend}
                icon="chatbubbles"
                color="#06B6D4"
              />
              <MetricCard 
                title="Velocity" 
                value={analytics.metrics.velocity}
                suffix="/wk"
                trend={analytics.metrics.velocity_change}
                icon="speedometer"
                color="#F59E0B"
              />
            </View>

            {/* Pipeline Funnel */}
            <PipelineFunnel funnel={analytics.funnel} />

            {/* Insight Card */}
            <InsightCard insight={analytics.insight} />

            {/* Sparkline */}
            <Sparkline data={analytics.sparkline} />

            {/* Offer Probability */}
            <OfferProbabilityCard probability={analytics.offer_probability} />
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  // Hero Card
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  heroRingContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRingContent: {
    position: 'absolute',
    alignItems: 'center',
  },
  heroRingValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  heroRingLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  heroStats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginLeft: 20,
  },
  heroStat: {
    alignItems: 'center',
  },
  heroStatValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  heroStatLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  heroStatDivider: {
    width: 1,
    height: 40,
  },
  // Metrics Row
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  metricIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  metricTitle: {
    fontSize: 11,
    marginTop: 4,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 6,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Funnel
  funnelContainer: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  funnelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  funnelTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  funnelBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  funnelStage: {
    flex: 1,
    alignItems: 'center',
  },
  funnelBarContainer: {
    height: 60,
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  funnelBar: {
    width: 24,
    borderRadius: 4,
    minHeight: 4,
  },
  funnelCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  funnelLabel: {
    fontSize: 9,
    marginTop: 2,
    textAlign: 'center',
  },
  // Sparkline
  sparklineContainer: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  sparklineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sparklineTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  sparklineLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  sparklineLegendText: {
    fontSize: 10,
  },
  // Insight Card
  insightCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  insightIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maturityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  maturityBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  insightMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
    marginBottom: 12,
  },
  insightFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  confidenceText: {
    fontSize: 12,
  },
  insightAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  insightActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Probability Card
  probabilityCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  probabilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  probabilityTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  probabilityContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  probabilityValue: {
    fontSize: 36,
    fontWeight: '700',
  },
  probabilityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  probabilityBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  probabilityBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  probabilityBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  probabilityConfidence: {
    fontSize: 12,
  },
});
