import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Platform } from 'react-native';
import { Text, Card, useTheme, ActivityIndicator, List } from 'react-native-paper';
import { LineChart } from 'react-native-gifted-charts';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

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

export default function AnalyticsScreen() {
  const theme = useTheme();
  const [patterns, setPatterns] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPatterns = async () => {
    try {
      const token = await storage.getItem('session_token');
      const response = await fetch(`${API_URL}/api/analytics/patterns`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPatterns(data);
      }
    } catch (error) {
      console.error('Failed to fetch patterns:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPatterns();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPatterns();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!patterns) {
    return (
      <View style={styles.center}>
        <Text>No analytics data available</Text>
      </View>
    );
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'positive':
        return 'checkmark-circle';
      case 'warning':
        return 'warning';
      default:
        return 'information-circle';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'positive':
        return '#10B981';
      case 'warning':
        return '#F59E0B';
      default:
        return '#3B82F6';
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Overview Card */}
      <Card style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.title}>
            Application Overview
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text variant="displaySmall">{patterns.total_applications}</Text>
              <Text variant="bodyMedium">Total Apps</Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="displaySmall">{Object.keys(patterns.stage_distribution).length}</Text>
              <Text variant="bodyMedium">Active Stages</Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="displaySmall">{Object.keys(patterns.job_family_distribution).length}</Text>
              <Text variant="bodyMedium">Job Families</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* AI Insights */}
      {patterns.insights && patterns.insights.length > 0 && (
        <Card style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}>
          <Card.Content>
            <View style={styles.titleRow}>
              <Ionicons name="bulb" size={24} color="#F59E0B" />
              <Text variant="titleLarge" style={styles.titleWithIcon}>
                AI-Powered Insights
              </Text>
            </View>
            {patterns.insights.map((insight: any, index: number) => (
              <List.Item
                key={index}
                title={insight.message}
                description={insight.category}
                left={(props) => (
                  <Ionicons
                    {...props}
                    name={getSeverityIcon(insight.severity)}
                    size={24}
                    color={getSeverityColor(insight.severity)}
                  />
                )}
                style={styles.insightItem}
              />
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Recommendations */}
      {patterns.recommendations && patterns.recommendations.length > 0 && (
        <Card style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}>
          <Card.Content>
            <View style={styles.titleRow}>
              <Ionicons name="star" size={24} color="#3B82F6" />
              <Text variant="titleLarge" style={styles.titleWithIcon}>
                Recommendations
              </Text>
            </View>
            {patterns.recommendations.map((rec: string, index: number) => (
              <List.Item
                key={index}
                title={rec}
                left={(props) => <Ionicons {...props} name="arrow-forward" size={20} color="#3B82F6" />}
                style={styles.recommendationItem}
              />
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Stage Distribution */}
      <Card style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.title}>
            Stage Distribution
          </Text>
          {Object.entries(patterns.stage_distribution).map(([stage, count]: [string, any]) => (
            <View key={stage} style={styles.progressItem}>
              <Text variant="bodyMedium" style={styles.progressLabel}>
                {stage}
              </Text>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${(count / patterns.total_applications) * 100}%`,
                      backgroundColor: '#3B82F6',
                    },
                  ]}
                />
              </View>
              <Text variant="bodyMedium" style={styles.progressCount}>
                {count}
              </Text>
            </View>
          ))}
        </Card.Content>
      </Card>

      {/* Job Family Distribution */}
      <Card style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.title}>
            Job Family Distribution
          </Text>
          {Object.entries(patterns.job_family_distribution).map(([family, count]: [string, any]) => (
            <View key={family} style={styles.progressItem}>
              <Text variant="bodyMedium" style={styles.progressLabel}>
                {family}
              </Text>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${(count / patterns.total_applications) * 100}%`,
                      backgroundColor: '#10B981',
                    },
                  ]}
                />
              </View>
              <Text variant="bodyMedium" style={styles.progressCount}>
                {count}
              </Text>
            </View>
          ))}
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
  card: {
    marginBottom: 16,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleWithIcon: {
    fontWeight: 'bold',
    marginLeft: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  insightItem: {
    paddingVertical: 8,
  },
  recommendationItem: {
    paddingVertical: 4,
  },
  progressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressLabel: {
    flex: 1,
    marginRight: 8,
  },
  progressBarContainer: {
    flex: 2,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressCount: {
    width: 40,
    textAlign: 'right',
    marginLeft: 8,
    fontFamily: 'monospace',
  },
});
