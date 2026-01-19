import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, RefreshControl } from 'react-native';
import { Text, Card, useTheme, ActivityIndicator } from 'react-native-paper';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { useThemeStore } from '../stores/themeStore';
import { getStageColor } from '../utils/colors';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
const { width } = Dimensions.get('window');

interface DashboardStats {
  total_applications: number;
  by_stage: { [key: string]: number };
  by_job_family: { [key: string]: number };
  by_work_type: { [key: string]: number };
  average_aging_days: number;
  recent_applications: number;
}

export default function DashboardScreen() {
  const theme = useTheme();
  const { actualTheme } = useThemeStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      const token = await SecureStore.getItemAsync('session_token');
      const response = await fetch(`${API_URL}/api/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.center}>
        <Text>No data available</Text>
      </View>
    );
  }

  // Prepare chart data
  const stageData = Object.entries(stats.by_stage).map(([key, value]) => ({
    value,
    label: key,
    frontColor: getStageColor(key),
  }));

  const pieData = Object.entries(stats.by_job_family).map(([key, value], index) => ({
    value,
    label: key,
    color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'][index % 6],
  }));

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Summary Cards */}
      <View style={styles.cardRow}>
        <Card style={[styles.summaryCard, { backgroundColor: theme.colors.elevation.level1 }]}>
          <Card.Content>
            <Text variant="displaySmall" style={styles.statNumber}>
              {stats.total_applications}
            </Text>
            <Text variant="bodyMedium">Total Applications</Text>
          </Card.Content>
        </Card>
        <Card style={[styles.summaryCard, { backgroundColor: theme.colors.elevation.level1 }]}>
          <Card.Content>
            <Text variant="displaySmall" style={styles.statNumber}>
              {stats.average_aging_days}
            </Text>
            <Text variant="bodyMedium">Avg Days Aging</Text>
          </Card.Content>
        </Card>
      </View>

      <View style={styles.cardRow}>
        <Card style={[styles.summaryCard, { backgroundColor: theme.colors.elevation.level1 }]}>
          <Card.Content>
            <Text variant="displaySmall" style={styles.statNumber}>
              {stats.recent_applications}
            </Text>
            <Text variant="bodyMedium">Last 7 Days</Text>
          </Card.Content>
        </Card>
        <Card style={[styles.summaryCard, { backgroundColor: theme.colors.elevation.level1 }]}>
          <Card.Content>
            <Text variant="displaySmall" style={styles.statNumber}>
              {Object.keys(stats.by_job_family).length}
            </Text>
            <Text variant="bodyMedium">Job Families</Text>
          </Card.Content>
        </Card>
      </View>

      {/* Stage Distribution Chart */}
      <Card style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.chartTitle}>
            Applications by Stage
          </Text>
          {stageData.length > 0 && (
            <BarChart
              data={stageData}
              width={width - 80}
              height={220}
              barWidth={24}
              spacing={20}
              roundedTop
              roundedBottom
              hideRules
              xAxisThickness={0}
              yAxisThickness={0}
              yAxisTextStyle={{ color: theme.colors.onSurface }}
              xAxisLabelTextStyle={{ color: theme.colors.onSurface, fontSize: 10 }}
              noOfSections={4}
              maxValue={Math.max(...stageData.map(d => d.value)) + 2}
            />
          )}
        </Card.Content>
      </Card>

      {/* Job Family Distribution */}
      <Card style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.chartTitle}>
            Job Family Distribution
          </Text>
          {pieData.length > 0 && (
            <View style={styles.pieContainer}>
              <PieChart
                data={pieData}
                donut
                radius={90}
                innerRadius={60}
                centerLabelComponent={() => (
                  <View>
                    <Text style={{ fontSize: 24, fontWeight: 'bold' }}>{stats.total_applications}</Text>
                    <Text style={{ fontSize: 12 }}>Total</Text>
                  </View>
                )}
              />
            </View>
          )}
          <View style={styles.legend}>
            {pieData.map((item, index) => (
              <View key={index} style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: item.color }]} />
                <Text variant="bodySmall">
                  {item.label}: {item.value}
                </Text>
              </View>
            ))}
          </View>
        </Card.Content>
      </Card>

      {/* Work Type */}
      <Card style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.chartTitle}>
            Work Type Distribution
          </Text>
          <View style={styles.workTypeContainer}>
            {Object.entries(stats.by_work_type).map(([type, count], index) => (
              <View key={index} style={styles.workTypeItem}>
                <Text variant="headlineMedium" style={{ fontFamily: 'monospace' }}>
                  {count}
                </Text>
                <Text variant="bodyMedium" style={{ textTransform: 'capitalize' }}>
                  {type}
                </Text>
              </View>
            ))}
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    marginHorizontal: 4,
  },
  card: {
    marginBottom: 16,
  },
  statNumber: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  chartTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  pieContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  legend: {
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 8,
  },
  workTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  workTypeItem: {
    alignItems: 'center',
  },
});
