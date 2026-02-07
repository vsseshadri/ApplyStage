import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, Animated, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

interface ChecklistItem {
  id: string;
  text: string;
  category: string;
  company_specific?: boolean;
}

interface InterviewChecklistProps {
  visible: boolean;
  onClose: () => void;
  stage: string;
  company: string;
  jobId: string;
  daysUntil: number;
  colors: {
    background: string;
    card: string;
    text: string;
    textSecondary: string;
    primary: string;
    border: string;
  };
  sessionToken: string;
}

const getBackendUrl = (): string => {
  const configUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL;
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  const url = configUrl || envUrl || '';
  console.log('[InterviewChecklist] BACKEND_URL resolved to:', url);
  return url;
};

const BACKEND_URL = getBackendUrl();

const InterviewChecklist: React.FC<InterviewChecklistProps> = ({
  visible,
  onClose,
  stage,
  company,
  jobId,
  daysUntil,
  colors,
  sessionToken,
}) => {
  const [checklist, setChecklist] = useState<{ title: string; items: ChecklistItem[] }>({ title: '', items: [] });
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const slideAnim = useState(new Animated.Value(0))[0];

  // Fetch checklist and saved progress when modal opens
  useEffect(() => {
    console.log('[InterviewChecklist] useEffect triggered, visible:', visible, 'stage:', stage, 'company:', company);
    if (visible) {
      fetchChecklistAndProgress();
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible, stage, company, jobId]);

  const fetchChecklistAndProgress = async () => {
    setLoading(true);
    console.log('[InterviewChecklist] Fetching checklist for stage:', stage, 'company:', company, 'jobId:', jobId);
    console.log('[InterviewChecklist] Using BACKEND_URL:', BACKEND_URL);
    try {
      // Fetch checklist items and saved progress in parallel
      const checklistUrl = `${BACKEND_URL}/api/interview-checklist/${stage}?company=${encodeURIComponent(company)}`;
      const progressUrl = `${BACKEND_URL}/api/checklist-progress/${jobId}/${stage}`;
      
      console.log('[InterviewChecklist] Fetching from:', checklistUrl);
      
      const [checklistResponse, progressResponse] = await Promise.all([
        fetch(checklistUrl, { headers: { 'Authorization': `Bearer ${sessionToken}` } }),
        fetch(progressUrl, { headers: { 'Authorization': `Bearer ${sessionToken}` } })
      ]);
      
      console.log('[InterviewChecklist] Checklist response status:', checklistResponse.status);
      
      if (checklistResponse.ok) {
        const data = await checklistResponse.json();
        console.log('[InterviewChecklist] Received checklist data:', JSON.stringify(data));
        setChecklist(data);
      } else {
        console.log('[InterviewChecklist] Checklist fetch failed:', checklistResponse.status);
      }
      
      if (progressResponse.ok) {
        const progressData = await progressResponse.json();
        console.log('[InterviewChecklist] Received progress data:', JSON.stringify(progressData));
        if (progressData.completed_items && Array.isArray(progressData.completed_items)) {
          setCompletedItems(new Set(progressData.completed_items));
        }
      }
    } catch (error) {
      console.log('[InterviewChecklist] Error fetching checklist:', error);
    } finally {
      setLoading(false);
    }
  };

  // Save progress to backend
  const saveProgress = useCallback(async (newCompletedItems: Set<string>) => {
    setSaving(true);
    try {
      await fetch(`${BACKEND_URL}/api/checklist-progress`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          job_id: jobId,
          stage: stage,
          completed_items: Array.from(newCompletedItems)
        })
      });
    } catch (error) {
      console.log('Error saving progress:', error);
    } finally {
      setSaving(false);
    }
  }, [jobId, stage, sessionToken]);

  const toggleItem = (id: string) => {
    setCompletedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      // Save progress to backend
      saveProgress(newSet);
      return newSet;
    });
  };

  const completedCount = completedItems.size;
  const totalCount = checklist.items.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const getCategoryIcon = (category: string): string => {
    const icons: { [key: string]: string } = {
      research: 'search',
      preparation: 'clipboard',
      technical: 'code-slash',
      stories: 'chatbubbles',
      questions: 'help-circle',
      pitch: 'megaphone',
      communication: 'chatbox-ellipses',
      compensation: 'cash',
      architecture: 'git-network',
      optimization: 'speedometer',
      practice: 'barbell',
      wellness: 'heart',
    };
    return icons[category] || 'checkmark-circle';
  };

  const formatStageName = (s: string): string => {
    return s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getUrgencyColor = () => {
    if (daysUntil === 0) return '#EF4444';
    if (daysUntil <= 2) return '#F59E0B';
    return colors.primary;
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
        <Animated.View
          style={[
            styles.container,
            { backgroundColor: colors.card },
            {
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [300, 0],
                  }),
                },
              ],
              opacity: slideAnim,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerContent}>
              <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor() + '20' }]}>
                <Text style={[styles.urgencyText, { color: getUrgencyColor() }]}>
                  {daysUntil === 0 ? 'TODAY' : daysUntil === 1 ? 'TOMORROW' : `${daysUntil} DAYS`}
                </Text>
              </View>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {company}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {formatStageName(stage)} Interview
              </Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: colors.primary, width: `${progress}%` },
                ]}
              />
            </View>
            <View style={styles.progressTextRow}>
              <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                {completedCount}/{totalCount} completed
              </Text>
              {saving && (
                <View style={styles.savingIndicator}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.savingText, { color: colors.textSecondary }]}>Saving...</Text>
                </View>
              )}
            </View>
          </View>

          {/* Checklist */}
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Loading checklist...
                </Text>
              </View>
            ) : (
              checklist.items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.checklistItem,
                    { borderBottomColor: colors.border },
                    completedItems.has(item.id) && styles.completedItem,
                  ]}
                  onPress={() => toggleItem(item.id)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.checkbox,
                      { borderColor: completedItems.has(item.id) ? colors.primary : colors.border },
                      completedItems.has(item.id) && { backgroundColor: colors.primary },
                    ]}
                  >
                    {completedItems.has(item.id) && (
                      <Ionicons name="checkmark" size={14} color="white" />
                    )}
                  </View>
                  <View style={styles.itemContent}>
                    <Text
                      style={[
                        styles.itemText,
                        { color: colors.text },
                        completedItems.has(item.id) && styles.completedText,
                      ]}
                    >
                      {item.text}
                    </Text>
                    <View style={styles.categoryBadge}>
                      <Ionicons
                        name={getCategoryIcon(item.category) as any}
                        size={12}
                        color={colors.textSecondary}
                      />
                      <Text style={[styles.categoryText, { color: colors.textSecondary }]}>
                        {item.category}
                      </Text>
                      {item.company_specific && (
                        <View style={[styles.companyTag, { backgroundColor: colors.primary + '20' }]}>
                          <Text style={[styles.companyTagText, { color: colors.primary }]}>
                            {company}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            {progress === 100 ? (
              <View style={styles.completedBanner}>
                <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                <Text style={styles.completedBannerText}>All tasks completed! You're ready! 🎉</Text>
              </View>
            ) : (
              <Text style={[styles.footerHint, { color: colors.textSecondary }]}>
                Progress is saved automatically
              </Text>
            )}
            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: colors.primary }]}
              onPress={handleClose}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    maxHeight: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerContent: {
    flex: 1,
  },
  urgencyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    padding: 4,
    marginLeft: 12,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  progressText: {
    fontSize: 12,
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savingText: {
    fontSize: 11,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  completedItem: {
    opacity: 0.6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  itemContent: {
    flex: 1,
  },
  itemText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  completedText: {
    textDecorationLine: 'line-through',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  companyTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  companyTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    gap: 12,
  },
  footerHint: {
    fontSize: 12,
    textAlign: 'center',
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    backgroundColor: '#22C55E10',
    borderRadius: 8,
  },
  completedBannerText: {
    color: '#22C55E',
    fontWeight: '600',
    fontSize: 14,
  },
  doneButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default InterviewChecklist;
