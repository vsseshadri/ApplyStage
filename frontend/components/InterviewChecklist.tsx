import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
const LLM_TIMEOUT_MS = 12000; // 12 second timeout

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

// ============================================================================
// ROLE & SENIORITY DETECTION
// ============================================================================

type SeniorityLevel = 'executive' | 'senior' | 'mid' | 'junior';
type RoleFamily = 'software_engineering' | 'data_science' | 'product_management' | 'program_management' | 
                   'design' | 'healthcare_clinical' | 'healthcare_admin' | 'aerospace' | 'finance' | 
                   'sales' | 'marketing' | 'legal' | 'hr' | 'operations' | 'consulting' | 'general';

const detectSeniority = (position: string): SeniorityLevel => {
  const lower = position.toLowerCase();
  
  // Executive level
  if (/\b(vp|vice president|director|head of|chief|cto|ceo|cfo|coo|principal|staff|distinguished|fellow)\b/.test(lower)) {
    return 'executive';
  }
  // Senior level
  if (/\b(senior|sr\.?|lead|manager|architect)\b/.test(lower)) {
    return 'senior';
  }
  // Junior level
  if (/\b(junior|jr\.?|associate|entry|intern|graduate|trainee|apprentice)\b/.test(lower)) {
    return 'junior';
  }
  // Default to mid
  return 'mid';
};

const detectRoleFamily = (position: string): RoleFamily => {
  const lower = position.toLowerCase();
  
  // Software Engineering
  if (/\b(software|developer|programmer|engineer|swe|sde|devops|sre|platform|backend|frontend|fullstack|full-stack|mobile)\b/.test(lower) && 
      !/\b(program|project|product)\b/.test(lower)) {
    return 'software_engineering';
  }
  // Data Science / ML / AI
  if (/\b(data scientist|machine learning|ml engineer|ai |analytics|data analyst|research scientist)\b/.test(lower)) {
    return 'data_science';
  }
  // Product Management
  if (/\b(product manager|product owner|pm\b|product lead)\b/.test(lower) && !/program/.test(lower)) {
    return 'product_management';
  }
  // Program Management
  if (/\b(program manager|project manager|technical program|tpm|pmo)\b/.test(lower)) {
    return 'program_management';
  }
  // Design
  if (/\b(designer|ux|ui|user experience|user interface|creative|visual)\b/.test(lower)) {
    return 'design';
  }
  // Healthcare Clinical
  if (/\b(nurse|rn\b|np\b|physician|doctor|surgeon|clinician|medical|therapist|pharmacist|dentist)\b/.test(lower)) {
    return 'healthcare_clinical';
  }
  // Healthcare Admin
  if (/\b(healthcare admin|hospital admin|medical director|clinical operations)\b/.test(lower)) {
    return 'healthcare_admin';
  }
  // Aerospace
  if (/\b(aerospace|avionics|flight|astronaut|rocket|propulsion|aircraft|aviation)\b/.test(lower)) {
    return 'aerospace';
  }
  // Finance
  if (/\b(financial analyst|investment|banking|trader|portfolio|accounting|accountant|controller|finance)\b/.test(lower)) {
    return 'finance';
  }
  // Sales
  if (/\b(sales|account executive|business development|ae\b|bdr|sdr)\b/.test(lower)) {
    return 'sales';
  }
  // Marketing
  if (/\b(marketing|growth|brand|content|seo|sem|digital marketing)\b/.test(lower)) {
    return 'marketing';
  }
  // Legal
  if (/\b(lawyer|attorney|legal|counsel|paralegal|compliance)\b/.test(lower)) {
    return 'legal';
  }
  // HR
  if (/\b(recruiter|hr\b|human resources|talent|people ops|hrbp)\b/.test(lower)) {
    return 'hr';
  }
  // Operations
  if (/\b(operations|supply chain|logistics|procurement|manufacturing)\b/.test(lower)) {
    return 'operations';
  }
  // Consulting
  if (/\b(consultant|consulting|advisory|strategy)\b/.test(lower)) {
    return 'consulting';
  }
  
  return 'general';
};

// ============================================================================
// COMPREHENSIVE ROLE + STAGE + SENIORITY TOPIC DATABASE
// ============================================================================

interface TopicDatabase {
  [roleFamily: string]: {
    [stage: string]: {
      [seniority: string]: string[];
    };
  };
}

