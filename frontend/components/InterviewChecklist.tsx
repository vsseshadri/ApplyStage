import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface FocusArea {
  id: string;
  text: string;
  category: string;
}

interface InterviewChecklistProps {
  visible: boolean;
  onClose: () => void;
  stage: string;
  company: string;
  position: string;
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

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const EMERGENT_LLM_KEY = 'sk-emergent-66a2f7f8f020eDaA7B';
const LLM_API_URL = 'https://api.openai.com/v1/chat/completions';
const LLM_TIMEOUT_MS = 8000; // 8 second timeout
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minute cache

// Stage display names mapping
const STAGE_DISPLAY_NAMES: { [key: string]: string } = {
  recruiter_screening: 'Recruiter Screening',
  phone_screen: 'Phone Screen',
  technical_screen: 'Technical Screen',
  coding_round_1: 'Coding Round 1',
  coding_round_2: 'Coding Round 2',
  system_design: 'System Design',
  behavioural: 'Behavioral',
  hiring_manager: 'Hiring Manager',
  final_round: 'Final Round',
  onsite: 'Onsite',
  offer: 'Offer Negotiation',
  clinical: 'Clinical Interview',
  case_study: 'Case Study',
};

// Role seniority detection
const SENIORITY_KEYWORDS = {
  principal: ['principal', 'staff', 'distinguished', 'fellow', 'architect'],
  senior: ['senior', 'sr.', 'sr ', 'lead', 'manager', 'director', 'vp', 'head'],
  mid: ['mid', 'intermediate', 'level ii', 'ii'],
  junior: ['junior', 'jr.', 'jr ', 'associate', 'entry', 'intern', 'graduate'],
};

// Role family detection
const ROLE_FAMILIES = {
  engineering: ['engineer', 'developer', 'programmer', 'architect', 'devops', 'sre', 'platform'],
  data: ['data scientist', 'data analyst', 'ml engineer', 'machine learning', 'ai ', 'analytics'],
  product: ['product manager', 'product owner', 'pm ', 'program manager'],
  design: ['designer', 'ux', 'ui', 'user experience', 'user interface'],
  healthcare: ['nurse', 'physician', 'doctor', 'clinician', 'medical', 'healthcare', 'rn ', 'np '],
  finance: ['analyst', 'accountant', 'finance', 'investment', 'banking', 'trader'],
  sales: ['sales', 'account executive', 'business development', 'bd ', 'ae '],
  marketing: ['marketing', 'growth', 'brand', 'content', 'seo', 'sem'],
  legal: ['lawyer', 'attorney', 'legal', 'counsel', 'paralegal'],
  hr: ['recruiter', 'hr ', 'human resources', 'talent', 'people ops'],
};

// ============================================================================
// IN-MEMORY CACHE (Session Scope)
// ============================================================================

interface CacheEntry {
  topics: FocusArea[];
  timestamp: number;
}

const topicCache: Map<string, CacheEntry> = new Map();

const getCacheKey = (stage: string, position: string): string => {
  return `${stage.toLowerCase()}_${position.toLowerCase().replace(/\s+/g, '_')}`;
};

const getCachedTopics = (stage: string, position: string): FocusArea[] | null => {
  const key = getCacheKey(stage, position);
  const entry = topicCache.get(key);
  
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.topics;
  }
  
  return null;
};

const setCachedTopics = (stage: string, position: string, topics: FocusArea[]): void => {
  const key = getCacheKey(stage, position);
  topicCache.set(key, {
    topics,
    timestamp: Date.now(),
  });
};

// ============================================================================
// ROLE & SENIORITY DETECTION
// ============================================================================

const detectSeniority = (position: string): string => {
  const lower = position.toLowerCase();
  
  for (const [level, keywords] of Object.entries(SENIORITY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return level;
    }
  }
  
  return 'mid'; // Default to mid-level
};

const detectRoleFamily = (position: string): string => {
  const lower = position.toLowerCase();
  
  for (const [family, keywords] of Object.entries(ROLE_FAMILIES)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return family;
    }
  }
  
  return 'engineering'; // Default to engineering
};

// ============================================================================
// DETERMINISTIC FALLBACK HEURISTIC GENERATOR
// ============================================================================

