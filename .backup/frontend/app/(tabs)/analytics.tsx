import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Platform } from 'react-native';
import { Text, Card, useTheme, ActivityIndicator, List } from 'react-native-paper';
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
  const [error, setError] = useState<string | null>(null);

  const fetchPatterns = async () => {
    try {
      setError(null);
      const token = await storage.getItem('session_token');
      const response = await fetch(`${API_URL}/api/analytics/patterns`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPatterns(data);
      } else {
        setError('Failed to load analytics');
      }
    } catch (error) {
      console.error('Failed to fetch patterns:', error);
      setError('Error loading analytics');
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

  if (error || !patterns) {
    return (
      <View style={styles.center}>
        <Ionicons name="analytics-outline" size={64} color={theme.colors.onSurfaceDisabled} />
        <Text variant="titleLarge" style={{ marginTop: 16, color: theme.colors.onSurfaceDisabled }}>
          {error || 'No analytics data available'}
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceDisabled, marginTop: 8 }}>
          Add some job applications to see insights
        </Text>
      </View>
    );
  }

  const totalApps = patterns.total_applications || 0;
  const stageDistribution = patterns.stage_distribution || {};
  const jobFamilyDistribution = patterns.job_family_distribution || {};
  const insights = patterns.insights || [];
  const recommendations = patterns.recommendations || [];

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

  if (totalApps === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="analytics-outline" size={64} color={theme.colors.onSurfaceDisabled} />
        <Text variant="titleLarge" style={{ marginTop: 16, color: theme.colors.onSurfaceDisabled }}>
          No Applications Yet
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceDisabled, marginTop: 8 }}>
          Add job applications to see AI-powered insights
        </Text>
      </View>
    );
  }

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
              <Text variant="displaySmall">{totalApps}</Text>
              <Text variant="bodyMedium">Total Apps</Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="displaySmall">{Object.keys(stageDistribution).length}</Text>
              <Text variant="bodyMedium">Active Stages</Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="displaySmall">{Object.keys(jobFamilyDistribution).length}</Text>
              <Text variant="bodyMedium">Job Families</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* AI Insights */}
      {insights.length > 0 && (
        <Card style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}>
          <Card.Content>
            <View style={styles.titleRow}>
              <Ionicons name="bulb" size={24} color="#F59E0B" />
              <Text variant="titleLarge" style={styles.titleWithIcon}>
                AI-Powered Insights
              </Text>
            </View>
            {insights.map((insight: any, index: number) => (
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
      {recommendations.length > 0 && (
        <Card style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}>
          <Card.Content>
            <View style={styles.titleRow}>
              <Ionicons name="star" size={24} color="#3B82F6" />
              <Text variant="titleLarge" style={styles.titleWithIcon}>
                Recommendations
              </Text>
            </View>
            {recommendations.map((rec: string, index: number) => (
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
      {Object.keys(stageDistribution).length > 0 && (
        <Card style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.title}>
              Stage Distribution
            </Text>
            {Object.entries(stageDistribution).map(([stage, count]: [string, any]) => (
              <View key={stage} style={styles.progressItem}>
                <Text variant="bodyMedium" style={[styles.progressLabel, { fontFamily: 'monospace' }]}>
                  {stage}
                </Text>
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${(count / totalApps) * 100}%`,
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
      )}

      {/* Job Family Distribution */}
      {Object.keys(jobFamilyDistribution).length > 0 && (
        <Card style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.title}>
              Job Family Distribution
            </Text>
            {Object.entries(jobFamilyDistribution).map(([family, count]: [string, any]) => (
              <View key={family} style={styles.progressItem}>
                <Text variant="bodyMedium" style={styles.progressLabel}>
                  {family}
                </Text>
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${(count / totalApps) * 100}%`,
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
      )}
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
    padding: 32,
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
