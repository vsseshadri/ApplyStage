import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ============================================================================
// TYPES
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
// CONFIG - Privacy First
// ============================================================================

const EMERGENT_LLM_KEY = 'sk-emergent-66a2f7f8f020eDaA7B';
const LLM_API_URL = 'https://api.openai.com/v1/chat/completions';
const LLM_TIMEOUT_MS = 10000;

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
// ROLE DETECTION
// ============================================================================

type Seniority = 'executive' | 'senior' | 'mid' | 'junior';
type RoleType = 'swe' | 'data' | 'pm' | 'tpm' | 'design' | 'clinical' | 'aerospace' | 'finance' | 'consulting' | 'general';

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
  return 'general';
};

// ============================================================================
// TOPIC POOLS - Large pools for each role/stage/seniority combination
// Refresh picks 6 different topics from the pool each time
// ============================================================================

interface TopicPool {
  [role: string]: {
    [stage: string]: {
      [seniority: string]: string[];
    };
  };
}

// Each pool has 12-18 topics so refresh can pick different sets
const TOPIC_POOLS: TopicPool = {
  swe: {
    system_design: {
      executive: [
        'Prepare to lead architecture discussions for systems handling 10M+ daily active users',
        'Review CAP theorem decisions you\'ve made: when you chose consistency vs availability and why',
        'Document examples of cross-team API governance and breaking change management',
        'Prepare to discuss build vs buy decisions for infrastructure: costs, risks, timeline trade-offs',
        'Review multi-region deployment strategies and disaster recovery plans you\'ve implemented',
        'Prepare examples of defining SLOs/SLAs and driving reliability improvements (99.9% → 99.99%)',
        'Document technical debt prioritization frameworks you\'ve used with ROI analysis',
        'Review cost optimization initiatives: how you reduced infrastructure spend by X%',
        'Prepare to discuss observability architecture at scale: metrics, logs, traces, alerting',
        'Document experience with zero-downtime migrations and rollback strategies',
        'Prepare examples of performance optimization at system level (P99 latency improvements)',
        'Review your approach to capacity planning and resource forecasting',
      ],
      senior: [
        'Practice designing for 100K+ concurrent users: load balancing (round-robin, least connections, consistent hashing)',
        'Review database sharding strategies: hash-based vs range-based with specific trade-offs',
        'Prepare to implement API rate limiting: token bucket algorithm implementation with Redis',
        'Study caching patterns in depth: cache-aside, write-through, write-behind, cache invalidation strategies',
        'Practice capacity estimation: calculate QPS, storage growth, bandwidth for given user scenarios',
        'Review message queue patterns: at-least-once vs exactly-once delivery, dead letter queues',
        'Prepare microservices patterns: circuit breakers, bulkheads, retry with exponential backoff',
        'Study database replication: leader-follower setup, failover, read replicas, conflict resolution',
        'Review CDN architecture: edge caching, cache invalidation, origin shielding',
        'Prepare to design notification systems: fanout strategies, priority queues, rate limiting',
        'Study consistency models: eventual consistency, read-your-writes, strong consistency trade-offs',
        'Review event-driven architecture: event sourcing, CQRS, saga patterns',
        'Prepare to discuss database indexing strategies: B-trees, hash indexes, composite indexes',
        'Study API design: REST best practices, versioning strategies, pagination patterns',
      ],
      mid: [
        'Study system components: what load balancers do, L4 vs L7 differences, health checks',
        'Practice designing a URL shortener: read/write ratio optimization, analytics, expiration',
        'Review SQL vs NoSQL decision making: when to use PostgreSQL vs MongoDB vs Cassandra',
        'Understand caching fundamentals: what Redis does, TTL strategies, cache hit ratio optimization',
        'Practice drawing clear system diagrams with data flow and failure points',
        'Learn to ask clarifying questions: expected QPS, read/write ratio, latency requirements, consistency needs',
        'Study basic scaling: horizontal vs vertical, when to use each, cost implications',
        'Review authentication patterns: JWT structure, session management, OAuth2 flows',
        'Practice designing a simple chat application architecture',
        'Study database indexing basics: primary keys, secondary indexes, query optimization',
        'Review API design fundamentals: RESTful principles, status codes, error handling',
        'Understand basic security: HTTPS, input validation, SQL injection prevention',
      ],
      junior: [
        'Learn the web request lifecycle: DNS resolution → TCP connection → HTTP request → response',
        'Understand why databases exist and basic SQL vs NoSQL differences',
        'Study what a load balancer does: distributing traffic, health checks, failover',
        'Learn about caching: why we cache data, what Redis is, basic cache concepts',
        'Practice explaining simple 3-tier architecture: client → server → database',
        'Prepare questions about the company\'s current tech stack and architecture decisions',
        'Review client-server model: request/response, stateless vs stateful',
        'Understand HTTP basics: methods (GET, POST, PUT, DELETE), status codes, headers',
        'Learn about APIs: what they are, REST basics, how frontend talks to backend',
        'Study basic database concepts: tables, relationships, primary keys, queries',
      ],
    },
    coding_round_1: {
      senior: [
        'Master sliding window pattern: minimum window substring, longest substring without repeating chars',
        'Practice two-pointer technique: 3Sum, container with most water, trapping rain water',
        'Review binary search variations: search in rotated array, find peak element, search range',
        'Study tree traversals with modifications: BFS level order, DFS paths, lowest common ancestor',
        'Practice graph algorithms: detect cycle (DFS), topological sort, shortest path (BFS)',
        'Review dynamic programming patterns: coin change, longest increasing subsequence, edit distance',
        'Master hashmap patterns: two sum, group anagrams, LRU cache implementation',
        'Practice string manipulation: palindrome variations, string matching, regex basics',
        'Study heap problems: merge k sorted lists, top k frequent elements, median finder',
        'Review interval problems: merge intervals, insert interval, meeting rooms',
        'Practice linked list algorithms: reverse in groups, detect and find cycle start, merge sorted',
        'Study backtracking patterns: permutations, combinations, subsets, N-queens',
        'Review monotonic stack problems: next greater element, largest rectangle in histogram',
        'Practice prefix sum and difference array techniques',
      ],
      mid: [
        'Practice array problems: two sum variations, best time to buy/sell stock, maximum subarray (Kadane)',
        'Master hashmap for O(1) lookups: frequency counting, finding duplicates, anagram detection',
        'Study two-pointer basics: valid palindrome, remove duplicates, reverse string in-place',
        'Practice string problems: reverse words, valid anagram, longest common prefix',
        'Review sorting: when to use built-in sort, understanding O(n log n), stable vs unstable',
        'Study recursion fundamentals: base cases, recursive calls, call stack visualization',
        'Practice linked list basics: reverse, find middle node, detect cycle with Floyd\'s',
        'Review stack problems: valid parentheses, evaluate reverse polish notation, daily temperatures',
        'Study binary search: basic implementation, search insert position, first/last occurrence',
        'Practice matrix traversal: rotate image, spiral order, search in 2D matrix',
        'Review basic math: reverse integer, palindrome number, count primes (Sieve)',
        'Study bit manipulation basics: single number (XOR), counting bits, power of two',
      ],
      junior: [
        'Review array fundamentals: iteration, indexing, slice, common methods in your language',
        'Practice basic string operations: reverse string, check if palindrome, count characters',
        'Learn hashmap basics: creating maps, adding/getting values, checking existence',
        'Practice simple problems: find maximum/minimum, count occurrences, remove element',
        'Review loop patterns: for loops, while loops, nested loops, break/continue',
        'Study Big-O basics: O(1) constant, O(n) linear, O(n²) quadratic with examples',
        'Practice tracing code execution step-by-step before running',
        'Review function basics: parameters, return values, variable scope',
        'Study conditional logic: if/else chains, switch statements, ternary operators',
        'Practice simple array sorting: understand what sorting does, use built-in sort',
      ],
    },
    behavioural: {
      executive: [
        'Prepare story about building engineering culture: hiring practices, values, team rituals',
        'Document a major technical transformation: from monolith to microservices, cloud migration',
        'Review examples of navigating conflicting priorities with C-suite peers',
        'Prepare to discuss a technical bet that failed and how you communicated/recovered',
        'Document how you developed engineering leaders (IC to manager transitions)',
        'Prepare examples of representing engineering to board/investors with business metrics',
        'Review how you built diverse, inclusive engineering teams',
        'Document experience with organizational restructuring and managing through change',
        'Prepare to discuss your engineering vision and how you communicated it org-wide',
        'Review examples of driving innovation while maintaining operational excellence',
      ],
      senior: [
        'Map your biggest project to STAR format with quantified impact (latency reduced 40%, costs down 30%)',
        'Prepare story about mentoring an engineer from junior to senior: specific actions and outcomes',
        'Document time you pushed back on product requirements with data and alternative solutions',
        'Review production incident you handled: detection, response, communication, post-mortem improvements',
        'Prepare "technical disagreement with peer" story: conflict, your approach, resolution, relationship after',
        'Document balancing tech debt vs features: how you made the case, what you prioritized, results',
        'Prepare story about delivering project with unclear/changing requirements',
        'Review process improvements you drove: code review, testing, CI/CD, deployment',
        'Document a time you made a decision with incomplete information and how it turned out',
        'Prepare cross-functional collaboration story: working with PM, design, other teams',
        'Review a failure/mistake: what happened, your responsibility, specific changes made after',
        'Document your approach to receiving and giving difficult feedback',
      ],
      mid: [
        'Prepare 5 STAR stories: biggest impact, teamwork challenge, learning from failure, initiative, conflict',
        'Quantify all achievements: "improved API latency by 40%", "reduced errors by 60%", "saved 10 eng hours/week"',
        'Document going above your job description: what you noticed, action you took, outcome',
        'Prepare "learned from failure" story: the mistake, your responsibility, specific changes you made',
        'Review working with difficult stakeholders: the situation, your approach, how you built the relationship',
        'Prepare to discuss career goals and why this specific role/company advances them',
        'Document receiving critical feedback: what it was, your initial reaction, how you acted on it',
        'Prepare story about working under pressure: tight deadline, what you did, result',
        'Review examples of proactive problem-solving: issue you identified before it was assigned',
        'Document helping a teammate: what they needed, how you supported them, outcome',
      ],
      junior: [
        'Prepare STAR stories from school projects, internships, hackathons, or personal projects',
        'Highlight learning agility: specific example of picking up new technology/concept quickly',
        'Document a challenging class project: the difficulty, your approach, what you delivered',
        'Prepare to explain your interest in this company and role with specific reasons',
        'Review teamwork examples: group projects, your specific contributions, outcomes',
        'Prepare questions about mentorship, learning opportunities, and career growth paths',
        'Document a time you had to learn something new under time pressure',
        'Prepare story about receiving feedback and how you improved',
        'Review examples of taking initiative outside of assigned work',
        'Document how you handle stress and competing priorities',
      ],
    },
    technical_screen: {
      senior: [
        'Review your most complex technical project: be ready for 20+ minutes of deep questions',
        'Prepare to discuss architecture decisions: what alternatives you considered, why you chose your approach',
        'Review advanced language features in your primary language (generics, concurrency, memory management)',
        'Prepare to whiteboard solutions while explaining your reasoning aloud',
        'Study system design elements that may come up: caching, queuing, database choices',
        'Review testing strategies: unit test design, mocking, integration tests, test coverage philosophy',
        'Prepare to discuss debugging complex issues: tools you use, your systematic approach',
        'Review code quality practices: clean code principles, refactoring experience, technical debt',
        'Prepare examples of performance optimization: profiling, bottleneck identification, solutions',
        'Study your primary framework/stack in depth: internals, best practices, common pitfalls',
      ],
      mid: [
        'Review core data structures: arrays, hashmaps, trees, graphs - when to use each',
        'Prepare 3-5 minute technical explanation of your main projects',
        'Practice solving simple coding problems while explaining your thought process',
        'Review OOP concepts: SOLID principles, design patterns you\'ve used',
        'Study your language\'s standard library: collections, string methods, I/O',
        'Prepare technical questions about the company\'s stack (research beforehand)',
        'Review debugging techniques: reading stack traces, using debuggers, logging strategies',
        'Prepare to discuss your development workflow: git, IDE, testing approach',
        'Study basic SQL: JOINs, aggregations, subqueries, index usage',
        'Review API design basics: REST principles, error handling, authentication',
      ],
      junior: [
        'Review CS fundamentals: basic data structures, simple algorithms, Big-O',
        'Prepare to discuss your coursework: favorite classes, challenging projects',
        'Practice explaining technical concepts simply without jargon',
        'Review basic SQL: SELECT, WHERE, JOIN, GROUP BY',
        'Study git basics: commit, branch, merge, pull request workflow',
        'Prepare to demonstrate your debugging approach: how you find and fix issues',
        'Review your programming language syntax: loops, functions, classes',
        'Prepare to discuss personal projects: what you built, technologies used, challenges',
        'Study basic web concepts: HTTP, APIs, client-server model',
        'Prepare questions about the tech stack and what you\'d be working on',
      ],
    },
  },
  tpm: {
    system_design: {
      executive: [
        'Prepare to discuss program architecture across portfolio of 50+ engineers',
        'Document aligning multi-year technical roadmaps with business strategy',
        'Review managing technical programs with $10M+ budgets: tracking, reporting, decisions',
        'Prepare to discuss vendor evaluation and management for critical systems',
        'Document scaling TPM organization: hiring, processes, templates, tools',
        'Prepare examples of executive communication on technical program status and risks',
        'Review build vs buy analysis you\'ve led and recommendation process',
        'Document experience with technical due diligence for acquisitions',
        'Prepare to discuss governance models for large technical programs',
        'Review change management for organization-wide technical initiatives',
      ],
      senior: [
        'Prepare to discuss managing cross-team dependencies in complex technical programs',
        'Document creating technical project plans with engineering-informed estimates',
        'Review technical risk identification: what signals you look for, how you mitigate',
        'Prepare examples of translating vague business requirements to technical specs',
        'Document managing scope changes: evaluation process, stakeholder communication, trade-offs',
        'Prepare to discuss technical trade-offs: scope vs timeline vs quality vs resources',
        'Review experience coordinating API changes across multiple consuming teams',
        'Document migration project experience: planning, rollback strategies, validation',
        'Prepare to discuss working with architecture teams on technical direction',
        'Review managing technical debt conversations with engineering leadership',
        'Document your approach to technical documentation and knowledge management',
        'Prepare examples of unblocking technical teams: removing obstacles, escalation',
      ],
      mid: [
        'Review creating dependency-aware project timelines with engineering input',
        'Study common technical risks in software projects: integration, performance, security',
        'Prepare to discuss Agile methodology: sprints, ceremonies, metrics, scaling',
        'Document tracking technical deliverables: what you track, how you report status',
        'Review communicating technical status to non-technical executives',
        'Prepare questions about the technical landscape you\'d be managing',
        'Study basic system integration concepts: APIs, data formats, protocols',
        'Document your experience with release management and deployment coordination',
        'Prepare to discuss how you learn about technical domains you\'re not expert in',
        'Review handling technical disagreements between engineering teams',
      ],
      junior: [
        'Review software development lifecycle: planning → development → testing → deployment',
        'Study Jira workflows: epics, stories, sprints, boards, reports',
        'Understand technical dependencies and how to visualize/track them',
        'Learn about APIs and system integrations at conceptual level',
        'Prepare to discuss how you\'d learn the technical landscape quickly',
        'Review Agile ceremonies: standup, planning, review, retrospective purposes',
        'Study basic project management: scope, timeline, resources, risks',
        'Prepare questions about TPM role in this organization',
        'Review technical documentation basics: what makes docs useful',
        'Understand engineering team structures: how different roles collaborate',
      ],
    },
    behavioural: {
      executive: [
        'Prepare stories about managing multi-million dollar, multi-year technical programs',
        'Document influencing executive decisions without direct authority',
        'Review navigating organizational change during major program transformations',
        'Prepare to discuss conflict resolution between VP-level engineering leaders',
        'Document program turnarounds: identifying issues, intervention, outcomes',
        'Prepare examples of building and developing TPM teams',
        'Review stakeholder management at executive level: competing priorities, politics',
        'Document driving accountability across engineering organizations',
        'Prepare to discuss your leadership philosophy for TPM function',
        'Review experience with program-level budget management and resource allocation',
      ],
      senior: [
        'Prepare STAR stories about managing complex, ambiguous technical programs',
        'Document driving accountability across multiple engineering teams',
        'Review handling program that went off track: detection, intervention, recovery',
        'Prepare story about resolving conflict between engineering teams or leads',
        'Document stakeholder management with competing priorities and urgent requests',
        'Prepare examples of escalation decisions: when you escalated, how, outcome',
        'Review building trust with skeptical engineering leads',
        'Document managing programs with frequently changing requirements',
        'Prepare to discuss risk communication: how you present bad news to leadership',
        'Review meeting facilitation: running effective meetings, driving decisions',
        'Document handling underperforming vendors or partner teams',
        'Prepare examples of process improvements you\'ve implemented',
      ],
      mid: [
        'Prepare stories demonstrating stakeholder management across technical and business teams',
        'Document keeping projects on track despite unexpected technical obstacles',
        'Review prioritizing when multiple stakeholders claim urgent priority',
        'Prepare story about managing difficult stakeholder relationship over time',
        'Document running effective meetings: preparation, facilitation, follow-up',
        'Prepare examples of communicating bad news effectively and early',
        'Review handling ambiguity: how you operate when requirements are unclear',
        'Document coordination examples: aligning multiple teams toward deadline',
        'Prepare to discuss your approach to status reporting and transparency',
        'Review conflict resolution between team members or teams',
      ],
      junior: [
        'Prepare coordination stories from school, clubs, volunteer work, or internships',
        'Document organizing group projects or events: planning, execution, outcomes',
        'Review handling multiple deadlines and competing priorities',
        'Prepare to discuss your organizational and communication strengths with examples',
        'Document any leadership experience and specific lessons learned',
        'Prepare questions about how TPMs work with engineering at this company',
        'Review examples of proactive problem identification',
        'Document working with people with different working styles',
        'Prepare to discuss what draws you to program management vs other roles',
        'Review examples of attention to detail catching important issues',
      ],
    },
    hiring_manager: {
      senior: [
        'Research hiring manager\'s current programs and organizational challenges',
        'Prepare 30-60-90 day plan: learning the landscape, quick wins, longer-term impact',
        'Document your approach to building relationships with engineering leads quickly',
        'Prepare questions about current program challenges and what success looks like',
        'Review organizational structure and key stakeholders you\'d work with',
        'Prepare to discuss your program management philosophy and methodology',
        'Document how you\'ve handled similar organizational contexts before',
        'Prepare questions about team culture and how decisions are made',
        'Review the manager\'s background to find connection points',
        'Prepare to discuss what you need from a manager to be successful',
      ],
      mid: [
        'Research manager\'s background and current portfolio of programs',
        'Prepare to discuss your project management methodology and tools',
        'Document handling challenging stakeholder situations with specific examples',
        'Prepare questions about team structure, expectations, and success metrics',
        'Review what tools and processes the team currently uses',
        'Prepare to discuss your communication style and preferences',
        'Document how you ramp up on new technical domains',
        'Prepare questions about growth opportunities and career paths',
        'Review recent company news that might affect the team\'s programs',
        'Prepare to discuss what you\'re looking for in your next role',
      ],
    },
  },
  clinical: {
    clinical: {
      executive: [
        'Prepare examples of improving clinical outcomes at department level with metrics (mortality, readmissions)',
        'Document quality improvement initiatives: PDSA cycles, root cause analysis, outcomes',
        'Review regulatory compliance leadership: Joint Commission, CMS, state survey preparation',
        'Prepare to discuss clinical staffing models: ratios, skill mix, float pool optimization',
        'Document implementing evidence-based practice changes across units or facilities',
        'Prepare examples of managing serious adverse events: investigation, disclosure, system changes',
        'Review budget management for clinical departments: FTEs, supplies, equipment',
        'Document interdisciplinary collaboration at leadership level',
        'Prepare to discuss your approach to clinical staff development and retention',
        'Review experience with clinical informatics and EHR optimization',
      ],
      senior: [
        'Prepare detailed patient scenarios in your specialty with clinical reasoning process',
        'Review protocols in your specialty and situations where clinical judgment overrides protocol',
        'Document clinical decision-making under time pressure: specific cases, your reasoning',
        'Practice SBAR format for critical handoffs: Situation, Background, Assessment, Recommendation',
        'Review medication management: high-alert meds, interactions, dosing in special populations',
        'Prepare to discuss precepting and mentoring new clinicians: your approach, examples',
        'Document complex case management: coordination, patient advocacy, outcomes',
        'Review delegation and supervision: what you delegate, how you ensure safety',
        'Prepare examples of patient/family teaching in challenging situations',
        'Document conflict resolution with physicians, patients, or family members',
        'Review your approach to staying current: journals, conferences, certifications',
        'Prepare to discuss ethical dilemmas you\'ve navigated and your reasoning',
      ],
      mid: [
        'Review clinical assessment frameworks for your patient population systematically',
        'Prepare patient cases demonstrating clinical judgment: assessment, intervention, evaluation',
        'Document prioritizing care with multiple patients: how you decide, examples',
        'Review pharmacology: common medications in specialty, doses, interactions, monitoring',
        'Prepare to discuss documentation standards: what to document, EHR workflows',
        'Study infection control protocols: precautions, hand hygiene, outbreak management',
        'Document patient safety initiatives you\'ve participated in',
        'Prepare examples of patient education tailored to different learning needs',
        'Review interdisciplinary collaboration: how you work with physicians, therapy, social work',
        'Document a time you caught an error before it reached the patient',
      ],
      junior: [
        'Review core clinical competencies from your nursing/clinical program',
        'Prepare examples from clinical rotations demonstrating learning and growth',
        'Study common diagnoses and treatments in the specialty you\'re applying to',
        'Review patient safety fundamentals: fall prevention, medication safety, infection control',
        'Prepare to discuss how you handle stressful or emotional patient situations',
        'Document your clinical interests and professional development goals',
        'Review basic pharmacology: drug classes, common medications, safety checks',
        'Prepare questions about orientation, preceptorship, and support for new grads',
        'Study the hospital/facility: Magnet status, specialties, patient population',
        'Document your approach to asking for help and seeking guidance',
      ],
    },
    behavioural: {
      senior: [
        'Prepare STAR stories about complex patient cases with positive outcomes due to your intervention',
        'Document advocating for patients or staff: situation, your actions, resolution',
        'Review handling ethical dilemmas: specific cases, your reasoning process, outcome',
        'Prepare story about teaching/mentoring clinical staff: approach, challenges, results',
        'Document your commitment to continuous learning: certifications, education, skills',
        'Prepare examples of interprofessional collaboration improving patient outcomes',
        'Review handling a clinical error or near-miss: response, reporting, prevention',
        'Document managing difficult family dynamics while maintaining patient advocacy',
        'Prepare to discuss burnout prevention: self-care strategies, when you\'ve struggled',
        'Review leadership examples: charge nurse, committee work, process improvement',
      ],
      mid: [
        'Prepare stories demonstrating patient advocacy in challenging situations',
        'Document handling difficult patient or family member interactions',
        'Review stress management: how you cope with emotional demands of clinical work',
        'Prepare to discuss continuing education and specialty certifications',
        'Document team collaboration: how you work with different personalities and disciplines',
        'Prepare story about learning from clinical error or near-miss experience',
        'Review time management with competing patient needs',
        'Document communication with physicians: SBAR, receiving orders, clarifying concerns',
        'Prepare examples of going above and beyond for patients',
        'Review handling disagreements with colleagues professionally',
      ],
    },
  },
  data: {
    technical_screen: {
      senior: [
        'Review ML algorithms in depth: gradient boosting (XGBoost, LightGBM), neural network architectures',
        'Prepare to explain end-to-end ML project: problem framing, data, features, model, evaluation, deployment',
        'Practice SQL: window functions (LAG, LEAD, ROW_NUMBER), CTEs, query optimization',
        'Review A/B testing rigor: power analysis, multiple comparisons, guardrail metrics, sequential testing',
        'Document feature engineering strategies: encoding, scaling, feature selection methods',
        'Prepare to discuss ML monitoring: data drift, model drift, performance degradation detection',
        'Review deep learning: CNN architectures, RNN/LSTM, transformers, attention mechanisms',
        'Document debugging model performance: bias-variance diagnosis, error analysis',
        'Prepare to discuss statistics: hypothesis testing, confidence intervals, Bayesian methods',
        'Review ML in production: containerization, APIs, batch vs real-time inference',
        'Document experimentation platforms and feature stores experience',
        'Prepare examples of causal inference: propensity matching, diff-in-diff, instrumental variables',
      ],
      mid: [
        'Review supervised learning: linear/logistic regression, decision trees, random forests, SVMs',
        'Practice Python pandas efficiently: groupby, merge, apply, vectorized operations',
        'Prepare SQL exercises: complex aggregations, self-joins, correlated subqueries, window functions',
        'Review evaluation metrics: precision/recall trade-off, F1, AUC-ROC, when to use each',
        'Document data pipeline experience: ETL, data cleaning, handling missing values',
        'Practice explaining ML concepts to non-technical stakeholders simply',
        'Review statistics: distributions, hypothesis testing, p-values, confidence intervals',
        'Prepare to discuss data visualization: choosing chart types, telling stories with data',
        'Document your approach to exploratory data analysis',
        'Review feature engineering: one-hot encoding, scaling, handling categorical variables',
      ],
      junior: [
        'Review ML fundamentals: train/test split, overfitting, cross-validation, bias-variance tradeoff',
        'Practice Python basics: numpy arrays, pandas dataframes, basic matplotlib',
        'Study SQL fundamentals: SELECT, JOIN types, GROUP BY, HAVING, ORDER BY',
        'Understand statistics basics: mean, variance, standard deviation, correlation, distributions',
        'Prepare to discuss data science projects from coursework or Kaggle',
        'Review the company\'s data products and potential ML applications',
        'Study basic ML models: linear regression, logistic regression, decision trees',
        'Prepare to demonstrate data manipulation in Python',
        'Review data visualization basics: when to use bar, line, scatter plots',
        'Document your approach to learning new data science tools',
      ],
    },
    behavioural: {
      senior: [
        'Prepare STAR stories about ML/data projects with measurable business impact',
        'Document cross-functional collaboration: working with product, engineering, stakeholders',
        'Review communicating complex analysis to non-technical audiences effectively',
        'Prepare story about model that failed or underperformed in production: diagnosis, fix',
        'Document mentoring junior data scientists: your approach, their growth',
        'Prepare examples of prioritizing among multiple analysis requests',
        'Review data quality challenges: how you identified and resolved data issues',
        'Document influencing decisions with data when stakeholders had different views',
        'Prepare to discuss balancing perfectionism vs shipping: when good enough is enough',
        'Review examples of self-directed projects that added unexpected value',
      ],
      mid: [
        'Prepare stories about data projects with clear business impact and metrics',
        'Document handling ambiguous analysis requests: clarifying, scoping, delivering',
        'Review presenting insights to leadership: how you structured, what worked',
        'Prepare to discuss ensuring data quality and validating analysis',
        'Document working with engineers on data pipelines and infrastructure',
        'Prepare story about learning new tool or technique quickly for a project',
        'Review handling conflicting data or unexpected analysis results',
        'Document time management with multiple concurrent analysis requests',
        'Prepare examples of proactive analysis that surfaced important insights',
        'Review collaboration with product team on metrics and experimentation',
      ],
    },
  },
  finance: {
    technical_screen: {
      senior: [
        'Review advanced financial modeling: DCF with multiple scenarios, LBO mechanics, merger models',
        'Prepare to walk through a complex model you built: assumptions, drivers, sensitivity analysis',
        'Document experience with financial systems: ERP, Bloomberg Terminal, FactSet, Capital IQ',
        'Review Excel mastery: INDEX-MATCH-MATCH, OFFSET, array formulas, financial functions (XNPV, XIRR)',
        'Prepare to discuss your financial analysis process and how you develop recommendations',
        'Review current market conditions: interest rates, valuations, sector trends, macro factors',
        'Document experience with financial reporting: 10-K/10-Q analysis, earnings calls',
        'Prepare to discuss accounting concepts: revenue recognition, lease accounting, impairment',
        'Review experience with forecasting: revenue builds, expense modeling, scenario planning',
        'Document M&A experience: due diligence, valuation, synergy analysis, integration',
      ],
      mid: [
        'Review financial statement analysis: profitability ratios, liquidity, leverage, efficiency',
        'Practice Excel modeling: 3-statement model linkages, sensitivity tables, scenario toggles',
        'Prepare to discuss budgeting and forecasting experience: process, assumptions, accuracy',
        'Review GAAP principles relevant to your area: revenue recognition, accruals, fair value',
        'Document financial analyses you\'ve conducted and their business impact',
        'Prepare examples of presenting financial data to leadership or board',
        'Review Excel functions: SUMIFS, pivot tables, charts, conditional formatting for dashboards',
        'Document your approach to variance analysis: budget vs actual, month over month',
        'Prepare to discuss financial controls and audit experience',
        'Review industry-specific metrics relevant to the company',
      ],
      junior: [
        'Review core finance concepts: time value of money, NPV, IRR, WACC components',
        'Practice Excel: pivot tables, VLOOKUP/INDEX-MATCH, basic formulas, charts',
        'Understand financial statements: income statement, balance sheet, cash flow statement linkages',
        'Review basic accounting: debits/credits, journal entries, accrual vs cash basis',
        'Prepare to discuss finance coursework: favorite classes, interesting projects',
        'Research the company: financial statements, recent earnings, analyst coverage',
        'Review financial ratios: gross margin, EBITDA margin, ROE, debt/equity',
        'Prepare to discuss your interest in this specific finance area',
        'Study basic valuation concepts: multiples, DCF at high level',
        'Document Excel skills and modeling experience from coursework',
      ],
    },
    case_study: {
      senior: [
        'Practice investment recommendation cases: develop thesis, identify catalysts and risks',
        'Review valuation mastery: when to use DCF vs comps vs precedents, common pitfalls',
        'Prepare to walk through your analytical framework for evaluating investments',
        'Practice presenting recommendations: structure, supporting data, handling pushback',
        'Review industry deep dives in 2-3 sectors: drivers, trends, key metrics',
        'Prepare to discuss current market opportunities and your investment viewpoint',
        'Document complex transactions you\'ve analyzed or executed',
        'Prepare to discuss risk factors and how you assess them',
        'Review due diligence processes you\'ve led or participated in',
        'Practice defending your analysis against challenging questions',
      ],
      mid: [
        'Practice financial cases with 30-45 minute time limits',
        'Review valuation approaches: comparable company analysis, precedent transactions, DCF',
        'Prepare to structure financial analysis systematically: framework, gather data, analyze, recommend',
        'Practice quick calculations: margins, growth rates, multiples, returns',
        'Review presenting financial recommendations clearly: headline, support, risks, next steps',
        'Prepare questions about the role\'s analytical focus areas',
        'Document your approach to dealing with incomplete or conflicting data',
        'Practice interpreting financial statements under time pressure',
        'Review industry knowledge for the company\'s sector',
        'Prepare to discuss how you stay current on markets and financial news',
      ],
    },
  },
  consulting: {
    case_study: {
      senior: [
        'Master case frameworks: MECE issue trees, hypothesis-driven, so-what chains',
        'Practice diverse cases: market entry, profitability diagnosis, M&A synergies, pricing',
        'Prepare to lead case discussions: drive the conversation, push back on interviewer',
        'Review industry knowledge in 2-3 sectors: key players, trends, margin structures, value chains',
        'Practice synthesis under pressure: 30-second summary of key findings and recommendation',
        'Prepare examples of managing ambiguous client situations',
        'Document client impact stories with specific metrics and outcomes',
        'Practice market sizing with multiple approaches: top-down, bottom-up, triangulation',
        'Review operations cases: cost reduction, process optimization, supply chain',
        'Prepare growth strategy cases: organic vs inorganic, market expansion frameworks',
        'Practice financial analysis in case context: break-even, NPV, ROI calculations',
        'Document experience with quantitative analysis: Excel modeling, data analysis',
      ],
      mid: [
        'Practice case frameworks: 3C\'s, Porter\'s Five Forces, value chain, profit tree',
        'Master market sizing: explicit assumptions, top-down and bottom-up, reasonableness checks',
        'Practice mental math: percentages, compound growth, quick multiplication/division',
        'Prepare structured approaches: profitability cases, market entry frameworks',
        'Practice delivering recommendations: clear structure, logic chain, actionable',
        'Review 2-3 industries to demonstrate commercial awareness',
        'Document your approach to ambiguous problems: how you structure, what questions you ask',
        'Practice brainstorming business ideas creatively and structurally',
        'Review basic financial analysis: margins, growth rates, break-even',
        'Prepare examples of analytical work from previous experience',
      ],
      junior: [
        'Learn core frameworks: SWOT, 3C\'s, Porter\'s Five Forces, profit tree basics',
        'Practice market sizing: be explicit about every assumption, show your math',
        'Practice structuring problems: break into MECE components, prioritize',
        'Review mental math: get comfortable with quick calculations, percentages, rounding',
        'Practice presenting analysis: clear, confident, acknowledge uncertainties',
        'Prepare examples from coursework demonstrating structured, analytical thinking',
        'Document your interest in consulting: why this career, why this firm',
        'Practice brainstorming: generating creative ideas within a structure',
        'Review basic business concepts: revenue, costs, margins, market share',
        'Prepare thoughtful questions about the firm\'s culture and work',
      ],
    },
    behavioural: {
      senior: [
        'Prepare STAR stories about complex client engagements and measurable impact',
        'Document managing difficult client situations: conflicts, expectation mismatches',
        'Review developing client relationships: from project delivery to trusted advisor',
        'Prepare story about recovering a project that was going poorly',
        'Document developing and mentoring junior consultants',
        'Prepare examples of business development: proposals, pitches, relationship building',
        'Review handling ambiguity: client didn\'t know what they needed, how you figured it out',
        'Document working with challenging client stakeholders',
        'Prepare to discuss your expertise areas and how you developed them',
        'Review examples of going beyond the project scope to add value',
      ],
      mid: [
        'Prepare stories demonstrating analytical problem-solving with real examples',
        'Document working in high-pressure, fast-paced environments effectively',
        'Review handling ambiguity: unclear requirements, incomplete data',
        'Prepare story about receiving tough feedback and making concrete improvements',
        'Document teamwork on consulting projects: your role, collaboration, outcomes',
        'Prepare to discuss motivation for consulting: what attracts you, what you know about it',
        'Review examples of leadership in team settings',
        'Document learning quickly: new industry, new skill, new tool',
        'Prepare examples of attention to detail catching important issues',
        'Review client interaction experience if any',
      ],
    },
  },
  general: {
    recruiter_screening: {
      senior: [
        'Prepare 60-second career summary: progression, key achievements, why this opportunity',
        'Research company: recent news, products, culture, leadership, funding/financials',
        'Document salary expectations with market data from Levels.fyi, Glassdoor, Blind',
        'Prepare 3 quantified achievements that directly relate to this role',
        'Prepare questions about team size, structure, challenges, and growth trajectory',
        'Review job description and map your experience to each requirement',
        'Document your motivation for leaving current role and seeking this one',
        'Prepare to discuss timeline, other processes, and your decision factors',
        'Review company values and prepare examples of alignment',
        'Document questions about interview process and what to expect',
      ],
      mid: [
        'Prepare concise career overview: background, current role, why you\'re looking',
        'Research company culture, mission, products, and recent developments',
        'Understand market compensation: salary ranges for role and location',
        'Prepare 3 reasons why you\'re specifically interested in this role and company',
        'Document questions about day-to-day responsibilities and success metrics',
        'Review your resume: be ready to discuss any gap or transition',
        'Prepare your availability and timeline for interview process',
        'Document what you\'re looking for: role type, company size, culture',
        'Research the recruiter on LinkedIn if possible',
        'Prepare questions about benefits, WFH policy, team culture',
      ],
      junior: [
        'Prepare brief introduction: education, relevant experience, enthusiasm for role',
        'Research company thoroughly: products, mission, values, office locations',
        'Understand entry-level compensation in your area for this role type',
        'Prepare specific reasons for interest in this company (not generic)',
        'Document questions about training, mentorship, and growth paths',
        'Review job posting requirements and map to your background',
        'Prepare to explain any gaps or unusual transitions in your background',
        'Research what day-to-day work looks like in this role',
        'Document your career interests and why this is a good first step',
        'Prepare questions that show you\'ve researched the company',
      ],
    },
    phone_screen: {
      senior: [
        'Map your top 3 achievements to specific business outcomes with metrics',
        'Research interviewer on LinkedIn: background, tenure, common connections',
        'Prepare compelling "why this company" answer with company-specific research',
        'Draft 4 STAR stories covering: leadership, impact, problem-solving, collaboration',
        'Test phone/video setup in quiet environment with good lighting',
        'Prepare 3-4 insightful questions showing understanding of role challenges',
        'Document your "weakness" answer: genuine area of growth with mitigation',
        'Prepare to explain your career trajectory: decisions, transitions, growth',
        'Review company competitors and market position',
        'Prepare to discuss timeline and other opportunities professionally',
      ],
      mid: [
        'Review resume thoroughly: be ready to discuss each role and transition',
        'Research interviewer and company recent news or announcements',
        'Prepare career story: where you\'ve been, where you\'re going, why this role',
        'Draft 3-4 STAR stories covering different skills and situations',
        'Test technology setup: camera, microphone, internet, background',
        'Prepare thoughtful questions about the role, team, and expectations',
        'Document your motivation for the move: positive framing',
        'Prepare to discuss salary expectations if asked (know market rates)',
        'Review the job description and highlight relevant experience',
        'Prepare closing: reiterate interest, ask about next steps',
      ],
      junior: [
        'Review resume and prepare to discuss every item in depth',
        'Research company and interviewer on LinkedIn for context',
        'Prepare "tell me about yourself" in 60 seconds: education, experience, interest',
        'Draft examples from school, projects, internships using STAR structure',
        'Test technology and find quiet, well-lit location',
        'Prepare questions about the role, training, and growth opportunities',
        'Document why you\'re interested in this specific company and role',
        'Prepare to discuss relevant coursework, projects, or activities',
        'Review basic industry knowledge related to the role',
        'Prepare to express enthusiasm and ask about next steps',
      ],
    },
    behavioural: {
      senior: [
        'Prepare 6+ STAR stories with quantified impact (revenue, cost savings, efficiency)',
        'Document examples of influencing others without formal authority',
        'Prepare "disagreement with manager/leadership" story with professional resolution',
        'Review developing team members: mentoring, delegating, performance conversations',
        'Prepare to discuss handling ambiguous situations: how you create clarity',
        'Document cross-functional initiative examples: stakeholders, obstacles, outcomes',
        'Prepare to discuss your failures: genuine ownership, specific learning, changes made',
        'Review examples of prioritization: competing demands, how you decided',
        'Document your leadership style with specific examples',
        'Prepare questions about culture and team dynamics',
      ],
      mid: [
        'Prepare STAR stories covering: impact, teamwork, challenge, learning, initiative',
        'Quantify achievements wherever possible: percentages, dollars, time, users',
        'Prepare to discuss your strengths with examples and areas for development',
        'Document receiving and acting on difficult feedback constructively',
        'Prepare "conflict with coworker" story: the issue, your approach, resolution',
        'Review examples of adapting to change or unexpected challenges',
        'Prepare "failed project" story: what went wrong, your responsibility, what you learned',
        'Document your motivation: why this role, why this company, why now',
        'Prepare questions about team culture and collaboration',
        'Review company values and map your examples to them',
      ],
      junior: [
        'Prepare STAR stories from academics, internships, jobs, activities, or volunteering',
        'Focus on learning agility: examples of quickly picking up something new',
        'Prepare to discuss why you\'re passionate about this field/role',
        'Document teamwork examples: your specific contributions and role',
        'Prepare "challenge overcome" story: the obstacle, your actions, result',
        'Review examples of initiative or going beyond requirements',
        'Document handling stress or pressure: finals, project deadlines, work',
        'Prepare "failure or mistake" story: what happened, what you learned',
        'Prepare questions about mentorship and professional development',
        'Document what you hope to learn in your first role',
      ],
    },
    hiring_manager: {
      senior: [
        'Research manager\'s background, tenure, and team structure thoroughly',
        'Prepare 30-60-90 day plan: learning phase, quick wins, longer-term contributions',
        'Document approach to building relationships with team and stakeholders quickly',
        'Prepare questions about team challenges, priorities, and success metrics',
        'Review organizational context: where team fits, key collaborators',
        'Prepare to discuss management style you work best with and why',
        'Document how you handle disagreements with managers constructively',
        'Prepare questions about decision-making processes and autonomy',
        'Review recent team accomplishments or challenges if discoverable',
        'Prepare to discuss what support you need to be successful',
      ],
      mid: [
        'Research hiring manager: background, team, LinkedIn posts or articles',
        'Prepare to discuss how you\'d approach ramping up in the role',
        'Document questions about team dynamics, priorities, and challenges',
        'Prepare to discuss your preferred working style and communication',
        'Review what success looks like in first 3-6 months if you can find out',
        'Prepare to discuss career goals and how this role fits',
        'Document how you handle feedback: examples of implementing suggestions',
        'Prepare questions about manager\'s style and expectations',
        'Review the team\'s work if visible (blog posts, products, etc.)',
        'Prepare to discuss what motivates you and keeps you engaged',
      ],
      junior: [
        'Research hiring manager and understand their role and team',
        'Prepare to discuss what kind of mentorship and guidance you\'re seeking',
        'Document questions about training, onboarding, and ramp-up expectations',
        'Prepare to discuss your working style: collaboration, communication, learning',
        'Review what entry-level work looks like: daily tasks, projects',
        'Prepare to discuss career interests and why this is exciting first step',
        'Document how you seek and receive feedback',
        'Prepare questions about growth opportunities and career paths',
        'Review manager\'s background for connection points',
        'Prepare to express enthusiasm and eagerness to learn',
      ],
    },
    final_round: {
      senior: [
        'Review all previous rounds: feedback received, concerns raised, questions asked',
        'Research all interviewers: executives, skip-levels, cross-functional partners',
        'Prepare strategic perspective: where you see the team/company in 2-3 years',
        'Document questions about company strategy, challenges, and your role in it',
        'Review compensation expectations and prepare for discussion',
        'Prepare closing summary: why you, why now, what you\'ll accomplish',
        'Document how you\'d approach first major project or initiative',
        'Prepare for culture/values discussion: alignment examples',
        'Review competitive landscape and your informed perspective',
        'Prepare questions about decision timeline and next steps',
      ],
      mid: [
        'Review and reflect on all previous conversations: themes, concerns, positives',
        'Research any new interviewers you\'ll be meeting',
        'Prepare to reinforce key strengths and address any lingering concerns',
        'Document questions about team growth, your progression, company direction',
        'Prepare to discuss compensation if appropriate for round',
        'Prepare strong close: summarize your fit, express genuine enthusiasm',
        'Review any company announcements since previous interviews',
        'Document what you\'ve learned about the role through the process',
        'Prepare to discuss timeline and competing opportunities professionally',
        'Review culture fit: examples that demonstrate alignment',
      ],
      junior: [
        'Review notes from all previous interviews: what you discussed, what went well',
        'Research any new interviewers on LinkedIn',
        'Prepare to show consistent enthusiasm and professionalism',
        'Document remaining questions about the role and opportunity',
        'Review entry-level compensation and benefits',
        'Prepare genuine expression of excitement and commitment',
        'Document what you\'ve learned about company through process',
        'Prepare to discuss timeline: when you can start, other processes',
        'Review culture and values: reinforce alignment',
        'Prepare to ask about next steps and decision timeline',
      ],
    },
    offer: {
      senior: [
        'Research total compensation benchmarks: Levels.fyi, Blind, Glassdoor, recruiter data',
        'Document negotiation priorities: base, equity, bonus, sign-on, benefits, title',
        'Review equity details thoroughly: grant type, vesting, cliff, refresh policy',
        'Prepare justification for counter: competing offers, market data, experience',
        'Calculate total annual compensation including all components and benefits value',
        'Know your reservation price: minimum you\'d accept, and walk-away number',
        'Prepare professional response timeline: when you\'ll decide, any dependencies',
        'Document questions about equity: strike price, 409A, secondary sales',
        'Review benefits details: health insurance, 401k match, PTO policy',
        'Prepare to negotiate non-salary items if salary is firm',
      ],
      mid: [
        'Research market rates for your role, level, and location specifically',
        'Understand all offer components: base, bonus, equity, signing bonus',
        'Prepare questions about benefits: healthcare plans, retirement, PTO accrual',
        'Document your priorities: what matters most vs nice-to-haves',
        'Prepare professional counter-offer approach with data',
        'Understand timeline: when they need an answer, your decision factors',
        'Review equity grant: type (RSU/options), vesting schedule, value',
        'Document questions about performance reviews, raises, promotions',
        'Prepare to negotiate respectfully: what you want, why it\'s fair',
        'Know that it\'s okay to ask for time to consider',
      ],
      junior: [
        'Research entry-level compensation for role and location on Glassdoor/Levels.fyi',
        'Understand offer components: base salary, any bonus, benefits',
        'Document questions about benefits: health insurance, 401k, PTO',
        'Know that asking for time to consider is professional and expected',
        'Understand signing bonus and relocation assistance if applicable',
        'Prepare to accept graciously or counter professionally',
        'Review start date flexibility and any constraints you have',
        'Document your actual needs: salary floor, must-have benefits',
        'Understand equity if offered: basics of RSUs or options',
        'Prepare to express enthusiasm while making informed decision',
      ],
    },
  },
};