const generateFallbackTopics = (stage: string, position: string, company: string): FocusArea[] => {
  const seniority = detectSeniority(position);
  const roleFamily = detectRoleFamily(position);
  const stageLower = stage.toLowerCase();
  
  // More specific, actionable topics by stage
  const stageTopics: { [key: string]: string[] } = {
    recruiter_screening: [
      'Research salary bands on Levels.fyi and prepare your target range with justification',
      'List 3 recent company news items (funding, product launches, leadership changes)',
      'Prepare a 60-second pitch: role → company → why now alignment',
      'Identify 2-3 questions about team structure and growth trajectory',
      'Review the job posting and match your experience to each requirement',
      'Prepare to explain any employment gaps or transitions concisely',
    ],
    phone_screen: [
      'Map your top 3 achievements to specific metrics (%, $, time saved)',
      'Research the interviewer on LinkedIn and find common ground',
      'Prepare a compelling "why this company specifically" answer with examples',
      'Draft 3 STAR stories: leadership challenge, technical win, team conflict',
      'Set up a distraction-free space with good audio and backup phone',
      'Prepare 2 insightful questions about team challenges and priorities',
    ],
    technical_screen: [
      'Review Big-O complexity for arrays, hashmaps, trees, and graphs',
      'Solve 3 medium LeetCode problems in your target language under 25 min each',
      'Practice explaining your approach out loud before writing code',
      'Review language-specific APIs: string methods, sorting, data structures',
      'Prepare to discuss a technical project you owned end-to-end',
      'Practice asking clarifying questions about inputs, outputs, and constraints',
    ],
    coding_round_1: [
      'Master these patterns: two pointers, sliding window, hashmap frequency counting',
      'Practice 5 problems from blind75 list with 20-min time limit each',
      'Rehearse the flow: clarify → examples → approach → code → test → optimize',
      'Review edge cases: empty input, single element, duplicates, negative numbers',
      'Practice debugging syntax errors quickly without IDE assistance',
      'Prepare to discuss time/space complexity trade-offs in your solutions',
    ],
    coding_round_2: [
      'Review advanced structures: tries for prefix, heaps for top-k, union-find for graphs',
      'Practice 3 dynamic programming problems: memoization vs tabulation approaches',
      'Study graph algorithms: BFS for shortest path, DFS for connected components',
      'Prepare for optimization questions: "Can you do better than O(n²)?"',
      'Review binary search variations: first/last occurrence, rotated arrays',
      'Practice explaining recursive solutions and their space complexity',
    ],
    system_design: [
      'Practice capacity estimation: QPS, storage, bandwidth for 1M/100M users',
      'Draw a basic architecture: load balancer → app servers → cache → database',
      'Review CAP theorem and prepare examples of CP vs AP system choices',
      'Study caching strategies: cache-aside, write-through, TTL policies',
      'Prepare trade-off discussions: SQL vs NoSQL, monolith vs microservices',
      'Practice explaining database sharding and replication strategies',
    ],
    behavioural: [
      'Prepare a "Tell me about yourself" that ends with why this role',
      'Draft STAR stories for: biggest impact, handled conflict, learned from failure',
      'Research company values and map your stories to demonstrate them',
      'Prepare a "weakness" answer that shows self-awareness and growth',
      'Quantify all achievements: users impacted, revenue generated, time saved',
      'Practice delivering stories in 2-3 minutes with clear structure',
    ],
    hiring_manager: [
      'Research the manager\'s background and team\'s recent projects on LinkedIn',
      'Prepare a 30-60-90 day plan outline for ramping up in the role',
      'Draft questions about team goals, biggest challenges, and success metrics',
      'Prepare to discuss your management/leadership style with examples',
      'Research the team structure and prepare questions about collaboration',
      'Be ready to discuss how you handle feedback and disagreements',
    ],
    final_round: [
      'Research the executive team and company strategy/vision',
      'Prepare to articulate your long-term career goals and this role\'s fit',
      'Review all previous interview feedback and address any concerns',
      'Prepare high-level questions about company direction and culture',
      'Know your compensation expectations and be ready to discuss',
      'Prepare a summary of why you\'re the best candidate for the role',
    ],
    offer: [
      'Research total comp benchmarks on Levels.fyi for your level and location',
      'List your negotiation priorities: base, equity, sign-on, start date, WFH',
      'Prepare data points to justify your counter-offer (competing offers, experience)',
      'Understand the equity details: grant type, vesting schedule, strike price',
      'Calculate the total annual compensation including benefits value',
      'Prepare your decision timeline and walk-away criteria',
    ],
    clinical: [
      'Review clinical scenarios relevant to the specialty and setting',
      'Prepare examples of clinical decision-making under pressure',
      'Review relevant protocols, guidelines, and compliance requirements',
      'Prepare to discuss patient outcomes you\'ve improved with data',
      'Study pharmacology relevant to the role and common interactions',
      'Prepare ethical dilemma examples and your reasoning process',
    ],
    case_study: [
      'Review problem-solving frameworks: MECE, hypothesis-driven, issue trees',
      'Practice market sizing: TAM calculations with clear assumptions',
      'Prepare to structure ambiguous problems with clarifying questions',
      'Practice mental math: percentages, growth rates, unit economics',
      'Review common case types: market entry, profitability, M&A, growth',
      'Prepare to present recommendations with supporting data and risks',
    ],
  };
  
  // Get base topics for the stage
  let topics = stageTopics[stageLower] || stageTopics.phone_screen;
  
  // Modify based on seniority for relevant stages
  if (seniority === 'principal' || seniority === 'senior') {
    if (stageLower === 'system_design') {
      topics = [
        'Prepare to lead the design discussion and drive requirements gathering',
        'Review large-scale systems you\'ve designed with specific numbers',
        'Prepare trade-off examples at organizational scale (cost, complexity, velocity)',
        'Study distributed consensus, eventual consistency, and partition tolerance',
        'Prepare to discuss cross-team dependencies and API design decisions',
        'Review observability: metrics, logging, tracing at scale',
      ];
    } else if (stageLower === 'behavioural') {
      topics = [
        'Prepare stories demonstrating influence without authority',
        'Draft examples of mentoring engineers and growing team capabilities',
        'Prepare a "driving organizational change" story with measurable impact',
        'Document technical strategy decisions and their business outcomes',
        'Prepare examples of cross-functional collaboration with PMs/Design',
        'Draft a story about navigating ambiguity and defining direction',
      ];
    }
  }
  
  // Modify based on role family
  if (roleFamily === 'data' && (stageLower === 'technical_screen' || stageLower === 'coding_round_1')) {
    topics = [
      'Review SQL: window functions, CTEs, complex joins, query optimization',
      'Practice Python pandas operations: groupby, merge, apply, vectorization',
      'Review ML fundamentals: bias-variance, overfitting, cross-validation',
      'Prepare to explain a model you built: features, evaluation, iteration',
      'Practice A/B test design: sample size, significance, practical significance',
      'Review statistics: hypothesis testing, confidence intervals, p-values',
    ];
  } else if (roleFamily === 'product' && stageLower === 'behavioural') {
    topics = [
      'Prepare a product launch story with metrics: adoption, retention, revenue',
      'Draft examples of prioritization: frameworks used, trade-offs made',
      'Prepare a stakeholder management story: conflicting priorities resolution',
      'Document a "killed a feature" decision and how you communicated it',
      'Prepare customer empathy examples: user research, feedback incorporation',
      'Draft a story about data-driven decisions changing product direction',
    ];
  }
  
  // Add company-specific research as first item if company provided
  if (company && company.trim()) {
    topics = [
      `Research ${company}: recent product launches, engineering blog posts, and Glassdoor reviews`,
      ...topics.slice(0, 5),
    ];
  }
  
  // Convert to FocusArea format with IDs
  return topics.map((text, index) => ({
    id: `focus_${index + 1}`,
    text,
    category: getCategoryForTopic(text),
  }));
};

