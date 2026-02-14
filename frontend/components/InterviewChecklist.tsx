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

  const BACKEND_URL = getBackendUrl();

  useEffect(() => {
    if (visible && stage) {
      fetchChecklist();
    }
  }, [visible, stage, company]);

  const fetchChecklist = async () => {
    setLoading(true);
    
    try {
      // Use the upcoming-interviews endpoint with query params for checklist
      const url = `${BACKEND_URL}/api/dashboard/upcoming-interviews?include_checklist=true&checklist_stage=${encodeURIComponent(stage)}&checklist_company=${encodeURIComponent(company || '')}`;
      console.log('[Checklist] Fetching from:', url);
      
      const response = await fetch(url, {
        headers: { 
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Handle response with checklist included
        if (data.checklist && data.checklist.items && Array.isArray(data.checklist.items)) {
          setItems(data.checklist.items.slice(0, 5));
        } else {
          // Use comprehensive stage-specific fallback
          console.log('[Checklist] Using stage-specific fallback for:', stage);
          setItems(getStageSpecificChecklist(stage, company));
        }
      } else {
        // Use fallback on error
        setItems(getStageSpecificChecklist(stage, company));
      }
    } catch (err) {
      console.log('[Checklist] Fetch error, using fallback:', err);
      setItems(getStageSpecificChecklist(stage, company));
    } finally {
      setLoading(false);
    }
  };

  // Comprehensive stage-specific checklist items
  const getStageSpecificChecklist = (stg: string, comp: string): ChecklistItem[] => {
    const stageChecklists: { [key: string]: ChecklistItem[] } = {
      // Recruiter Screening
      recruiter_screening: [
        { id: "rs1", text: "Prepare 60-second elevator pitch about yourself", category: "pitch" },
        { id: "rs2", text: "Review job description and match your skills", category: "preparation" },
        { id: "rs3", text: "Research company mission, values, and culture", category: "research" },
        { id: "rs4", text: "Prepare salary expectations (check Glassdoor/Levels.fyi)", category: "compensation" },
        { id: "rs5", text: "Have 3 questions ready about role and team", category: "questions" }
      ],
      // Phone Screen
      phone_screen: [
        { id: "ps1", text: "Review your resume - be ready to discuss any point", category: "preparation" },
        { id: "ps2", text: "Prepare 'Why this company?' and 'Why this role?' answers", category: "pitch" },
        { id: "ps3", text: "Research recent company news and announcements", category: "research" },
        { id: "ps4", text: "Have 3-4 STAR stories ready (Situation, Task, Action, Result)", category: "stories" },
        { id: "ps5", text: "Test your phone/video setup in a quiet space", category: "preparation" }
      ],
      // Technical Screen
      technical_screen: [
        { id: "ts1", text: "Review data structures: arrays, trees, graphs, hash maps", category: "technical" },
        { id: "ts2", text: "Practice 2-3 LeetCode medium problems with time limit", category: "practice" },
        { id: "ts3", text: "Be ready to explain your thought process out loud", category: "communication" },
        { id: "ts4", text: "Review Big O notation and complexity analysis", category: "technical" },
        { id: "ts5", text: "Test screen sharing and coding environment", category: "preparation" }
      ],
      // System Design
      system_design: [
        { id: "sd1", text: "Review system design fundamentals (CAP theorem, scaling)", category: "architecture" },
        { id: "sd2", text: "Practice designing: URL shortener, Twitter feed, Chat app", category: "practice" },
        { id: "sd3", text: "Know trade-offs: SQL vs NoSQL, caching strategies", category: "technical" },
        { id: "sd4", text: "Be ready for capacity estimation and back-of-envelope math", category: "optimization" },
        { id: "sd5", text: "Prepare to discuss load balancing and database sharding", category: "architecture" }
      ],
      // Behavioral
      behavioral: [
        { id: "bh1", text: "Prepare 5 STAR stories: leadership, conflict, failure, success", category: "stories" },
        { id: "bh2", text: "Have examples of cross-team collaboration", category: "stories" },
        { id: "bh3", text: "Prepare a story about receiving difficult feedback", category: "stories" },
        { id: "bh4", text: "Research company values - align your stories", category: "research" },
        { id: "bh5", text: "Practice out loud - time yourself (2-3 min per story)", category: "practice" }
      ],
      // Hiring Manager
      hiring_manager: [
        { id: "hm1", text: "Research the hiring manager on LinkedIn", category: "research" },
        { id: "hm2", text: "Prepare questions about team structure and goals", category: "questions" },
        { id: "hm3", text: "Have a 30-60-90 day plan outline ready", category: "preparation" },
        { id: "hm4", text: "Be ready to discuss your management/leadership style", category: "stories" },
        { id: "hm5", text: "Prepare examples of mentoring or team building", category: "stories" }
      ],
      // Onsite
      onsite: [
        { id: "os1", text: "Get 8 hours of sleep the night before", category: "wellness" },
        { id: "os2", text: "Review all interviewers on LinkedIn", category: "research" },
        { id: "os3", text: "Prepare different questions for each interviewer", category: "questions" },
        { id: "os4", text: "Plan your outfit and travel/login logistics", category: "preparation" },
        { id: "os5", text: "Bring water, snacks, and copies of your resume", category: "preparation" }
      ],
      // Final Round
      final_round: [
        { id: "fr1", text: "Review feedback from previous rounds (if available)", category: "preparation" },
        { id: "fr2", text: "Research executive team and company strategy", category: "research" },
        { id: "fr3", text: "Prepare high-level vision for your contribution", category: "pitch" },
        { id: "fr4", text: "Have thoughtful strategic questions ready", category: "questions" },
        { id: "fr5", text: "Be prepared to discuss compensation expectations", category: "compensation" }
      ],
      // Offer Stage
      offer: [
        { id: "of1", text: "Research market rates on Levels.fyi, Glassdoor, Blind", category: "compensation" },
        { id: "of2", text: "Ask about health insurance, dental, vision coverage", category: "compensation" },
        { id: "of3", text: "Clarify 401k match percentage and vesting schedule", category: "compensation" },
        { id: "of4", text: "Understand equity/RSU details: vesting, refresh grants", category: "compensation" },
        { id: "of5", text: "Ask about PTO, remote work policy, signing bonus", category: "compensation" }
      ]
    };

    // Get stage-specific items or default to phone_screen
    let items = stageChecklists[stg] || stageChecklists.phone_screen;
    
    // Add company-specific research item if company is provided
    if (comp) {
      const companyItem: ChecklistItem = { 
        id: "ctx1", 
        text: `Research ${comp}'s recent news, products, and culture`, 
        category: "research", 
        company_specific: true 
      };
      items = [companyItem, ...items.slice(0, 4)];
    }
    
    return items;
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

  // Fixed: Handle NaN and invalid daysUntil values - return null to hide badge entirely
  const getUrgencyLabel = () => {
    const days = typeof daysUntil === 'number' && !isNaN(daysUntil) ? daysUntil : null;
    
    if (days === null) return null; // Don't show badge if no valid date
    if (days === 0) return { text: 'TODAY', color: '#EF4444' };
    if (days === 1) return { text: 'TOMORROW', color: '#F59E0B' };
    if (days < 0) return null; // Don't show badge for past dates
    return { text: `In ${days} days`, color: colors.primary };
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
              {urgency && (
                <View style={[styles.urgencyBadge, { backgroundColor: urgency.color + '20' }]}>
                  <Text style={[styles.urgencyText, { color: urgency.color }]}>{urgency.text}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Divider - reduced spacing */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Title - left aligned, no icon */}
          <Text style={[styles.title, { color: colors.text }]}>Suggested Prep Checklist</Text>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading checklist...
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
              {items.map((item, index) => (
                <View key={item.id} style={styles.listItem}>
                  <Text style={[styles.listItemNumber, { color: colors.primary }]}>
                    {index + 1}.
                  </Text>
                  <Text style={[styles.listItemText, { color: colors.text }]}>
                    {item.text}
                  </Text>
                </View>
              ))}
            </ScrollView>
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
    marginVertical: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
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
  listContainer: {
    maxHeight: 300,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  listItemNumber: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
    minWidth: 20,
  },
  listItemText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
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
