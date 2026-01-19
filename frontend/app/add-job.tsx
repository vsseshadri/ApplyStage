import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  useTheme,
  SegmentedButtons,
  Chip,
  Portal,
  Modal,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useJobStore } from './stores/jobStore';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Template {
  template_id: string;
  job_family: string;
  stages: string[];
  is_default: boolean;
}

export default function AddJobScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { addJob } = useJobStore();
  
  // Form state
  const [company, setCompany] = useState('');
  const [position, setPosition] = useState('');
  const [location, setLocation] = useState('');
  const [workType, setWorkType] = useState('remote');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [appliedDate, setAppliedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Stage selection
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedStages, setSelectedStages] = useState<string[]>(['Applied']);
  const [currentStage, setCurrentStage] = useState('Applied');
  const [customStage, setCustomStage] = useState('');
  const [showStageModal, setShowStageModal] = useState(false);
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const token = await SecureStore.getItemAsync('session_token');
      const response = await fetch(`${API_URL}/api/templates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.default || []);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  const handleTemplateSelect = (template: Template) => {
    setSelectedStages(template.stages);
    setCurrentStage(template.stages[0] || 'Applied');
    setShowStageModal(false);
  };

  const handleAddCustomStage = () => {
    if (customStage.trim()) {
      setSelectedStages([...selectedStages, customStage.trim()]);
      setCustomStage('');
    }
  };

  const handleRemoveStage = (stage: string) => {
    setSelectedStages(selectedStages.filter(s => s !== stage));
    if (currentStage === stage) {
      setCurrentStage(selectedStages[0] || 'Applied');
    }
  };

  const handleSubmit = async () => {
    if (!company || !position || !location) {
      alert('Please fill in required fields');
      return;
    }

    setLoading(true);
    try {
      const jobData = {
        company,
        position,
        location,
        work_type: workType,
        salary_range: salaryMin && salaryMax ? {
          min: parseInt(salaryMin),
          max: parseInt(salaryMax),
          currency,
        } : undefined,
        applied_date: new Date(appliedDate).toISOString(),
        current_stage: currentStage,
        custom_stages: selectedStages,
        url,
        notes,
      };

      await addJob(jobData);
      router.back();
    } catch (error) {
      console.error('Failed to add job:', error);
      alert('Failed to add job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          {/* Company */}
          <TextInput
            label="Company *"
            value={company}
            onChangeText={setCompany}
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="office-building" />}
          />

          {/* Position */}
          <TextInput
            label="Position *"
            value={position}
            onChangeText={setPosition}
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="briefcase" />}
          />

          {/* Location */}
          <TextInput
            label="Location *"
            value={location}
            onChangeText={setLocation}
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="map-marker" />}
          />

          {/* Work Type */}
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Work Type
          </Text>
          <SegmentedButtons
            value={workType}
            onValueChange={setWorkType}
            buttons={[
              { value: 'onsite', label: 'Onsite' },
              { value: 'remote', label: 'Remote' },
              { value: 'hybrid', label: 'Hybrid' },
            ]}
            style={styles.segmented}
          />

          {/* Salary Range */}
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Salary Range (Optional)
          </Text>
          <View style={styles.row}>
            <TextInput
              label="Min"
              value={salaryMin}
              onChangeText={setSalaryMin}
              mode="outlined"
              keyboardType="numeric"
              style={[styles.input, { flex: 1 }]}
            />
            <TextInput
              label="Max"
              value={salaryMax}
              onChangeText={setSalaryMax}
              mode="outlined"
              keyboardType="numeric"
              style={[styles.input, { flex: 1, marginLeft: 8 }]}
            />
            <TextInput
              label="Currency"
              value={currency}
              onChangeText={setCurrency}
              mode="outlined"
              style={[styles.input, { width: 100, marginLeft: 8 }]}
            />
          </View>

          {/* Applied Date */}
          <TextInput
            label="Applied Date"
            value={appliedDate}
            onChangeText={setAppliedDate}
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="calendar" />}
          />

          {/* Interview Stages */}
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Interview Stages
          </Text>
          <Button
            mode="outlined"
            onPress={() => setShowStageModal(true)}
            style={styles.templateButton}
            icon="folder"
          >
            Load Template
          </Button>

          <View style={styles.stagesContainer}>
            {selectedStages.map((stage, index) => (
              <Chip
                key={index}
                mode={currentStage === stage ? 'flat' : 'outlined'}
                selected={currentStage === stage}
                onPress={() => setCurrentStage(stage)}
                onClose={() => handleRemoveStage(stage)}
                style={styles.stageChip}
              >
                {stage}
              </Chip>
            ))}
          </View>

          <View style={styles.row}>
            <TextInput
              label="Add Custom Stage"
              value={customStage}
              onChangeText={setCustomStage}
              mode="outlined"
              style={[styles.input, { flex: 1 }]}
            />
            <Button
              mode="contained"
              onPress={handleAddCustomStage}
              style={styles.addStageButton}
            >
              Add
            </Button>
          </View>

          {/* URL */}
          <TextInput
            label="Job URL (Optional)"
            value={url}
            onChangeText={setUrl}
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="link" />}
          />

          {/* Notes */}
          <TextInput
            label="Notes (Optional)"
            value={notes}
            onChangeText={setNotes}
            mode="outlined"
            multiline
            numberOfLines={4}
            style={styles.input}
            left={<TextInput.Icon icon="note" />}
          />

          {/* Submit Buttons */}
          <View style={styles.buttonRow}>
            <Button
              mode="outlined"
              onPress={() => router.back()}
              style={styles.button}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={loading}
              disabled={loading}
              style={styles.button}
            >
              Add Job
            </Button>
          </View>
        </View>
      </ScrollView>

      {/* Template Selection Modal */}
      <Portal>
        <Modal
          visible={showStageModal}
          onDismiss={() => setShowStageModal(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.background }]}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>
            Select Template
          </Text>
          <ScrollView>
            {templates.map((template) => (
              <Button
                key={template.template_id}
                mode="outlined"
                onPress={() => handleTemplateSelect(template)}
                style={styles.templateItem}
              >
                {template.job_family}
              </Button>
            ))}
          </ScrollView>
          <Button onPress={() => setShowStageModal(false)}>Close</Button>
        </Modal>
      </Portal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  form: {
    padding: 16,
  },
  input: {
    marginBottom: 16,
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 12,
    fontWeight: 'bold',
  },
  segmented: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  templateButton: {
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
  addStageButton: {
    marginLeft: 8,
    height: 56,
    justifyContent: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 16,
  },
  button: {
    flex: 1,
  },
  modal: {
    margin: 20,
    padding: 20,
    borderRadius: 8,
    maxHeight: '80%',
  },
  modalTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  templateItem: {
    marginBottom: 8,
  },
});