const getCategoryForTopic = (text: string): string => {
  const lower = text.toLowerCase();
  
  if (lower.includes('research') || lower.includes('review')) return 'research';
  if (lower.includes('practice') || lower.includes('prepare')) return 'practice';
  if (lower.includes('story') || lower.includes('example')) return 'stories';
  if (lower.includes('question')) return 'questions';
  if (lower.includes('technical') || lower.includes('data') || lower.includes('system')) return 'technical';
  if (lower.includes('communication') || lower.includes('explain')) return 'communication';
  
  return 'preparation';
};

// ============================================================================
// LLM API INTEGRATION
// ============================================================================

const getStageSpecificPromptContext = (stage: string): string => {
  const stageLower = stage.toLowerCase();
  
  const stageContexts: { [key: string]: string } = {
    recruiter_screening: `This is an initial recruiter call (15-30 min). Focus on: salary expectations research, company culture fit signals, role scope clarity, and making a strong first impression. Topics should help the candidate avoid being screened out.`,
    
    phone_screen: `This is a phone screen with hiring team (30-45 min). Focus on: resume deep-dive preparation, motivation articulation, role fit demonstration, and thoughtful questions. Topics should help establish credibility and interest.`,
    
    technical_screen: `This is a technical screening call (45-60 min). Focus on: fundamental concepts review, problem-solving demonstration, technical communication clarity, and domain knowledge. Topics should be specific to passing technical evaluation.`,
    
    coding_round_1: `This is the first coding interview (45-60 min). Focus on: specific algorithm patterns (arrays, strings, hashmaps), time complexity optimization, edge case handling, and clear code communication. Topics must be directly actionable for coding problems.`,
    
    coding_round_2: `This is an advanced coding round. Focus on: complex data structures (trees, graphs, heaps), dynamic programming patterns, optimization techniques, and system-aware coding. Topics should prepare for harder problems.`,
    
    system_design: `This is a system design interview (45-60 min). Focus on: requirement clarification techniques, capacity estimation methods, specific system components (load balancers, caches, databases), and trade-off articulation. Topics must be architecturally specific.`,
    
    behavioural: `This is a behavioral interview (45-60 min). Focus on: STAR story structuring, specific competencies (leadership, conflict, failure), company values alignment, and impactful quantification. Topics should prepare concrete stories.`,
    
    hiring_manager: `This is a hiring manager interview (45-60 min). Focus on: team dynamics understanding, management style alignment, 30-60-90 day planning, and strategic contribution vision. Topics should demonstrate team fit and initiative.`,
    
    final_round: `This is a final/executive round. Focus on: executive presence, strategic vision articulation, long-term career alignment, and compensation discussion readiness. Topics should prepare for high-stakes evaluation.`,
    
    offer: `This is offer negotiation stage. Focus on: specific compensation components (base, equity, bonus, benefits), market rate data sources, negotiation tactics, and decision timeline management. Topics must be actionable for negotiation.`,
    
    clinical: `This is a clinical interview for healthcare roles. Focus on: specific patient care scenarios, clinical decision protocols, compliance requirements, and care outcome examples. Topics must be clinically relevant.`,
    
    case_study: `This is a case study presentation. Focus on: structured frameworks (MECE, hypothesis-driven), quantitative analysis methods, recommendation synthesis, and presentation clarity. Topics should prepare analytical delivery.`,
  };
  
  return stageContexts[stageLower] || stageContexts.phone_screen;
};

