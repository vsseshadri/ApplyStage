import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface FocusArea {
  id: string;
  text: string;
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
// CONFIGURATION - Privacy First, No Logging
// ============================================================================

const EMERGENT_LLM_KEY = 'sk-emergent-66a2f7f8f020eDaA7B';
const LLM_API_URL = 'https://api.openai.com/v1/chat/completions';
const LLM_TIMEOUT_MS = 10000;

// Session-scoped in-memory cache only - cleared on app restart
const sessionCache = new Map<string, { topics: FocusArea[]; timestamp: number }>();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

// Stage display names
const STAGE_NAMES: Record<string, string> = {
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

// ============================================================================
// ROLE & SENIORITY DETECTION - Pure Functions, No Side Effects
// ============================================================================

type Seniority = 'executive' | 'senior' | 'mid' | 'junior';
type RoleType = 'swe' | 'data' | 'pm' | 'tpm' | 'design' | 'clinical' | 'aerospace' | 'finance' | 'consulting' | 'sales' | 'ops' | 'general';

const detectSeniority = (pos: string): Seniority => {
  const p = pos.toLowerCase();
  if (/\b(vp|vice president|director|head|chief|cto|ceo|principal|staff|distinguished|fellow)\b/.test(p)) return 'executive';
  if (/\b(senior|sr\.?|lead|manager|architect)\b/.test(p)) return 'senior';
  if (/\b(junior|jr\.?|associate|entry|intern|graduate|trainee)\b/.test(p)) return 'junior';
  return 'mid';
};

const detectRole = (pos: string): RoleType => {
  const p = pos.toLowerCase();
  if (/\b(software|developer|engineer|swe|sde|devops|sre|backend|frontend|fullstack|mobile)\b/.test(p) && !/program|project|product/.test(p)) return 'swe';
  if (/\b(data scien|machine learning|ml |ai |analyst|analytics)\b/.test(p)) return 'data';
  if (/\b(product manager|product owner)\b/.test(p)) return 'pm';
  if (/\b(program manager|project manager|tpm|technical program)\b/.test(p)) return 'tpm';
  if (/\b(designer|ux|ui|user experience)\b/.test(p)) return 'design';
  if (/\b(nurse|physician|doctor|clinician|medical|rn\b|np\b|therapist|pharmacist)\b/.test(p)) return 'clinical';
  if (/\b(aerospace|avionics|flight|rocket|propulsion|aircraft)\b/.test(p)) return 'aerospace';
  if (/\b(finance|investment|banking|trader|accounting|controller)\b/.test(p)) return 'finance';
  if (/\b(consultant|consulting|strategy|advisory)\b/.test(p)) return 'consulting';
  if (/\b(sales|account executive|business development)\b/.test(p)) return 'sales';
  if (/\b(operations|supply chain|logistics|manufacturing)\b/.test(p)) return 'ops';
  return 'general';
};

// ============================================================================
// COMPREHENSIVE TOPIC DATABASE
// Indexed by: role -> stage -> seniority
// Each entry has multiple topic sets for refresh variety
// ============================================================================

type TopicSets = string[][];

interface TopicDB {
  [role: string]: {
    [stage: string]: {
      [seniority: string]: TopicSets;
    };
  };
}

const TOPICS: TopicDB = {
  // ==================== SOFTWARE ENGINEERING ====================
  swe: {
    system_design: {
      executive: [
        [
          'Prepare to lead architecture discussions for systems handling 10M+ daily users',
          'Review your decisions on CAP theorem trade-offs with specific examples (chose CP for payment systems because...)',
          'Document how you evaluated build vs buy for infrastructure components',
          'Prepare examples of defining SLOs/SLAs and driving reliability improvements',
          'Review your experience with multi-region deployments and disaster recovery',
          'Prepare to discuss organizational impact of architecture decisions',
        ],
        [
          'Study your approach to decomposing monoliths into microservices at scale',
          'Prepare examples of cross-team API design and governance',
          'Review cost optimization strategies you\'ve implemented (reduced infra spend by X%)',
          'Document your experience with zero-downtime migration strategies',
          'Prepare to discuss technical debt prioritization frameworks',
          'Review observability architecture: metrics, logs, traces at scale',
        ],
      ],
      senior: [
        [
          'Practice designing systems for 100K concurrent users with specific load balancing strategies (round-robin vs least connections)',
          'Review database sharding approaches: hash-based vs range-based with trade-offs',
          'Prepare to implement API rate limiting: token bucket algorithm with Redis',
          'Study caching patterns: cache-aside, write-through, write-behind with invalidation strategies',
          'Practice capacity estimation: calculate QPS, storage, bandwidth for given user base',
          'Review message queue patterns: at-least-once vs exactly-once delivery',
        ],
        [
          'Study microservices patterns: circuit breakers (Hystrix), bulkheads, retries with backoff',
          'Prepare to design a notification system with fanout, priority queues, rate limiting',
          'Review consistency patterns: eventual consistency, read-your-writes, strong consistency',
          'Practice designing a URL shortener with read/write optimization and analytics',
          'Study database replication: leader-follower, multi-leader, conflict resolution',
          'Prepare to discuss CDN architecture and edge caching strategies',
        ],
      ],
      mid: [
        [
          'Study basic system components: what load balancers do, types (L4 vs L7)',
          'Practice designing a simple key-value store with replication',
          'Review SQL vs NoSQL: when to use PostgreSQL vs MongoDB vs Cassandra',
          'Understand caching basics: what Redis does, TTL, cache hit ratio',
          'Practice drawing system diagrams with clear data flow',
          'Learn to ask clarifying questions: expected QPS, read/write ratio, latency SLA',
        ],
        [
          'Study how web requests flow: DNS → CDN → Load Balancer → App → DB',
          'Review horizontal vs vertical scaling with specific examples',
          'Practice designing a simple chat application architecture',
          'Understand database indexing: B-trees, when to add indexes',
          'Study API design basics: REST principles, pagination, versioning',
          'Review authentication patterns: JWT, sessions, OAuth basics',
        ],
      ],
      junior: [
        [
          'Learn the basic request flow: what happens when you type a URL',
          'Understand why we use databases and the difference between SQL and NoSQL',
          'Study what a load balancer does and why it\'s needed',
          'Learn about caching: why we cache, what Redis is',
          'Practice explaining a simple 3-tier architecture',
          'Prepare questions about the company\'s tech stack',
        ],
        [
          'Review client-server architecture basics',
          'Understand HTTP methods and status codes',
          'Learn about APIs: what they are, how to use them',
          'Study basic security: HTTPS, authentication vs authorization',
          'Practice drawing simple system diagrams',
          'Review what databases, web servers, and application servers do',
        ],
      ],
    },
    coding_round_1: {
      executive: [
        [
          'Review clean code principles - prepare to demonstrate and discuss',
          'Practice explaining trade-offs in algorithm choices during coding',
          'Prepare to discuss how you evaluate code quality in reviews',
          'Review concurrency patterns: thread safety, locks, async/await',
          'Practice coding while articulating design decisions',
          'Prepare examples of refactoring legacy code',
        ],
      ],
      senior: [
        [
          'Practice sliding window problems: minimum window substring, longest substring without repeating',
          'Master two-pointer technique: 3Sum, container with most water',
          'Review binary search variations: search in rotated array, find peak element',
          'Practice tree traversals: BFS, DFS, level order with modifications',
          'Study graph algorithms: detect cycle, topological sort',
          'Review dynamic programming: coin change, longest increasing subsequence',
        ],
        [
          'Practice hashmap patterns: two sum, group anagrams, LRU cache',
          'Review string manipulation: palindrome variations, string matching',
          'Study heap problems: merge k sorted lists, top k frequent elements',
          'Practice interval problems: merge intervals, meeting rooms',
          'Review linked list: reverse, detect cycle, merge sorted lists',
          'Study backtracking: permutations, combinations, subsets',
        ],
      ],
      mid: [
        [
          'Practice array problems: two sum, best time to buy/sell stock, maximum subarray',
          'Review hashmap usage for O(1) lookups and counting frequencies',
          'Study two-pointer basics: valid palindrome, reverse string',
          'Practice string manipulation: reverse words, valid anagram',
          'Review sorting algorithms: when to use which, built-in sort complexity',
          'Study recursion basics: factorial, fibonacci, tree traversal',
        ],
        [
          'Practice linked list basics: reverse, find middle, detect cycle',
          'Review stack problems: valid parentheses, daily temperatures',
          'Study binary search: basic implementation, search insert position',
          'Practice matrix problems: rotate image, spiral matrix traversal',
          'Review math problems: reverse integer, count primes',
          'Study bit manipulation basics: single number, counting bits',
        ],
      ],
      junior: [
        [
          'Review array fundamentals: iteration, indexing, common methods',
          'Practice basic string operations: reverse, check palindrome',
          'Study hashmap basics: how to use, when to use for lookups',
          'Practice simple problems: find max/min, count occurrences',
          'Review loop patterns: for, while, nested loops',
          'Study Big-O basics: O(1), O(n), O(n²) with examples',
        ],
        [
          'Practice tracing code step-by-step before running',
          'Review function basics: parameters, return values, scope',
          'Study conditional logic: if/else, switch statements',
          'Practice simple sorting: understand bubble sort concept',
          'Review array methods in your language: push, pop, slice',
          'Study debugging techniques: print statements, step through',
        ],
      ],
    },
    behavioural: {
      executive: [
        [
          'Prepare a story about building engineering culture at scale (hiring, processes, values)',
          'Document how you drove a major technical transformation with business impact',
          'Review examples of navigating conflicting priorities with other executives',
          'Prepare to discuss a technical bet that didn\'t pay off and how you handled it',
          'Document how you developed and retained top engineering talent',
          'Prepare examples of representing engineering to board/investors',
        ],
      ],
      senior: [
        [
          'Map your biggest project to STAR: situation, task, 3+ specific actions, quantified results',
          'Prepare a story about mentoring an engineer from junior to senior level',
          'Document a time you pushed back on product requirements with data',
          'Review how you handled a production incident: detection, response, post-mortem',
          'Prepare a "technical disagreement with peer" story with positive resolution',
          'Document examples of balancing tech debt vs feature delivery',
        ],
        [
          'Prepare a story about delivering a project with unclear requirements',
          'Document how you improved team processes (code review, testing, deployment)',
          'Review a time you had to make a decision with incomplete information',
          'Prepare examples of cross-team collaboration challenges and solutions',
          'Document a failure and specific changes you made afterwards',
          'Prepare to discuss your approach to giving and receiving feedback',
        ],
      ],
      mid: [
        [
          'Prepare 5 STAR stories covering: impact, teamwork, challenge, learning, initiative',
          'Quantify achievements: "improved latency by 40%", "reduced errors by 60%"',
          'Document a time you went beyond your job description',
          'Prepare a "learned from failure" story with specific takeaways',
          'Review examples of working with difficult stakeholders',
          'Prepare to discuss your career goals and why this role',
        ],
      ],
      junior: [
        [
          'Prepare STAR stories from school projects, internships, or personal projects',
          'Highlight learning agility: how quickly you picked up new technologies',
          'Document a challenging project and how you overcame obstacles',
          'Prepare to explain your interest in this specific company/role',
          'Review teamwork examples: your role, contributions, outcomes',
          'Prepare questions about mentorship and growth opportunities',
        ],
      ],
    },
    technical_screen: {
      senior: [
        [
          'Review your most complex project - be ready for deep technical questions',
          'Prepare to discuss architecture decisions and trade-offs you made',
          'Review advanced language features in your primary language',
          'Prepare to whiteboard a solution and explain your thinking',
          'Study system design elements that may come up in technical discussions',
          'Review testing strategies: unit, integration, e2e approaches',
        ],
      ],
      mid: [
        [
          'Review data structures: arrays, hashmaps, trees - when to use each',
          'Prepare to explain your projects technically in 3-5 minutes',
          'Practice coding simple problems while explaining your thought process',
          'Review OOP concepts: inheritance, polymorphism, encapsulation',
          'Study your primary language\'s standard library and common patterns',
          'Prepare technical questions about the company\'s stack',
        ],
      ],
      junior: [
        [
          'Review CS fundamentals: basic data structures, algorithms, complexity',
          'Prepare to discuss your coursework and personal projects',
          'Practice explaining technical concepts in simple terms',
          'Review basic SQL: SELECT, JOIN, WHERE, GROUP BY',
          'Study git basics: commit, branch, merge, pull request',
          'Prepare to demonstrate your learning approach and debugging skills',
        ],
      ],
    },
  },

  // ==================== PROGRAM MANAGEMENT ====================
  tpm: {
    system_design: {
      executive: [
        [
          'Prepare to discuss program architecture at portfolio level across 50+ engineers',
          'Document your approach to aligning technical roadmaps with business strategy',
          'Review examples of managing technical programs with $10M+ budgets',
          'Prepare to discuss vendor management and build vs buy decisions',
          'Document how you\'ve scaled TPM organizations and processes',
          'Prepare examples of executive communication on technical programs',
        ],
      ],
      senior: [
        [
          'Prepare to discuss managing cross-team dependencies in distributed systems',
          'Document how you create technical project plans with realistic estimates',
          'Review your approach to technical risk identification and mitigation',
          'Prepare examples of translating business requirements to technical specs',
          'Document how you manage scope creep in technical programs',
          'Prepare to discuss technical trade-offs: scope, timeline, quality, resources',
        ],
        [
          'Study common system integration challenges and how to plan for them',
          'Prepare examples of coordinating API changes across multiple teams',
          'Review your experience with migration projects and rollback plans',
          'Document how you work with architecture teams on technical decisions',
          'Prepare to discuss managing technical debt conversations',
          'Review your approach to technical documentation and knowledge sharing',
        ],
      ],
      mid: [
        [
          'Review how to create dependency-aware project timelines',
          'Study common technical risks in software projects and mitigation strategies',
          'Prepare to discuss Agile/Scrum methodologies at team and program level',
          'Document your experience tracking technical deliverables',
          'Review how to communicate technical status to non-technical stakeholders',
          'Prepare questions about the technical landscape you\'d be managing',
        ],
      ],
      junior: [
        [
          'Review software development lifecycle basics: planning, development, testing, deployment',
          'Study project management tools: Jira workflows, sprint planning, backlog management',
          'Understand technical dependencies and how to track them',
          'Learn about APIs and system integrations at a high level',
          'Prepare to discuss how you\'d learn the technical landscape quickly',
          'Review Agile ceremonies: standups, planning, retros, demos',
        ],
      ],
    },
    behavioural: {
      executive: [
        [
          'Prepare stories about managing multi-million dollar, multi-year programs',
          'Document examples of influencing executive decisions without direct authority',
          'Review how you\'ve navigated organizational change during major programs',
          'Prepare to discuss conflict resolution at VP/Director level',
          'Document program turnarounds: how you rescued failing initiatives',
          'Prepare examples of building TPM teams and developing talent',
        ],
      ],
      senior: [
        [
          'Prepare STAR stories about managing complex, ambiguous technical programs',
          'Document examples of driving accountability across engineering teams',
          'Review how you handled a program that was going off track',
          'Prepare a story about resolving conflicts between engineering teams',
          'Document your approach to stakeholder management with competing priorities',
          'Prepare examples of escalation decisions and outcomes',
        ],
        [
          'Document how you built trust with engineering leads',
          'Prepare a story about managing a program with changing requirements',
          'Review examples of risk communication to leadership',
          'Prepare to discuss your meeting facilitation style',
          'Document how you handle underperforming vendors or teams',
          'Prepare examples of process improvements you\'ve implemented',
        ],
      ],
      mid: [
        [
          'Prepare stories demonstrating stakeholder management across functions',
          'Document examples of keeping projects on track despite obstacles',
          'Review how you prioritize when multiple stakeholders have urgent requests',
          'Prepare a story about managing a difficult stakeholder relationship',
          'Document your approach to running effective meetings',
          'Prepare examples of communicating bad news effectively',
        ],
      ],
      junior: [
        [
          'Prepare stories about coordination from school, clubs, or internships',
          'Document examples of organizing events or group projects',
          'Review how you handle multiple deadlines and priorities',
          'Prepare to discuss your organizational and communication skills',
          'Document any leadership experience and what you learned',
          'Prepare questions about how TPMs operate in this organization',
        ],
      ],
    },
    hiring_manager: {
      senior: [
        [
          'Research the hiring manager\'s programs and team structure',
          'Prepare a 30-60-90 day plan for ramping on their programs',
          'Document your approach to building relationships with eng leads quickly',
          'Prepare questions about current program challenges and priorities',
          'Review the org structure and key stakeholders you\'d work with',
          'Prepare to discuss your program management philosophy',
        ],
      ],
      mid: [
        [
          'Research the manager\'s background and current programs',
          'Prepare to discuss your project management methodology',
          'Document how you\'ve handled challenging stakeholder situations',
          'Prepare questions about team structure and success metrics',
          'Review what tools and processes the team uses',
          'Prepare to discuss your communication and organization style',
        ],
      ],
    },
  },

  // ==================== CLINICAL/HEALTHCARE ====================
  clinical: {
    clinical: {
      executive: [
        [
          'Prepare examples of improving clinical outcomes at department/unit level with metrics',
          'Document your experience with quality improvement initiatives (PDSA cycles, Six Sigma)',
          'Review regulatory compliance leadership: Joint Commission, CMS, state requirements',
          'Prepare to discuss clinical staffing models and resource optimization',
          'Document experience implementing evidence-based practice changes',
          'Prepare examples of managing adverse events and system improvements',
        ],
      ],
      senior: [
        [
          'Prepare detailed patient scenarios in your specialty with clinical reasoning',
          'Review clinical protocols and situations where you\'d deviate from them',
          'Document examples of clinical decision-making under time pressure',
          'Practice SBAR format for critical handoffs and escalations',
          'Review medication interactions and high-alert medications in your specialty',
          'Prepare to discuss how you precept and mentor new staff',
        ],
        [
          'Study complex case management scenarios in your specialty area',
          'Prepare examples of patient advocacy and care coordination',
          'Review your approach to difficult conversations with patients/families',
          'Document how you stay current with clinical best practices',
          'Prepare to discuss interdisciplinary collaboration examples',
          'Review ethical dilemmas you\'ve navigated and your reasoning',
        ],
      ],
      mid: [
        [
          'Review clinical assessment frameworks for your patient population',
          'Prepare patient cases demonstrating your clinical judgment',
          'Document how you prioritize care with multiple patients',
          'Review pharmacology: common medications, doses, interactions',
          'Prepare to discuss documentation standards and EHR workflows',
          'Study infection control and safety protocols for your setting',
        ],
      ],
      junior: [
        [
          'Review core clinical competencies from your program',
          'Prepare examples from clinical rotations showing your learning',
          'Study common diagnoses and treatments in the specialty',
          'Review patient safety: fall prevention, medication safety, infection control',
          'Prepare to discuss how you handle stressful patient situations',
          'Document your clinical interests and professional goals',
        ],
      ],
    },
    behavioural: {
      senior: [
        [
          'Prepare STAR stories about complex patient cases and outcomes',
          'Document examples of advocating for patients or staff',
          'Review how you\'ve handled ethical dilemmas in clinical practice',
          'Prepare a story about teaching or mentoring clinical staff',
          'Document your approach to continuous learning and staying current',
          'Prepare examples of interprofessional team collaboration',
        ],
      ],
      mid: [
        [
          'Prepare stories demonstrating patient advocacy and communication',
          'Document examples of handling difficult patient or family situations',
          'Review how you manage stress and prevent burnout',
          'Prepare to discuss your continuing education and certifications',
          'Document examples of team collaboration in clinical settings',
          'Prepare a story about learning from a clinical error or near-miss',
        ],
      ],
      junior: [
        [
          'Prepare stories from clinical rotations showing compassion and care',
          'Document examples of handling challenging patient interactions',
          'Review why you chose this clinical specialty',
          'Prepare to discuss your stress management strategies',
          'Document preceptors or mentors who influenced your practice',
          'Prepare questions about orientation and support for new staff',
        ],
      ],
    },
  },

  // ==================== AEROSPACE ====================
  aerospace: {
    technical_screen: {
      executive: [
        [
          'Prepare to discuss aerospace program leadership and certification experience',
          'Review your experience with DO-178C/DO-254 compliance at program level',
          'Document major milestone achievements in aerospace programs',
          'Prepare examples of managing FAA/EASA certification processes',
          'Review your approach to safety management systems',
          'Prepare to discuss systems engineering at aircraft/spacecraft level',
        ],
      ],
      senior: [
        [
          'Review flight dynamics: equations of motion, stability derivatives, control response',
          'Prepare to discuss propulsion systems: turbofan performance, specific fuel consumption',
          'Document your experience with V&V processes: test plans, requirements traceability',
          'Review avionics architecture: ARINC 429, MIL-STD-1553, data buses',
          'Prepare examples of solving complex aerospace engineering problems',
          'Study recent developments in your aerospace specialty area',
        ],
        [
          'Review structural analysis: FEM basics, fatigue analysis, damage tolerance',
          'Prepare to discuss materials: composites, aluminum alloys, material selection',
          'Document your experience with environmental qualification testing',
          'Review aerodynamics: lift, drag, pressure distributions, CFD experience',
          'Prepare examples of trade studies you\'ve conducted',
          'Study regulatory requirements relevant to your specialty (FAR, MIL-STD)',
        ],
      ],
      mid: [
        [
          'Review core aerospace fundamentals: aerodynamics, structures, propulsion basics',
          'Prepare to discuss your experience with aerospace design tools (CATIA, MATLAB, NASTRAN)',
          'Document your understanding of aerospace quality standards (AS9100)',
          'Review materials properties and selection criteria for aerospace',
          'Prepare to discuss your testing and validation experience',
          'Study the company\'s products and recent aerospace programs',
        ],
      ],
      junior: [
        [
          'Review aerospace engineering fundamentals from coursework',
          'Prepare to discuss senior design project and key learnings',
          'Study basic aerodynamics: lift equation, drag components, Bernoulli',
          'Review orbital mechanics basics if applicable to the role',
          'Prepare to discuss your CAD and analysis tool experience',
          'Research the company\'s aerospace programs and missions',
        ],
      ],
    },
    system_design: {
      senior: [
        [
          'Review system safety analysis methods: FMEA, FTA, hazard analysis, safety cases',
          'Prepare to discuss avionics integration architecture and interfaces',
          'Document experience with redundancy design and fault tolerance',
          'Review environmental qualification: temperature, vibration, EMI/EMC',
          'Prepare examples of interface control document development',
          'Study system verification approaches: analysis, inspection, test, demo',
        ],
      ],
      mid: [
        [
          'Review systems engineering V-model and lifecycle processes',
          'Study interface definition and requirements flowdown',
          'Prepare to discuss configuration management in aerospace',
          'Review requirements management tools and traceability',
          'Document your experience with integration testing',
          'Prepare questions about the system architecture landscape',
        ],
      ],
    },
  },

  // ==================== DATA SCIENCE ====================
  data: {
    technical_screen: {
      executive: [
        [
          'Prepare to discuss ML strategy and ROI at organizational level',
          'Document your experience building and scaling data science teams',
          'Review your approach to ML infrastructure and MLOps decisions',
          'Prepare to discuss ethical AI, bias mitigation, and responsible ML',
          'Document examples of translating business problems to ML solutions at scale',
          'Prepare to discuss data governance and privacy frameworks',
        ],
      ],
      senior: [
        [
          'Review advanced ML: gradient boosting (XGBoost, LightGBM), neural network architectures',
          'Prepare to explain a model end-to-end: features, training, evaluation, deployment',
          'Practice SQL: window functions, CTEs, complex joins, query optimization',
          'Review A/B testing: power analysis, multiple comparisons, sequential testing',
          'Document your feature engineering strategies and pipelines',
          'Prepare to discuss ML monitoring and model drift detection',
        ],
        [
          'Study deep learning architectures: CNNs, RNNs, transformers, attention',
          'Prepare examples of debugging model performance issues',
          'Review statistics: hypothesis testing, confidence intervals, Bayesian methods',
          'Document your experience with ML in production systems',
          'Prepare to discuss experimentation platforms and feature stores',
          'Review causal inference methods: propensity scores, diff-in-diff, regression discontinuity',
        ],
      ],
      mid: [
        [
          'Review supervised learning: linear/logistic regression, decision trees, random forests',
          'Practice Python pandas: groupby, merge, apply, window operations efficiently',
          'Prepare SQL exercises: aggregations, joins, subqueries, case statements',
          'Review evaluation metrics: precision, recall, F1, AUC-ROC, when to use each',
          'Document your data pipeline and ETL experience',
          'Practice explaining ML concepts to non-technical stakeholders',
        ],
      ],
      junior: [
        [
          'Review ML basics: train/test split, overfitting, cross-validation, bias-variance',
          'Practice Python data manipulation with pandas and numpy',
          'Review SQL fundamentals: SELECT, JOIN, GROUP BY, HAVING',
          'Understand statistics basics: mean, variance, distributions, correlation',
          'Prepare to discuss your data science projects and Kaggle experience',
          'Review the company\'s data products and potential ML applications',
        ],
      ],
    },
    behavioural: {
      senior: [
        [
          'Prepare STAR stories about impactful ML/data projects with business metrics',
          'Document examples of collaborating with product and engineering teams',
          'Review how you communicate complex analysis to non-technical stakeholders',
          'Prepare a story about a model that failed or underperformed in production',
          'Document your approach to mentoring junior data scientists',
          'Prepare examples of prioritizing among multiple analysis requests',
        ],
      ],
      mid: [
        [
          'Prepare stories about data projects with clear business impact',
          'Document how you handle ambiguous data analysis requests',
          'Review examples of presenting insights to leadership',
          'Prepare to discuss how you ensure data quality and validate analysis',
          'Document examples of working with engineers on data pipelines',
          'Prepare a story about learning a new tool or technique quickly',
        ],
      ],
    },
  },

  // ==================== FINANCE ====================
  finance: {
    technical_screen: {
      senior: [
        [
          'Review advanced financial modeling: DCF with multiple scenarios, LBO mechanics',
          'Prepare to walk through a model you built: assumptions, sensitivity analysis',
          'Document experience with financial systems: ERP, Bloomberg, FactSet',
          'Review Excel advanced: INDEX-MATCH-MATCH, array formulas, financial functions',
          'Prepare to discuss your approach to financial analysis and recommendations',
          'Review current market conditions: rates, valuations, sector trends',
        ],
      ],
      mid: [
        [
          'Review financial statement analysis: ratios, trends, peer benchmarking',
          'Practice Excel modeling: building 3-statement model, sensitivity tables',
          'Prepare to discuss your budgeting and forecasting experience',
          'Review GAAP/IFRS principles relevant to your area',
          'Document financial analyses you\'ve conducted and their impact',
          'Prepare examples of presenting financial information to leadership',
        ],
      ],
      junior: [
        [
          'Review core finance: time value of money, NPV, IRR, WACC basics',
          'Practice Excel: pivot tables, VLOOKUP/INDEX-MATCH, charts',
          'Understand financial statements: income statement, balance sheet, cash flow',
          'Review basic accounting: debits/credits, accruals, journal entries',
          'Prepare to discuss your finance coursework and interests',
          'Research the company\'s financial position and recent earnings',
        ],
      ],
    },
    case_study: {
      senior: [
        [
          'Practice investment recommendation cases with clear thesis and catalysts',
          'Review valuation: comparable companies, precedent transactions, DCF',
          'Prepare to walk through your financial analysis framework',
          'Practice presenting recommendations with supporting data and risks',
          'Review industry metrics for 2-3 sectors in depth',
          'Prepare to discuss current market opportunities and risks',
        ],
      ],
      mid: [
        [
          'Practice financial case studies with 30-minute time limits',
          'Review valuation methods and when to apply each',
          'Prepare to structure financial analyses systematically',
          'Practice calculating financial metrics quickly: margins, returns, growth',
          'Review how to present financial recommendations clearly',
          'Prepare questions about the role\'s analytical responsibilities',
        ],
      ],
    },
  },

  // ==================== CONSULTING ====================
  consulting: {
    case_study: {
      executive: [
        [
          'Prepare to lead strategic case discussions at C-level',
          'Review frameworks for organizational transformation and change management',
          'Document major engagement turnarounds and lessons learned',
          'Prepare to discuss client relationship development and account growth',
          'Review your thought leadership and industry expertise',
          'Prepare examples of winning competitive pursuits',
        ],
      ],
      senior: [
        [
          'Master frameworks: MECE issue trees, hypothesis-driven problem solving',
          'Practice cases: market entry, profitability diagnosis, M&A synergies',
          'Prepare to lead case discussions and push back on interviewer',
          'Review industry analyses in 2-3 sectors with current trends',
          'Practice synthesizing recommendations under time pressure',
          'Prepare examples of managing client relationships and expectations',
        ],
        [
          'Practice market sizing with clear, defensible assumptions',
          'Review operations cases: cost reduction, process improvement',
          'Prepare growth strategy cases: organic vs inorganic, market expansion',
          'Practice financial analysis in case context: margins, break-even, ROI',
          'Document client success stories with quantified impact',
          'Prepare to discuss your industry expertise and perspectives',
        ],
      ],
      mid: [
        [
          'Practice case frameworks: 3C\'s, Porter\'s forces, value chain',
          'Master market sizing with top-down and bottom-up approaches',
          'Practice mental math: percentages, compound growth, unit economics',
          'Prepare structured approaches to profitability and market entry cases',
          'Practice delivering recommendations with clear logic chain',
          'Review 2-3 industries to demonstrate commercial awareness',
        ],
      ],
      junior: [
        [
          'Learn core frameworks: SWOT, 3C\'s, Porter\'s 5 forces, profit tree',
          'Practice market sizing: be explicit about assumptions and math',
          'Practice structuring problems into mutually exclusive components',
          'Review mental math: get comfortable with quick calculations',
          'Practice presenting analysis clearly and responding to pushback',
          'Prepare examples demonstrating analytical and structured thinking',
        ],
      ],
    },
    behavioural: {
      senior: [
        [
          'Prepare STAR stories about complex client engagements and impact',
          'Document examples of managing difficult client situations',
          'Review how you\'ve developed client relationships and grown accounts',
          'Prepare a story about recovering a challenging project',
          'Document your approach to developing and mentoring consultants',
          'Prepare examples of business development and proposal wins',
        ],
      ],
      mid: [
        [
          'Prepare stories demonstrating problem-solving and analytical skills',
          'Document examples of working under pressure with tight deadlines',
          'Review how you handle ambiguity and incomplete information',
          'Prepare a story about receiving tough feedback and improving',
          'Document teamwork examples and your role on project teams',
          'Prepare to discuss your motivation for consulting',
        ],
      ],
    },
  },

  // ==================== GENERAL (Fallback for all roles) ====================
  general: {
    recruiter_screening: {
      executive: [
        [
          'Prepare executive summary of your career impact in 60 seconds',
          'Research the company\'s board, investors, and recent strategic moves',
          'Document your compensation expectations with market data (Levels.fyi, Glassdoor)',
          'Prepare your leadership philosophy in 2-3 sentences',
          'Review recent company news and prepare relevant observations',
          'Prepare strategic questions about the role and organization',
        ],
      ],
      senior: [
        [
          'Prepare 60-second career summary highlighting progression and impact',
          'Research company on Glassdoor, LinkedIn, and news for recent developments',
          'Document salary expectations with market data justification',
          'Prepare 3 key achievements with quantified impact (%, $, time)',
          'Prepare questions about team structure and growth trajectory',
          'Review job description and map your experience to requirements',
        ],
      ],
      mid: [
        [
          'Prepare concise overview of your experience and career goals',
          'Research company culture, mission, products, and recent news',
          'Understand market rate for this role in your location',
          'Prepare 3 reasons why you\'re interested in this specific role',
          'Document questions about the role, team, and company',
          'Review your resume and be ready to discuss any point in depth',
        ],
      ],
      junior: [
        [
          'Prepare brief introduction covering education and relevant experience',
          'Research company thoroughly: products, culture, values, mission',
          'Understand entry-level compensation ranges in your area',
          'Prepare your "why this role/company" answer with specific reasons',
          'Document questions about training, mentorship, and growth',
          'Review job posting and prepare relevant examples from your background',
        ],
      ],
    },
    phone_screen: {
      senior: [
        [
          'Map top 3 achievements to specific metrics and business outcomes',
          'Research interviewer on LinkedIn and identify connection points',
          'Prepare compelling "why this company" answer with specific reasons',
          'Draft 3 STAR stories covering: leadership, impact, problem-solving',
          'Test your phone/video setup in a quiet environment',
          'Prepare 3-4 insightful questions about team challenges',
        ],
      ],
      mid: [
        [
          'Review resume and prepare to discuss each role in detail',
          'Research interviewer and company recent developments',
          'Prepare your career story and motivation for this transition',
          'Draft 3 STAR stories covering different skills/situations',
          'Test technology setup and find a quiet location',
          'Prepare 3-4 thoughtful questions about the role and team',
        ],
      ],
      junior: [
        [
          'Review resume and prepare to explain all experiences clearly',
          'Research company and interviewer on LinkedIn',
          'Prepare "tell me about yourself" in 60 seconds max',
          'Draft examples from school, projects, or internships',
          'Test technology setup and find quiet location',
          'Prepare questions about the role and development opportunities',
        ],
      ],
    },
    behavioural: {
      senior: [
        [
          'Prepare 5+ STAR stories with quantified business impact',
          'Document examples of influencing without direct authority',
          'Prepare "disagreement with leadership" story with resolution',
          'Review examples of developing and mentoring team members',
          'Prepare to discuss handling ambiguity and prioritization',
          'Document cross-functional initiative examples',
        ],
      ],
      mid: [
        [
          'Prepare STAR stories: achievement, challenge, teamwork, failure, initiative',
          'Quantify achievements: percentages, dollars, time saved, users impacted',
          'Prepare to discuss strengths and areas for development',
          'Document examples of receiving and acting on feedback',
          'Prepare "conflict resolution" story with positive outcome',
          'Review how your values align with company culture',
        ],
      ],
      junior: [
        [
          'Prepare STAR stories from school, internships, or activities',
          'Focus on learning agility and growth mindset examples',
          'Prepare to discuss why you\'re passionate about this field',
          'Document teamwork examples: your role and contributions',
          'Prepare "challenge overcome" story with learnings',
          'Prepare questions about culture and development programs',
        ],
      ],
    },
    hiring_manager: {
      senior: [
        [
          'Research manager\'s background and team structure',
          'Prepare 30-60-90 day plan with specific milestones',
          'Document approach to building relationships with the team',
          'Prepare questions about success metrics and challenges',
          'Review team\'s recent projects and priorities',
          'Prepare to discuss management and collaboration style',
        ],
      ],
      mid: [
        [
          'Research hiring manager\'s background on LinkedIn',
          'Prepare to discuss how you\'d ramp up in the role',
          'Document questions about team dynamics and priorities',
          'Prepare to discuss working style and preferences',
          'Review what success looks like in first 6 months',
          'Prepare to discuss career goals and growth interests',
        ],
      ],
      junior: [
        [
          'Research hiring manager and understand their role',
          'Prepare to discuss what mentorship you\'re seeking',
          'Document questions about training and development',
          'Prepare to discuss working style and learning approach',
          'Review what entry-level role looks like day-to-day',
          'Prepare to discuss career interests and goals',
        ],
      ],
    },
    final_round: {
      senior: [
        [
          'Review all previous interview feedback and address concerns',
          'Research senior leadership and company strategic direction',
          'Prepare high-level vision for role\'s impact',
          'Document questions about growth trajectory and success metrics',
          'Review compensation benchmarks and prepare for discussion',
          'Prepare closing statement: why you, why now, why this company',
        ],
      ],
      mid: [
        [
          'Reflect on previous interviews and common themes/feedback',
          'Research any new interviewers you\'ll meet',
          'Prepare to reinforce strengths and address any concerns',
          'Document questions about team direction and your growth',
          'Prepare to discuss compensation expectations',
          'Prepare closing: enthusiasm, fit, and clear next steps',
        ],
      ],
      junior: [
        [
          'Review notes from all previous interviews',
          'Research any new interviewers on LinkedIn',
          'Prepare to demonstrate continued enthusiasm and fit',
          'Document remaining questions about the role',
          'Understand entry-level compensation and benefits',
          'Prepare to express excitement and commitment',
        ],
      ],
    },
    offer: {
      senior: [
        [
          'Research total comp on Levels.fyi for similar roles and levels',
          'List negotiation priorities: base, equity, sign-on, start date',
          'Understand equity details: grant type, vesting, refresh policy',
          'Prepare data points to justify counter-offer',
          'Calculate total compensation including benefits value',
          'Know your walk-away number and decision timeline',
        ],
      ],
      mid: [
        [
          'Research market rates for role and experience level',
          'Understand all compensation components: base, bonus, equity',
          'Prepare questions about benefits: health, 401k match, PTO',
          'Document your priorities: what matters most to you',
          'Prepare professional counter-offer approach',
          'Understand timeline and next steps',
        ],
      ],
      junior: [
        [
          'Research entry-level compensation for role and location',
          'Understand offer components: salary, benefits, start date',
          'Prepare questions about benefits and development programs',
          'Know that it\'s okay to ask for time to consider',
          'Understand signing bonus and relocation if applicable',
          'Prepare to accept or negotiate professionally',
        ],
      ],
    },
  },
};

// ============================================================================
// TOPIC GENERATION - Pure Functions, Deterministic Fallback
// ============================================================================

const getTopicsForProfile = (
  role: RoleType,
  stage: string,
  seniority: Seniority,
  setIndex: number = 0
): string[] => {
  const stageLower = stage.toLowerCase();
  
  // Try role-specific topics first
  const roleSets = TOPICS[role]?.[stageLower]?.[seniority];
  if (roleSets && roleSets.length > 0) {
    const idx = setIndex % roleSets.length;
    return roleSets[idx];
  }
  
  // Fall back to general topics
  const generalSets = TOPICS.general?.[stageLower]?.[seniority];
  if (generalSets && generalSets.length > 0) {
    const idx = setIndex % generalSets.length;
    return generalSets[idx];
  }
  
  // Ultimate fallback
  return TOPICS.general?.phone_screen?.mid?.[0] || [];
};

const generateTopicsFromDB = (
  stage: string,
  position: string,
  company: string,
  refreshCount: number = 0
): FocusArea[] => {
  const seniority = detectSeniority(position);
  const role = detectRole(position);
  
  let topics = getTopicsForProfile(role, stage, seniority, refreshCount);
  
  // Add company-specific topic if company provided
  if (company && company.trim() && topics.length > 0) {
    const companyTopic = `Research ${company}: recent news, products, engineering blog, Glassdoor reviews`;
    topics = [companyTopic, ...topics.slice(0, 5)];
  }
  
  return topics.slice(0, 6).map((text, i) => ({
    id: `db_${refreshCount}_${i}_${Date.now()}`,
    text,
  }));
};

// ============================================================================
// LLM GENERATION - No Logging of User Data
// ============================================================================

const generateTopicsFromLLM = async (
  stage: string,
  position: string,
  company: string,
  isRefresh: boolean
): Promise<FocusArea[] | null> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  
  const stageDisplay = STAGE_NAMES[stage.toLowerCase()] || stage;
  const seniority = detectSeniority(position);
  const role = detectRole(position);

  const prompt = `Generate 6 specific interview preparation topics.

Role: ${position}
Stage: ${stageDisplay}
Level: ${seniority}
${company ? `Company: ${company}` : ''}

Requirements:
- Specific to ${seniority} ${role} interviewing for ${stageDisplay}
- Each topic is actionable, completable in 30min-2hrs
- Include specific techniques, tools, or resources
- NOT generic advice like "research the company"
${isRefresh ? `- Generate DIFFERENT topics than typical advice. Timestamp: ${Date.now()}` : ''}

Return ONLY a JSON array of 6 strings, no markdown.`;

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
          { role: 'system', content: 'Return only valid JSON arrays. No markdown.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 700,
        temperature: isRefresh ? 1.0 : 0.8,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    
    const match = content.match(/\[[\s\S]*?\]/);
    if (!match) return null;
    
    const topics: string[] = JSON.parse(match[0]);
    if (!Array.isArray(topics) || topics.length < 4) return null;
    
    return topics.slice(0, 6).map((text, i) => ({
      id: `llm_${Date.now()}_${i}`,
      text: String(text),
    }));
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
};

// ============================================================================
// MAIN COMPONENT - Stateless, Client-Side Only
// ============================================================================

const InterviewChecklist: React.FC<InterviewChecklistProps> = ({
  visible,
  onClose,
  stage,
  company,
  position,
  daysUntil,
  colors,
}) => {
  const [topics, setTopics] = useState<FocusArea[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAI, setIsAI] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const mountedRef = useRef(true);
  
  // Derived state - no side effects
  const seniority = useMemo(() => detectSeniority(position), [position]);
  const roleType = useMemo(() => detectRole(position), [position]);
  const stageDisplay = useMemo(() => 
    STAGE_NAMES[stage.toLowerCase()] || stage.replace(/_/g, ' '), [stage]);
  
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  
  // Load topics when modal opens - instant fallback, background AI upgrade
  useEffect(() => {
    if (!visible || !stage) return;
    
    const cacheKey = `${stage}_${position}`.toLowerCase();
    const cached = sessionCache.get(cacheKey);
    
    // Check session cache first
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setTopics(cached.topics);
      setIsAI(true);
      return;
    }
    
    // INSTANT: Show fallback immediately (<100ms)
    const fallback = generateTopicsFromDB(stage, position, company, 0);
    setTopics(fallback);
    setIsAI(false);
    setLoading(true);
    
    // BACKGROUND: Try to upgrade with AI
    generateTopicsFromLLM(stage, position, company, false).then(llmTopics => {
      if (mountedRef.current && llmTopics) {
        setTopics(llmTopics);
        setIsAI(true);
        sessionCache.set(cacheKey, { topics: llmTopics, timestamp: Date.now() });
      }
      if (mountedRef.current) setLoading(false);
    });
  }, [visible, stage, position, company]);
  
  // Refresh handler - always generates NEW topics
  const handleRefresh = async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    const newCount = refreshCount + 1;
    setRefreshCount(newCount);
    
    // Clear cache for this combination
    const cacheKey = `${stage}_${position}`.toLowerCase();
    sessionCache.delete(cacheKey);
    
    // Show next fallback set immediately
    const fallback = generateTopicsFromDB(stage, position, company, newCount);
    setTopics(fallback);
    setIsAI(false);
    
    // Try AI in background
    const llmTopics = await generateTopicsFromLLM(stage, position, company, true);
    
    if (mountedRef.current) {
      if (llmTopics) {
        setTopics(llmTopics);
        setIsAI(true);
      }
      setRefreshing(false);
    }
  };
  
  const urgency = useMemo(() => {
    if (typeof daysUntil !== 'number' || isNaN(daysUntil) || daysUntil < 0) return null;
    if (daysUntil === 0) return { text: 'TODAY', color: '#EF4444' };
    if (daysUntil === 1) return { text: 'TOMORROW', color: '#F59E0B' };
    return { text: `In ${daysUntil} days`, color: colors.primary };
  }, [daysUntil, colors.primary]);
  
  if (!visible) return null;
  
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={[styles.title, { color: colors.text }]}>Preparation Focus</Text>
              <Text style={[styles.stage, { color: colors.primary }]}>{stageDisplay}</Text>
              {position && (
                <Text style={[styles.position, { color: colors.textSecondary }]} numberOfLines={1}>
                  {position}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          {/* Context badges */}
          <View style={[styles.badges, { borderBottomColor: colors.border }]}>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: colors.primary + '18' }]}>
                <Text style={[styles.badgeText, { color: colors.primary }]}>
                  {seniority.charAt(0).toUpperCase() + seniority.slice(1)} Level
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: colors.textSecondary + '18' }]}>
                <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                  {roleType.toUpperCase()}
                </Text>
              </View>
            </View>
            {urgency && (
              <View style={[styles.urgency, { backgroundColor: urgency.color + '20' }]}>
                <Text style={[styles.urgencyText, { color: urgency.color }]}>{urgency.text}</Text>
              </View>
            )}
          </View>
          
          {/* Topics */}
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {topics.map((topic, i) => (
              <View key={topic.id} style={[styles.item, { backgroundColor: colors.background }]}>
                <View style={[styles.num, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.numText, { color: colors.primary }]}>{i + 1}</Text>
                </View>
                <Text style={[styles.itemText, { color: colors.text }]}>{topic.text}</Text>
              </View>
            ))}
          </ScrollView>
          
          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.refreshBtn, { borderColor: colors.border }]}
              onPress={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="refresh" size={18} color={colors.primary} />
                  <Text style={[styles.refreshText, { color: colors.primary }]}>New Topics</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.doneBtn, { backgroundColor: colors.primary }]} onPress={onClose}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
          
          {/* Source indicator */}
          <View style={styles.source}>
            <Ionicons name={isAI ? 'sparkles' : 'cube-outline'} size={11} color={colors.textSecondary} />
            <Text style={[styles.sourceText, { color: colors.textSecondary }]}>
              {isAI ? 'AI-personalized' : 'Role-specific tips'}
              {loading && !isAI ? ' • Enhancing...' : ''}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  card: {
    width: '92%',
    maxWidth: 400,
    maxHeight: '85%',
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, paddingBottom: 10 },
  headerContent: { flex: 1, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  stage: { fontSize: 14, fontWeight: '600' },
  position: { fontSize: 13, marginTop: 2 },
  badges: { paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
  badgeRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  urgency: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  urgencyText: { fontSize: 11, fontWeight: '700' },
  list: { padding: 14 },
  item: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, borderRadius: 10, marginBottom: 8 },
  num: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  numText: { fontSize: 12, fontWeight: '700' },
  itemText: { flex: 1, fontSize: 14, lineHeight: 20 },
  footer: { flexDirection: 'row', padding: 14, borderTopWidth: 1, gap: 10 },
  refreshBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 10, borderWidth: 1, gap: 6 },
  refreshText: { fontSize: 14, fontWeight: '600' },
  doneBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 10 },
  doneText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  source: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingBottom: 10, gap: 4 },
  sourceText: { fontSize: 11 },
});

export default InterviewChecklist;
