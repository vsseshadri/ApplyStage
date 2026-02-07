import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, Animated, Platform } from 'react-native';
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

const BACKEND_URL = getBackendUrl();

const InterviewChecklist: React.FC<InterviewChecklistProps> = ({
  visible,
  onClose,
  stage,
  company,
  daysUntil,
  colors,
  sessionToken,
}) => {
  const [checklist, setChecklist] = useState<{ title: string; items: ChecklistItem[] }>({ title: '', items: [] });
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const slideAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (visible) {
      fetchChecklist();
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible, stage, company]);

  const fetchChecklist = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/interview-checklist/${stage}?company=${encodeURIComponent(company)}`,
        { headers: { 'Authorization': `Bearer ${sessionToken}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setChecklist(data);
      }
    } catch (error) {
      console.log('Error fetching checklist:', error);
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
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
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
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
            <Text style={[styles.progressText, { color: colors.textSecondary }]}>
              {completedCount}/{totalCount} completed
            </Text>
          </View>

          {/* Checklist */}
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Loading checklist...
                </Text>
              </View>
            ) : (
              checklist.items.map((item, index) => (
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
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: colors.primary }]}
              onPress={onClose}
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
  progressText: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'right',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
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
  footer: {
    padding: 20,
    borderTopWidth: 1,
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