const TOPIC_DATABASE: TopicDatabase = {
  software_engineering: {
    system_design: {
      executive: [
        'Prepare to lead architecture discussions - practice whiteboarding complex distributed systems',
        'Review trade-offs you\'ve made at scale: CAP theorem decisions, consistency vs availability',
        'Prepare examples of cross-team technical decisions and their organizational impact',
        'Study recent case studies: how Uber/Netflix/Meta handle millions of concurrent requests',
        'Practice capacity estimation: QPS, storage, bandwidth for 100M+ users',
        'Review your experience with service mesh, observability at scale, and incident response',
      ],
      senior: [
        'Practice designing systems handling 10K+ concurrent requests with load balancing strategies',
        'Review database sharding patterns and when to use horizontal vs vertical scaling',
        'Prepare to explain API rate limiting implementations: token bucket, sliding window',
        'Study caching strategies: cache invalidation, write-through vs write-behind patterns',
        'Practice drawing clear architecture diagrams with data flow and failure points',
        'Review microservices patterns: circuit breakers, saga patterns, event sourcing',
      ],
      mid: [
        'Study basic system design components: load balancers, CDNs, reverse proxies',
        'Practice designing a URL shortener with read/write ratio optimization',
        'Review SQL vs NoSQL trade-offs with specific use case examples',
        'Understand caching basics: Redis vs Memcached, TTL strategies',
        'Practice estimating storage and bandwidth for common scenarios',
        'Learn to ask clarifying questions: scale, latency requirements, consistency needs',
      ],
      junior: [
        'Review how web requests flow: DNS → Load Balancer → Server → Database',
        'Understand basic scaling: vertical (bigger server) vs horizontal (more servers)',
        'Study what databases do and when to use SQL vs NoSQL',
        'Learn about caching: why we cache, what Redis is, cache hit/miss concepts',
        'Practice explaining simple architectures like a blog or todo app',
        'Prepare questions about the company\'s tech stack and architecture',
      ],
    },
    coding_round_1: {
      executive: [
        'Practice leadership-style coding: clean code, design patterns, extensibility',
        'Review advanced algorithms you\'d expect senior engineers to implement',
        'Prepare to discuss code review feedback and mentoring approaches',
        'Practice explaining trade-offs in your solutions clearly',
        'Review concurrency patterns: thread safety, locks, async patterns',
        'Prepare to discuss your approach to technical debt and code quality',
      ],
      senior: [
        'Master these patterns: sliding window, two pointers, binary search variations',
        'Practice 5+ medium LeetCode problems in 25 minutes each',
        'Review graph algorithms: BFS for shortest path, DFS for traversal',
        'Prepare to optimize solutions: O(n²) to O(n log n) conversions',
        'Practice explaining your thought process while coding aloud',
        'Review language-specific optimizations and idioms',
      ],
      mid: [
        'Focus on array and string manipulation problems - solve 3 per day',
        'Master HashMap usage for O(1) lookups and frequency counting',
        'Practice the two-pointer technique for sorted array problems',
        'Review recursion basics and when to use iterative vs recursive',
        'Get comfortable with time/space complexity analysis',
        'Practice debugging your code with edge cases',
      ],
      junior: [
        'Review fundamental data structures: arrays, strings, hashmaps, linked lists',
        'Practice 2-3 easy LeetCode problems daily in your target language',
        'Master basic operations: reverse string, find max/min, two sum',
        'Learn to trace through code step by step before running',
        'Practice explaining your approach before writing code',
        'Review Big-O basics: constant, linear, quadratic complexity',
      ],
    },
    behavioural: {
      executive: [
        'Prepare stories about driving org-wide technical strategy and vision',
        'Document examples of building and scaling high-performing teams',
        'Prepare to discuss technical investment decisions and ROI',
        'Review examples of navigating ambiguity and setting direction',
        'Prepare stories about cross-functional influence at exec level',
        'Document how you\'ve handled technical crises and post-mortems',
      ],
      senior: [
        'Map 3 projects to STAR format with specific metrics (latency reduced 40%, etc.)',
        'Prepare mentoring stories: how you grew junior engineers',
        'Document a time you pushed back on product requirements with data',
        'Prepare a "technical disagreement resolution" story',
        'Review examples of balancing tech debt vs feature delivery',
        'Prepare to discuss your approach to code reviews and quality',
      ],
      mid: [
        'Prepare 5 STAR stories covering: impact, collaboration, challenge, learning, initiative',
        'Quantify your achievements: % improvement, users affected, time saved',
        'Prepare a "learned from failure" story with concrete takeaways',
        'Document examples of working with cross-functional teams',
        'Prepare to discuss your development goals and growth areas',
        'Review how your work impacted users or business metrics',
      ],
      junior: [
        'Prepare stories from internships, projects, or coursework using STAR format',
        'Highlight your learning agility - how quickly you picked up new skills',
        'Prepare to discuss a challenging project and how you overcame obstacles',
        'Review your technical interests and why you chose this field',
        'Prepare questions about mentorship and growth opportunities',
        'Document team projects: your role, contributions, and learnings',
      ],
    },
    technical_screen: {
      executive: [
        'Prepare to discuss architectural decisions at scale and their rationale',
        'Review your track record of technical leadership and its impact',
        'Prepare examples of evaluating and adopting new technologies',
        'Document your experience with technical strategy and roadmapping',
        'Review how you\'ve balanced innovation with reliability',
        'Prepare to discuss your technical vision for the organization',
      ],
      senior: [
        'Review advanced data structures: tries, segment trees, union-find',
        'Practice system design elements in coding problems',
        'Prepare to discuss your most complex technical project in depth',
        'Review concurrency, threading, and async programming patterns',
        'Practice optimizing solutions and discussing trade-offs',
        'Prepare technical questions about the company\'s stack',
      ],
      mid: [
        'Review core data structures: arrays, hashmaps, trees, graphs',
        'Practice explaining your technical projects in 2-3 minutes',
        'Solve 2-3 LeetCode medium problems with focus on explanation',
        'Review Big-O complexity for common operations',
        'Prepare to discuss your development workflow and tools',
        'Practice coding without IDE - syntax, imports from memory',
      ],
      junior: [
        'Review fundamentals: OOP concepts, basic algorithms, data structures',
        'Practice explaining your projects and coursework clearly',
        'Solve 3-5 easy LeetCode problems in your target language',
        'Review basic SQL queries: SELECT, JOIN, GROUP BY',
        'Prepare to discuss your learning process and how you debug',
        'Research the company\'s tech stack and prepare relevant questions',
      ],
    },
  },
  program_management: {
    system_design: {
      executive: [
        'Prepare to discuss program architecture at portfolio level',
        'Review examples of managing programs with 50+ engineers across teams',
        'Document how you\'ve aligned technical roadmaps with business strategy',
        'Prepare to discuss resource allocation across competing priorities',
        'Review your experience with build vs buy decisions at scale',
        'Prepare examples of managing vendor relationships for major systems',
      ],
      senior: [
        'Prepare to discuss system dependencies and cross-team coordination',
        'Review examples of de-risking large technical initiatives',
        'Document how you\'ve managed technical debt conversations with eng leaders',
        'Prepare to discuss trade-offs: scope, timeline, quality, resources',
        'Review your approach to technical requirements gathering',
        'Prepare examples of translating business needs to technical requirements',
      ],
      mid: [
        'Study how to create technical project timelines with dependencies',
        'Review risk management frameworks for technical projects',
        'Prepare to discuss how you coordinate between engineering teams',
        'Document your experience with Agile/Scrum at scale',
        'Review common integration points and failure modes in systems',
        'Prepare questions about the technical architecture landscape',
      ],
      junior: [
        'Review basic software development lifecycle and methodologies',
        'Study project management tools: Jira, Asana, MS Project',
        'Understand technical dependencies and how to track them',
        'Learn about APIs, integrations, and system boundaries',
        'Prepare to discuss how you\'d learn the technical landscape quickly',
        'Review basic concepts: sprints, backlogs, velocity, burndown',
      ],
    },
    behavioural: {
      executive: [
        'Prepare stories about managing multi-million dollar programs',
        'Document examples of executive stakeholder management',
        'Review how you\'ve navigated organizational change during major initiatives',
        'Prepare to discuss conflict resolution at senior leadership level',
        'Document program turnarounds: how you rescued failing initiatives',
        'Prepare examples of building high-performing TPM teams',
      ],
      senior: [
        'Prepare STAR stories about managing complex, ambiguous programs',
        'Document examples of influencing engineering teams without authority',
        'Review how you\'ve handled scope creep and timeline pressures',
        'Prepare a story about resolving cross-team conflicts',
        'Document how you\'ve driven accountability in engineering teams',
        'Prepare examples of risk escalation and mitigation',
      ],
      mid: [
        'Prepare stories demonstrating stakeholder management skills',
        'Document examples of keeping projects on track despite obstacles',
        'Review how you communicate technical status to non-technical stakeholders',
        'Prepare a story about managing competing priorities',
        'Document your approach to running effective meetings',
        'Prepare examples of identifying and mitigating project risks',
      ],
      junior: [
        'Prepare stories from coursework or internships about coordination',
        'Document examples of organizing team activities or projects',
        'Review how you handle multiple deadlines and priorities',
        'Prepare to discuss your communication and organization skills',
        'Document any leadership experience in clubs or group projects',
        'Prepare questions about the team structure and how TPMs operate',
      ],
    },
    hiring_manager: {
      executive: [
        'Research the VP/Director\'s background and organizational challenges',
        'Prepare your vision for the TPM function at scale',
        'Document your leadership philosophy and team-building approach',
        'Prepare to discuss program governance and portfolio management',
        'Review organizational changes you\'ve driven and their impact',
        'Prepare questions about strategic priorities and pain points',
      ],
      senior: [
        'Research the hiring manager\'s programs and team structure',
        'Prepare a 30-60-90 day plan for ramping on their programs',
        'Document your approach to building relationships with eng leads',
        'Prepare to discuss how you handle underperforming team dynamics',
        'Review your stakeholder management approach',
        'Prepare questions about team challenges and success metrics',
      ],
      mid: [
        'Research the manager\'s background and current programs',
        'Prepare to discuss your project management methodology',
        'Document how you\'ve handled difficult stakeholders',
        'Prepare questions about team structure and growth opportunities',
        'Review how you prioritize when everything is urgent',
        'Prepare to discuss your communication tools and style',
      ],
      junior: [
        'Research the hiring manager on LinkedIn and understand their programs',
        'Prepare to discuss why you\'re interested in program management',
        'Document your organizational and communication strengths',
        'Prepare questions about mentorship and training programs',
        'Review what makes a successful TPM in their organization',
        'Prepare to discuss how you\'d learn the technical landscape',
      ],
    },
  },
  healthcare_clinical: {
    clinical: {
      executive: [
        'Prepare examples of improving clinical outcomes at department/org level',
        'Review leadership in quality improvement initiatives with metrics',
        'Document experience with accreditation and regulatory compliance',
        'Prepare to discuss clinical staffing models and resource optimization',
        'Review your approach to evidence-based practice implementation',
        'Prepare examples of handling adverse events and system improvements',
      ],
      senior: [
        'Prepare detailed patient care scenarios in your specialty',
        'Review clinical protocols and when you\'d deviate from them',
        'Document examples of clinical decision-making under pressure',
        'Prepare SBAR format examples for critical communications',
        'Review medication interactions common in your specialty',
        'Prepare to discuss how you mentor junior clinical staff',
      ],
      mid: [
        'Review clinical assessment frameworks relevant to your specialty',
        'Prepare patient case examples demonstrating your clinical judgment',
        'Document how you prioritize care with multiple patients',
        'Review pharmacology relevant to your area of practice',
        'Prepare to discuss documentation standards and EHR workflows',
        'Review infection control and safety protocols',
      ],
      junior: [
        'Review core clinical competencies for your role',
        'Prepare examples from clinical rotations demonstrating learning',
        'Study common diagnoses and treatments in the specialty',
        'Review patient safety protocols and when to escalate',
        'Prepare to discuss how you handle stressful patient situations',
        'Document your clinical interests and growth goals',
      ],
    },
    behavioural: {
      executive: [
        'Prepare stories about leading clinical teams through challenges',
        'Document examples of implementing new protocols organization-wide',
        'Review how you\'ve handled conflicts between clinical and administrative priorities',
        'Prepare to discuss your approach to staff development and retention',
        'Document quality improvement initiatives you\'ve led with outcomes',
        'Prepare examples of managing during crisis situations',
      ],
      senior: [
        'Prepare STAR stories about complex patient cases and outcomes',
        'Document examples of advocating for patients or staff',
        'Review how you\'ve handled ethical dilemmas in practice',
        'Prepare a story about teaching or mentoring clinical staff',
        'Document how you stay current with clinical best practices',
        'Prepare to discuss your collaboration with interdisciplinary teams',
      ],
      mid: [
        'Prepare stories demonstrating patient advocacy and communication',
        'Document examples of handling difficult patient or family situations',
        'Review how you manage stress and prevent burnout',
        'Prepare to discuss your continuing education and certifications',
        'Document examples of team collaboration and communication',
        'Prepare a story about learning from a clinical mistake',
      ],
      junior: [
        'Prepare stories from clinical training demonstrating compassion',
        'Document examples of handling challenging patient interactions',
        'Review why you chose this clinical specialty',
        'Prepare to discuss your stress management strategies',
        'Document your clinical role models and what you learned',
        'Prepare questions about preceptorship and support systems',
      ],
    },
  },
  aerospace: {
    technical_screen: {
      executive: [
        'Review your experience leading certifications (FAA, EASA, etc.)',
        'Prepare to discuss systems engineering at program level',
        'Document your experience with DO-178C/DO-254 compliance',
        'Review aerospace safety management and risk assessment',
        'Prepare examples of leading multi-disciplinary engineering teams',
        'Document major program milestones you\'ve achieved',
      ],
      senior: [
        'Review flight dynamics and control systems fundamentals',
        'Prepare to discuss propulsion systems analysis and trade-offs',
        'Document your experience with V&V processes in aerospace',
        'Review avionics architecture and integration challenges',
        'Prepare examples of solving complex aerospace engineering problems',
        'Study recent developments in your aerospace specialty',
      ],
      mid: [
        'Review core aerospace fundamentals: aerodynamics, structures, propulsion',
        'Prepare to discuss your experience with aerospace design tools (CATIA, MATLAB)',
        'Document your understanding of aerospace quality standards',
        'Review materials commonly used and their properties',
        'Prepare to discuss your experience with testing and validation',
        'Study the company\'s products and recent aerospace programs',
      ],
      junior: [
        'Review aerospace engineering fundamentals from your coursework',
        'Prepare to discuss relevant projects and senior design experience',
        'Study basic aerodynamics: lift, drag, thrust, weight',
        'Review orbital mechanics basics if applicable',
        'Prepare to discuss your CAD and analysis tool experience',
        'Research the company\'s aerospace programs and missions',
      ],
    },
    system_design: {
      executive: [
        'Prepare to discuss aerospace system architecture at program level',
        'Review your experience with requirements decomposition and traceability',
        'Document major system trade studies you\'ve led',
        'Prepare examples of managing integration across aerospace disciplines',
        'Review your approach to safety-critical system design',
        'Prepare to discuss certification strategies and timelines',
      ],
      senior: [
        'Review system safety analysis methods: FMEA, FTA, hazard analysis',
        'Prepare to discuss avionics integration architecture',
        'Document experience with redundancy and fault tolerance design',
        'Review environmental qualification requirements',
        'Prepare examples of interface control document development',
        'Study recent system architectures in commercial/defense aerospace',
      ],
      mid: [
        'Review basic system engineering lifecycle and processes',
        'Study interface definition and control processes',
        'Prepare to discuss configuration management in aerospace',
        'Review requirements management tools and processes',
        'Document your experience with system integration testing',
        'Prepare questions about the system architecture landscape',
      ],
      junior: [
        'Review systems engineering fundamentals: V-model, requirements',
        'Study how aerospace systems are decomposed into subsystems',
        'Understand the relationship between hardware and software requirements',
        'Review basic testing hierarchies: unit, integration, system',
        'Prepare to discuss your systems thinking approach',
        'Research the company\'s major programs and their architectures',
      ],
    },
  },
  data_science: {
    technical_screen: {
      executive: [
        'Prepare to discuss ML strategy and ROI at organizational level',
        'Review examples of building and scaling ML teams',
        'Document your approach to ML infrastructure decisions',
        'Prepare to discuss ethical AI and responsible ML practices',
        'Review your experience with ML in production at scale',
        'Prepare examples of translating business problems to ML solutions',
      ],
      senior: [
        'Review advanced ML: ensemble methods, deep learning architectures',
        'Prepare to explain a model you built: features, evaluation, iteration',
        'Practice SQL window functions and complex analytical queries',
        'Review A/B testing design: power analysis, multiple comparisons',
        'Prepare to discuss feature engineering strategies',
        'Review ML ops and model deployment best practices',
      ],
      mid: [
        'Review supervised learning: regression, classification, evaluation metrics',
        'Practice Python pandas: groupby, merge, apply, window functions',
        'Prepare SQL exercises: CTEs, window functions, complex joins',
        'Review statistics: hypothesis testing, confidence intervals, p-values',
        'Prepare to discuss your data pipeline experience',
        'Practice explaining ML concepts to non-technical stakeholders',
      ],
      junior: [
        'Review ML basics: train/test split, overfitting, cross-validation',
        'Practice basic Python data manipulation with pandas',
        'Review SQL fundamentals: joins, aggregations, filtering',
        'Understand basic statistics: mean, median, variance, distributions',
        'Prepare to discuss your data science projects from school',
        'Review the company\'s products and potential ML applications',
      ],
    },
    behavioural: {
      executive: [
        'Prepare stories about building data science culture in organizations',
        'Document examples of executive-level data presentations',
        'Review how you\'ve balanced innovation with reliability in ML',
        'Prepare to discuss data ethics and privacy decisions',
        'Document your approach to hiring and developing DS talent',
        'Prepare examples of driving business value through ML',
      ],
      senior: [
        'Prepare STAR stories about impactful ML projects with business metrics',
        'Document examples of collaborating with product/engineering teams',
        'Review how you communicate complex analysis to stakeholders',
        'Prepare a story about a model that failed and what you learned',
        'Document your approach to mentoring junior data scientists',
        'Prepare examples of prioritizing among multiple analysis requests',
      ],
      mid: [
        'Prepare stories about data projects with clear business impact',
        'Document how you handle ambiguous data analysis requests',
        'Review examples of presenting insights to non-technical audiences',
        'Prepare to discuss how you validate and QA your analysis',
        'Document examples of cross-functional collaboration',
        'Prepare a story about learning a new tool or technique quickly',
      ],
      junior: [
        'Prepare stories from coursework or personal projects',
        'Document your passion for data and analytical thinking',
        'Prepare to discuss how you approach an unfamiliar dataset',
        'Review your experience with data visualization',
        'Prepare questions about the team\'s tools and workflows',
        'Document your learning goals in data science',
      ],
    },
  },
  finance: {
    technical_screen: {
      executive: [
        'Prepare to discuss financial modeling at strategic level',
        'Review your experience with M&A due diligence and valuation',
        'Document examples of presenting to C-suite and board',
        'Prepare to discuss risk management frameworks',
        'Review your approach to financial forecasting and planning',
        'Prepare examples of driving financial strategy decisions',
      ],
      senior: [
        'Review advanced financial modeling: DCF, LBO, merger models',
        'Prepare to discuss your approach to financial analysis and insights',
        'Document experience with financial systems and ERP',
        'Review Excel advanced functions: INDEX-MATCH, financial functions',
        'Prepare to discuss your experience with financial reporting',
        'Review current market conditions and their implications',
      ],
      mid: [
        'Review financial statement analysis: ratios, trends, benchmarking',
        'Practice Excel modeling: building projections, sensitivity analysis',
        'Prepare to discuss your experience with budgeting and forecasting',
        'Review GAAP/IFRS accounting principles relevant to your area',
        'Prepare examples of financial analysis you\'ve conducted',
        'Document your experience with financial tools and systems',
      ],
      junior: [
        'Review core finance concepts: time value of money, NPV, IRR',
        'Practice Excel: pivot tables, VLOOKUP, basic modeling',
        'Understand financial statements: income statement, balance sheet, cash flow',
        'Review basic accounting principles',
        'Prepare to discuss your finance coursework and interests',
        'Research the company\'s financial position and recent news',
      ],
    },
    case_study: {
      executive: [
        'Prepare to lead executive-level financial strategy discussions',
        'Review your framework for evaluating major investment decisions',
        'Document examples of complex financial transactions you\'ve led',
        'Prepare to discuss risk-return trade-offs at portfolio level',
        'Review your approach to capital allocation decisions',
        'Prepare examples of financial turnarounds or transformations',
      ],
      senior: [
        'Practice case studies: company valuation, investment thesis',
        'Review financial frameworks: WACC, capital structure optimization',
        'Prepare to walk through your financial modeling approach',
        'Practice presenting investment recommendations',
        'Review industry metrics and benchmarks in your sector',
        'Prepare to discuss current market opportunities and risks',
      ],
      mid: [
        'Practice financial case studies with time constraints',
        'Review valuation methods: comparable companies, precedent transactions',
        'Prepare to structure financial analysis systematically',
        'Practice calculating key financial metrics quickly',
        'Review how to present financial analysis clearly',
        'Prepare questions about the role\'s analytical responsibilities',
      ],
      junior: [
        'Practice basic case study frameworks for finance',
        'Review how to approach valuation questions systematically',
        'Practice mental math: percentages, growth rates, ratios',
        'Prepare to structure ambiguous financial questions',
        'Review basic financial metrics and what they indicate',
        'Prepare to discuss your interest in the specific finance area',
      ],
    },
  },
  consulting: {
    case_study: {
      executive: [
        'Prepare to demonstrate strategic thinking at C-level',
        'Review your frameworks for organizational transformation',
        'Document major engagement turnarounds you\'ve led',
        'Prepare to discuss client relationship management',
        'Review your approach to business development',
        'Prepare examples of thought leadership in your practice area',
      ],
      senior: [
        'Master multiple frameworks: MECE, 80/20, hypothesis-driven analysis',
        'Practice case interviews covering: market entry, profitability, M&A',
        'Prepare to lead the case discussion rather than just respond',
        'Review industry analyses in 2-3 sectors',
        'Practice synthesizing recommendations under time pressure',
        'Prepare examples of managing client relationships',
      ],
      mid: [
        'Practice case study frameworks: issue trees, hypothesis testing',
        'Review market sizing approaches with clear assumptions',
        'Practice mental math: percentages, compound growth, unit economics',
        'Prepare structured approaches to common case types',
        'Practice delivering recommendations with supporting logic',
        'Review 2-3 industries to demonstrate commercial awareness',
      ],
      junior: [
        'Learn core consulting frameworks: 3C\'s, Porter\'s 5 forces, SWOT',
        'Practice market sizing with the top-down and bottom-up approaches',
        'Practice breaking down problems into structured components',
        'Review basic mental math and get comfortable with estimates',
        'Practice presenting your analysis clearly and confidently',
        'Prepare examples demonstrating analytical thinking',
      ],
    },
    behavioural: {
      executive: [
        'Prepare stories about winning and delivering major engagements',
        'Document examples of building practice areas or offices',
        'Review your approach to developing consulting talent',
        'Prepare to discuss thought leadership and market positioning',
        'Document examples of navigating complex client politics',
        'Prepare examples of innovation in service delivery',
      ],
      senior: [
        'Prepare STAR stories about complex client engagements',
        'Document examples of managing client expectations',
        'Review how you\'ve handled difficult stakeholder situations',
        'Prepare a story about recovering a challenging project',
        'Document your approach to mentoring consultants',
        'Prepare examples of business development activities',
      ],
      mid: [
        'Prepare stories demonstrating analytical problem-solving',
        'Document examples of working in high-pressure, fast-paced environments',
        'Review how you handle ambiguity and incomplete information',
        'Prepare a story about receiving and incorporating feedback',
        'Document examples of teamwork and collaboration',
        'Prepare to discuss your motivation for consulting',
      ],
      junior: [
        'Prepare stories from coursework, internships, or extracurriculars',
        'Document examples of leadership and taking initiative',
        'Prepare to discuss why you want to work in consulting',
        'Review your analytical and problem-solving approach',
        'Prepare examples of working effectively in teams',
        'Document your interest areas and why this firm',
      ],
    },
  },
  general: {
    recruiter_screening: {
      executive: [
        'Prepare executive summary of your career arc and impact',
        'Research the company\'s executive team and recent board decisions',
        'Prepare your compensation expectations based on market data',
        'Document your leadership philosophy in 2-3 sentences',
        'Prepare questions about strategic priorities and challenges',
        'Review recent company news and prepare relevant observations',
      ],
      senior: [
        'Prepare a 60-second career summary highlighting progression',
        'Research the company on Glassdoor, LinkedIn, and recent news',
        'Prepare your salary range with market data justification',
        'Document 3 key achievements with quantified impact',
        'Prepare questions about team structure and growth trajectory',
        'Review the job description and align your experience',
      ],
      mid: [
        'Prepare a concise overview of your experience and career goals',
        'Research the company culture, mission, and recent developments',
        'Understand the market rate for the role in your location',
        'Prepare 3 reasons why you\'re interested in this specific role',
        'Document questions about the role and team',
        'Review your resume and be ready to discuss any point',
      ],
      junior: [
        'Prepare a brief introduction covering education and relevant experience',
        'Research the company thoroughly: products, culture, values',
        'Understand entry-level compensation ranges in your area',
        'Prepare your "why this role/company" answer',
        'Document questions about training, mentorship, and growth',
        'Review the job posting and prepare relevant examples',
      ],
    },
    phone_screen: {
      executive: [
        'Research the interviewer\'s background and recent initiatives',
        'Prepare to discuss your strategic vision for the role',
        'Document your approach to building and leading organizations',
        'Prepare examples of driving business results at scale',
        'Review the company\'s competitive landscape and positioning',
        'Prepare questions about culture and leadership team dynamics',
      ],
      senior: [
        'Map your top 3 achievements to specific metrics and outcomes',
        'Research the interviewer on LinkedIn and find connection points',
        'Prepare a compelling "why this company" answer with specifics',
        'Draft 3 STAR stories: leadership, impact, and problem-solving',
        'Review the company\'s tech stack and recent projects',
        'Prepare insightful questions about team challenges',
      ],
      mid: [
        'Review your resume and prepare to discuss each role in detail',
        'Research the interviewer and company recent developments',
        'Prepare your career story and motivation for this transition',
        'Draft 3 STAR stories covering impact and collaboration',
        'Test your phone/video setup in a quiet environment',
        'Prepare 3-4 thoughtful questions about the role',
      ],
      junior: [
        'Review your resume and prepare to explain all experiences',
        'Research the company and interviewer on LinkedIn',
        'Prepare your "tell me about yourself" in 60 seconds',
        'Draft examples from school, projects, or internships',
        'Test your technology setup and find a quiet location',
        'Prepare questions about the role and development opportunities',
      ],
    },
    behavioural: {
      executive: [
        'Prepare stories about building and transforming organizations',
        'Document examples of executive-level strategic decisions',
        'Review how you\'ve navigated board and investor relationships',
        'Prepare to discuss your leadership failures and learnings',
        'Document how you build high-performing leadership teams',
        'Prepare examples of driving culture change at scale',
      ],
      senior: [
        'Prepare 5+ STAR stories with quantified business impact',
        'Document examples of influencing without direct authority',
        'Prepare a "disagreement with leadership" story and resolution',
        'Review examples of developing and mentoring team members',
        'Prepare to discuss how you handle ambiguity and prioritization',
        'Document examples of driving cross-functional initiatives',
      ],
      mid: [
        'Prepare STAR stories: achievement, challenge, collaboration, failure',
        'Quantify all achievements: percentages, dollars, time, users',
        'Prepare to discuss your strengths and development areas',
        'Document examples of receiving and acting on feedback',
        'Prepare a "conflict resolution" story with positive outcome',
        'Review how your values align with the company culture',
      ],
      junior: [
        'Prepare STAR stories from school, internships, or activities',
        'Focus on demonstrating learning agility and growth mindset',
        'Prepare to discuss why you\'re passionate about this field',
        'Document examples of teamwork and taking initiative',
        'Prepare a "challenge overcome" story with learnings',
        'Prepare questions about culture and development programs',
      ],
    },
    hiring_manager: {
      executive: [
        'Research the hiring executive\'s background and initiatives',
        'Prepare your 100-day plan for organizational impact',
        'Document your leadership philosophy and team-building approach',
        'Prepare questions about strategic priorities and board dynamics',
        'Review the organizational structure and reporting lines',
        'Prepare to discuss compensation and equity expectations',
      ],
      senior: [
        'Research the manager\'s background and team structure',
        'Prepare a 30-60-90 day plan with specific milestones',
        'Document how you\'d approach building relationships with the team',
        'Prepare questions about success metrics and team challenges',
        'Review the team\'s recent projects and priorities',
        'Prepare to discuss your management and collaboration style',
      ],
      mid: [
        'Research the hiring manager\'s background on LinkedIn',
        'Prepare to discuss how you\'d ramp up in the role',
        'Document questions about team dynamics and priorities',
        'Prepare to discuss your working style and preferences',
        'Review what success looks like in the first 6 months',
        'Prepare to discuss career goals and growth interests',
      ],
      junior: [
        'Research the hiring manager and understand their role',
        'Prepare to discuss what kind of mentorship you\'re seeking',
        'Document questions about training and development opportunities',
        'Prepare to discuss your working style and learning approach',
        'Review what an entry-level person does day-to-day',
        'Prepare to discuss your career interests and goals',
      ],
    },
    final_round: {
      executive: [
        'Research all executives you\'ll meet and their priorities',
        'Prepare your strategic vision for the organization',
        'Review any feedback from earlier rounds and address concerns',
        'Prepare questions about board dynamics and strategic direction',
        'Document your compensation requirements and negotiation points',
        'Prepare closing statements about your commitment and vision',
      ],
      senior: [
        'Review all previous interview feedback and prepare responses',
        'Research senior leadership and company strategic direction',
        'Prepare your high-level vision for the role\'s impact',
        'Document questions about growth trajectory and success metrics',
        'Review compensation benchmarks and prepare for discussion',
        'Prepare your closing statement: why you, why now',
      ],
      mid: [
        'Reflect on all previous interviews and common themes',
        'Research any new interviewers you\'ll meet',
        'Prepare to reinforce key strengths and address any concerns',
        'Document questions about team direction and your growth',
        'Prepare to discuss compensation expectations professionally',
        'Prepare your closing: enthusiasm, fit, and next steps',
      ],
      junior: [
        'Review notes from all previous interviews',
        'Research any new interviewers on LinkedIn',
        'Prepare to demonstrate continued enthusiasm and fit',
        'Document any remaining questions about the role',
        'Understand entry-level compensation and benefits',
        'Prepare to express your excitement and commitment',
      ],
    },
    offer: {
      executive: [
        'Research total compensation benchmarks for executive roles',
        'Prepare negotiation strategy: base, equity, bonus, benefits',
        'Review equity terms: vesting, acceleration, change of control',
        'Prepare questions about board seat, budget authority, resources',
        'Document your priorities and trade-offs for negotiation',
        'Prepare your decision timeline and communication plan',
      ],
      senior: [
        'Research compensation on Levels.fyi for comparable roles',
        'List your negotiation priorities: base, equity, sign-on, start date',
        'Understand equity details: grant type, vesting, refresh grants',
        'Prepare data points to justify your counter-offer',
        'Calculate total compensation including benefits value',
        'Know your walk-away criteria and decision timeline',
      ],
      mid: [
        'Research market rates for your role and experience level',
        'Understand all compensation components: base, bonus, equity',
        'Prepare questions about benefits: health, 401k, PTO',
        'Document your priorities: what matters most to you',
        'Prepare a professional counter-offer approach',
        'Understand the timeline and next steps',
      ],
      junior: [
        'Research entry-level compensation for your role and location',
        'Understand the offer components: salary, benefits, start date',
        'Prepare questions about benefits and development programs',
        'Know that it\'s okay to ask for time to consider',
        'Understand signing bonuses and relocation if applicable',
        'Prepare to accept or negotiate professionally',
      ],
    },
  },
};

