import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Text, Card, Chip, FAB, useTheme, Searchbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useJobStore } from '../stores/jobStore';
import { getStageColor, WORK_TYPE_COLORS } from '../utils/colors';
import { format } from 'date-fns';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

export default function JobsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { jobs, loading, fetchJobs } = useJobStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchJobs();
    setRefreshing(false);
  };

  const filteredJobs = jobs.filter(
    (job) =>
      job.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderJobCard = ({ item }: any) => (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/job-details', params: { jobId: item.job_id } })}
    >
      <Card style={[styles.jobCard, { backgroundColor: theme.colors.elevation.level1 }]}>
        <Card.Content>
          <View style={styles.jobHeader}>
            <View style={{ flex: 1 }}>
              <Text variant="titleLarge" style={styles.company}>
                {item.company}
              </Text>
              <Text variant="bodyLarge">{item.position}</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {item.location}
              </Text>
            </View>
            <View style={styles.agingBadge}>
              <Text variant="headlineSmall" style={{ fontFamily: 'monospace' }}>
                {item.total_business_days_aging}
              </Text>
              <Text variant="bodySmall">days</Text>
            </View>
          </View>

          <View style={styles.jobDetails}>
            <Chip
              mode="flat"
              style={[styles.chip, { backgroundColor: getStageColor(item.current_stage) + '20' }]}
              textStyle={{ color: getStageColor(item.current_stage), fontFamily: 'monospace' }}
            >
              {item.current_stage}
            </Chip>
            <Chip
              icon={() => <Ionicons name="location" size={14} />}
              mode="flat"
              style={styles.chip}
            >
              {item.work_type}
            </Chip>
          </View>

          {item.salary_range && (
            <Text variant="bodyMedium" style={styles.salary}>
              ${item.salary_range.min?.toLocaleString()} - $
              {item.salary_range.max?.toLocaleString()} {item.salary_range.currency}
            </Text>
          )}

          <View style={styles.footer}>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Applied: {format(new Date(item.applied_date), 'MMM dd, yyyy')}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant, fontFamily: 'monospace' }}
            >
              Stage: {item.stage_business_days_aging}d
            </Text>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search jobs..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />
      </View>

      <FlatList
        data={filteredJobs}
        renderItem={renderJobCard}
        keyExtractor={(item) => item.job_id}
        contentContainerStyle={styles.listContent}
        numColumns={isTablet ? 2 : 1}
        key={isTablet ? 'tablet' : 'phone'}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="briefcase-outline" size={64} color={theme.colors.onSurfaceDisabled} />
            <Text variant="titleLarge" style={{ marginTop: 16, color: theme.colors.onSurfaceDisabled }}>
              No jobs yet
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceDisabled }}>
              Tap + to add your first job application
            </Text>
          </View>
        }
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push('/add-job')}
        label={isTablet ? 'Add Job' : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchBar: {
    elevation: 2,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  jobCard: {
    marginBottom: 16,
    marginHorizontal: isTablet ? 8 : 0,
    flex: isTablet ? 1 : undefined,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  company: {
    fontWeight: 'bold',
  },
  agingBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#3B82F6' + '20',
  },
  jobDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 8,
    gap: 8,
  },
  chip: {
    marginRight: 8,
  },
  salary: {
    marginTop: 8,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
});
