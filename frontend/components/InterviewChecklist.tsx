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
// CONFIG
// ============================================================================

const EMERGENT_LLM_KEY = 'sk-emergent-66a2f7f8f020eDaA7B';
const LLM_API_URL = 'https://api.openai.com/v1/chat/completions';
const LLM_TIMEOUT_MS = 10000;

const STAGE_NAMES: Record<string, string> = {
  recruiter_screening: 'Recruiter Screening',
  phone_screen: 'Phone Screen',
  technical_screen: 'Technical Screen',
  technical_round: 'Technical Round',
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
// IMPROVED ROLE DETECTION - More specific patterns
// ============================================================================

type Seniority = 'executive' | 'senior' | 'mid' | 'junior';
type RoleType = 
  | 'software' | 'software_architect' | 'data' | 'ml_engineer' | 'dba' | 'product' | 'program' | 'tpm' | 'pmo' | 'project_mgmt' | 'design'
  | 'professional_services' | 'solutions_architect' | 'customer_success'
  | 'mechanical' | 'aerospace' | 'electrical_hw' | 'chemical' | 'civil'
  | 'clinical' | 'pharmacist' | 'accounting' | 'finance' | 'consulting' | 'sales'
  | 'marketing' | 'hr' | 'legal' | 'admin' | 'operations' | 'general';

const detectSeniority = (pos: string): Seniority => {
  const p = pos.toLowerCase();
  // Executive level - SVP, VP, C-suite, Director, Principal, Staff
  if (/\b(svp|senior vice president|evp|executive vice president|vp\b|vice president|director|head of|chief|cto|ceo|cfo|coo|cmo|cpo|cro|principal|staff|distinguished|fellow|partner)\b/.test(p)) return 'executive';
  // Senior level
  if (/\b(senior|sr\.?|lead|manager|architect|ii|iii|iv|2|3|4)\b/.test(p)) return 'senior';
  // Junior level
  if (/\b(junior|jr\.?|associate|entry|intern|graduate|trainee|apprentice|i\b|1\b)\b/.test(p)) return 'junior';
  return 'mid';
};

const detectRole = (pos: string): RoleType => {
  const p = pos.toLowerCase();
  
  // SOFTWARE ARCHITECT - Check first as it's more specific
  if (/\b(software architect|solution architect|systems architect|enterprise architect|technical architect|platform architect|cloud architect)\b/.test(p)) {
    return 'software_architect';
  }
  
  // SOLUTIONS ARCHITECT / PROFESSIONAL SERVICES
  if (/\b(solutions architect|solutions eng|professional services|implementation|customer success eng|technical account|field eng|sales eng)\b/.test(p)) {
    return 'solutions_architect';
  }
  
  // PROFESSIONAL SERVICES (broader)
  if (/\b(professional services|consulting eng|services eng|delivery|implementation manager|customer eng)\b/.test(p)) {
    return 'professional_services';
  }
  
  // TECHNICAL PROGRAM MANAGEMENT - Check before general program
  if (/\b(technical program|tpm|technical project)\b/.test(p)) {
    return 'tpm';
  }
  
  // ML/AI ENGINEER - More specific than general data
  if (/\b(ml engineer|machine learning eng|ai engineer|deep learning eng|mlops|ml ops)\b/.test(p)) {
    return 'ml_engineer';
  }
  
  // DATABASE ADMINISTRATOR / DBA
  if (/\b(dba|database admin|database engineer|db admin|database architect|sql server admin|oracle dba|mysql admin|postgres admin|mongodb admin|data architect)\b/.test(p)) {
    return 'dba';
  }
  
  // SOFTWARE - Must have software-specific keywords, not just "engineer"
  if (/\b(software|developer|programmer|coder|full.?stack|front.?end|back.?end|web dev|mobile dev|ios dev|android dev|devops|sre|site reliability|platform eng|cloud eng|swe\b|sde\b)\b/.test(p)) {
    return 'software';
  }
  
  // DATA SCIENCE / Analytics (not ML Engineer which is caught above)
  if (/\b(data scientist|data science|data anal|business intel|bi analyst|statistician|quantitative|data eng|analytics eng)\b/.test(p)) {
    return 'data';
  }
  
  // AEROSPACE - Turbine, propulsion, flight, aircraft, rockets, avionics
  if (/\b(aerospace|turbine|propulsion|jet eng|rocket|spacecraft|satellite|avionics|flight|aerodynamic|aircraft|aviation|astronaut)\b/.test(p)) {
    return 'aerospace';
  }
  
  // MECHANICAL - Manufacturing, CAD, thermal, HVAC, automotive
  if (/\b(mechanical|mech eng|manufacturing|cad|solidworks|thermal|hvac|automotive|vehicle|powertrain|robotics|automation eng)\b/.test(p)) {
    return 'mechanical';
  }
  
  // ELECTRICAL HARDWARE - Not software, circuits, PCB, power systems
  if (/\b(electrical eng|ee\b|hardware eng|pcb|circuit|power system|embedded|firmware|asic|fpga|rf eng|signal)\b/.test(p) && !/software/.test(p)) {
    return 'electrical_hw';
  }
  
  // CHEMICAL - Process, chemistry, pharmaceutical, biotech
  if (/\b(chemical eng|process eng|chemistry|pharmaceutical|biotech|biochem|materials sci|polymer|petrochemical)\b/.test(p)) {
    return 'chemical';
  }
  
  // CIVIL - Construction, structural, environmental, geotechnical
  if (/\b(civil eng|structural|construction|geotechnical|environmental eng|transportation eng|water resource|surveyor)\b/.test(p)) {
    return 'civil';
  }
  
  // CLINICAL / HEALTHCARE - Added many medical specialties
  if (/\b(nurse|rn\b|lpn|np\b|physician|doctor|md\b|surgeon|clinician|therapist|pharmacist|dentist|medical|healthcare|patient care|clinical|pediatrician|cardiologist|neurologist|oncologist|radiologist|anesthesiologist|dermatologist|psychiatrist|psychologist|optometrist|ophthalmologist|gynecologist|obstetrician|urologist|orthopedic|emt|paramedic|phlebotomist|sonographer|technologist|pathologist|veterinarian|chiropractor|podiatrist|midwife|dietitian|nutritionist|respiratory|occupational|physical therapist|speech therapist|audiologist|social worker|counselor|cna|lvn|aprn|pa\b|physician assistant)\b/.test(p)) {
    return 'clinical';
  }
  
  // ACCOUNTING
  if (/\b(accountant|accounting|cpa\b|auditor|tax|bookkeep|controller|accounts payable|accounts receivable|billing)\b/.test(p)) {
    return 'accounting';
  }
  
  // FINANCE / INVESTMENT
  if (/\b(financial analyst|investment|banker|trading|portfolio|equity|credit|underwriter|actuary|wealth|asset manage|private equity|venture capital)\b/.test(p)) {
    return 'finance';
  }
  
  // CONSULTING
  if (/\b(consultant|consulting|advisory|strategy|mckinsey|bain|bcg|deloitte|accenture|pwc|ey\b|kpmg)\b/.test(p)) {
    return 'consulting';
  }
  
  // PRODUCT MANAGEMENT
  if (/\b(product manager|product owner|pm\b|product lead|product director)\b/.test(p) && !/program|project/.test(p)) {
    return 'product';
  }
  
  // PROGRAM / PROJECT MANAGEMENT
  if (/\b(program manager|project manager|pmp|scrum master|agile coach|delivery manager|tpm|technical program)\b/.test(p)) {
    return 'program';
  }
  
  // DESIGN - UX, UI, graphic, industrial
  if (/\b(designer|ux|ui|user experience|user interface|graphic|visual|creative|industrial design|product design)\b/.test(p)) {
    return 'design';
  }
  
  // SALES
  if (/\b(sales|account exec|ae\b|bdr|sdr|business develop|customer success|account manager|territory)\b/.test(p)) {
    return 'sales';
  }
  
  // MARKETING
  if (/\b(marketing|growth|brand|content|seo|sem|digital market|social media|communications|pr\b|public relations)\b/.test(p)) {
    return 'marketing';
  }
  
  // HR
  if (/\b(human resource|hr\b|recruiter|talent|people ops|hrbp|compensation|benefits|payroll|training|l&d)\b/.test(p)) {
    return 'hr';
  }
  
  // LEGAL
  if (/\b(lawyer|attorney|legal|counsel|paralegal|compliance|contract|litigation)\b/.test(p)) {
    return 'legal';
  }
  
  // ADMIN / ASSISTANT
  if (/\b(admin|assistant|coordinator|secretary|receptionist|office manager|executive assistant|ea\b)\b/.test(p)) {
    return 'admin';
  }
  
  // OPERATIONS / SUPPLY CHAIN
  if (/\b(operations|supply chain|logistics|procurement|warehouse|inventory|fulfillment|distribution)\b/.test(p)) {
    return 'operations';
  }
  
  // Check for generic "engineer" without specific type - likely hardware/general engineering
  if (/\bengineer\b/.test(p) && !/software|data|product|program/.test(p)) {
    // Could be mechanical, check context
    if (/\b(boeing|lockheed|northrop|raytheon|spacex|nasa|airbus|ge aviation|rolls.?royce|pratt|engine)\b/.test(p)) {
      return 'aerospace';
    }
    return 'mechanical'; // Default generic engineer to mechanical
  }
  
  return 'general';
};

const getRoleDisplayName = (role: RoleType): string => {
  const names: Record<RoleType, string> = {
    software: 'Software',
    software_architect: 'SW Architect',
    data: 'Data/Analytics',
    ml_engineer: 'ML Engineer',
    product: 'Product',
    program: 'Program Mgmt',
    tpm: 'Tech Program',
    design: 'Design',
    professional_services: 'Prof Services',
    solutions_architect: 'Solutions',
    mechanical: 'Mechanical',
    aerospace: 'Aerospace',
    electrical_hw: 'Electrical',
    chemical: 'Chemical',
    civil: 'Civil',
    clinical: 'Clinical',
    accounting: 'Accounting',
    finance: 'Finance',
    consulting: 'Consulting',
    sales: 'Sales',
    marketing: 'Marketing',
    hr: 'HR',
    legal: 'Legal',
    admin: 'Admin',
    operations: 'Operations',
    general: 'General',
  };
  return names[role] || 'General';
};

// ============================================================================
// COMPREHENSIVE TOPIC POOLS BY ROLE + STAGE + SENIORITY
// ============================================================================

interface TopicPool {
  [role: string]: {
    [stage: string]: {
      [seniority: string]: string[];
    };
  };
}

const TOPIC_POOLS: TopicPool = {
  // ==================== AEROSPACE ENGINEERING ====================
  aerospace: {
    technical_screen: {
      executive: [
        'Review your experience leading aircraft/spacecraft certification programs (FAA, EASA, NASA)',
        'Prepare to discuss systems engineering at program level: requirements flow, V&V strategy',
        'Document major technical decisions on propulsion or structures programs',
        'Review DO-178C/DO-254 compliance leadership experience',
        'Prepare examples of managing technical risk on safety-critical systems',
        'Document experience with flight test programs and certification milestones',
        'Review your approach to supplier technical management for aerospace components',
        'Prepare to discuss integration challenges across avionics, structures, propulsion',
      ],
      senior: [
        'Review turbine/engine thermodynamics: Brayton cycle efficiency, compressor maps, turbine cooling',
        'Prepare to discuss blade design: stress analysis, creep, thermal fatigue, material selection',
        'Study CFD analysis for aerodynamic optimization: mesh quality, turbulence models, validation',
        'Review structural analysis: FEA fundamentals, fatigue life prediction, damage tolerance',
        'Prepare examples of root cause analysis for component failures',
        'Document experience with GD&T and tolerance stack-up analysis',
        'Review propulsion performance: thrust specific fuel consumption, efficiency optimization',
        'Prepare to discuss materials: superalloys, composites, coatings for high-temperature applications',
        'Study vibration analysis: modal analysis, forced response, flutter prevention',
        'Review your experience with test planning: instrumentation, data acquisition, correlation',
        'Prepare to discuss design for manufacturability in aerospace components',
        'Document experience with configuration management and change control',
      ],
      mid: [
        'Review fundamentals: compressible flow, shock waves, boundary layers, heat transfer',
        'Study turbine components: compressor stages, combustor design, turbine blade cooling',
        'Prepare to discuss your CAD experience: CATIA, NX, or SolidWorks for aerospace',
        'Review materials science: aluminum alloys, titanium, nickel superalloys, composites',
        'Document FEA experience: static, dynamic, thermal analysis',
        'Prepare to explain a technical project: design, analysis, testing, iteration',
        'Study aerospace standards: AS9100, AMS specifications, ASTM standards',
        'Review your experience with engineering drawings and GD&T',
        'Prepare to discuss failure modes: fatigue, corrosion, foreign object damage',
        'Document any hands-on test or lab experience',
      ],
      junior: [
        'Review aerospace fundamentals from coursework: aerodynamics, structures, propulsion',
        'Study gas turbine basics: compression, combustion, expansion, efficiency',
        'Prepare to discuss senior design project in detail: your role, challenges, outcomes',
        'Review basic thermodynamics: first/second law, cycle analysis, efficiency calculations',
        'Document CAD and analysis tool experience (CATIA, MATLAB, ANSYS)',
        'Prepare to explain your interest in aerospace and this specific company/role',
        'Study the company\'s products: aircraft models, engine programs, space systems',
        'Review basic materials: properties, selection criteria, common aerospace materials',
        'Prepare questions about the team\'s current projects and technologies',
        'Document any internship or co-op experience in aerospace',
      ],
    },
    technical_round: {
      senior: [
        'Review turbine thermodynamics in depth: stage loading, efficiency maps, off-design performance',
        'Prepare to solve heat transfer problems: convection coefficients, fin effectiveness, thermal resistance',
        'Study compressor aerodynamics: stage matching, surge margin, stall prediction',
        'Review structural mechanics: stress concentration factors, fatigue notch factors, lifing methods',
        'Prepare to discuss combustor design: flame stability, emissions, liner cooling',
        'Document experience with engine performance analysis: cycle matching, component maps',
        'Review rotor dynamics: critical speeds, balancing, bearing design',
        'Prepare whiteboard calculations: thrust, efficiency, pressure ratios, temperature ratios',
        'Study secondary air systems: sealing, cooling flows, cavity purge',
        'Review your approach to design trade studies: weight vs cost vs performance',
      ],
      mid: [
        'Review core thermodynamics: isentropic relations, polytropic efficiency, stage loading',
        'Prepare to solve basic heat transfer problems: conduction, convection, radiation',
        'Study fluid mechanics: Bernoulli, compressible flow relations, nozzle flow',
        'Review stress analysis basics: principal stresses, failure theories, safety factors',
        'Prepare to discuss a component design you worked on: requirements, analysis, results',
        'Document your understanding of turbine blade cooling techniques',
        'Review materials selection criteria for high-temperature applications',
        'Prepare to explain manufacturing processes: casting, forging, machining for aerospace',
        'Study the company\'s engine programs and recent technical achievements',
        'Review engineering calculations you should be able to do by hand',
      ],
      junior: [
        'Review thermodynamics: ideal gas law, first law, second law, entropy',
        'Study basic fluid mechanics: conservation laws, Bernoulli equation, pipe flow',
        'Prepare to solve simple heat transfer problems',
        'Review statics and mechanics of materials: free body diagrams, stress/strain',
        'Document coursework projects that demonstrate engineering fundamentals',
        'Prepare to discuss your engineering problem-solving approach',
        'Study basic manufacturing processes: casting, machining, joining',
        'Review the company and prepare thoughtful technical questions',
        'Prepare to explain what interests you about turbine/aerospace engineering',
        'Document any lab experience with testing, measurement, or data analysis',
      ],
    },
    behavioural: {
      senior: [
        'Prepare STAR story about solving a complex technical problem on an engine/aircraft program',
        'Document experience working with cross-functional teams: design, test, manufacturing, suppliers',
        'Review a time you identified a design issue and drove the solution',
        'Prepare story about meeting aggressive program schedule with quality',
        'Document mentoring or technical leadership examples',
        'Review how you\'ve handled disagreements with other engineers on technical approaches',
        'Prepare example of adapting to changing requirements or priorities',
        'Document your approach to continuous learning in aerospace technology',
      ],
      mid: [
        'Prepare stories demonstrating technical problem-solving on real projects',
        'Document teamwork examples: your role, collaboration, technical outcomes',
        'Review a time you learned a new skill or tool quickly for a project',
        'Prepare story about handling a technical setback or failed test',
        'Document your attention to detail catching errors or issues',
        'Review examples of working under schedule pressure',
        'Prepare to discuss your career goals in aerospace engineering',
        'Document any safety-conscious decisions or actions',
      ],
    },
  },

  // ==================== MECHANICAL ENGINEERING ====================
  mechanical: {
    technical_screen: {
      senior: [
        'Review machine design fundamentals: shaft design, bearing selection, gear analysis',
        'Prepare to discuss FEA experience: mesh convergence, boundary conditions, result interpretation',
        'Study thermal management: heat exchanger design, thermal expansion, cooling strategies',
        'Review GD&T mastery: datum selection, tolerance stack-ups, functional gauging',
        'Prepare examples of DFM/DFA: designing for manufacturing and assembly',
        'Document experience with product development lifecycle: concept to production',
        'Review fatigue analysis: S-N curves, Miner\'s rule, mean stress effects',
        'Prepare to discuss materials selection: metals, plastics, composites for applications',
        'Study mechanism design: linkages, cams, kinematic analysis',
        'Review your experience with test correlation: predicted vs measured results',
        'Prepare to discuss root cause analysis and corrective action processes',
        'Document supplier technical management experience',
      ],
      mid: [
        'Review mechanics of materials: stress/strain, Mohr\'s circle, failure theories',
        'Study thermodynamics fundamentals: heat transfer modes, thermal resistance networks',
        'Prepare to discuss CAD proficiency: SolidWorks, CATIA, NX features you use',
        'Review basic FEA: element types, mesh quality, interpreting results',
        'Document your understanding of common manufacturing processes',
        'Prepare to explain technical projects: design intent, analysis, validation',
        'Study materials: mechanical properties, selection criteria, testing methods',
        'Review GD&T basics: common tolerances, datums, fit requirements',
        'Prepare to discuss your approach to design trade-offs',
        'Document any hands-on building, testing, or prototyping experience',
      ],
      junior: [
        'Review statics: free body diagrams, equilibrium, reaction forces',
        'Study mechanics of materials: axial, shear, bending, torsion',
        'Prepare to discuss senior design project or capstone in detail',
        'Review thermodynamics basics: first law, heat transfer fundamentals',
        'Document CAD experience and proficiency level',
        'Prepare to explain engineering fundamentals clearly',
        'Study basic manufacturing: machining, casting, sheet metal, 3D printing',
        'Review the company\'s products and prepare relevant questions',
        'Document any internship or co-op experience',
        'Prepare to demonstrate problem-solving approach with examples',
      ],
    },
    technical_round: {
      senior: [
        'Prepare to solve machine design problems: shaft sizing, bearing life, gear calculations',
        'Review structural analysis: combined loading, stress concentration, fatigue',
        'Study heat transfer problems: fins, heat exchangers, transient analysis',
        'Prepare whiteboard calculations: deflection, natural frequency, thermal expansion',
        'Review failure analysis: fracture mechanics, wear mechanisms, corrosion',
        'Document your design calculation methods and hand calculation abilities',
        'Prepare to discuss trade-off analysis: weight, cost, performance, reliability',
        'Review vibration analysis: SDOF systems, isolation, damping',
        'Study mechanism kinematics and dynamics problems',
        'Prepare to explain your design philosophy and approach',
      ],
      mid: [
        'Review beam bending: deflection equations, moment diagrams, stress distribution',
        'Prepare to solve simple thermal problems: conduction, convection, radiation',
        'Study machine elements: bolted joints, welded connections, shaft design',
        'Review dynamics: kinematics, Newton\'s laws, energy methods',
        'Prepare to discuss FEA results interpretation and validation',
        'Document calculation methods for common mechanical problems',
        'Review materials selection for specific applications',
        'Prepare to explain your engineering design process',
        'Study the company\'s products and relevant technical challenges',
        'Review tolerance analysis and stack-up calculations',
      ],
    },
    behavioural: {
      senior: [
        'Prepare STAR story about leading a complex mechanical design project',
        'Document cross-functional collaboration: design, manufacturing, quality, suppliers',
        'Review a time you solved a difficult manufacturing or quality issue',
        'Prepare story about innovation or cost reduction in design',
        'Document mentoring experience and technical leadership',
        'Review handling design reviews and peer feedback',
        'Prepare example of balancing schedule pressure with design quality',
        'Document continuous improvement initiatives you\'ve driven',
      ],
      mid: [
        'Prepare stories demonstrating mechanical design problem-solving',
        'Document teamwork on engineering projects',
        'Review a challenging technical problem and your solution',
        'Prepare story about learning new tools or methods',
        'Document attention to detail examples',
        'Review handling design changes and iterations',
        'Prepare to discuss career interests in mechanical engineering',
        'Document any hands-on manufacturing or testing experience',
      ],
    },
  },

  // ==================== CLINICAL / HEALTHCARE ====================
  clinical: {
    clinical: {
      executive: [
        'Prepare to discuss departmental/practice leadership: quality metrics, patient outcomes, staff development',
        'Review your experience with clinical program development and service line growth',
        'Document examples of physician/staff recruitment, retention, and performance management',
        'Prepare to discuss your approach to evidence-based medicine implementation',
        'Review budget management for clinical departments: FTEs, equipment, supplies',
        'Document quality improvement initiatives with measurable outcomes (mortality, readmissions, HCAHPS)',
        'Prepare to discuss regulatory compliance: Joint Commission, CMS, state requirements',
        'Review your leadership in peer review, credentialing, or medical staff committees',
        'Document experience with clinical informatics and EHR optimization',
        'Prepare to discuss your vision for the department/practice',
      ],
      senior: [
        'Prepare complex patient case presentations demonstrating clinical reasoning in your specialty',
        'Review differential diagnosis approaches for common and uncommon presentations',
        'Document examples of managing medically complex patients with multiple comorbidities',
        'Prepare to discuss your approach to patient communication and shared decision-making',
        'Review medication management: prescribing practices, interactions, monitoring',
        'Document experience mentoring residents, students, or junior colleagues',
        'Prepare examples of handling difficult cases: diagnostic uncertainty, treatment failures',
        'Review your participation in quality improvement, morbidity/mortality conferences',
        'Document experience with specialty-specific procedures and their complications',
        'Prepare to discuss ethical dilemmas: end-of-life care, resource allocation, autonomy',
        'Review your approach to staying current: journals, CME, conferences',
        'Document interdisciplinary collaboration: consulting services, care coordination',
      ],
      mid: [
        'Review clinical assessment frameworks and history-taking techniques for your specialty',
        'Prepare patient cases demonstrating your clinical judgment and decision-making',
        'Document your approach to common presentations in your specialty',
        'Review pharmacology: first-line treatments, drug interactions, special populations',
        'Prepare to discuss your documentation practices and EHR workflows',
        'Study evidence-based guidelines relevant to your specialty (ACEP, AAP, ACC, etc.)',
        'Document examples of effective patient/family communication',
        'Review interdisciplinary collaboration: nurses, specialists, social work, case management',
        'Prepare examples of recognizing and responding to clinical deterioration',
        'Document your approach to managing patient load and prioritization',
      ],
      junior: [
        'Review core clinical competencies from your training program',
        'Prepare examples from rotations demonstrating clinical reasoning',
        'Study common diagnoses and evidence-based treatments in the specialty',
        'Review patient safety fundamentals and when to escalate concerns',
        'Document your clinical interests and why this specialty',
        'Prepare to discuss how you handle stressful clinical situations',
        'Review basic pharmacology and prescribing principles',
        'Document your approach to asking questions and seeking guidance',
        'Prepare questions about supervision, support, and practice structure',
        'Review the organization: patient population, services, culture',
      ],
    },
    technical_screen: {
      executive: [
        'Prepare to discuss clinical program metrics and quality outcomes you\'ve achieved',
        'Review your experience with accreditation surveys and regulatory requirements',
        'Document leadership in implementing new clinical protocols or technologies',
        'Prepare to discuss your approach to clinical staff development and training',
        'Review experience with clinical research or quality improvement projects',
        'Document EHR and clinical informatics leadership experience',
      ],
      senior: [
        'Review complex clinical scenarios requiring advanced diagnostic workup',
        'Prepare to discuss specialty board certification and maintenance of certification',
        'Document experience with specialty-specific procedures: indications, technique, complications',
        'Review evidence-based practice changes you\'ve championed',
        'Prepare to discuss quality metrics and clinical outcomes in your practice',
        'Document experience with clinical decision support and protocols',
        'Review your approach to diagnostic testing: appropriate use, interpretation',
        'Prepare examples of managing rare or unusual cases',
      ],
      mid: [
        'Review clinical procedures and skills expected for this position',
        'Prepare to discuss your clinical experience and patient volumes',
        'Document certifications: board status, BLS, ACLS, specialty certs',
        'Review your experience with common conditions in this specialty',
        'Prepare to discuss your clinical workflow and documentation practices',
        'Document EHR proficiency and any clinical informatics experience',
        'Review evidence-based guidelines you follow in practice',
        'Prepare to discuss your approach to clinical uncertainty',
      ],
      junior: [
        'Review clinical competencies expected at your training level',
        'Prepare to discuss your clinical rotations and patient experiences',
        'Document any certifications: BLS, ACLS, procedure training',
        'Review common presentations you should know at this level',
        'Prepare to discuss your clinical reasoning approach',
        'Document EHR experience from training',
        'Review supervision expectations and when to escalate',
        'Prepare questions about clinical duties and support structure',
      ],
    },
    behavioural: {
      executive: [
        'Prepare STAR stories about leading clinical teams through challenging situations',
        'Document examples of driving quality improvement with measurable outcomes',
        'Review handling conflicts between clinical and administrative priorities',
        'Prepare to discuss building high-performing clinical teams',
        'Document your approach to performance management and difficult conversations',
        'Review crisis leadership: pandemics, disasters, critical incidents',
        'Prepare examples of advocating for resources or policy changes',
        'Document collaboration with hospital/practice administration',
      ],
      senior: [
        'Prepare STAR stories about complex patient situations and positive outcomes',
        'Document examples of patient advocacy: challenging the system, escalating concerns',
        'Review handling ethical dilemmas: informed consent, capacity, end-of-life',
        'Prepare story about teaching or mentoring trainees effectively',
        'Document commitment to continuous learning and professional development',
        'Review interprofessional collaboration and conflict resolution',
        'Prepare examples of responding to medical emergencies or codes',
        'Document quality improvement projects you\'ve initiated or led',
        'Review handling medical errors: disclosure, system improvement',
        'Prepare story about managing a difficult diagnostic or treatment challenge',
      ],
      mid: [
        'Prepare patient care stories demonstrating clinical competence and compassion',
        'Document teamwork and collaboration in clinical settings',
        'Review handling difficult patient or family situations professionally',
        'Prepare story about managing high patient volumes or stressful shifts',
        'Document your commitment to professional growth and learning',
        'Review examples of effective communication with the care team',
        'Prepare to discuss work-life balance in clinical practice',
        'Document learning from errors or near-misses constructively',
        'Review examples of adapting to changing clinical situations',
        'Prepare story about going above and beyond for a patient',
      ],
      junior: [
        'Prepare stories from clinical rotations showing compassion and professionalism',
        'Document examples of handling challenging patient interactions',
        'Review why you chose this specialty and clinical setting',
        'Prepare to discuss how you handle clinical stress and uncertainty',
        'Document mentors who influenced your clinical development',
        'Review examples of working effectively in clinical teams',
        'Prepare story about learning from a clinical mistake',
        'Document your approach to feedback and continuous improvement',
        'Prepare questions about mentorship and professional development',
        'Review your long-term career goals in clinical medicine',
      ],
    },
    hiring_manager: {
      senior: [
        'Research the hiring manager: clinical background, leadership style, department priorities',
        'Prepare a 30-60-90 day plan: orientation, establishing practice, contributions',
        'Document your approach to integrating into an existing clinical team',
        'Prepare questions about patient volume, case mix, and call schedule',
        'Review the organizational structure and reporting relationships',
        'Prepare to discuss your clinical philosophy and practice style',
        'Document how you build relationships with nursing and support staff',
        'Prepare questions about performance expectations and metrics',
      ],
      mid: [
        'Research the practice or department and hiring manager',
        'Prepare to discuss how you\'d ramp up in this clinical environment',
        'Document questions about typical patient volume and case complexity',
        'Prepare to discuss your clinical strengths and areas for growth',
        'Review the team structure and collaboration expectations',
        'Prepare questions about supervision, support, and mentorship',
        'Document your career goals and how this position fits',
        'Prepare to discuss call schedule, coverage, and work-life balance',
      ],
    },
  },

  // ==================== ACCOUNTING ====================
  accounting: {
    technical_screen: {
      senior: [
        'Review complex accounting standards: revenue recognition (ASC 606), leases (ASC 842)',
        'Prepare to discuss technical accounting research and memo writing',
        'Document experience with consolidations, intercompany eliminations, foreign currency',
        'Review internal controls: SOX compliance, control design, testing',
        'Prepare examples of audit management and external auditor relationships',
        'Document ERP experience: SAP, Oracle, NetSuite - implementation or optimization',
        'Review financial close process leadership: timeline, reconciliations, reporting',
        'Prepare to discuss accounting policy decisions and their rationale',
        'Document experience with equity accounting, stock compensation, M&A accounting',
        'Review your approach to managing and developing accounting teams',
      ],
      mid: [
        'Review GAAP fundamentals: accrual accounting, matching principle, materiality',
        'Prepare to discuss month-end close process: journal entries, reconciliations',
        'Document experience with specific account areas: fixed assets, prepaids, accruals',
        'Review internal controls relevant to your areas of responsibility',
        'Prepare examples of identifying and resolving accounting discrepancies',
        'Document ERP and Excel skills relevant to the role',
        'Review audit preparation and working with external auditors',
        'Prepare to discuss your attention to detail and accuracy',
        'Document process improvements you\'ve implemented',
        'Review the company\'s industry and relevant accounting considerations',
      ],
      junior: [
        'Review accounting fundamentals: debits/credits, journal entries, trial balance',
        'Prepare to discuss your accounting education and relevant coursework',
        'Document Excel proficiency: pivot tables, VLOOKUP, formulas',
        'Review basic financial statements: income statement, balance sheet, cash flow',
        'Prepare to explain month-end close activities at a basic level',
        'Document any internship or accounting experience',
        'Review the company and prepare questions about the accounting function',
        'Prepare to discuss your CPA plans and career goals',
        'Document attention to detail examples from school or work',
        'Review basic internal controls and why they matter',
      ],
    },
    behavioural: {
      senior: [
        'Prepare STAR stories about resolving complex accounting issues',
        'Document leadership examples: managing team, developing staff, driving results',
        'Review audit findings or control deficiencies you\'ve remediated',
        'Prepare story about meeting tight close deadlines under pressure',
        'Document cross-functional collaboration: FP&A, treasury, operations',
        'Review handling disagreements with auditors or management',
        'Prepare examples of process improvements with measurable impact',
        'Document your approach to managing and prioritizing multiple priorities',
      ],
      mid: [
        'Prepare stories demonstrating accuracy and attention to detail',
        'Document meeting deadlines in the close process',
        'Review resolving reconciliation discrepancies',
        'Prepare story about learning new accounting areas quickly',
        'Document teamwork and collaboration examples',
        'Review handling high-volume, deadline-driven work',
        'Prepare to discuss your career goals in accounting',
        'Document process improvement ideas you\'ve contributed',
      ],
    },
  },

  // ==================== SOFTWARE ENGINEERING ====================
  software: {
    technical_screen: {
      senior: [
        'Review your most complex technical project in depth for detailed questions',
        'Prepare to discuss architecture decisions: trade-offs, alternatives considered',
        'Study advanced language features in your primary language',
        'Review system design elements: caching, queuing, database choices',
        'Prepare to whiteboard solutions while explaining your reasoning',
        'Document debugging complex issues: tools, systematic approach',
        'Review testing strategies: unit, integration, e2e, coverage philosophy',
        'Prepare to discuss code review practices and quality standards',
        'Study performance optimization: profiling, bottleneck identification',
        'Review your primary framework in depth: internals, best practices',
      ],
      mid: [
        'Review data structures: arrays, hashmaps, trees, graphs - when to use each',
        'Prepare 3-5 minute technical explanation of your main projects',
        'Practice coding simple problems while explaining thought process',
        'Review OOP concepts: SOLID principles, design patterns used',
        'Study your language\'s standard library: collections, utilities',
        'Prepare technical questions about the company\'s stack',
        'Review debugging techniques: stack traces, debuggers, logging',
        'Prepare to discuss your development workflow: git, testing',
        'Study basic SQL: JOINs, aggregations, indexing',
        'Review API design basics: REST principles, error handling',
      ],
      junior: [
        'Review CS fundamentals: data structures, algorithms, Big-O',
        'Prepare to discuss coursework and personal projects',
        'Practice explaining technical concepts simply',
        'Review basic SQL: SELECT, WHERE, JOIN, GROUP BY',
        'Study git basics: commit, branch, merge, pull request',
        'Prepare to demonstrate debugging approach',
        'Review programming language syntax: loops, functions, classes',
        'Prepare questions about tech stack and learning opportunities',
        'Document any internship or project experience',
        'Study basic web concepts: HTTP, APIs, client-server',
      ],
    },
    system_design: {
      senior: [
        'Practice designing systems for 100K+ concurrent users: load balancing strategies',
        'Review database sharding: hash-based vs range-based trade-offs',
        'Prepare to implement API rate limiting: token bucket with Redis',
        'Study caching patterns: cache-aside, write-through, invalidation',
        'Practice capacity estimation: QPS, storage, bandwidth calculations',
        'Review message queue patterns: at-least-once vs exactly-once delivery',
        'Prepare microservices patterns: circuit breakers, bulkheads, retries',
        'Study database replication: leader-follower, failover, read replicas',
        'Review CDN architecture: edge caching, origin shielding',
        'Prepare notification system design: fanout, priority queues',
        'Study consistency models: eventual, read-your-writes, strong',
        'Review event-driven architecture: event sourcing, CQRS, sagas',
      ],
      mid: [
        'Study system components: load balancers (L4 vs L7), health checks',
        'Practice designing URL shortener: read/write optimization, analytics',
        'Review SQL vs NoSQL: PostgreSQL, MongoDB, Cassandra use cases',
        'Understand caching: Redis basics, TTL strategies, hit ratio',
        'Practice drawing clear system diagrams with data flow',
        'Learn to ask clarifying questions: QPS, latency requirements, consistency',
        'Study scaling: horizontal vs vertical, cost implications',
        'Review authentication: JWT, sessions, OAuth2 flows',
        'Practice chat application architecture design',
        'Study database indexing: primary, secondary, query optimization',
      ],
    },
    coding_round_1: {
      senior: [
        'Master sliding window: minimum window substring, longest substring',
        'Practice two-pointer: 3Sum, container with most water, trapping rain',
        'Review binary search variations: rotated array, peak element, range',
        'Study tree traversals: BFS level order, DFS paths, LCA',
        'Practice graph algorithms: cycle detection, topological sort, BFS shortest path',
        'Review dynamic programming: coin change, LIS, edit distance',
        'Master hashmap patterns: two sum, group anagrams, LRU cache',
        'Practice heap problems: merge k sorted, top k frequent, median finder',
        'Study interval problems: merge intervals, meeting rooms',
        'Review linked list: reverse in groups, cycle detection, merge sorted',
        'Practice backtracking: permutations, combinations, subsets',
        'Study monotonic stack: next greater element, largest rectangle',
      ],
      mid: [
        'Practice array problems: two sum, buy/sell stock, maximum subarray',
        'Master hashmap for O(1) lookups: frequency counting, duplicates',
        'Study two-pointer: palindrome, remove duplicates, reverse',
        'Practice string problems: reverse words, anagram, common prefix',
        'Review sorting: built-in sort, understanding O(n log n)',
        'Study recursion: base cases, recursive calls, visualization',
        'Practice linked list: reverse, middle node, cycle detection',
        'Review stack: valid parentheses, daily temperatures',
        'Study binary search: basic, search insert, first/last occurrence',
        'Practice matrix: rotate image, spiral order, 2D search',
      ],
    },
    behavioural: {
      senior: [
        'Map biggest project to STAR with quantified impact (latency %, cost savings)',
        'Prepare mentoring story: junior to senior engineer growth',
        'Document pushing back on requirements with data and alternatives',
        'Review production incident handling: detection, response, post-mortem',
        'Prepare technical disagreement story: conflict, approach, resolution',
        'Document tech debt vs features balancing decisions',
        'Prepare story about unclear/changing requirements delivery',
        'Review process improvements: code review, testing, CI/CD',
        'Document decision-making with incomplete information',
        'Prepare cross-functional collaboration story',
      ],
      mid: [
        'Prepare STAR stories: impact, teamwork, challenge, learning, initiative',
        'Quantify achievements: latency improved 40%, errors reduced 60%',
        'Document going above job description',
        'Prepare failure story: mistake, responsibility, specific changes',
        'Review working with difficult stakeholders',
        'Prepare career goals discussion',
        'Document receiving and acting on feedback',
        'Prepare working under pressure story',
        'Review proactive problem-solving examples',
        'Document helping teammates',
      ],
    },
  },

  // ==================== DATA SCIENCE / ML ====================
  data: {
    system_design: {
      senior: [
        'Review ML system design patterns: batch vs real-time inference, online vs offline training',
        'Prepare to design recommendation systems: collaborative filtering, content-based, hybrid',
        'Study feature store architecture: offline/online stores, feature freshness, consistency',
        'Review data pipeline design: streaming vs batch, Lambda vs Kappa architecture',
        'Prepare to design A/B testing infrastructure: randomization, sample size, metrics logging',
        'Document experience with ML model serving: latency optimization, model versioning, canary deploys',
        'Review data warehouse design: star schema, fact/dimension tables, query optimization',
        'Prepare to discuss ML training infrastructure: distributed training, GPU clusters, experiment tracking',
        'Study data quality systems: validation rules, monitoring, anomaly detection',
        'Review search and ranking system design: inverted index, relevance scoring, personalization',
        'Prepare to design fraud detection systems: feature engineering, real-time scoring, feedback loops',
        'Document experience with embeddings: vector search, approximate nearest neighbors, indexing',
      ],
      mid: [
        'Review basic ML pipeline design: data ingestion, feature engineering, training, serving',
        'Prepare to design a simple recommendation system: what data, what model, how to serve',
        'Study ETL pipeline patterns: extract, transform, load, scheduling, error handling',
        'Review data warehouse basics: dimensional modeling, slowly changing dimensions',
        'Prepare to discuss batch vs real-time processing trade-offs',
        'Document experience with data orchestration: Airflow, Luigi, Prefect',
        'Review model serving basics: REST APIs, latency considerations, caching',
        'Prepare to design A/B test analysis pipeline: metrics collection, statistical tests, reporting',
        'Study data validation approaches: schema validation, statistical tests, anomaly detection',
        'Review basic feature store concepts: what features to store, how to serve them',
      ],
      junior: [
        'Review basic data pipeline concepts: sources, transformations, destinations',
        'Study what a data warehouse is and how it differs from a database',
        'Understand batch vs streaming data processing at a high level',
        'Review how ML models are deployed and served in production',
        'Prepare to discuss data quality: why it matters, basic validation',
        'Study what feature engineering is and why it matters',
        'Review basic A/B testing concepts: control, treatment, metrics',
        'Prepare questions about the company\'s data infrastructure',
        'Understand ETL: Extract, Transform, Load basics',
        'Review the company\'s data products and how they might be built',
      ],
    },
    technical_screen: {
      senior: [
        'Review ML algorithms in depth: gradient boosting, neural architectures',
        'Prepare end-to-end ML project explanation: framing, data, model, deployment',
        'Practice SQL: window functions, CTEs, query optimization',
        'Review A/B testing: power analysis, multiple comparisons, sequential testing',
        'Document feature engineering strategies and pipelines',
        'Prepare to discuss ML monitoring: data drift, model drift detection',
        'Review deep learning: CNNs, RNNs, transformers, attention',
        'Document debugging model performance: bias-variance, error analysis',
        'Prepare statistics discussion: hypothesis testing, Bayesian methods',
        'Review ML in production: containerization, APIs, batch vs real-time',
        'Document experimentation platforms and feature stores',
        'Prepare causal inference examples: propensity matching, diff-in-diff',
      ],
      mid: [
        'Review supervised learning: linear/logistic regression, trees, random forests',
        'Practice pandas efficiently: groupby, merge, apply, vectorized operations',
        'Prepare SQL: aggregations, joins, subqueries, window functions',
        'Review evaluation metrics: precision/recall, F1, AUC-ROC, when to use',
        'Document data pipeline experience: ETL, cleaning, missing values',
        'Practice explaining ML to non-technical stakeholders',
        'Review statistics: distributions, hypothesis testing, p-values',
        'Prepare data visualization discussion: chart selection, storytelling',
        'Document EDA approach',
        'Review feature engineering: encoding, scaling, categoricals',
      ],
      junior: [
        'Review ML basics: train/test split, overfitting, cross-validation',
        'Practice Python: numpy, pandas, matplotlib basics',
        'Study SQL: SELECT, JOIN, GROUP BY, HAVING',
        'Understand statistics: mean, variance, distributions, correlation',
        'Prepare to discuss coursework and Kaggle projects',
        'Review company data products and ML applications',
        'Study basic ML models: linear, logistic, decision trees',
        'Prepare to demonstrate Python data manipulation',
        'Review visualization basics: chart types and uses',
        'Document learning approach for new tools',
      ],
    },
    behavioural: {
      senior: [
        'Prepare ML/data project STAR stories with business metrics impact',
        'Document cross-functional collaboration: product, engineering, stakeholders',
        'Review communicating complex analysis to non-technical audiences',
        'Prepare model failure/underperformance story: diagnosis, fix',
        'Document mentoring junior data scientists',
        'Prepare prioritization among multiple analysis requests',
        'Review data quality challenges: identification, resolution',
        'Document influencing decisions when stakeholders disagreed',
        'Prepare perfectionism vs shipping balance discussion',
        'Review self-directed projects adding unexpected value',
      ],
    },
  },

  // ==================== CONSULTING ====================
  consulting: {
    case_study: {
      senior: [
        'Master frameworks: MECE issue trees, hypothesis-driven, so-what chains',
        'Practice diverse cases: market entry, profitability, M&A, pricing',
        'Prepare to lead case discussions: drive conversation, push back',
        'Review industry knowledge: 2-3 sectors in depth',
        'Practice synthesis under pressure: 30-second recommendation summary',
        'Prepare ambiguous client situation examples',
        'Document client impact stories with metrics',
        'Practice market sizing: top-down, bottom-up, triangulation',
        'Review operations cases: cost reduction, process optimization',
        'Prepare growth strategy: organic vs inorganic frameworks',
        'Practice financial analysis in cases: break-even, NPV, ROI',
        'Document quantitative analysis experience',
      ],
      mid: [
        'Practice frameworks: 3C\'s, Porter\'s Five Forces, value chain, profit tree',
        'Master market sizing: explicit assumptions, reasonableness checks',
        'Practice mental math: percentages, compound growth, quick division',
        'Prepare profitability and market entry structured approaches',
        'Practice recommendation delivery: clear structure, logic chain',
        'Review 2-3 industries for commercial awareness',
        'Document ambiguous problem structuring approach',
        'Practice brainstorming: creative ideas within structure',
        'Review basic financial analysis: margins, growth, break-even',
        'Prepare analytical work examples',
      ],
      junior: [
        'Learn frameworks: SWOT, 3C\'s, Porter\'s Five Forces, profit tree',
        'Practice market sizing: explicit assumptions, show math',
        'Practice structuring: MECE components, prioritization',
        'Review mental math: quick calculations, rounding',
        'Practice presenting analysis: clear, confident, acknowledge gaps',
        'Prepare coursework examples showing structured thinking',
        'Document consulting interest: why career, why firm',
        'Practice brainstorming within frameworks',
        'Review business basics: revenue, costs, margins',
        'Prepare firm culture questions',
      ],
    },
    behavioural: {
      senior: [
        'Prepare complex client engagement STAR stories with impact',
        'Document difficult client situation management',
        'Review client relationship development: project to trusted advisor',
        'Prepare project recovery story',
        'Document consultant development and mentoring',
        'Prepare business development examples: proposals, pitches',
        'Review ambiguity handling: client didn\'t know needs',
        'Document challenging client stakeholder management',
        'Prepare expertise development discussion',
        'Review going beyond scope to add value',
      ],
      mid: [
        'Prepare analytical problem-solving stories with examples',
        'Document high-pressure, deadline-driven work',
        'Review ambiguity handling: unclear requirements, incomplete data',
        'Prepare tough feedback story with improvements',
        'Document team project examples',
        'Prepare consulting motivation discussion',
        'Review leadership in team settings',
        'Document quick learning examples',
        'Prepare attention to detail catching issues',
        'Review any client interaction experience',
      ],
    },
  },

  // ==================== FINANCE / INVESTMENT ====================
  finance: {
    technical_screen: {
      senior: [
        'Review advanced modeling: DCF scenarios, LBO mechanics, merger models',
        'Prepare model walkthrough: assumptions, drivers, sensitivity',
        'Document financial systems experience: Bloomberg, FactSet, Capital IQ',
        'Review Excel mastery: array formulas, financial functions (XNPV, XIRR)',
        'Prepare financial analysis process and recommendation approach',
        'Review market conditions: rates, valuations, sector trends',
        'Document financial reporting analysis: 10-K, earnings calls',
        'Prepare accounting discussion: revenue recognition, leases, impairment',
        'Review forecasting: revenue builds, expense modeling, scenarios',
        'Document M&A experience: due diligence, valuation, synergies',
      ],
      mid: [
        'Review financial statement analysis: profitability, liquidity, leverage ratios',
        'Practice Excel modeling: 3-statement linkages, sensitivity tables',
        'Prepare budgeting and forecasting discussion',
        'Review GAAP: revenue recognition, accruals, fair value',
        'Document financial analyses and business impact',
        'Prepare financial presentation examples',
        'Review Excel: SUMIFS, pivot tables, dashboards',
        'Document variance analysis approach',
        'Prepare audit and controls experience',
        'Review industry-specific metrics',
      ],
      junior: [
        'Review finance fundamentals: time value, NPV, IRR, WACC',
        'Practice Excel: pivot tables, VLOOKUP, basic formulas',
        'Understand financial statements: linkages, key line items',
        'Review basic accounting: debits/credits, accruals',
        'Prepare finance coursework discussion',
        'Research company financials and recent news',
        'Review financial ratios: margins, returns, leverage',
        'Prepare interest in finance area discussion',
        'Study basic valuation concepts',
        'Document Excel and modeling coursework',
      ],
    },
    case_study: {
      senior: [
        'Practice investment recommendation cases: thesis, catalysts, risks',
        'Review valuation mastery: DCF vs comps vs precedents pitfalls',
        'Prepare analytical framework walkthrough',
        'Practice recommendation presentation with pushback handling',
        'Review industry deep dives: 2-3 sectors, key metrics',
        'Prepare market opportunities and investment viewpoint',
        'Document complex transaction analysis',
        'Prepare risk assessment discussion',
        'Review due diligence processes',
        'Practice defending analysis against challenges',
      ],
    },
  },

  // ==================== ADMIN / ASSISTANT ====================
  admin: {
    technical_screen: {
      senior: [
        'Review executive support experience: calendar management, travel, expense reporting',
        'Prepare examples of managing complex schedules across time zones',
        'Document event and meeting coordination for large groups',
        'Review communication drafting: emails, presentations, reports on behalf of executives',
        'Prepare to discuss confidential information handling',
        'Document project coordination and deadline management',
        'Review technology proficiency: Office Suite, calendar tools, expense systems',
        'Prepare examples of proactive problem-solving for executives',
        'Document vendor and external stakeholder management',
        'Review prioritization when everything is urgent',
      ],
      mid: [
        'Review administrative skills: scheduling, correspondence, filing systems',
        'Prepare calendar management and meeting coordination examples',
        'Document Microsoft Office proficiency: Word, Excel, PowerPoint, Outlook',
        'Review travel arrangement and expense report processing',
        'Prepare examples of handling multiple tasks and priorities',
        'Document communication skills: phone, email, in-person',
        'Review confidentiality and discretion examples',
        'Prepare to discuss your organizational systems',
        'Document problem-solving for administrative challenges',
        'Review customer/client service experience',
      ],
      junior: [
        'Review basic administrative skills: filing, data entry, scheduling',
        'Prepare Microsoft Office proficiency demonstration',
        'Document any receptionist or customer service experience',
        'Review professional communication: phone, email etiquette',
        'Prepare to discuss your organizational abilities',
        'Document attention to detail examples',
        'Review handling multiple tasks simultaneously',
        'Prepare to discuss your interest in administrative work',
        'Document any relevant coursework or certifications',
        'Review the company and prepare thoughtful questions',
      ],
    },
    behavioural: {
      senior: [
        'Prepare STAR stories about supporting high-level executives',
        'Document handling sensitive or confidential situations',
        'Review managing complex, high-stakes events or meetings',
        'Prepare story about anticipating needs before being asked',
        'Document handling difficult stakeholders or situations',
        'Review prioritization under pressure',
        'Prepare examples of initiative and process improvement',
        'Document building relationships across the organization',
      ],
      mid: [
        'Prepare stories demonstrating organizational skills',
        'Document handling multiple priorities and deadlines',
        'Review customer service or stakeholder interaction examples',
        'Prepare story about solving an unexpected problem',
        'Document attention to detail catching errors',
        'Review handling stressful or busy periods',
        'Prepare teamwork and collaboration examples',
        'Document professional development and learning',
      ],
    },
  },

  // ==================== SOFTWARE ARCHITECT ====================
  software_architect: {
    system_design: {
      executive: [
        'Prepare to lead enterprise architecture discussions: domain-driven design, bounded contexts',
        'Review microservices patterns at scale: service mesh, event-driven architecture, CQRS',
        'Document your approach to technology strategy and roadmap planning',
        'Prepare examples of architectural decisions with business impact quantification',
        'Review your experience with cloud architecture: multi-cloud, hybrid, migration strategies',
        'Document governance models: ADRs, architecture review boards, standards',
        'Prepare to discuss build vs buy decisions at enterprise scale',
        'Review security architecture: zero trust, identity management, data protection',
        'Document experience with legacy modernization and technical debt strategies',
        'Prepare to discuss cross-cutting concerns: observability, reliability, scalability',
      ],
      senior: [
        'Review distributed systems patterns: consensus, replication, partitioning',
        'Prepare to discuss API design: REST vs GraphQL vs gRPC trade-offs',
        'Document experience with event-driven architecture: Kafka, event sourcing, saga patterns',
        'Review database architecture: polyglot persistence, sharding, caching strategies',
        'Prepare examples of NFR definition: latency, throughput, availability targets',
        'Study resilience patterns: circuit breakers, bulkheads, retry with backoff',
        'Document your approach to capacity planning and performance modeling',
        'Review security patterns: authentication, authorization, encryption at rest/in transit',
        'Prepare to discuss deployment architecture: blue-green, canary, feature flags',
        'Document experience with container orchestration and service mesh',
      ],
      mid: [
        'Review common architecture patterns: layered, hexagonal, clean architecture',
        'Study API design principles: versioning, pagination, error handling',
        'Prepare to discuss database selection criteria: SQL vs NoSQL use cases',
        'Document experience with cloud services: compute, storage, messaging',
        'Review caching strategies: CDN, application cache, database cache',
        'Prepare to discuss authentication and authorization patterns',
        'Study message queue patterns: pub/sub, request/reply, dead letter queues',
        'Document your approach to creating architecture documentation',
        'Review containerization basics: Docker, Kubernetes concepts',
        'Prepare to discuss monitoring and observability approaches',
      ],
    },
    technical_screen: {
      executive: [
        'Prepare to discuss your architecture philosophy and decision frameworks',
        'Review major architecture transformations you\'ve led and their outcomes',
        'Document experience with enterprise integration patterns',
        'Prepare examples of influencing technical direction across organizations',
        'Review your approach to emerging technology evaluation',
        'Document experience with architecture governance and standards',
      ],
      senior: [
        'Review your most complex architectural design and the trade-offs involved',
        'Prepare to whiteboard system architectures with clear reasoning',
        'Document experience with performance optimization at architecture level',
        'Review patterns for high availability and disaster recovery',
        'Prepare to discuss security architecture considerations',
        'Document your approach to technology evaluation and POCs',
      ],
    },
    behavioural: {
      executive: [
        'Prepare stories about driving architectural transformation at org level',
        'Document examples of influencing without authority across teams',
        'Review navigating conflicting technical opinions at senior level',
        'Prepare to discuss building architecture practice and mentoring architects',
        'Document experience with vendor and technology partner relationships',
        'Review examples of communicating technical strategy to business leaders',
      ],
      senior: [
        'Prepare STAR stories about architectural decisions and their impact',
        'Document examples of pushing back on requirements with data',
        'Review mentoring developers on architectural thinking',
        'Prepare story about evolving architecture based on changing requirements',
        'Document cross-team collaboration on shared architecture concerns',
        'Review handling technical debt and modernization initiatives',
      ],
    },
  },

  // ==================== ML ENGINEER ====================
  ml_engineer: {
    system_design: {
      senior: [
        'Review ML system design: feature stores, model serving, experiment tracking',
        'Prepare to design training pipelines: distributed training, hyperparameter tuning',
        'Study MLOps patterns: CI/CD for ML, model versioning, A/B testing for models',
        'Document experience with real-time vs batch inference trade-offs',
        'Review model monitoring: data drift, model drift, performance degradation',
        'Prepare to discuss feature engineering pipelines and feature freshness',
        'Study vector databases and embedding search at scale',
        'Document experience with GPU infrastructure and optimization',
        'Review cost optimization for ML workloads: spot instances, model compression',
        'Prepare to discuss ML platform architecture and self-service capabilities',
      ],
      mid: [
        'Review basic ML pipeline design: data ingestion, training, serving',
        'Study model serving options: REST APIs, gRPC, batch prediction',
        'Prepare to discuss experiment tracking and model registry',
        'Document experience with feature stores: offline and online features',
        'Review containerization for ML: Docker, Kubernetes for ML workloads',
        'Prepare to discuss model monitoring basics',
        'Study data validation and quality checks for ML',
        'Document experience with cloud ML services (SageMaker, Vertex AI, Azure ML)',
        'Review A/B testing for model deployment',
        'Prepare to discuss technical debt in ML systems',
      ],
    },
    technical_screen: {
      senior: [
        'Review deep learning architectures: transformers, attention mechanisms, CNNs, RNNs',
        'Prepare to discuss ML frameworks in depth: PyTorch, TensorFlow, JAX',
        'Document experience with distributed training: data parallel, model parallel',
        'Review optimization techniques: gradient descent variants, learning rate schedules',
        'Prepare to discuss model compression: quantization, pruning, distillation',
        'Document debugging ML models: loss curves, gradient issues, overfitting',
        'Review production ML challenges: latency optimization, batching, caching',
        'Prepare to discuss responsible AI: fairness, interpretability, bias detection',
      ],
      mid: [
        'Review ML fundamentals: supervised, unsupervised, reinforcement learning',
        'Prepare to discuss common architectures: neural networks, trees, ensembles',
        'Document experience with ML frameworks: PyTorch or TensorFlow',
        'Review training pipelines: data loading, augmentation, validation',
        'Prepare to discuss evaluation metrics and cross-validation',
        'Document debugging skills: understanding loss, gradients, overfitting',
        'Review your experience with GPU programming basics',
        'Prepare to discuss model deployment and serving',
      ],
    },
    behavioural: {
      senior: [
        'Prepare STAR stories about ML projects from research to production',
        'Document cross-functional collaboration: data scientists, engineers, product',
        'Review handling model failures in production',
        'Prepare story about optimizing ML systems for scale or cost',
        'Document mentoring on ML engineering practices',
        'Review balancing research exploration with production reliability',
      ],
    },
  },

  // ==================== TECHNICAL PROGRAM MANAGEMENT ====================
  tpm: {
    system_design: {
      executive: [
        'Prepare to discuss program architecture for complex technical initiatives',
        'Review your experience managing programs with 50+ engineers across teams',
        'Document technical roadmap alignment with business strategy',
        'Prepare examples of build vs buy decisions at program level',
        'Review vendor management for critical technical systems',
        'Document experience with technical due diligence for M&A',
        'Prepare to discuss portfolio management across technical programs',
        'Review governance models for large technical initiatives',
      ],
      senior: [
        'Prepare to discuss cross-team technical dependency management',
        'Review creating technical project plans with engineering-informed estimates',
        'Document technical risk identification and mitigation strategies',
        'Prepare examples of translating business requirements to technical specs',
        'Review managing scope changes in technical programs',
        'Document experience coordinating API changes across consuming teams',
        'Prepare to discuss migration projects: planning, rollback, validation',
        'Review working with architecture on technical direction',
      ],
      mid: [
        'Review creating dependency-aware project timelines',
        'Study common technical risks in software projects',
        'Prepare to discuss Agile methodology at scale',
        'Document tracking technical deliverables and milestones',
        'Review communicating technical status to executives',
        'Prepare questions about the technical landscape',
        'Study system integration concepts: APIs, data formats',
        'Document experience with release management',
      ],
    },
    technical_screen: {
      senior: [
        'Review software development lifecycle and methodologies',
        'Prepare to discuss your understanding of system architecture',
        'Document experience with technical requirements gathering',
        'Review release management and deployment coordination',
        'Prepare to discuss technical debt conversations',
        'Document your approach to learning technical domains quickly',
      ],
      mid: [
        'Review SDLC phases and Agile ceremonies',
        'Prepare to discuss your technical acumen development',
        'Document experience with technical documentation',
        'Review understanding of APIs and integrations',
        'Prepare questions about the technical stack',
        'Document how you partner with engineering teams',
      ],
    },
    behavioural: {
      executive: [
        'Prepare stories about multi-million dollar technical program management',
        'Document influencing technical decisions without authority',
        'Review organizational change during major technical initiatives',
        'Prepare to discuss conflict resolution at VP level',
        'Document program turnarounds: identifying issues, intervention',
        'Prepare examples of building and scaling TPM teams',
      ],
      senior: [
        'Prepare STAR stories about complex, ambiguous technical programs',
        'Document driving accountability across engineering teams',
        'Review handling programs going off track: detection, intervention',
        'Prepare story about resolving technical team conflicts',
        'Document stakeholder management with competing priorities',
        'Review escalation decisions and outcomes',
      ],
      mid: [
        'Prepare stories demonstrating technical program coordination',
        'Document keeping projects on track despite technical obstacles',
        'Review prioritizing competing urgent requests',
        'Prepare story about technical stakeholder management',
        'Document running effective technical meetings',
        'Review communicating technical bad news effectively',
      ],
    },
  },

  // ==================== PROFESSIONAL SERVICES / SOLUTIONS ====================
  solutions_architect: {
    technical_screen: {
      executive: [
        'Prepare to discuss pre-sales technical leadership and win rate improvement',
        'Review your experience with enterprise customer architecture reviews',
        'Document examples of technical deal strategy for complex sales',
        'Prepare to discuss customer success programs and technical enablement',
        'Review building and scaling solutions architecture teams',
        'Document experience with partner ecosystem and technical integrations',
      ],
      senior: [
        'Review your experience with customer-facing technical presentations',
        'Prepare to discuss solution design for complex enterprise requirements',
        'Document POC and pilot execution: planning, success criteria, evaluation',
        'Review integration patterns: APIs, webhooks, ETL, iPaaS',
        'Prepare examples of technical objection handling',
        'Document your approach to technical discovery and requirements gathering',
        'Review competitive positioning on technical capabilities',
        'Prepare to discuss customer architecture assessments',
        'Document experience with security and compliance requirements',
        'Review your presentation and demo skills',
      ],
      mid: [
        'Review the company\'s product architecture and integration options',
        'Prepare to discuss common customer use cases and solutions',
        'Document experience with technical presentations to customers',
        'Review API and integration basics',
        'Prepare to discuss your customer-facing communication skills',
        'Document POC or demo experience',
        'Review common technical objections and responses',
        'Prepare questions about the pre-sales process',
      ],
    },
    behavioural: {
      senior: [
        'Prepare STAR stories about winning complex technical deals',
        'Document examples of turning around difficult customer situations',
        'Review collaboration with sales on deal strategy',
        'Prepare story about managing multiple customers and deals simultaneously',
        'Document experience with cross-functional customer success',
        'Review handling technically challenging customer requests',
      ],
      mid: [
        'Prepare stories demonstrating customer-facing technical skills',
        'Document collaboration between technical and sales teams',
        'Review handling customer questions you couldn\'t immediately answer',
        'Prepare story about a successful customer presentation or demo',
        'Document managing customer expectations',
        'Review balancing multiple customer requests',
      ],
    },
  },

  professional_services: {
    technical_screen: {
      senior: [
        'Review implementation methodology: discovery, design, build, deploy, optimize',
        'Prepare to discuss complex customer implementations you\'ve led',
        'Document experience with data migration and system integration',
        'Review change management and user adoption strategies',
        'Prepare examples of handling scope changes during implementation',
        'Document your approach to customer stakeholder management',
        'Review technical documentation and runbook creation',
        'Prepare to discuss escalation handling and issue resolution',
        'Document experience with customer training and enablement',
        'Review your project management approach for implementations',
      ],
      mid: [
        'Review implementation processes: requirements, configuration, testing, go-live',
        'Prepare to discuss customer project experience',
        'Document your technical and configuration skills',
        'Review working with customer technical teams',
        'Prepare examples of troubleshooting customer issues',
        'Document your approach to customer communication',
        'Review handling implementation challenges',
        'Prepare questions about the implementation methodology',
      ],
    },
    behavioural: {
      senior: [
        'Prepare STAR stories about complex customer implementations',
        'Document examples of managing difficult customer relationships',
        'Review handling implementation projects going off track',
        'Prepare story about customer escalation resolution',
        'Document balancing multiple customer engagements',
        'Review examples of driving customer adoption and success',
      ],
      mid: [
        'Prepare stories demonstrating customer implementation skills',
        'Document teamwork on customer projects',
        'Review handling customer frustration or issues',
        'Prepare story about learning customer\'s business quickly',
        'Document managing customer expectations',
        'Review examples of attention to detail on implementations',
      ],
    },
  },

  // ==================== GENERAL (Fallback) ====================
  general: {
    recruiter_screening: {
      senior: [
        'Prepare 60-second career summary: progression, achievements, why this opportunity',
        'Research company: news, products, culture, leadership, recent developments',
        'Document salary expectations with market data (Levels.fyi, Glassdoor)',
        'Prepare 3 quantified achievements directly relevant to this role',
        'Prepare questions about team structure, challenges, growth trajectory',
        'Review job description and map experience to requirements',
        'Document motivation for the move with positive framing',
        'Prepare timeline discussion and decision factors',
        'Review company values and prepare alignment examples',
        'Document questions about interview process',
      ],
      mid: [
        'Prepare career overview: background, current role, why looking',
        'Research company: culture, mission, products, recent news',
        'Understand market rate for role in your location',
        'Prepare 3 reasons for interest in this specific role/company',
        'Document questions about day-to-day and success metrics',
        'Review resume: ready to discuss gaps or transitions',
        'Prepare availability and timeline',
        'Document what you\'re looking for: role type, culture',
        'Research recruiter if possible',
        'Prepare benefits and policy questions',
      ],
      junior: [
        'Prepare introduction: education, relevant experience, enthusiasm',
        'Research company: products, mission, values, locations',
        'Understand entry-level compensation in your area',
        'Prepare specific reasons for this company (not generic)',
        'Document questions about training and mentorship',
        'Review job requirements and map to background',
        'Prepare to explain any gaps or transitions',
        'Research what day-to-day looks like',
        'Document career interests and goals',
        'Prepare researched company questions',
      ],
    },
    phone_screen: {
      senior: [
        'Map top 3 achievements to specific business outcomes with metrics',
        'Research interviewer: background, tenure, connections',
        'Prepare compelling "why this company" with research',
        'Draft 4 STAR stories: leadership, impact, problem-solving, collaboration',
        'Test phone/video setup with good audio and lighting',
        'Prepare 3-4 insightful questions showing role understanding',
        'Document weakness answer: growth area with mitigation',
        'Prepare career trajectory explanation',
        'Review competitors and market position',
        'Prepare timeline and opportunities discussion',
      ],
      mid: [
        'Review resume: ready to discuss each role and transition',
        'Research interviewer and company recent news',
        'Prepare career story: past, present, future, why this role',
        'Draft 3-4 STAR stories covering different situations',
        'Test technology: camera, mic, internet, background',
        'Prepare questions about role, team, expectations',
        'Document positive motivation framing',
        'Prepare salary expectation discussion',
        'Review job description highlights',
        'Prepare strong close: interest, next steps',
      ],
      junior: [
        'Review resume: ready to discuss every item',
        'Research company and interviewer on LinkedIn',
        'Prepare 60-second "tell me about yourself"',
        'Draft STAR examples from school, projects, internships',
        'Test technology and find quiet, well-lit location',
        'Prepare questions about role and growth',
        'Document specific company/role interest',
        'Prepare relevant coursework discussion',
        'Review industry basics',
        'Prepare enthusiasm close and next steps question',
      ],
    },
    technical_screen: {
      senior: [
        'Review your most complex project for in-depth technical discussion',
        'Prepare to explain technical decisions: alternatives, trade-offs, outcomes',
        'Document deep expertise in your primary technical area',
        'Prepare to demonstrate problem-solving approach with examples',
        'Review industry standards and best practices',
        'Prepare technical questions about the company\'s work',
        'Document leadership in technical decisions',
        'Review tools and technologies in job description',
      ],
      mid: [
        'Review fundamentals in your technical area',
        'Prepare 3-5 minute explanation of key projects',
        'Document tools and technologies you\'ve used',
        'Prepare to discuss your problem-solving approach',
        'Review industry knowledge relevant to role',
        'Document hands-on experience with examples',
        'Prepare technical questions about the team',
        'Review the job description technical requirements',
      ],
      junior: [
        'Review fundamentals from your education/training',
        'Prepare to discuss projects and coursework',
        'Document tools and technologies you know',
        'Prepare to explain your learning approach',
        'Review basics that may be tested',
        'Document any practical experience',
        'Prepare questions about the technical environment',
        'Review company products and technology',
      ],
    },
    technical_round: {
      senior: [
        'Prepare for deep technical discussion in your specialty area',
        'Review complex problems you\'ve solved and be ready to explain approach',
        'Document technical leadership and decision-making examples',
        'Prepare whiteboard or hands-on demonstration of skills',
        'Review advanced concepts in your field',
        'Prepare to discuss trade-offs and optimization',
        'Document your expertise areas in depth',
        'Review company\'s technical challenges and prepare relevant discussion',
      ],
      mid: [
        'Review core technical concepts for your field',
        'Prepare to solve problems or demonstrate skills live',
        'Document your technical experience with examples',
        'Prepare to explain your thought process clearly',
        'Review common tools and methods in your area',
        'Document projects showcasing your technical skills',
        'Prepare questions about the technical work',
        'Review fundamentals you may be tested on',
      ],
      junior: [
        'Review fundamental concepts from your training',
        'Prepare to demonstrate basic skills in your area',
        'Document projects showing your technical abilities',
        'Prepare to think through problems step-by-step',
        'Review basics that entry-level should know',
        'Prepare to show your learning potential',
        'Document any hands-on experience',
        'Prepare questions about learning opportunities',
      ],
    },
    behavioural: {
      senior: [
        'Prepare 6+ STAR stories with quantified business impact',
        'Document influencing without formal authority examples',
        'Prepare disagreement with leadership story: professional resolution',
        'Review developing team members: mentoring, performance conversations',
        'Prepare handling ambiguity: creating clarity',
        'Document cross-functional initiatives: stakeholders, obstacles, outcomes',
        'Prepare failure story: ownership, learning, changes',
        'Review prioritization examples: competing demands',
        'Document leadership style with examples',
        'Prepare culture and team dynamics questions',
      ],
      mid: [
        'Prepare STAR stories: impact, teamwork, challenge, learning, initiative',
        'Quantify achievements wherever possible',
        'Prepare strengths with examples, development areas',
        'Document receiving difficult feedback constructively',
        'Prepare conflict resolution story: issue, approach, outcome',
        'Review adapting to change examples',
        'Prepare failure story: responsibility, learning',
        'Document motivation: role, company, timing',
        'Prepare culture questions',
        'Review company values for alignment',
      ],
      junior: [
        'Prepare STAR stories from academics, jobs, activities',
        'Focus on learning agility examples',
        'Prepare field/role passion discussion',
        'Document teamwork: specific contributions',
        'Prepare challenge overcome story',
        'Review initiative examples',
        'Document stress handling',
        'Prepare failure/mistake story with learning',
        'Prepare mentorship questions',
        'Document first role learning hopes',
      ],
    },
    hiring_manager: {
      senior: [
        'Research manager: background, team, tenure',
        'Prepare 30-60-90 day plan: learning, quick wins, contributions',
        'Document building team relationships approach',
        'Prepare questions: challenges, priorities, success metrics',
        'Review organizational context and collaborators',
        'Prepare management style discussion',
        'Document constructive disagreement handling',
        'Prepare autonomy and decision-making questions',
        'Review team accomplishments if findable',
        'Prepare support needs discussion',
      ],
      mid: [
        'Research manager on LinkedIn',
        'Prepare ramp-up approach discussion',
        'Document team dynamics questions',
        'Prepare working style discussion',
        'Review success metrics if findable',
        'Prepare career goals discussion',
        'Document feedback implementation examples',
        'Prepare manager style questions',
        'Review team work if visible',
        'Prepare motivation discussion',
      ],
      junior: [
        'Research manager and their role',
        'Prepare mentorship discussion',
        'Document training questions',
        'Prepare working/learning style discussion',
        'Review entry-level role activities',
        'Prepare career interests discussion',
        'Document feedback seeking approach',
        'Prepare growth opportunity questions',
        'Review manager background for connections',
        'Prepare enthusiasm and learning eagerness',
      ],
    },
    final_round: {
      senior: [
        'Review all previous round feedback and concerns',
        'Research all interviewers: executives, skip-levels',
        'Prepare strategic perspective: team/company in 2-3 years',
        'Document company strategy questions',
        'Review compensation expectations',
        'Prepare closing: why you, why now, what you\'ll accomplish',
        'Document first major initiative approach',
        'Prepare culture/values alignment examples',
        'Review competitive landscape',
        'Prepare timeline questions',
      ],
      mid: [
        'Review previous interviews: themes, concerns, positives',
        'Research new interviewers',
        'Prepare to reinforce strengths, address concerns',
        'Document team growth and progression questions',
        'Prepare compensation discussion',
        'Prepare strong close: fit, enthusiasm',
        'Review company announcements since last interview',
        'Document role learnings through process',
        'Prepare timeline discussion',
        'Review culture fit examples',
      ],
      junior: [
        'Review notes from all previous interviews',
        'Research new interviewers',
        'Prepare consistent enthusiasm and professionalism',
        'Document remaining role questions',
        'Review entry-level compensation/benefits',
        'Prepare genuine excitement expression',
        'Document company learnings',
        'Prepare timeline: start date, other processes',
        'Review culture alignment',
        'Prepare next steps question',
      ],
    },
    offer: {
      senior: [
        'Research total compensation benchmarks: Levels.fyi, Blind',
        'Document negotiation priorities: base, equity, bonus, sign-on',
        'Review equity details: grant type, vesting, refresh',
        'Prepare counter-offer justification: competing offers, market data',
        'Calculate total compensation including benefits',
        'Know reservation price and walk-away number',
        'Prepare response timeline',
        'Document equity questions: strike price, liquidity',
        'Review benefits details',
        'Prepare non-salary negotiation items',
      ],
      mid: [
        'Research market rates for role and level',
        'Understand offer components: base, bonus, equity',
        'Prepare benefits questions: healthcare, retirement, PTO',
        'Document priorities: most important vs nice-to-have',
        'Prepare professional counter approach with data',
        'Understand timeline and decision factors',
        'Review equity: type, vesting, value',
        'Document performance review questions',
        'Prepare respectful negotiation',
        'Know asking for time is okay',
      ],
      junior: [
        'Research entry-level compensation for role/location',
        'Understand offer: salary, benefits',
        'Document benefits questions',
        'Know asking for consideration time is professional',
        'Understand signing bonus/relocation if offered',
        'Prepare to accept or counter professionally',
        'Review start date flexibility',
        'Document needs: salary floor, required benefits',
        'Understand equity basics if offered',
        'Prepare enthusiastic yet informed decision',
      ],
    },
  },
};

// ============================================================================
// TOPIC SELECTION
// ============================================================================

const selectTopicsFromPool = (pool: string[], count: number, seed: number): string[] => {
  if (pool.length === 0) return [];
  if (pool.length <= count) return [...pool];
  
  const shuffled = [...pool];
  let currentSeed = seed;
  
  for (let i = shuffled.length - 1; i > 0; i--) {
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
  const stageLower = stage.toLowerCase().replace(/\s+/g, '_');
  
  // Stage mapping - map various stage names to our topic pool keys
  const stageMapping: Record<string, string[]> = {
    // Clinical variations
    'clinical': ['clinical'],
    'clinical_case_review': ['clinical'],
    'clinical_interview': ['clinical'],
    'clinical_round': ['clinical'],
    'case_presentation': ['clinical', 'case_study'],
    'patient_case': ['clinical'],
    // Technical variations
    'technical_screen': ['technical_screen', 'technical_round'],
    'technical_round': ['technical_round', 'technical_screen'],
    'technical_interview': ['technical_screen', 'technical_round'],
    'tech_screen': ['technical_screen'],
    // Coding variations
    'coding_round_1': ['coding_round_1'],
    'coding_round_2': ['coding_round_1'],
    'coding_interview': ['coding_round_1'],
    'coding': ['coding_round_1'],
    // Behavioral variations
    'behavioural': ['behavioural'],
    'behavioral': ['behavioural'],
    'behavioral_interview': ['behavioural'],
    'culture_fit': ['behavioural'],
    // System design variations
    'system_design': ['system_design'],
    'architecture': ['system_design'],
    'design_round': ['system_design'],
    // Case study variations
    'case_study': ['case_study'],
    'case_interview': ['case_study'],
    'business_case': ['case_study'],
  };
  
  // Get potential stage keys to try
  const stageKeys = stageMapping[stageLower] || [stageLower];
  
  // Try each stage key for the specific role
  let pool: string[] | undefined;
  
  for (const stageKey of stageKeys) {
    pool = TOPIC_POOLS[role]?.[stageKey]?.[seniority];
    if (pool && pool.length > 0) break;
  }
  
  // If no role-specific topics, try general topics for these stages
  if (!pool || pool.length === 0) {
    for (const stageKey of stageKeys) {
      pool = TOPIC_POOLS.general?.[stageKey]?.[seniority];
      if (pool && pool.length > 0) break;
    }
  }
  
  // Fall back to phone_screen if nothing found
  if (!pool || pool.length === 0) {
    pool = TOPIC_POOLS[role]?.phone_screen?.[seniority] || 
           TOPIC_POOLS.general?.phone_screen?.[seniority];
  }
  
  // Ultimate fallback
  if (!pool || pool.length === 0) {
    pool = TOPIC_POOLS.general?.phone_screen?.mid || [];
  }
  
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
  
  if (company && company.trim() && topics.length > 0) {
    const companyTopic = `Research ${company}: recent news, products, culture, Glassdoor reviews`;
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
  const roleDisplay = getRoleDisplayName(role);

  const prompt = `Generate 6 specific, actionable interview preparation topics.

Position: ${position}
Interview Stage: ${stageDisplay}
Seniority Level: ${seniority}
Role Category: ${roleDisplay}
${company ? `Company: ${company}` : ''}

Requirements:
- Topics must be HIGHLY SPECIFIC to ${position} preparing for ${stageDisplay}
- Include field-specific terminology, tools, concepts, and resources
- Each topic completable in 30min-2hrs
- NOT generic advice - must be relevant to this exact role and stage
${isRefresh ? `- Generate COMPLETELY DIFFERENT topics than typical. Seed: ${Date.now()}` : ''}

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
          { role: 'system', content: 'You are an expert career coach. Return only valid JSON arrays. No markdown.' },
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
  const roleDisplay = useMemo(() => getRoleDisplayName(roleType), [roleType]);
  const stageDisplay = useMemo(() => 
    STAGE_NAMES[stage.toLowerCase()] || stage.replace(/_/g, ' '), [stage]);
  
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  
  useEffect(() => {
    if (!visible || !stage) return;
    
    const initialSeed = Date.now();
    setRefreshSeed(initialSeed);
    const fallback = generateTopicsFromDB(stage, position, company, initialSeed);
    setTopics(fallback);
    setIsAI(false);
    setLoading(true);
    
    generateTopicsFromLLM(stage, position, company, false).then(llmTopics => {
      if (mountedRef.current && llmTopics && llmTopics.length >= 4) {
        setTopics(llmTopics);
        setIsAI(true);
      }
      if (mountedRef.current) setLoading(false);
    });
  }, [visible, stage, position, company]);
  
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    
    const newSeed = Date.now();
    setRefreshSeed(newSeed);
    
    const fallback = generateTopicsFromDB(stage, position, company, newSeed);
    setTopics(fallback);
    setIsAI(false);
    
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
                  {roleDisplay}
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
