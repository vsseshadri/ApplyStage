import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, ActivityIndicator, Platform } from 'react-native';
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
  return configUrl || envUrl || '';
};

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
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const BACKEND_URL = getBackendUrl();

  useEffect(() => {
    if (visible && stage) {
      fetchChecklist();
    }
  }, [visible, stage, company]);

  const fetchChecklist = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Use POST endpoint for better proxy compatibility
      const url = `${BACKEND_URL}/api/dashboard/prep-checklist`;
      console.log('[Checklist] Fetching from:', url, 'stage:', stage, 'company:', company);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          stage: stage,
          company: company || ''
        })
      });
      
      console.log('[Checklist] Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[Checklist] Received data:', JSON.stringify(data));
        
        if (data.items && Array.isArray(data.items)) {
          setItems(data.items.slice(0, 5)); // Ensure max 5 items
        } else {
          setError('Invalid response format');
        }
      } else {
        const errorText = await response.text();
        console.log('[Checklist] Error response:', errorText);
        setError(`Failed to load (${response.status})`);
      }
    } catch (err) {
      console.log('[Checklist] Fetch error:', err);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (id: string) => {
    setCompletedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const formatStageName = (s: string): string => {
    return s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getUrgencyLabel = () => {
    if (daysUntil === 0) return { text: 'TODAY', color: '#EF4444' };
    if (daysUntil === 1) return { text: 'TOMORROW', color: '#F59E0B' };
    return { text: `In ${daysUntil} days`, color: colors.primary };
  };

  const urgency = getUrgencyLabel();
  const completedCount = completedItems.size;
  const totalCount = items.length;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        
        {/* Simple Card Overlay */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={[styles.companyName, { color: colors.text }]}>{company}</Text>
              <Text style={[styles.stageName, { color: colors.textSecondary }]}>
                {formatStageName(stage)} Interview
              </Text>
              <View style={[styles.urgencyBadge, { backgroundColor: urgency.color + '20' }]}>
                <Text style={[styles.urgencyText, { color: urgency.color }]}>{urgency.text}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Title */}
          <View style={styles.titleRow}>
            <Ionicons name="checkbox-outline" size={20} color={colors.primary} />
            <Text style={[styles.title, { color: colors.text }]}>AI Interview Prep Checklist</Text>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Generating personalized checklist...
              </Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={40} color="#EF4444" />
              <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
              <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={fetchChecklist}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
              {items.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.checkItem, { borderBottomColor: colors.border }]}
                  onPress={() => toggleItem(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.checkbox,
                    { borderColor: completedItems.has(item.id) ? colors.primary : colors.border },
                    completedItems.has(item.id) && { backgroundColor: colors.primary }
                  ]}>
                    {completedItems.has(item.id) && (
                      <Ionicons name="checkmark" size={14} color="white" />
                    )}
                  </View>
                  <View style={styles.checkItemContent}>
                    <Text style={[
                      styles.checkItemText,
                      { color: colors.text },
                      completedItems.has(item.id) && styles.checkedText
                    ]}>
                      {index + 1}. {item.text}
                    </Text>
                    {item.company_specific && (
                      <View style={[styles.companyTag, { backgroundColor: colors.primary + '15' }]}>
                        <Text style={[styles.companyTagText, { color: colors.primary }]}>
                          {company}-specific
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Footer */}
          {!loading && !error && items.length > 0 && (
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                {completedCount}/{totalCount} completed
              </Text>
              {completedCount === totalCount && (
                <Text style={styles.readyText}>You're ready! 🎉</Text>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '80%',
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  companyName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  stageName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  urgencyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    textAlign: 'center',
  },
  errorContainer: {
    paddingVertical: 30,
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: 'white',
    fontWeight: '600',
  },
  listContainer: {
    maxHeight: 300,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
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
  checkItemContent: {
    flex: 1,
  },
  checkItemText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  checkedText: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  companyTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 6,
  },
  companyTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: 16,
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 13,
  },
  readyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22C55E',
  },
});

export default InterviewChecklist;
