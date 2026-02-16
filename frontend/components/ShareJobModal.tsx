/**
 * ShareJobModal Component
 * Displays an overlay confirmation UI for shared job postings
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { ParsedJobData, parseJobDetailsFromContent, markUrlAsProcessed } from '../utils/shareReceiver';
import Constants from 'expo-constants';

interface ShareJobModalProps {
  visible: boolean;
  sharedUrl: string;
  sharedText?: string;
  onClose: () => void;
  onJobCreated: () => void;
}

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 
                    process.env.EXPO_PUBLIC_BACKEND_URL || '';

const JOB_TYPES = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
];

const WORK_MODES = [
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
];

export default function ShareJobModal({ 
  visible, 
  sharedUrl, 
  sharedText, 
  onClose, 
  onJobCreated 
}: ShareJobModalProps) {
  const { colors } = useTheme();
  const { sessionToken, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedJobData | null>(null);

  // Form state
  const [companyName, setCompanyName] = useState('');
  const [position, setPosition] = useState('');
  const [jobType, setJobType] = useState('full_time');
  const [workMode, setWorkMode] = useState('hybrid');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [minSalary, setMinSalary] = useState('');
  const [maxSalary, setMaxSalary] = useState('');
  const [status, setStatus] = useState('applied');

  // Parse shared content when modal opens
  useEffect(() => {
    if (visible && sharedUrl) {
      setLoading(true);
      
      // Parse the URL and text content
      const parsed = parseJobDetailsFromContent(sharedUrl, sharedText);
      setParsedData(parsed);
      
      // Populate form fields
      setCompanyName(parsed.company_name);
      setPosition(parsed.position);
      setJobType(parsed.job_type);
      setWorkMode(parsed.work_mode);
      setState(parsed.location.state);
      setCity(parsed.location.city);
      setMinSalary(parsed.min_salary);
      setMaxSalary(parsed.max_salary);
      setStatus(parsed.status);
      
      setLoading(false);
    }
  }, [visible, sharedUrl, sharedText]);

  // Format salary with commas
  const formatSalary = (value: string): string => {
    const numericValue = value.replace(/[^0-9]/g, '');
    if (!numericValue) return '';
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Handle salary input
  const handleSalaryChange = (setter: (val: string) => void, value: string) => {
    setter(formatSalary(value));
  };

  // Open the original job URL
  const handleOpenUrl = () => {
    if (sharedUrl) {
      Linking.openURL(sharedUrl);
    }
  };

  // Submit the job
  const handleConfirm = async () => {
    // Validate required fields
    if (!companyName.trim()) {
      Alert.alert('Required Field', 'Please enter the company name.');
      return;
    }
    if (!position.trim()) {
      Alert.alert('Required Field', 'Please enter the position.');
      return;
    }

    setSaving(true);

    try {
      // Get user's country for currency
      const userCountry = user?.domicile_country || 'US';
      const currencyCode = userCountry === 'India' ? 'INR' : 'USD';

      // Prepare job data
      const jobData = {
        company_name: companyName.trim(),
        position: position.trim(),
        job_type: jobType,
        work_mode: workMode,
        location: workMode !== 'remote' ? {
          state: state.trim(),
          city: city.trim(),
        } : undefined,
        salary_range: {
          min: minSalary ? parseInt(minSalary.replace(/,/g, '')) : 0,
          max: maxSalary ? parseInt(maxSalary.replace(/,/g, '')) : 0,
          currency: currencyCode,
        },
        status: status,
        job_url: sharedUrl,
        date_applied: new Date().toISOString(),
        notes: sharedText ? `Shared from: ${sharedText.substring(0, 200)}` : `Added via Share from URL`,
      };

      const response = await fetch(`${BACKEND_URL}/api/jobs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jobData),
      });

      if (response.ok) {
        // Mark URL as processed to prevent duplicates
        await markUrlAsProcessed(sharedUrl);
        
        Alert.alert(
          'Success!',
          `"${position}" at ${companyName} has been added to your jobs.`,
          [{ text: 'OK', onPress: () => {
            onJobCreated();
            onClose();
          }}]
        );
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to create job entry.');
      }
    } catch (error) {
      console.error('Error creating job:', error);
      Alert.alert('Error', 'Failed to create job entry. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    content: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '90%',
      paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    closeButton: {
      padding: 4,
    },
    scrollContent: {
      padding: 20,
    },
    urlPreview: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 12,
      marginBottom: 20,
      flexDirection: 'row',
      alignItems: 'center',
    },
    urlIcon: {
      marginRight: 10,
    },
    urlText: {
      flex: 1,
      fontSize: 13,
      color: colors.primary,
    },
    openUrlButton: {
      padding: 8,
    },
    section: {
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    requiredLabel: {
      color: '#EF4444',
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputPlaceholder: {
      color: colors.textSecondary,
    },
    optionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    optionButton: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionButtonSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    optionText: {
      fontSize: 14,
      color: colors.text,
    },
    optionTextSelected: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    halfInput: {
      flex: 1,
    },
    footer: {
      flexDirection: 'row',
      padding: 20,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: colors.card,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    confirmButton: {
      flex: 2,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    confirmButtonDisabled: {
      opacity: 0.6,
    },
    confirmButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    loadingContainer: {
      padding: 40,
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: colors.textSecondary,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: '#22C55E20',
      borderWidth: 1,
      borderColor: '#22C55E',
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#22C55E',
      marginRight: 8,
    },
    statusText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#22C55E',
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={dynamicStyles.container}
      >
        <View style={dynamicStyles.content}>
          {/* Header */}
          <View style={dynamicStyles.header}>
            <Text style={dynamicStyles.headerTitle}>Add Job from Share</Text>
            <TouchableOpacity style={dynamicStyles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={dynamicStyles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={dynamicStyles.loadingText}>Parsing job details...</Text>
            </View>
          ) : (
            <>
              <ScrollView style={dynamicStyles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* URL Preview */}
                <TouchableOpacity style={dynamicStyles.urlPreview} onPress={handleOpenUrl}>
                  <Ionicons name="link" size={20} color={colors.primary} style={dynamicStyles.urlIcon} />
                  <Text style={dynamicStyles.urlText} numberOfLines={1}>{sharedUrl}</Text>
                  <View style={dynamicStyles.openUrlButton}>
                    <Ionicons name="open-outline" size={18} color={colors.primary} />
                  </View>
                </TouchableOpacity>

                {/* Company Name */}
                <View style={dynamicStyles.section}>
                  <Text style={dynamicStyles.label}>
                    Company Name <Text style={dynamicStyles.requiredLabel}>*</Text>
                  </Text>
                  <TextInput
                    style={dynamicStyles.input}
                    value={companyName}
                    onChangeText={setCompanyName}
                    placeholder="Enter company name"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>

                {/* Position */}
                <View style={dynamicStyles.section}>
                  <Text style={dynamicStyles.label}>
                    Position <Text style={dynamicStyles.requiredLabel}>*</Text>
                  </Text>
                  <TextInput
                    style={dynamicStyles.input}
                    value={position}
                    onChangeText={setPosition}
                    placeholder="Enter position title"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>

                {/* Position Type */}
                <View style={dynamicStyles.section}>
                  <Text style={dynamicStyles.label}>Position Type</Text>
                  <View style={dynamicStyles.optionsRow}>
                    {JOB_TYPES.map((type) => (
                      <TouchableOpacity
                        key={type.value}
                        style={[
                          dynamicStyles.optionButton,
                          jobType === type.value && dynamicStyles.optionButtonSelected,
                        ]}
                        onPress={() => setJobType(type.value)}
                      >
                        <Text
                          style={[
                            dynamicStyles.optionText,
                            jobType === type.value && dynamicStyles.optionTextSelected,
                          ]}
                        >
                          {type.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Work Mode */}
                <View style={dynamicStyles.section}>
                  <Text style={dynamicStyles.label}>Work Mode</Text>
                  <View style={dynamicStyles.optionsRow}>
                    {WORK_MODES.map((mode) => (
                      <TouchableOpacity
                        key={mode.value}
                        style={[
                          dynamicStyles.optionButton,
                          workMode === mode.value && dynamicStyles.optionButtonSelected,
                        ]}
                        onPress={() => setWorkMode(mode.value)}
                      >
                        <Text
                          style={[
                            dynamicStyles.optionText,
                            workMode === mode.value && dynamicStyles.optionTextSelected,
                          ]}
                        >
                          {mode.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Location (if not remote) */}
                {workMode !== 'remote' && (
                  <View style={dynamicStyles.section}>
                    <Text style={dynamicStyles.label}>Location</Text>
                    <View style={dynamicStyles.row}>
                      <TextInput
                        style={[dynamicStyles.input, dynamicStyles.halfInput]}
                        value={city}
                        onChangeText={setCity}
                        placeholder="City"
                        placeholderTextColor={colors.textSecondary}
                      />
                      <TextInput
                        style={[dynamicStyles.input, dynamicStyles.halfInput]}
                        value={state}
                        onChangeText={setState}
                        placeholder="State"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                  </View>
                )}

                {/* Salary Range */}
                <View style={dynamicStyles.section}>
                  <Text style={dynamicStyles.label}>Salary Range (Optional)</Text>
                  <View style={dynamicStyles.row}>
                    <TextInput
                      style={[dynamicStyles.input, dynamicStyles.halfInput]}
                      value={minSalary}
                      onChangeText={(val) => handleSalaryChange(setMinSalary, val)}
                      placeholder="Min"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                    />
                    <TextInput
                      style={[dynamicStyles.input, dynamicStyles.halfInput]}
                      value={maxSalary}
                      onChangeText={(val) => handleSalaryChange(setMaxSalary, val)}
                      placeholder="Max"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Application Status */}
                <View style={dynamicStyles.section}>
                  <Text style={dynamicStyles.label}>Application Status</Text>
                  <View style={dynamicStyles.statusBadge}>
                    <View style={dynamicStyles.statusDot} />
                    <Text style={dynamicStyles.statusText}>Applied</Text>
                  </View>
                </View>
              </ScrollView>

              {/* Footer */}
              <View style={dynamicStyles.footer}>
                <TouchableOpacity style={dynamicStyles.cancelButton} onPress={onClose}>
                  <Text style={dynamicStyles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[dynamicStyles.confirmButton, saving && dynamicStyles.confirmButtonDisabled]}
                  onPress={handleConfirm}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                      <Text style={dynamicStyles.confirmButtonText}>Add Job</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