// ============================================================================
// TOPIC SELECTION - Picks different topics on each refresh
// ============================================================================

const selectTopicsFromPool = (
  pool: string[],
  count: number,
  seed: number
): string[] => {
  if (pool.length === 0) return [];
  if (pool.length <= count) return [...pool];
  
  // Use seed to select different subset each time
  const shuffled = [...pool];
  
  // Fisher-Yates shuffle with seeded random
  let currentSeed = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    // Simple seeded random
    currentSeed = (currentSeed * 1103515245 + 12345) & 0x7fffffff;
    const j = currentSeed % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled.slice(0, count);
};

const getTopicsForProfile = (
  role: RoleType,
  stage: string,
  seniority: Seniority,
  refreshSeed: number
): string[] => {
  const stageLower = stage.toLowerCase();
  
  // Try role-specific pool first
  let pool = TOPIC_POOLS[role]?.[stageLower]?.[seniority];
  
  // Fall back to general pool
  if (!pool || pool.length === 0) {
    pool = TOPIC_POOLS.general?.[stageLower]?.[seniority];
  }
  
  // Ultimate fallback
  if (!pool || pool.length === 0) {
    pool = TOPIC_POOLS.general?.phone_screen?.mid || [];
  }
  
  // Select 6 topics from the pool using the refresh seed
  return selectTopicsFromPool(pool, 6, refreshSeed);
};