// ============================================================================
// TOPIC GENERATION FUNCTIONS
// ============================================================================

const getTopicsFromDatabase = (
  roleFamily: RoleFamily,
  stage: string,
  seniority: SeniorityLevel
): string[] => {
  const stageLower = stage.toLowerCase();
  
  // Try to get role-specific topics first
  const roleTopics = TOPIC_DATABASE[roleFamily]?.[stageLower]?.[seniority];
  if (roleTopics && roleTopics.length > 0) {
    return roleTopics;
  }
  
  // Fall back to general topics for this stage
  const generalTopics = TOPIC_DATABASE.general?.[stageLower]?.[seniority];
  if (generalTopics && generalTopics.length > 0) {
    return generalTopics;
  }
  
  // Ultimate fallback to general phone_screen mid-level
  return TOPIC_DATABASE.general?.phone_screen?.mid || [];
};

const generateFallbackTopics = (
  stage: string,
  position: string,
  company: string,
  shuffleSeed?: number
): FocusArea[] => {
  const seniority = detectSeniority(position);
  const roleFamily = detectRoleFamily(position);
  
  let topics = getTopicsFromDatabase(roleFamily, stage, seniority);
  
  // Add company-specific research as first item if company provided
  if (company && company.trim() && topics.length > 0) {
    const companyTopic = `Research ${company}'s recent news, products, and culture on LinkedIn and Glassdoor`;
    topics = [companyTopic, ...topics.slice(0, 5)];
  }
  
  // If shuffleSeed provided, shuffle deterministically based on the seed
  if (shuffleSeed !== undefined) {
    // Simple seeded shuffle
    const shuffled = [...topics];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor((shuffleSeed * (i + 1)) % (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    topics = shuffled;
  }
  
  return topics.slice(0, 6).map((text, index) => ({
    id: `focus_${index + 1}`,
    text,
    category: getCategoryForTopic(text),
  }));
};

const getCategoryForTopic = (text: string): string => {
  const lower = text.toLowerCase();
  
  if (lower.includes('research') || lower.includes('review') || lower.includes('study')) return 'research';
  if (lower.includes('practice') || lower.includes('prepare') || lower.includes('draft')) return 'practice';
  if (lower.includes('story') || lower.includes('example') || lower.includes('document')) return 'stories';
  if (lower.includes('question')) return 'questions';
  if (lower.includes('technical') || lower.includes('code') || lower.includes('system')) return 'technical';
  
  return 'preparation';
};

// ============================================================================
// LLM API INTEGRATION
// ============================================================================

const generateLLMTopics = async (
  stage: string,
  position: string,
  company: string,
  forceNewGeneration: boolean = false
): Promise<FocusArea[] | null> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  
  const stageDisplay = STAGE_DISPLAY_NAMES[stage.toLowerCase()] || stage.replace(/_/g, ' ');
  const seniority = detectSeniority(position);
  const roleFamily = detectRoleFamily(position);
  
  // Get role-family specific context
  const roleContext = getRoleSpecificContext(roleFamily, stage, seniority);
  const variationPrompt = forceNewGeneration 
    ? `\n\nIMPORTANT: Generate COMPLETELY DIFFERENT topics than typical suggestions. Focus on overlooked but critical preparation areas. Timestamp: ${Date.now()}`
    : '';

  const prompt = `You are an expert interview coach. Generate exactly 6 highly specific, actionable preparation topics.

**Candidate Profile:**
- Position: ${position}
- Seniority Level: ${seniority.toUpperCase()}
- Role Family: ${roleFamily.replace(/_/g, ' ')}
- Interview Stage: ${stageDisplay}
${company ? `- Company: ${company}` : ''}

**Role-Specific Context:**
${roleContext}

**Requirements:**
1. Topics must be SPECIFIC to the ${seniority} ${roleFamily.replace(/_/g, ' ')} role, not generic advice
2. Each topic must be actionable and completable in 30min-2hrs
3. Include specific tools, frameworks, techniques, or resources relevant to ${roleFamily.replace(/_/g, ' ')}
4. Consider what a ${seniority}-level candidate should demonstrate
5. Focus on what will actually help pass this ${stageDisplay} stage
${variationPrompt}

**Format:** Return ONLY a JSON array of 6 strings. No markdown, no explanation, no numbering.

Example format: ["Topic 1", "Topic 2", "Topic 3", "Topic 4", "Topic 5", "Topic 6"]`;

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
            content: 'You are an expert interview coach. Return ONLY valid JSON arrays of strings. No markdown formatting.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 800,
        temperature: forceNewGeneration ? 1.0 : 0.8,
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
      console.log('[PrepChecklist] Empty LLM response');
      return null;
    }
    
    // Parse JSON response
    let topics: string[];
    try {
      // Handle both raw array and markdown-wrapped responses
      const jsonMatch = content.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        topics = JSON.parse(jsonMatch[0]);
      } else {
        console.log('[PrepChecklist] No JSON array found in response');
        return null;
      }
    } catch (parseError) {
      console.log('[PrepChecklist] JSON parse error:', parseError);
      return null;
    }
    
    // Validate
    if (!Array.isArray(topics) || topics.length < 4) {
      console.log('[PrepChecklist] Invalid topics array');
      return null;
    }
    
    console.log('[PrepChecklist] Successfully generated LLM topics');
    
    return topics.slice(0, 6).map((text, index) => ({
      id: `ai_${Date.now()}_${index}`,
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

const getRoleSpecificContext = (roleFamily: RoleFamily, stage: string, seniority: SeniorityLevel): string => {
  const stageLower = stage.toLowerCase();
  
  const contexts: { [key: string]: { [stage: string]: string } } = {
    software_engineering: {
      system_design: seniority === 'senior' || seniority === 'executive'
        ? 'Focus on: distributed systems at scale, handling millions of concurrent requests, load balancing strategies, database sharding, caching layers (Redis/Memcached), API rate limiting (token bucket, leaky bucket), microservices patterns, event-driven architecture, CAP theorem trade-offs.'
        : 'Focus on: basic system components (load balancers, caches, databases), simple scaling strategies, understanding when to use SQL vs NoSQL, basic API design.',
      coding_round_1: 'Focus on: data structures (arrays, hashmaps, trees), algorithms (sorting, searching, dynamic programming), Big-O analysis, code optimization, clean code practices.',
      behavioural: 'Focus on: technical leadership, code review practices, mentoring, handling technical debt, collaboration with product/design, incident response.',
    },
    program_management: {
      system_design: seniority === 'senior' || seniority === 'executive'
        ? 'Focus on: program architecture discussions, cross-team coordination strategies, technical risk management, requirements decomposition, integration planning, trade-off decisions between scope/timeline/quality.'
        : 'Focus on: understanding technical dependencies, project planning with engineering teams, basic system integration concepts, Agile at scale.',
      behavioural: 'Focus on: stakeholder management, conflict resolution, driving accountability, managing ambiguity, cross-functional influence, executive communication.',
    },
    healthcare_clinical: {
      clinical: seniority === 'senior' || seniority === 'executive'
        ? 'Focus on: complex patient scenarios, clinical decision-making under pressure, quality improvement leadership, regulatory compliance, staff management, ethical dilemmas.'
        : 'Focus on: patient assessment skills, clinical protocols, medication safety, communication with patients and families, documentation standards.',
      behavioural: 'Focus on: patient advocacy, handling difficult situations, stress management, teamwork in clinical settings, continuous learning.',
    },
    aerospace: {
      technical_screen: seniority === 'senior' || seniority === 'executive'
        ? 'Focus on: systems engineering, certification processes (DO-178C, FAA), flight dynamics, propulsion systems, V&V processes, safety-critical design.'
        : 'Focus on: aerospace fundamentals, design tools (CATIA, MATLAB), materials science, basic flight mechanics, testing processes.',
      system_design: 'Focus on: requirements traceability, interface control, redundancy design, environmental qualification, integration testing, safety analysis (FMEA, FTA).',
    },
    data_science: {
      technical_screen: seniority === 'senior' || seniority === 'executive'
        ? 'Focus on: ML at scale, model deployment (MLOps), A/B testing design, feature engineering strategies, ML ethics, business impact measurement.'
        : 'Focus on: supervised/unsupervised learning basics, Python/pandas proficiency, SQL skills, basic statistics, model evaluation metrics.',
      behavioural: 'Focus on: translating business problems to ML solutions, communicating insights to non-technical stakeholders, handling data quality issues.',
    },
    finance: {
      technical_screen: seniority === 'senior' || seniority === 'executive'
        ? 'Focus on: financial modeling (DCF, LBO), M&A analysis, strategic financial planning, risk management frameworks, executive presentations.'
        : 'Focus on: financial statement analysis, Excel modeling, budgeting and forecasting, basic accounting principles.',
      case_study: 'Focus on: financial frameworks, valuation methods, industry analysis, presenting investment recommendations.',
    },
    consulting: {
      case_study: 'Focus on: MECE problem structuring, hypothesis-driven analysis, market sizing, profitability analysis, M&A cases, presenting recommendations.',
      behavioural: 'Focus on: client management, working in ambiguous situations, fast-paced delivery, teamwork, receiving feedback.',
    },
  };
  
  return contexts[roleFamily]?.[stageLower] || 
    `Focus on demonstrating ${seniority}-level competencies appropriate for ${roleFamily.replace(/_/g, ' ')} roles.`;
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
  const [refreshCount, setRefreshCount] = useState(0);
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
  }, [visible, stage, position]);
  
  const loadTopics = async (forceRefresh: boolean) => {
    setLoading(true);
    
    // Try LLM generation first
    const llmTopics = await generateLLMTopics(stage, position, company, forceRefresh);
    
    if (mountedRef.current) {
      if (llmTopics && llmTopics.length >= 4) {
        setFocusAreas(llmTopics);
        setIsAiGenerated(true);
      } else {
        // Use comprehensive fallback
        const fallbackTopics = generateFallbackTopics(
          stage, 
          position, 
          company, 
          forceRefresh ? Date.now() : undefined
        );
        setFocusAreas(fallbackTopics);
        setIsAiGenerated(false);
      }
      setLoading(false);
    }
  };
  
  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshCount(prev => prev + 1);
    
    // Always try LLM with force flag for completely new topics
    const llmTopics = await generateLLMTopics(stage, position, company, true);
    
    if (mountedRef.current) {
      if (llmTopics && llmTopics.length >= 4) {
        setFocusAreas(llmTopics);
        setIsAiGenerated(true);
      } else {
        // Generate fallback with different seed each time
        const fallbackTopics = generateFallbackTopics(
          stage, 
          position, 
          company, 
          Date.now() + refreshCount
        );
        setFocusAreas(fallbackTopics);
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
  const seniority = detectSeniority(position);
  const roleFamily = detectRoleFamily(position);
  
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
        
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={[styles.title, { color: colors.text }]}>
                Preparation Focus Areas
              </Text>
              <View style={styles.headerMeta}>
                <Text style={[styles.stageName, { color: colors.primary }]}>
                  {formatStageName(stage)}
                </Text>
              </View>
              {position && (
                <Text style={[styles.positionName, { color: colors.textSecondary }]} numberOfLines={1}>
                  {position}
                </Text>
              )}
            </View>
            <TouchableOpacity 
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          {/* Context badges */}
          <View style={[styles.metaBar, { borderBottomColor: colors.border }]}>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: colors.primary + '15' }]}>
                <Text style={[styles.badgeText, { color: colors.primary }]}>
                  {seniority.charAt(0).toUpperCase() + seniority.slice(1)}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: colors.textSecondary + '15' }]}>
                <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                  {roleFamily.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Text>
              </View>
              {company && (
                <View style={[styles.badge, { backgroundColor: colors.textSecondary + '15' }]}>
                  <Ionicons name="business-outline" size={12} color={colors.textSecondary} />
                  <Text style={[styles.badgeText, { color: colors.textSecondary, marginLeft: 4 }]}>
                    {company}
                  </Text>
                </View>
              )}
            </View>
            {urgency && (
              <View style={[styles.urgencyBadge, { backgroundColor: urgency.color + '20' }]}>
                <Text style={[styles.urgencyText, { color: urgency.color }]}>
                  {urgency.text}
                </Text>
              </View>
            )}
          </View>
          
          {/* Topics List */}
          <ScrollView style={styles.topicsList} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Generating personalized topics...
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
              disabled={refreshing || loading}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="refresh" size={18} color={colors.primary} />
                  <Text style={[styles.refreshText, { color: colors.primary }]}>
                    New Topics
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
                {isAiGenerated ? 'AI-personalized for your profile' : 'Role-specific preparation tips'}
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
    maxHeight: '85%',
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
  },
  stageName: {
    fontSize: 14,
    fontWeight: '600',
  },
  positionName: {
    fontSize: 13,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  metaBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
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
