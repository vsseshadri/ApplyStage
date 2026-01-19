import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  Button,
  useTheme,
  Divider,
  Menu,
  IconButton,
  Portal,
  Modal,
  TextInput,
} from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { useJobStore } from '../stores/jobStore';
import { getStageColor } from '../utils/colors';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function JobDetailsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { jobId } = useLocalSearchParams();
  const { deleteJob, updateStage } = useJobStore();
  
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [stageModalVisible, setStageModalVisible] = useState(false);
  const [selectedNewStage, setSelectedNewStage] = useState('');

  useEffect(() => {
    fetchJobDetails();
  }, [jobId]);

  const fetchJobDetails = async () => {
    try {
      const token = await SecureStore.getItemAsync('session_token');
      const response = await fetch(`${API_URL}/api/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setJob(data);
      }
    } catch (error) {
      console.error('Failed to fetch job:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Job',
      'Are you sure you want to delete this job application?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteJob(jobId as string);
            router.back();
          },
        },
      ]
    );
  };

  const handleUpdateStage = async () => {
    if (!selectedNewStage) return;
    
    await updateStage(jobId as string, selectedNewStage);
    setStageModalVisible(false);
    fetchJobDetails();
  };

  const openUrl = () => {
    if (job?.url) {
      Linking.openURL(job.url);
    }
  };

  if (loading) {
    return <View style={styles.center}><Text>Loading...</Text></View>;
  }

  if (!job) {
    return <View style={styles.center}><Text>Job not found</Text></View>;
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header Card */}
      <Card style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}>
        <Card.Content>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text variant="headlineMedium" style={styles.company}>
                {job.company}
              </Text>
              <Text variant="titleLarge">{job.position}</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {job.location}
              </Text>
            </View>
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <IconButton
                  icon="dots-vertical"
                  onPress={() => setMenuVisible(true)}
                />
              }
            >
              <Menu.Item onPress={handleDelete} title="Delete" leadingIcon="delete" />
            </Menu>
          </View>
        </Card.Content>
      </Card>

      {/* Details Card */}
      <Card style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Details
          </Text>
          
          <View style={styles.detailRow}>
            <Ionicons name="briefcase" size={20} color={theme.colors.primary} />
            <Text variant="bodyLarge" style={styles.detailText}>
              {job.job_family}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="location" size={20} color={theme.colors.primary} />
            <Text variant="bodyLarge" style={styles.detailText}>
              {job.work_type}
            </Text>
          </View>

          {job.salary_range && (
            <View style={styles.detailRow}>
              <Ionicons name="cash" size={20} color={theme.colors.primary} />
              <Text variant="bodyLarge" style={styles.detailText}>
                ${job.salary_range.min?.toLocaleString()} - $
                {job.salary_range.max?.toLocaleString()} {job.salary_range.currency}
              </Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={20} color={theme.colors.primary} />
            <Text variant="bodyLarge" style={styles.detailText}>
              Applied: {format(new Date(job.applied_date), 'MMM dd, yyyy')}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="time" size={20} color={theme.colors.primary} />
            <Text variant="bodyLarge" style={styles.detailText}>
              Total aging: {job.total_business_days_aging} business days
            </Text>
          </View>

          {job.url && (
            <Button
              mode="outlined"
              onPress={openUrl}
              style={styles.urlButton}
              icon="link"
            >
              View Job Posting
            </Button>
          )}
        </Card.Content>
      </Card>

      {/* Current Stage */}
      <Card style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Current Stage
          </Text>
          <Chip
            mode="flat"
            style={[
              styles.currentStageChip,
              { backgroundColor: getStageColor(job.current_stage) + '20' },
            ]}
            textStyle={{
              color: getStageColor(job.current_stage),
              fontFamily: 'monospace',
              fontSize: 16,
            }}
          >
            {job.current_stage}
          </Chip>
          <Text variant="bodyMedium" style={{ marginTop: 8 }}>
            Stage aging: {job.stage_business_days_aging} business days
          </Text>
          <Button
            mode="contained"
            onPress={() => setStageModalVisible(true)}
            style={styles.updateButton}
            icon="update"
          >
            Update Stage
          </Button>
        </Card.Content>
      </Card>

      {/* Stage History */}
      {job.stage_history && job.stage_history.length > 0 && (
        <Card style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Stage History
            </Text>
            {job.stage_history.map((stage: any, index: number) => (
              <View key={index} style={styles.historyItem}>
                <View style={styles.historyDot} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyLarge" style={{ fontFamily: 'monospace' }}>
                    {stage.stage}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {format(new Date(stage.start_date), 'MMM dd, yyyy')}
                    {stage.end_date && ` - ${format(new Date(stage.end_date), 'MMM dd, yyyy')}`}
                  </Text>
                  <Chip
                    mode="outlined"
                    style={{ alignSelf: 'flex-start', marginTop: 4 }}
                    textStyle={{ fontSize: 10 }}
                  >
                    {stage.outcome}
                  </Chip>
                </View>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* AI Insights */}
      {job.ai_insights && (
        <Card style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}>
          <Card.Content>
            <View style={styles.titleRow}>
              <Ionicons name="bulb" size={24} color="#F59E0B" />
              <Text variant="titleMedium" style={styles.aiTitle}>
                AI Insights
              </Text>
            </View>
            <Text variant="bodyMedium">
              Confidence: {(job.ai_insights.confidence * 100).toFixed(0)}%
            </Text>
            {job.ai_insights.analysis && (
              <Text variant="bodyMedium" style={{ marginTop: 8 }}>
                {job.ai_insights.analysis}
              </Text>
            )}
          </Card.Content>
        </Card>
      )}

      {/* Notes */}
      {job.notes && (
        <Card style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Notes
            </Text>
            <Text variant="bodyMedium">{job.notes}</Text>
          </Card.Content>
        </Card>
      )}

      {/* Stage Update Modal */}
      <Portal>
        <Modal
          visible={stageModalVisible}
          onDismiss={() => setStageModalVisible(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.background }]}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>
            Update Stage
          </Text>
          <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
            Current: {job.current_stage}
          </Text>
          
          {job.custom_stages && job.custom_stages.length > 0 && (
            <View style={styles.stagesContainer}>
              {job.custom_stages.map((stage: string, index: number) => (
                <Chip
                  key={index}
                  mode={selectedNewStage === stage ? 'flat' : 'outlined'}
                  selected={selectedNewStage === stage}
                  onPress={() => setSelectedNewStage(stage)}
                  style={styles.stageChip}
                >
                  {stage}
                </Chip>
              ))}
            </View>
          )}

          <View style={styles.modalButtons}>
            <Button onPress={() => setStageModalVisible(false)}>Cancel</Button>
            <Button
              mode="contained"
              onPress={handleUpdateStage}
              disabled={!selectedNewStage || selectedNewStage === job.current_stage}
            >
              Update
            </Button>
          </View>
        </Modal>
      </Portal>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  company: {
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailText: {
    marginLeft: 12,
  },
  urlButton: {
    marginTop: 16,
  },
  currentStageChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  updateButton: {
    marginTop: 16,
  },
  historyItem: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingLeft: 8,
  },
  historyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3B82F6',
    marginRight: 12,
    marginTop: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiTitle: {
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modal: {
    margin: 20,
    padding: 20,
    borderRadius: 8,
  },
  modalTitle: {
    fontWeight: 'bold',
    marginBottom: 16,
  },
  stagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 8,
  },
  stageChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
});