const generateTopicsFromDB = (
  stage: string,
  position: string,
  company: string,
  refreshSeed: number
): FocusArea[] => {
  const seniority = detectSeniority(position);
  const role = detectRole(position);
  
  let topics = getTopicsForProfile(role, stage, seniority, refreshSeed);
  
  // Add company research topic if company provided
  if (company && company.trim() && topics.length > 0) {
    const companyTopic = `Research ${company}: recent news, products, engineering blog, Glassdoor culture reviews`;
    topics = [companyTopic, ...topics.slice(0, 5)];
  }
  
  return topics.map((text, i) => ({
    id: `topic_${refreshSeed}_${i}_${Date.now()}`,
    text,
  }));
};

// ============================================================================
// LLM GENERATION
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

  const prompt = `Generate 6 specific, actionable interview preparation topics.

Position: ${position}
Interview Stage: ${stageDisplay}
Seniority: ${seniority}
Role Type: ${role}
${company ? `Company: ${company}` : ''}

Requirements:
- Highly specific to ${seniority}-level ${role} preparing for ${stageDisplay}
- Each actionable in 30min-2hrs
- Include specific resources, techniques, or frameworks
- NOT generic (avoid "research company", "prepare questions")
${isRefresh ? `- Generate COMPLETELY DIFFERENT topics. Seed: ${Date.now()}` : ''}

Return ONLY a JSON array of 6 strings. No markdown.`;

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
        max_tokens: 800,
        temperature: isRefresh ? 1.2 : 0.9,
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
    
    const parsed: string[] = JSON.parse(match[0]);
    if (!Array.isArray(parsed) || parsed.length < 4) return null;
    
    return parsed.slice(0, 6).map((text, i) => ({
      id: `llm_${Date.now()}_${i}`,
      text: String(text),
    }));
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
};