const generateDynamicTopics = async (
  stage: string,
  position: string,
  company: string,
  forceNewGeneration: boolean = false
): Promise<FocusArea[] | null> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  
  const stageDisplay = STAGE_DISPLAY_NAMES[stage.toLowerCase()] || stage.replace(/_/g, ' ');
  const stageContext = getStageSpecificPromptContext(stage);
  const seniority = detectSeniority(position);
  const roleFamily = detectRoleFamily(position);
  
  const seniorityContext = seniority === 'senior' || seniority === 'principal' 
    ? 'This is a senior-level candidate who should demonstrate leadership, architectural thinking, and strategic impact.'
    : seniority === 'junior' 
    ? 'This is an early-career candidate who should demonstrate learning agility, fundamentals mastery, and growth potential.'
    : 'This is a mid-level candidate who should demonstrate solid execution and growth trajectory.';

  const variationSeed = forceNewGeneration ? `\n[Variation seed: ${Date.now()}]` : '';
  
  const prompt = `You are an expert interview coach. Generate exactly 6 highly specific, actionable preparation topics for this interview:

**Role:** ${position}
**Interview Stage:** ${stageDisplay}
${company ? `**Company:** ${company}` : ''}
**Seniority Level:** ${seniority}
**Role Type:** ${roleFamily}

**Stage Context:** ${stageContext}

**Seniority Context:** ${seniorityContext}

**CRITICAL REQUIREMENTS:**
1. Each topic must be a SPECIFIC, ACTIONABLE task (not generic advice)
2. Topics must directly help succeed in THIS specific stage
3. Include concrete details: specific techniques, frameworks, or resources
4. For technical roles: include specific technologies, patterns, or tools to review
5. Each topic should be completable in 30 min - 2 hours
6. NO generic advice like "research the company" - be specific about WHAT to research
${forceNewGeneration ? '7. Generate DIFFERENT topics than typical suggestions - focus on often-overlooked but critical preparation areas' : ''}
${variationSeed}

**Examples of GOOD specific topics:**
- "Practice the 'Top K Elements' pattern using heap - do 3 LeetCode medium problems"
- "Map your biggest project to STAR format with specific metrics (revenue, users, efficiency gains)"
- "Review CAP theorem trade-offs and prepare examples of when you'd choose CP vs AP systems"

**Examples of BAD generic topics:**
- "Review data structures" (too vague)
- "Prepare for behavioral questions" (not actionable)
- "Research the company" (not specific)

Return ONLY a JSON array of exactly 6 strings. No markdown, no explanation.`;

  try {
    const response = await fetch(LLM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EMERGENT_LLM_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert interview coach specializing in technical and behavioral interview preparation. You provide highly specific, actionable advice. Return ONLY valid JSON arrays of strings with no markdown formatting.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 600,
        temperature: forceNewGeneration ? 0.9 : 0.7, // Higher temperature for refresh to get more variety
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log('[PrepChecklist] LLM API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    
    if (!content) {
      return null;
    }
    
    // Parse JSON response
    let topics: string[];
    try {
      // Handle both raw array and markdown-wrapped responses
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        topics = JSON.parse(jsonMatch[0]);
      } else {
        return null;
      }
    } catch (parseError) {
      console.log('[PrepChecklist] JSON parse error:', parseError);
      return null;
    }
    
    // Validate and convert to FocusArea format
    if (!Array.isArray(topics) || topics.length < 4) {
      return null;
    }
    
    return topics.slice(0, 6).map((text, index) => ({
      id: `ai_${index + 1}`,
      text: typeof text === 'string' ? text : String(text),
      category: getCategoryForTopic(typeof text === 'string' ? text : ''),
    }));
    
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.log('[PrepChecklist] LLM request timed out');
    } else {
      console.log('[PrepChecklist] LLM error:', error.message);
    }
    
    return null;
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const InterviewChecklist: React.FC<InterviewChecklistProps> = ({
  visible,
  onClose,
  stage,
  company,
  position,
  jobId,
  daysUntil,
  colors,
  sessionToken,
}) => {
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);
  
  // Track component mount status
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  
  // Fetch topics when modal opens
  useEffect(() => {
    if (visible && stage) {
      loadTopics(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, stage, position]);
  
  const loadTopics = async (forceRefresh: boolean) => {
    if (!forceRefresh) {
      // Check cache first
      const cached = getCachedTopics(stage, position);
      if (cached) {
        setFocusAreas(cached);
        setIsAiGenerated(true);
        setLoading(false);
        return;
      }
    }
    
    setLoading(true);
    
    // Try to get AI-generated topics first for better quality
    const aiTopics = await generateDynamicTopics(stage, position, company, forceRefresh);
    
    if (mountedRef.current && aiTopics && aiTopics.length >= 4) {
      setFocusAreas(aiTopics);
      setIsAiGenerated(true);
      setCachedTopics(stage, position, aiTopics);
      setLoading(false);
    } else if (mountedRef.current) {
      // Fall back to deterministic topics only if AI fails
      const fallbackTopics = generateFallbackTopics(stage, position, company);
      setFocusAreas(fallbackTopics);
      setIsAiGenerated(false);
      setLoading(false);
    }
  };
  
  const handleRefresh = async () => {
    setRefreshing(true);
    
    // Clear cache for this combination to force new generation
    const key = getCacheKey(stage, position);
    topicCache.delete(key);
    
    // Try AI generation with forceNewGeneration=true for variety
    const aiTopics = await generateDynamicTopics(stage, position, company, true);
    
    if (mountedRef.current) {
      if (aiTopics && aiTopics.length >= 4) {
        setFocusAreas(aiTopics);
        setIsAiGenerated(true);
        // Don't cache refresh results to ensure next refresh is also fresh
      } else {
        // Regenerate fallback with shuffled order for some variety
        const fallbackTopics = generateFallbackTopics(stage, position, company);
        // Shuffle the topics to provide some variation
        const shuffled = [...fallbackTopics].sort(() => Math.random() - 0.5);
        setFocusAreas(shuffled);
        setIsAiGenerated(false);
      }
      setRefreshing(false);
    }
  };
  
  const formatStageName = (s: string): string => {
    return STAGE_DISPLAY_NAMES[s.toLowerCase()] || s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };
  
  const getUrgencyLabel = () => {
    const days = typeof daysUntil === 'number' && !isNaN(daysUntil) ? daysUntil : null;
    
    if (days === null) return null;
    if (days === 0) return { text: 'TODAY', color: '#EF4444' };
    if (days === 1) return { text: 'TOMORROW', color: '#F59E0B' };
    if (days < 0) return null;
    return { text: `In ${days} days`, color: colors.primary };
  };
  
  const urgency = getUrgencyLabel();
  
  // Category icons mapping
  const getCategoryIcon = (category: string): string => {
    const icons: { [key: string]: string } = {
      research: 'search',
      practice: 'fitness',
      stories: 'book',
      questions: 'help-circle',
      technical: 'code-slash',
      communication: 'chatbubbles',
      preparation: 'clipboard',
    };
    return icons[category] || 'checkmark-circle';
  };
  
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
        
        {/* Main Card */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={[styles.title, { color: colors.text }]}>
                Focus Areas for This Stage
              </Text>
              <View style={styles.headerMeta}>
                <Text style={[styles.stageName, { color: colors.primary }]}>
                  {formatStageName(stage)}
                </Text>
                {position && (
                  <Text style={[styles.positionName, { color: colors.textSecondary }]}>
                    • {position}
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity 
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          {/* Company & Urgency Bar */}
          {(company || urgency) && (
            <View style={[styles.metaBar, { borderBottomColor: colors.border }]}>
              {company && (
                <View style={styles.companyTag}>
                  <Ionicons name="business-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.companyText, { color: colors.textSecondary }]}>
                    {company}
                  </Text>
                </View>
              )}
              {urgency && (
                <View style={[styles.urgencyBadge, { backgroundColor: urgency.color + '20' }]}>
                  <Text style={[styles.urgencyText, { color: urgency.color }]}>
                    {urgency.text}
                  </Text>
                </View>
              )}
            </View>
          )}
          
          {/* Topics List */}
          <ScrollView style={styles.topicsList} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Generating focus areas...
                </Text>
              </View>
            ) : (
              focusAreas.map((area, index) => (
                <View 
                  key={area.id} 
                  style={[
                    styles.topicCard,
                    { backgroundColor: colors.background },
                    index === focusAreas.length - 1 && styles.lastTopicCard
                  ]}
                >
                  <View style={[styles.topicNumber, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.topicNumberText, { color: colors.primary }]}>
                      {index + 1}
                    </Text>
                  </View>
                  <Text style={[styles.topicText, { color: colors.text }]}>
                    {area.text}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
          
          {/* Footer Actions */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity 
              style={[styles.refreshButton, { borderColor: colors.border }]}
              onPress={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="refresh" size={18} color={colors.primary} />
                  <Text style={[styles.refreshText, { color: colors.primary }]}>
                    Refresh
                  </Text>
                </>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.closeActionButton, { backgroundColor: colors.primary }]}
              onPress={onClose}
            >
              <Text style={styles.closeActionText}>Done</Text>
            </TouchableOpacity>
          </View>
          
          {/* AI indicator */}
          {!loading && (
            <View style={styles.aiIndicator}>
              <Ionicons 
                name={isAiGenerated ? 'sparkles' : 'cube-outline'} 
                size={12} 
                color={colors.textSecondary} 
              />
              <Text style={[styles.aiIndicatorText, { color: colors.textSecondary }]}>
                {isAiGenerated ? 'AI-personalized' : 'Standard tips'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  card: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 12,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  stageName: {
    fontSize: 14,
    fontWeight: '600',
  },
  positionName: {
    fontSize: 13,
    marginLeft: 4,
  },
  closeButton: {
    padding: 4,
  },
  metaBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  companyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  companyText: {
    fontSize: 13,
    marginLeft: 6,
  },
  urgencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: '700',
  },
  topicsList: {
    padding: 16,
    paddingTop: 12,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  topicCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  lastTopicCard: {
    marginBottom: 0,
  },
  topicNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  topicNumberText: {
    fontSize: 13,
    fontWeight: '700',
  },
  topicText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  refreshButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  refreshText: {
    fontSize: 14,
    fontWeight: '600',
  },
  closeActionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  closeActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  aiIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 12,
    gap: 4,
  },
  aiIndicatorText: {
    fontSize: 11,
  },
});

export default InterviewChecklist;