// ============================================================================
// COMPONENT
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
  const [refreshSeed, setRefreshSeed] = useState(() => Date.now());
  const mountedRef = useRef(true);
  
  const seniority = useMemo(() => detectSeniority(position), [position]);
  const roleType = useMemo(() => detectRole(position), [position]);
  const stageDisplay = useMemo(() => 
    STAGE_NAMES[stage.toLowerCase()] || stage.replace(/_/g, ' '), [stage]);
  
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  
  // Load on open
  useEffect(() => {
    if (!visible || !stage) return;
    
    // INSTANT fallback (<50ms)
    const initialSeed = Date.now();
    setRefreshSeed(initialSeed);
    const fallback = generateTopicsFromDB(stage, position, company, initialSeed);
    setTopics(fallback);
    setIsAI(false);
    setLoading(true);
    
    // Background AI upgrade
    generateTopicsFromLLM(stage, position, company, false).then(llmTopics => {
      if (mountedRef.current && llmTopics && llmTopics.length >= 4) {
        setTopics(llmTopics);
        setIsAI(true);
      }
      if (mountedRef.current) setLoading(false);
    });
  }, [visible, stage, position, company]);
  
  // Refresh - ALWAYS new topics
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    
    // New seed for completely different selection
    const newSeed = Date.now();
    setRefreshSeed(newSeed);
    
    // Show new fallback set immediately
    const fallback = generateTopicsFromDB(stage, position, company, newSeed);
    setTopics(fallback);
    setIsAI(false);
    
    // Try LLM for even better topics
    const llmTopics = await generateTopicsFromLLM(stage, position, company, true);
    
    if (mountedRef.current) {
      if (llmTopics && llmTopics.length >= 4) {
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
          
          <View style={[styles.badges, { borderBottomColor: colors.border }]}>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: colors.primary + '18' }]}>
                <Text style={[styles.badgeText, { color: colors.primary }]}>
                  {seniority.charAt(0).toUpperCase() + seniority.slice(1)}
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
          
          <View style={styles.source}>
            <Ionicons name={isAI ? 'sparkles' : 'cube-outline'} size={11} color={colors.textSecondary} />
            <Text style={[styles.sourceText, { color: colors.textSecondary }]}>
              {isAI ? 'AI-personalized' : 'Role-specific'}
              {loading && !isAI ? ' • Enhancing...' : ''}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  card: { width: '92%', maxWidth: 400, maxHeight: '85%', borderRadius: 16, overflow: 'hidden',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 }, android: { elevation: 8 } }) },
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
