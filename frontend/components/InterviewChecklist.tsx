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
  | 'clinical' | 'pharmacist' | 'accounting' | 'finance' | 'payroll' | 'consulting' | 'sales'
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
  
  // PMO - Program Management Office
  if (/\b(pmo|program management office|portfolio manager|portfolio management|program director)\b/.test(p)) {
    return 'pmo';
  }
  
  // PROJECT MANAGEMENT - Separate from program management
  if (/\b(project manager|pmp\b|project lead|project coordinator|construction manager|it project)\b/.test(p) && !/program/.test(p)) {
    return 'project_mgmt';
  }
  
  // CUSTOMER SUCCESS - Check before general sales
  if (/\b(customer success|csm\b|cs manager|cs director|client success|customer experience|cx\b|customer advocate|renewal manager|adoption manager)\b/.test(p)) {
    return 'customer_success';
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
  // Also captures VP/SVP/Director of Engineering when combined with software context
  if (/\b(software|developer|programmer|coder|full.?stack|front.?end|back.?end|web dev|mobile dev|ios dev|android dev|devops|sre|site reliability|platform eng|cloud eng|swe\b|sde\b)\b/.test(p)) {
    return 'software';
  }
  
  // VP/SVP/Director of Engineering (when not caught by software above)
  if (/\b(vp of engineering|vice president.*engineering|svp.*engineering|director of engineering|head of engineering|engineering director|engineering manager)\b/.test(p)) {
    return 'software';
  }
  
  // DATA SCIENCE / Analytics (not ML Engineer which is caught above)
  if (/\b(data scientist|data science|data anal|business intel|bi analyst|statistician|quantitative|data eng|analytics eng)\b/.test(p)) {
    return 'data';
  }
  
  // PHARMACIST - Check before general clinical
  if (/\b(pharmacist|pharmacy|pharmd|pharm\.?d|clinical pharmacist|retail pharmacist|hospital pharmacist|pharmacy manager|pharmacy director|pharmaceutical)\b/.test(p)) {
    return 'pharmacist';
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
  
  // CHEMICAL - Process, chemistry, pharmaceutical (not pharmacist), biotech
  if (/\b(chemical eng|process eng|chemistry|biotech|biochem|materials sci|polymer|petrochemical|chemical plant|refinery)\b/.test(p) && !/pharmacist/.test(p)) {
    return 'chemical';
  }
  
  // CIVIL - Construction, structural, environmental, geotechnical
  if (/\b(civil eng|structural|construction|geotechnical|environmental eng|transportation eng|water resource|surveyor)\b/.test(p)) {
    return 'civil';
  }
  
  // CLINICAL / HEALTHCARE - Added many medical specialties
  if (/\b(nurse|rn\b|lpn|np\b|physician|doctor|md\b|surgeon|clinician|therapist|dentist|medical|healthcare|patient care|clinical|pediatrician|cardiologist|neurologist|oncologist|radiologist|anesthesiologist|dermatologist|psychiatrist|psychologist|optometrist|ophthalmologist|gynecologist|obstetrician|urologist|orthopedic|emt|paramedic|phlebotomist|sonographer|technologist|pathologist|veterinarian|chiropractor|podiatrist|midwife|dietitian|nutritionist|respiratory|occupational|physical therapist|speech therapist|audiologist|social worker|counselor|cna|lvn|aprn|pa\b|physician assistant)\b/.test(p)) {
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
  
  // PROGRAM MANAGEMENT (broader, not TPM or PMO)
  if (/\b(program manager|scrum master|agile coach|delivery manager)\b/.test(p)) {
    return 'program';
  }
  
  // DESIGN - UX, UI, graphic, industrial
  if (/\b(designer|ux|ui|user experience|user interface|graphic|visual|creative|industrial design|product design)\b/.test(p)) {
    return 'design';
  }
  
  // SALES (excluding customer success which is caught above)
  if (/\b(sales|account exec|ae\b|bdr|sdr|business develop|account manager|territory)\b/.test(p)) {
    return 'sales';
  }
  
  // MARKETING
  if (/\b(marketing|growth|brand|content|seo|sem|digital market|social media|communications|pr\b|public relations)\b/.test(p)) {
    return 'marketing';
  }
  
  // Payroll - Payroll Specialist, Payroll Administrator, Payroll Analyst
  if (/\b(payroll)\b/.test(p)) {
    return 'payroll';
  }
  
  // HR - Human Resources, People Operations, HRBP, Training
  if (/\b(human resource|hr\b|recruiter|talent|people ops|people operations|people advisor|people partner|hrbp|hr business partner|compensation|benefits|training|l&d|learning and development|employee relations|workforce|staffing)\b/.test(p)) {
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
    dba: 'DBA',
    product: 'Product',
    program: 'Program Mgmt',
    tpm: 'Tech Program',
    pmo: 'PMO',
    project_mgmt: 'Project Mgmt',
    design: 'Design',
    professional_services: 'Prof Services',
    solutions_architect: 'Solutions',
    customer_success: 'Customer Success',
    mechanical: 'Mechanical',
    aerospace: 'Aerospace',
    electrical_hw: 'Electrical',
    chemical: 'Chemical',
    civil: 'Civil',
    clinical: 'Clinical',
    pharmacist: 'Pharmacy',
    accounting: 'Accounting',
    finance: 'Finance',
    payroll: 'Payroll',
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
      junior: [
        'Prepare STAR stories from internships, coursework, or part-time accounting roles',
        'Document attention to detail catching errors in assignments',
        'Review handling multiple deadlines during busy periods (finals, internship)',
        'Prepare story about learning accounting software or ERP systems',
        'Document teamwork examples from group projects or team environments',
        'Prepare to discuss your CPA exam plans and career trajectory',
        'Review examples showing your reliability and work ethic',
        'Document any process improvement suggestions you\'ve made',
      ],
    },
    recruiter_screening: {
      senior: [
        'Prepare 60-second career summary highlighting CPA credentials and progression',
        'Document your experience with SEC reporting, technical accounting, or audit',
        'Review salary expectations for senior accountants in your market (Robert Half, Glassdoor)',
        'Prepare to discuss your ERP experience: SAP, Oracle, NetSuite, Workday',
        'Document reasons for leaving: growth, challenge, industry interest',
        'Prepare questions about team size, close timeline, reporting structure',
        'Review the company\'s industry and relevant accounting complexities',
        'Document your availability and notice period clearly',
      ],
      mid: [
        'Prepare career overview: education, CPA status, roles, progression',
        'Research company: industry, size, public/private, recent news',
        'Review market rate for staff/senior accountants in your area',
        'Prepare reasons for interest in this specific company and role',
        'Document your experience with month-end close and reconciliations',
        'Prepare questions about team structure and accounting systems used',
        'Review job description and map your experience to requirements',
        'Document your CPA status or exam progress',
      ],
      junior: [
        'Prepare introduction: accounting degree, relevant coursework, internships',
        'Research the company: industry, products, accounting department size',
        'Understand entry-level accountant salary in your area',
        'Prepare specific reasons for interest in this company (not generic)',
        'Document your Excel skills and any ERP exposure',
        'Prepare questions about training, mentorship, CPA support',
        'Review accounting fundamentals you learned in school',
        'Document your CPA exam plans and timeline',
      ],
    },
    phone_screen: {
      senior: [
        'Review your experience with complex accounting: revenue recognition, leases, consolidations',
        'Prepare to discuss month-end close process improvements you\'ve driven',
        'Document your approach to audit preparation and external auditor management',
        'Prepare STAR stories about resolving accounting discrepancies or control issues',
        'Review your ERP and reporting tool expertise in detail',
        'Prepare questions about accounting policies, close calendar, and team structure',
        'Document your experience with SOX compliance if applicable',
        'Prepare to discuss your management or mentoring experience',
      ],
      mid: [
        'Review your month-end close responsibilities and reconciliation experience',
        'Prepare to discuss your most challenging accounting issue and resolution',
        'Document your Excel and ERP system proficiency',
        'Prepare STAR stories demonstrating accuracy and deadline management',
        'Review internal controls you\'ve worked with or helped improve',
        'Prepare questions about typical close timeline and peak periods',
        'Document your experience with specific account areas: AP, AR, FA, etc.',
        'Prepare to discuss your career goals and CPA progress',
      ],
      junior: [
        'Review accounting fundamentals: journal entries, debits/credits, trial balance',
        'Prepare to discuss your accounting coursework and relevant projects',
        'Document any internship or part-time accounting experience',
        'Prepare STAR stories from school or work showing attention to detail',
        'Review your Excel skills: formulas, pivot tables, VLOOKUP',
        'Prepare questions about training program and CPA support',
        'Document your understanding of month-end close at a basic level',
        'Prepare to discuss your interest in accounting as a career',
      ],
    },
    hiring_manager: {
      senior: [
        'Research the hiring manager: their background, tenure, team structure',
        'Prepare a 30-60-90 day plan for ramping up in the accounting team',
        'Document your approach to building relationships with auditors and business partners',
        'Prepare to discuss how you handle competing priorities during close',
        'Review specific accounting challenges this company might face (industry-specific)',
        'Prepare questions about performance metrics and career growth',
        'Document your technical accounting research and memo-writing experience',
        'Prepare to discuss your leadership style and team development approach',
      ],
      mid: [
        'Research the hiring manager and team structure',
        'Prepare to discuss how you\'d ramp up on their specific accounting processes',
        'Document your experience with their industry or similar companies',
        'Prepare questions about day-to-day responsibilities and typical challenges',
        'Review what success looks like in this role after 6-12 months',
        'Prepare to discuss your working style and collaboration approach',
        'Document your career goals and how this role fits',
        'Prepare questions about the team culture and close process',
      ],
      junior: [
        'Research the hiring manager on LinkedIn',
        'Prepare to discuss how you approach learning new accounting systems',
        'Document your eagerness to learn and take on responsibility',
        'Prepare questions about training, mentorship, and feedback',
        'Review what entry-level accountants typically do in their first year',
        'Prepare to discuss your career goals in accounting',
        'Document how you handle detailed work and deadlines',
        'Prepare questions about CPA support and professional development',
      ],
    },
    final_round: {
      senior: [
        'Prepare for deeper technical accounting discussions: revenue recognition, impairments',
        'Review your experience presenting to senior leadership or audit committees',
        'Document your vision for improving the accounting function',
        'Prepare to discuss cross-functional relationships: FP&A, treasury, tax',
        'Review compensation expectations and be ready to negotiate',
        'Prepare thoughtful questions about the company\'s accounting challenges',
        'Document your approach to managing through system implementations or changes',
        'Prepare to discuss your long-term career goals and fit with the company',
      ],
      mid: [
        'Review all previous interview topics and be ready for deeper follow-up',
        'Prepare to meet additional team members or cross-functional partners',
        'Document questions about team dynamics and working relationships',
        'Prepare to discuss specific scenarios: busy season, audit, system issues',
        'Review your salary expectations with market data',
        'Prepare to express strong interest and ask about next steps',
        'Document your decision factors and timeline',
        'Prepare thoughtful questions about growth and development',
      ],
      junior: [
        'Review all fundamentals discussed in previous rounds',
        'Prepare to meet additional team members or senior accountants',
        'Document your enthusiasm for the opportunity and team',
        'Prepare questions about day-to-day life and team culture',
        'Review your salary expectations for entry-level roles',
        'Prepare to express strong interest and commitment',
        'Document your availability and start date flexibility',
        'Prepare questions about training timeline and first projects',
      ],
    },
  },

  // ==================== OPERATIONS / SUPPLY CHAIN / INVENTORY ====================
  operations: {
    technical_screen: {
      senior: [
        'Review replenishment and inventory strategy: service level targets, assortment support, merchandise plans',
        'Prepare to discuss demand forecasting: basic and seasonal forecasts, demand history, statistical analysis',
        'Document experience with E3 and SAP system settings for DC and store article/site level inventory',
        'Review exception-based reporting: reacting to articles exceeding or falling below performance levels',
        'Prepare examples of article-site replenishment execution at store level',
        'Document experience with purchase order execution and suggested order quantities',
        'Review omni-channel buy and allocation strategy alignment with inventory flow and financial plans',
        'Prepare to discuss vendor forecasts/projections for replenished products',
        'Document your approach to promotional inventory: "plans and events" for articles',
        'Review strategic levers to optimize inventory and support merchandising strategy',
        'Prepare examples of ad-hoc analysis for company initiatives and hindsight projects',
        'Document experience teaching data-driven decision-making to merchandising teams',
      ],
      mid: [
        'Review inventory fundamentals: trends, exceptions, rate of sale, MOQ, minimum presentation quantities',
        'Prepare to discuss your experience with inventory systems: E3, SAP MM, Oracle, NetSuite',
        'Document experience with article forecast and profile for new article replenishment',
        'Review demand planning: forecasting inputs, store activity, assortment changes, current trends',
        'Prepare examples of communicating replenishment recommendations to buying and logistics teams',
        'Document your Excel skills for inventory analysis: pivot tables, VLOOKUP, data analysis',
        'Review PO expediting and logistics issue resolution experience',
        'Prepare to discuss maintaining appropriate inventory levels at DC and store level',
        'Document KPIs you\'ve tracked: service levels, fill rate, inventory turns, stockouts',
        'Review your experience partnering with buyers, planners, and allocations teammates',
      ],
      junior: [
        'Review inventory management basics: what is replenishment, why service levels matter',
        'Prepare to discuss your coursework in operations, supply chain, retail, or merchandising',
        'Document Excel proficiency: basic formulas, sorting, filtering, pivot tables',
        'Review basic inventory concepts: SKU, article-site, DC vs store inventory',
        'Prepare examples from internships, retail experience, or part-time work',
        'Document your understanding of store operations and replenishment',
        'Review what inventory analysts do: forecasting, replenishment, reporting',
        'Prepare questions about E3, SAP, and systems you\'ll learn',
        'Document your attention to detail with specific examples',
        'Review the company\'s merchandise categories and distribution model',
      ],
    },
    behavioural: {
      senior: [
        'Prepare STAR stories about inventory optimization with quantified service level improvements',
        'Document cross-functional collaboration: buyers, planners, allocations, logistics, store operations',
        'Review examples of developing and teaching best practices to merchandising organization',
        'Prepare story about resolving major replenishment issues or stockout situations',
        'Document your experience training users with varying requirements on data-driven decisions',
        'Review handling conflicting priorities: service levels vs inventory costs vs financial plans',
        'Prepare examples of identifying gaps and developing strategies to maximize inventory productivity',
        'Document your approach to delivering actionable insights through ad-hoc analysis',
        'Review examples of influencing assortments through demand evaluation and inventory forecasting',
        'Prepare story demonstrating solution-oriented approach with fact-based recommendations',
      ],
      mid: [
        'Prepare STAR stories demonstrating analytical skills in demand forecasting and trends analysis',
        'Document meeting deadlines during peak seasons: pre-season planning, promotional events',
        'Review examples of catching and resolving inventory exceptions or performance issues',
        'Prepare story about learning E3, SAP, or new replenishment system quickly',
        'Document teamwork examples with buying, planning, and logistics teams',
        'Review handling high-volume replenishment work during promotional periods',
        'Prepare to discuss your career goals in inventory/merchandising analytics',
        'Document process improvement suggestions for replenishment or forecasting',
      ],
      junior: [
        'Prepare STAR stories from coursework, retail internships, or part-time jobs',
        'Document attention to detail: catching data errors, accuracy in reports',
        'Review examples of working with spreadsheets and inventory data',
        'Prepare story about learning something new quickly in a retail environment',
        'Document teamwork and collaboration examples from group projects or work',
        'Review handling multiple tasks and prioritizing during busy periods',
        'Prepare to discuss your interest in retail inventory and merchandising',
        'Document any relevant coursework in supply chain, retail, or analytics',
      ],
    },
    recruiter_screening: {
      senior: [
        'Prepare career summary highlighting replenishment strategy and inventory optimization accomplishments',
        'Document your experience with E3, SAP, and major retail inventory systems',
        'Review salary expectations for senior inventory analyst/merchandising roles',
        'Prepare to discuss experience with omni-channel inventory and allocation strategies',
        'Document your retail/merchandising industry experience and why this company interests you',
        'Prepare questions about merchandising team structure, systems, and current challenges',
        'Review the company\'s assortment strategy and distribution model',
        'Document your availability and notice period',
      ],
      mid: [
        'Prepare career overview: education, experience in inventory analysis and retail operations',
        'Research company: merchandise categories, store count, distribution complexity',
        'Review market rate for inventory analyst roles in retail industry',
        'Prepare reasons for interest in this specific role and company',
        'Document your experience with forecasting, replenishment systems, and Excel',
        'Prepare questions about team size, systems (E3/SAP), and day-to-day responsibilities',
        'Review job description and map your experience to replenishment requirements',
        'Document any relevant certifications or retail analytics training',
      ],
      junior: [
        'Prepare introduction: degree, relevant coursework in retail, supply chain, or analytics',
        'Research the company: products, store operations, merchandising approach',
        'Understand entry-level inventory analyst salary in retail industry',
        'Prepare specific reasons for interest in retail inventory/merchandising',
        'Document your Excel and analytical skills for inventory work',
        'Prepare questions about training on E3, SAP, and career growth path',
        'Review what retail inventory analysts do and why it interests you',
        'Document any relevant retail internship or store operations experience',
      ],
    },
    phone_screen: {
      senior: [
        'Review your experience implementing replenishment and inventory strategy with service level results',
        'Prepare to discuss demand forecasting methods: seasonal forecasts, statistical analysis, trend analysis',
        'Document your approach to maintaining inventory levels while achieving financial targets',
        'Prepare STAR stories about optimizing inventory productivity and reducing stockouts',
        'Review your E3/SAP expertise: system settings, exception reporting, vendor forecasts',
        'Prepare questions about current replenishment challenges and service level KPIs',
        'Document experience partnering with buyers and planners on omni-channel allocation',
        'Prepare to discuss your experience teaching data-driven decisions to merchandising teams',
      ],
      mid: [
        'Review your daily responsibilities: forecasting, replenishment execution, exception management',
        'Prepare to discuss your most challenging inventory issue and how you resolved it',
        'Document your E3/SAP and Excel proficiency for inventory analysis',
        'Prepare STAR stories demonstrating analytical skills and accuracy in forecasting',
        'Review inventory metrics you\'ve tracked: service levels, turns, fill rate',
        'Prepare questions about typical work cycle and peak promotional periods',
        'Document your experience with article-site replenishment and store operations',
        'Prepare to discuss your career goals in retail inventory/merchandising',
      ],
      junior: [
        'Review retail inventory concepts from coursework or research',
        'Prepare to discuss relevant projects, case studies, or retail experience',
        'Document your Excel and data analysis skills for inventory work',
        'Prepare STAR stories showing attention to detail and learning ability',
        'Review what inventory analysts do: forecasting, replenishment, reporting',
        'Prepare questions about E3, SAP training and mentorship program',
        'Document any relevant retail, store operations, or internship experience',
        'Prepare to discuss your interest in retail merchandising and inventory',
      ],
    },
    hiring_manager: {
      senior: [
        'Research the hiring manager: their background in merchandising/inventory',
        'Prepare a 30-60-90 day plan for ramping up on E3, SAP, and replenishment processes',
        'Document your approach to building relationships with buyers, planners, and store ops',
        'Prepare to discuss how you balance service levels vs inventory costs vs financial plans',
        'Review specific challenges: seasonal forecasting, promotional inventory, omni-channel',
        'Prepare questions about pre-season merchandising process and success metrics',
        'Document your experience leading inventory optimization and teaching best practices',
        'Prepare to discuss developing strategies to maximize inventory productivity',
      ],
      mid: [
        'Research the hiring manager and understand the merchandising team structure',
        'Prepare to discuss how you\'d learn their E3/SAP systems and replenishment processes',
        'Document your experience with similar retail categories or merchandising environments',
        'Prepare questions about day-to-day responsibilities: forecasting, PO execution, exceptions',
        'Review what success looks like: service levels, inventory turns, stockout reduction',
        'Prepare to discuss partnering with buyers, planners, and allocations team',
        'Document your career goals in retail inventory and merchandising analytics',
        'Prepare questions about promotional periods and seasonal planning cycles',
      ],
      junior: [
        'Research the hiring manager on LinkedIn',
        'Prepare to discuss your approach to learning E3, SAP, and inventory systems',
        'Document your eagerness to learn replenishment and demand forecasting',
        'Prepare questions about training program, feedback, and mentorship',
        'Review what you\'d likely do in your first few months on the job',
        'Prepare to discuss your interest in retail merchandising career',
        'Document your reliability, attention to detail, and analytical mindset',
        'Prepare questions about growth path from analyst to senior roles',
      ],
    },
    final_round: {
      senior: [
        'Prepare for deeper discussions on replenishment strategy and inventory optimization',
        'Review your experience presenting to merchandising leadership on inventory insights',
        'Document your vision for improving service levels and inventory productivity',
        'Prepare to discuss cross-functional relationships: buying, planning, logistics, store ops',
        'Review compensation expectations and negotiation points',
        'Prepare thoughtful questions about omni-channel strategy and merchandising challenges',
        'Document your approach to teaching data-driven decisions to varying user groups',
        'Prepare to discuss long-term career goals in retail inventory/merchandising leadership',
      ],
      mid: [
        'Review all previous interview topics for deeper follow-up on forecasting and replenishment',
        'Prepare to meet additional team members: buyers, planners, allocations, store ops',
        'Document questions about team dynamics and collaboration with merchandising',
        'Prepare to discuss specific scenarios: seasonal planning, promotional events, stockouts',
        'Review salary expectations with retail industry market data',
        'Prepare to express strong interest and ask about next steps in process',
        'Document your decision factors and timeline for accepting an offer',
        'Prepare questions about growth into senior analyst or planning roles',
      ],
      junior: [
        'Review fundamentals discussed in previous interviews about inventory and forecasting',
        'Prepare to meet additional team members in merchandising organization',
        'Document your enthusiasm for retail inventory and merchandising career',
        'Prepare questions about day-to-day life, team culture, and collaboration',
        'Review entry-level inventory analyst salary expectations in retail',
        'Prepare to express commitment and interest in learning the role',
        'Document your availability to start and flexibility',
        'Prepare questions about first projects, training timeline, and early responsibilities',
      ],
    },
  },

  // ==================== SOFTWARE ENGINEERING ====================
  software: {
    technical_screen: {
      senior: [
        'Review experience developing and maintaining SaaS applications with modern frameworks',
        'Prepare to discuss RESTful API and microservices implementation',
        'Document experience with relational (PostgreSQL, MySQL) and NoSQL databases (MongoDB, Redis)',
        'Review containerization with Docker and orchestration using Kubernetes',
        'Prepare examples of comprehensive unit testing and full SDLC participation',
        'Document mentoring developers through pairing sessions and code reviews',
        'Review best practices for AI-assisted development and modern tooling',
        'Prepare to discuss guiding architectural decisions based on proven patterns and pragmatic tradeoffs',
        'Document fostering a culture of continuous learning and technical excellence',
        'Review collaborating across teams on multiple concurrent projects',
        'Prepare to discuss cloud platforms: AWS, GCP, Azure services used',
        'Document your approach to technical leadership and practical guidance',
      ],
      mid: [
        'Review data structures: arrays, hashmaps, trees, graphs - when to use each',
        'Prepare 3-5 minute technical explanation of your main projects',
        'Practice coding simple problems while explaining thought process',
        'Review OOP concepts: SOLID principles, design patterns used',
        'Study your language\'s standard library: collections, utilities',
        'Prepare technical questions about the company\'s stack',
        'Review debugging techniques: stack traces, debuggers, logging',
        'Prepare to discuss your development workflow: git, testing, CI/CD',
        'Study basic SQL: JOINs, aggregations, indexing',
        'Review API design basics: REST principles, error handling',
        'Document experience with Docker containers and basic Kubernetes concepts',
        'Prepare to discuss unit testing practices and code coverage',
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
        'Practice designing SaaS applications for scalability and multi-tenancy',
        'Review microservices architecture: service decomposition, API gateway, service mesh',
        'Prepare to discuss RESTful API design: versioning, pagination, error handling',
        'Study containerization patterns: Docker multi-stage builds, image optimization',
        'Review Kubernetes concepts: deployments, services, ingress, ConfigMaps, Secrets',
        'Prepare cloud platform architecture: AWS/GCP/Azure service selection',
        'Document database design: relational vs NoSQL trade-offs, sharding, replication',
        'Review caching strategies: Redis, CDN, application-level caching',
        'Prepare message queue patterns: Kafka, RabbitMQ, event-driven architecture',
        'Study CI/CD pipeline design: testing stages, deployment strategies',
        'Review observability: logging, metrics, tracing, alerting',
        'Prepare to discuss architectural decisions and pragmatic tradeoffs',
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
        'Prepare STAR story about mentoring developers through pairing sessions and code reviews',
        'Document sharing best practices for AI-assisted development and modern tooling',
        'Review guiding architectural decisions: proven patterns, pragmatic tradeoffs',
        'Prepare examples of fostering continuous learning and technical excellence culture',
        'Document collaborating across teams on multiple concurrent projects',
        'Review leading technical initiatives with quantified impact (latency %, cost savings)',
        'Prepare story about balancing tech debt vs feature delivery',
        'Document production incident handling: detection, response, post-mortem',
        'Review pushing back on requirements with data and alternatives',
        'Prepare cross-functional collaboration story with business stakeholders',
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
        'Review experience managing complex global calendars across multiple time zones',
        'Prepare examples of coordinating logistics for meetings, offsites, and leadership summits',
        'Document handling high-volume email correspondence with professionalism and discretion',
        'Review leading and facilitating staff meetings: setting agendas, capturing notes, tracking follow-ups',
        'Prepare to discuss serving as key point of contact representing the team',
        'Document project coordination: tracking milestones, deadlines, deliverables, stakeholder follow-up',
        'Review coordinating complex travel arrangements and large-scale events',
        'Prepare examples of acting as liaison between Managing Director, senior leaders, and cross-functional teams',
        'Document supporting organizational change initiatives and communications',
        'Review proactively identifying inefficiencies and suggesting workflow improvements',
        'Prepare to discuss promoting inclusive team environment with sensitivity to global teams and diverse cultures',
        'Document collaboration with other administrative professionals across teams',
      ],
      mid: [
        'Review calendar management and scheduling across time zones',
        'Prepare meeting coordination examples: logistics, agendas, follow-ups',
        'Document Microsoft Office proficiency: Word, Excel, PowerPoint, Outlook',
        'Review travel arrangement and expense report processing experience',
        'Prepare examples of handling multiple priorities and deadlines',
        'Document communication skills: email correspondence, phone etiquette, stakeholder interaction',
        'Review confidentiality and discretion when handling sensitive information',
        'Prepare to discuss your organizational systems and tracking methods',
        'Document event coordination for team meetings and small events',
        'Review supporting project milestones and deliverables tracking',
      ],
      junior: [
        'Review basic administrative skills: scheduling, filing, data entry',
        'Prepare Microsoft Office proficiency demonstration: Word, Excel, Outlook',
        'Document any receptionist, customer service, or front-desk experience',
        'Review professional communication: phone etiquette, email writing',
        'Prepare to discuss your organizational abilities and attention to detail',
        'Document examples of handling multiple tasks simultaneously',
        'Review note-taking and meeting support experience',
        'Prepare to discuss your interest in administrative support career',
        'Document any relevant coursework or certifications',
        'Review the company and prepare thoughtful questions',
      ],
    },
    behavioural: {
      senior: [
        'Prepare STAR stories about managing complex global calendars for senior leaders',
        'Document handling confidential and sensitive information with discretion',
        'Review coordinating high-stakes events: leadership summits, offsites, board meetings',
        'Prepare story about proactively identifying inefficiencies and implementing workflow improvements',
        'Document serving as liaison between executives and cross-functional teams',
        'Review prioritization when supporting multiple senior leaders with conflicting demands',
        'Prepare examples of promoting inclusive environment with sensitivity to global teams',
        'Document building strong relationships across diverse cultures and time zones',
        'Review supporting organizational change initiatives and communications',
        'Prepare story about anticipating needs before being asked',
      ],
      mid: [
        'Prepare stories demonstrating organizational skills in calendar and meeting management',
        'Document handling multiple priorities and deadlines under pressure',
        'Review examples of professional email correspondence and stakeholder communication',
        'Prepare story about solving an unexpected scheduling or logistics challenge',
        'Document attention to detail: catching errors, ensuring accuracy in communications',
        'Review handling stressful periods with multiple competing priorities',
        'Prepare teamwork examples collaborating with other administrative professionals',
        'Document following up on project milestones and deliverables',
      ],
      junior: [
        'Prepare STAR stories from school, part-time jobs, or volunteer work',
        'Document examples showing attention to detail and organization',
        'Review handling multiple tasks in a fast-paced environment',
        'Prepare story about learning a new system or process quickly',
        'Document customer service or front-facing communication experience',
        'Review examples of being reliable, dependable, and professional',
        'Prepare to discuss your interest in administrative support career path',
        'Document teamwork and collaboration examples from any setting',
      ],
    },
    recruiter_screening: {
      senior: [
        'Prepare career summary highlighting executive support for senior leaders and Managing Directors',
        'Document experience with global calendar management across multiple time zones',
        'Review salary expectations for senior administrative roles supporting leadership',
        'Prepare to discuss coordinating large-scale events: offsites, leadership summits',
        'Document your experience acting as liaison between executives and cross-functional teams',
        'Prepare questions about the executive(s) you\'d support and team culture',
        'Review the company leadership team and organizational structure',
        'Document your availability and flexibility for supporting global teams',
      ],
      mid: [
        'Prepare career overview: administrative experience, progression, key skills',
        'Research company: size, industry, culture, executive team structure',
        'Review market rate for administrative assistants in your area',
        'Prepare reasons for interest in this company and role',
        'Document your Microsoft Office proficiency and calendar management skills',
        'Prepare questions about team structure, duties, and executives you\'d support',
        'Review job description and map your experience to requirements',
        'Document your availability and any schedule considerations',
      ],
      junior: [
        'Prepare introduction: education, any office or customer service experience',
        'Research the company: products, culture, location, team',
        'Understand entry-level administrative salary in your area',
        'Prepare specific reasons for interest in administrative work',
        'Document your Microsoft Office skills and willingness to learn',
        'Prepare questions about training, responsibilities, and growth path',
        'Review what administrative assistants do day-to-day',
        'Document any relevant experience: reception, retail, customer service',
      ],
    },
    phone_screen: {
      senior: [
        'Review experience managing complex global calendars across time zones',
        'Prepare to discuss coordinating logistics for meetings, offsites, and leadership summits',
        'Document examples of handling confidential information with discretion',
        'Prepare STAR stories about leading staff meetings and tracking follow-ups',
        'Review your experience as liaison between senior leaders and cross-functional teams',
        'Prepare questions about the executive\'s working style and communication preferences',
        'Document your approach to supporting organizational change initiatives',
        'Prepare to discuss proactively identifying and improving administrative workflows',
      ],
      mid: [
        'Review your administrative experience: scheduling, correspondence, meeting coordination',
        'Prepare to discuss your most challenging administrative situation and resolution',
        'Document your Microsoft Office and technology proficiency',
        'Prepare STAR stories demonstrating organization and reliability',
        'Review your experience with travel arrangements and event coordination',
        'Prepare questions about typical day-to-day responsibilities',
        'Document examples of handling multiple priorities under deadlines',
        'Prepare to discuss your career goals in administrative support',
      ],
      junior: [
        'Review any administrative, office, or customer service experience',
        'Prepare to discuss your organizational skills and attention to detail',
        'Document your Microsoft Office proficiency: Word, Excel, Outlook, PowerPoint',
        'Prepare STAR stories from school, jobs, or activities showing reliability',
        'Review professional communication: phone etiquette, email writing',
        'Prepare questions about training and onboarding process',
        'Document your ability to handle multiple tasks and stay organized',
        'Prepare to discuss why you\'re interested in administrative work',
      ],
    },
    hiring_manager: {
      senior: [
        'Research the hiring manager and executive(s) you\'d support (Managing Director level)',
        'Prepare a 30-60-90 day plan for learning preferences and establishing trust with leadership',
        'Document your approach to building partnerships with senior leaders across time zones',
        'Prepare to discuss managing conflicting demands on your executive\'s calendar',
        'Review challenges: global coordination, large-scale events, organizational change support',
        'Prepare questions about communication preferences and working style expectations',
        'Document your experience promoting inclusive environment with diverse global teams',
        'Prepare to discuss collaborating with other administrative professionals',
      ],
      mid: [
        'Research the hiring manager and understand the team structure',
        'Prepare to discuss how you\'d ramp up on their processes and systems',
        'Document your experience in similar industries or supporting multiple stakeholders',
        'Prepare questions about day-to-day responsibilities and expectations',
        'Review what success looks like: calendar management, event execution, communication',
        'Prepare to discuss your working style and organizational methods',
        'Document your career goals and how this role fits your growth path',
        'Prepare questions about team culture and collaboration with other admins',
      ],
      junior: [
        'Research the hiring manager on LinkedIn',
        'Prepare to discuss how you approach learning new systems and processes',
        'Document your eagerness to learn and take on responsibility',
        'Prepare questions about training, feedback, and mentorship',
        'Review what you\'d likely do in your first few months',
        'Prepare to discuss your organizational style and reliability',
        'Document your ability to handle confidential information appropriately',
        'Prepare questions about growth and career development path',
      ],
    },
    final_round: {
      senior: [
        'Prepare for deeper discussions about supporting Managing Director and senior leadership',
        'Review experience coordinating high-stakes events: leadership summits, offsites, board meetings',
        'Document your approach to building trust and partnership with global executives',
        'Prepare to discuss scenarios: calendar conflicts across time zones, urgent executive requests',
        'Review compensation expectations and flexibility for global team support',
        'Prepare questions about organizational change initiatives and your role in communications',
        'Document your approach to identifying inefficiencies and improving workflows',
        'Prepare to meet additional stakeholders and demonstrate cultural sensitivity',
      ],
      mid: [
        'Review all previous interview topics for follow-up questions',
        'Prepare to meet additional team members or executives',
        'Document questions about team dynamics and working relationships',
        'Prepare to discuss specific scenarios: scheduling conflicts, event logistics challenges',
        'Review salary expectations with market data',
        'Prepare to express strong interest and ask about next steps',
        'Document your decision factors and timeline',
        'Prepare questions about growth opportunities and professional development',
      ],
      junior: [
        'Review key topics from previous interviews',
        'Prepare to meet additional team members',
        'Document your enthusiasm for the opportunity',
        'Prepare questions about day-to-day life and team culture',
        'Review entry-level administrative salary expectations',
        'Prepare to express commitment and interest in learning',
        'Document your availability to start',
        'Prepare questions about first projects and training timeline',
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

  // ==================== CHEMICAL ENGINEERING ====================
  chemical: {
    technical_screen: {
      executive: [
        'Review your experience leading chemical plant operations or process engineering groups',
        'Prepare to discuss major capital projects: reactor design, distillation columns, heat integration',
        'Document safety leadership: PSM compliance, HAZOP facilitation, MOC governance',
        'Review P&ID and process flow diagram development for complex systems',
        'Prepare examples of process optimization with quantified results (yield, throughput, cost)',
        'Document environmental compliance leadership: air permits, wastewater, EPA regulations',
        'Review your experience with technology transfer and scale-up from pilot to commercial',
        'Prepare to discuss vendor management for process equipment and catalysts',
      ],
      senior: [
        'Review reaction engineering: kinetics, reactor selection, conversion optimization',
        'Prepare to discuss mass transfer operations: distillation, absorption, extraction, crystallization',
        'Study process simulation tools: Aspen Plus, HYSYS, PRO/II experience',
        'Review thermodynamics: phase equilibria, VLE, activity coefficients, equations of state',
        'Document experience with heat exchanger design: LMTD, effectiveness-NTU, fouling',
        'Prepare examples of troubleshooting process upsets and identifying root causes',
        'Review process control: PID tuning, cascade control, advanced process control',
        'Study safety analysis: HAZOP, LOPA, inherently safer design principles',
        'Document experience with pilot plant operations and scale-up calculations',
        'Prepare to discuss material and energy balances for complex processes',
        'Review fluid mechanics: pump selection, pressure drop calculations, two-phase flow',
        'Document P&ID development and review experience',
      ],
      mid: [
        'Review unit operations fundamentals: distillation, heat transfer, mass transfer',
        'Prepare to discuss your process simulation experience and example projects',
        'Study material and energy balance calculations for process design',
        'Review thermodynamics: ideal gas, real gas, phase diagrams, Raoult\'s law',
        'Document your experience with process troubleshooting and data analysis',
        'Prepare to explain a process design or optimization project in detail',
        'Review equipment sizing: pumps, heat exchangers, vessels, columns',
        'Study safety fundamentals: MSDS, hazard identification, PPE requirements',
        'Document any hands-on plant or lab experience',
        'Prepare questions about the facility, products, and engineering challenges',
      ],
      junior: [
        'Review chemical engineering fundamentals: thermo, transport, kinetics, separations',
        'Study unit operations basics: distillation columns, heat exchangers, reactors',
        'Prepare to discuss senior design project or capstone experience',
        'Review material and energy balance fundamentals',
        'Document any process simulation experience (Aspen, HYSYS)',
        'Prepare to explain your interest in chemical engineering and this role',
        'Study the company\'s products and processes',
        'Review safety basics: hazard awareness, laboratory safety',
        'Document any internship or co-op experience in chemical industry',
        'Prepare thoughtful questions about the engineering team and projects',
      ],
    },
    technical_round: {
      senior: [
        'Prepare to solve reaction engineering problems: conversion, selectivity, reactor sizing',
        'Review distillation design: McCabe-Thiele, reflux ratio, feed location',
        'Study heat exchanger calculations: shell-and-tube design, LMTD correction factors',
        'Prepare whiteboard calculations: pressure drop, pump sizing, vessel design',
        'Review process control: transfer functions, stability, controller tuning',
        'Document experience with process economics: operating costs, capital estimation',
        'Prepare to discuss catalyst selection and deactivation mechanisms',
        'Review separation process selection for given requirements',
        'Study process safety calculations: relief valve sizing, flare loads',
        'Prepare examples of your analytical approach to process problems',
      ],
      mid: [
        'Review material balance calculations with reaction and recycle streams',
        'Prepare to solve basic heat transfer problems: conduction, convection, radiation',
        'Study distillation fundamentals: vapor-liquid equilibrium, relative volatility',
        'Review fluid mechanics: Bernoulli equation, friction losses, pump curves',
        'Document your approach to process calculations and estimation',
        'Prepare to discuss equipment selection for process requirements',
        'Review reaction kinetics: rate laws, Arrhenius equation, reactor comparison',
        'Study the company\'s processes and prepare relevant technical questions',
        'Prepare to explain your engineering problem-solving methodology',
        'Review safety considerations in process design',
      ],
    },
    behavioural: {
      senior: [
        'Prepare STAR story about solving a complex process engineering problem',
        'Document cross-functional collaboration: operations, maintenance, safety, environmental',
        'Review a time you identified a process improvement opportunity and implemented it',
        'Prepare story about managing a process upset or safety incident',
        'Document mentoring experience with junior engineers',
        'Review handling competing priorities between production and engineering projects',
        'Prepare examples of communicating technical issues to non-technical stakeholders',
        'Document continuous learning in chemical engineering technologies',
      ],
      mid: [
        'Prepare stories demonstrating technical problem-solving on process issues',
        'Document teamwork examples: your role in engineering projects',
        'Review a time you learned a new technology or process quickly',
        'Prepare story about handling a technical setback or failed experiment',
        'Document attention to detail examples in process work',
        'Review examples of working with operations or maintenance teams',
        'Prepare to discuss your career goals in chemical engineering',
        'Document any safety-conscious decisions or actions',
      ],
    },
  },

  // ==================== DATABASE ADMINISTRATOR (DBA) ====================
  dba: {
    technical_screen: {
      executive: [
        'Review your experience leading database teams and enterprise data strategy',
        'Prepare to discuss database architecture decisions: on-prem vs cloud, vendor selection',
        'Document major migration or upgrade projects you\'ve led',
        'Review disaster recovery and business continuity planning for databases',
        'Prepare examples of performance tuning with business impact metrics',
        'Document your approach to database security and compliance (SOX, HIPAA, PCI)',
        'Review vendor management: licensing negotiations, support escalations',
        'Prepare to discuss database modernization: legacy to cloud, microservices data patterns',
        'Document capacity planning and infrastructure budgeting experience',
        'Review high availability architecture: clustering, replication, failover strategies',
      ],
      senior: [
        'Review advanced query optimization: execution plans, index strategies, query rewrites',
        'Prepare to discuss database design: normalization, denormalization trade-offs, partitioning',
        'Study backup and recovery strategies: RPO/RTO requirements, point-in-time recovery',
        'Review high availability: clustering (RAC, Always On), replication, failover',
        'Document performance tuning experience: wait events, contention, I/O optimization',
        'Prepare examples of troubleshooting production database issues under pressure',
        'Review security: encryption, access control, auditing, vulnerability management',
        'Study automation: scripting (Python, PowerShell), infrastructure as code, CI/CD for DB',
        'Document experience with database migrations and version upgrades',
        'Prepare to discuss storage optimization: compression, tiering, archival',
        'Review your experience with different database platforms (Oracle, SQL Server, PostgreSQL, MySQL)',
        'Document monitoring and alerting setup for database health',
      ],
      mid: [
        'Review SQL fundamentals: joins, subqueries, CTEs, window functions',
        'Prepare to discuss index design: B-tree, hash, composite, covering indexes',
        'Study backup strategies: full, differential, incremental, backup validation',
        'Review basic performance tuning: slow query identification, execution plans',
        'Document experience with database installation, configuration, patching',
        'Prepare examples of troubleshooting connectivity or performance issues',
        'Study replication basics: master-slave, synchronous vs asynchronous',
        'Review user management: permissions, roles, access control',
        'Document your experience with specific database platforms',
        'Prepare questions about the database environment and challenges',
      ],
      junior: [
        'Review SQL basics: SELECT, INSERT, UPDATE, DELETE, JOINs',
        'Study database fundamentals: tables, indexes, constraints, relationships',
        'Prepare to discuss your database coursework or projects',
        'Review basic administration: creating databases, users, backups',
        'Document any experience with database platforms (academic or personal)',
        'Prepare to explain relational database concepts clearly',
        'Study the company\'s technology stack and database platforms used',
        'Review normalization concepts: 1NF, 2NF, 3NF',
        'Document troubleshooting approach for basic database issues',
        'Prepare questions about the DBA team structure and learning opportunities',
      ],
    },
    system_design: {
      senior: [
        'Review database architecture for high-traffic applications: sharding strategies, read replicas',
        'Prepare to design database schemas for specific use cases: e-commerce, analytics, logging',
        'Study data partitioning: horizontal vs vertical, partition pruning, maintenance',
        'Review caching strategies: query cache, application cache, cache invalidation',
        'Document experience with database selection: SQL vs NoSQL trade-offs for requirements',
        'Prepare to discuss data modeling for different workloads: OLTP vs OLAP',
        'Study distributed database patterns: CAP theorem, consistency models',
        'Review data pipeline architecture: ETL, CDC, real-time streaming',
        'Document experience with database cloud services (RDS, Aurora, Cloud SQL)',
        'Prepare to discuss multi-region database strategies and data locality',
      ],
      mid: [
        'Review basic database scaling: vertical vs horizontal, connection pooling',
        'Prepare to design simple database schemas with proper normalization',
        'Study index design for common query patterns',
        'Review replication strategies and their trade-offs',
        'Document experience with database backup and restore procedures',
        'Prepare to discuss connection management and pooling',
        'Study basic high availability concepts',
        'Review query optimization for application requirements',
        'Document your understanding of database monitoring and performance metrics',
        'Prepare questions about the company\'s database architecture',
      ],
    },
    behavioural: {
      senior: [
        'Prepare STAR story about resolving a critical database production issue',
        'Document examples of database performance improvements with metrics',
        'Review a time you prevented data loss or managed a disaster recovery situation',
        'Prepare story about balancing maintenance windows with business needs',
        'Document collaboration with development teams on database design',
        'Review handling urgent requests while maintaining stability',
        'Prepare examples of automating repetitive DBA tasks',
        'Document mentoring junior DBAs or training developers',
        'Review on-call experience and incident management',
        'Prepare story about a major migration or upgrade project',
      ],
      mid: [
        'Prepare stories demonstrating database troubleshooting skills',
        'Document teamwork with developers on database issues',
        'Review handling production alerts and after-hours incidents',
        'Prepare story about learning a new database platform quickly',
        'Document attention to detail in database administration',
        'Review examples of documentation and knowledge sharing',
        'Prepare to discuss your career goals in database administration',
        'Document any automation or scripting you\'ve done',
      ],
    },
  },

  // ==================== PHARMACIST ====================
  pharmacist: {
    clinical: {
      executive: [
        'Review your experience leading pharmacy departments: clinical services, operations, staff development',
        'Prepare to discuss pharmacy program development: MTM, specialty pharmacy, clinical protocols',
        'Document quality improvement initiatives with measurable outcomes',
        'Review regulatory compliance leadership: DEA, Board of Pharmacy, Joint Commission, CMS',
        'Prepare examples of formulary management and P&T committee participation',
        'Document budget management for pharmacy operations: drug spend, FTEs, technology',
        'Review your experience with pharmacy informatics and clinical decision support',
        'Prepare to discuss strategic planning for pharmacy services',
        'Document leadership in medication safety initiatives',
        'Review interdisciplinary collaboration at the executive level',
      ],
      senior: [
        'Prepare complex clinical cases demonstrating pharmacotherapy expertise',
        'Review medication therapy management: comprehensive reviews, recommendations, outcomes',
        'Document experience with specialty medications: biologics, oncology, transplant',
        'Prepare to discuss drug information resources and evidence-based practice',
        'Review pharmacokinetic calculations and dosing adjustments',
        'Document patient counseling approaches for complex regimens',
        'Prepare examples of identifying and resolving drug interactions',
        'Review your participation in interdisciplinary rounds and care teams',
        'Document experience with anticoagulation management',
        'Prepare to discuss antimicrobial stewardship principles and experience',
        'Review chronic disease management: diabetes, hypertension, heart failure',
        'Document adverse drug reaction identification and reporting',
      ],
      mid: [
        'Review common drug interactions and monitoring parameters',
        'Prepare to discuss your prescription verification workflow',
        'Document experience with common chronic disease medications',
        'Review counseling techniques for patient education',
        'Prepare examples of identifying prescription errors or issues',
        'Study regulatory requirements: controlled substances, prescription validity',
        'Document immunization experience and techniques',
        'Review basic pharmacokinetics: half-life, clearance, dosing intervals',
        'Prepare to discuss your approach to drug information questions',
        'Document any specialty pharmacy or clinical rotation experience',
      ],
      junior: [
        'Review core pharmacology from pharmacy school by therapeutic area',
        'Prepare examples from rotations demonstrating clinical judgment',
        'Study common drug interactions and contraindications',
        'Review patient counseling principles and communication techniques',
        'Document your clinical interests and why this practice setting',
        'Prepare to discuss how you stay current with drug information',
        'Review regulatory basics: DEA schedules, prescription requirements',
        'Document any residency or internship experience',
        'Prepare questions about clinical opportunities and preceptorship',
        'Review the organization: patient population, services, pharmacy model',
      ],
    },
    technical_screen: {
      senior: [
        'Review clinical pharmacy services you\'ve developed or managed',
        'Prepare to discuss advanced clinical certifications (BCPS, BCACP, BCOP)',
        'Document medication use evaluation experience',
        'Review pharmacoeconomic analyses: cost-effectiveness, drug budget impact',
        'Prepare examples of protocol development or clinical guidelines',
        'Document pharmacy informatics experience: EHR optimization, CPOE, alerts',
        'Review your experience with regulatory inspections and compliance',
        'Prepare to discuss quality metrics: medication errors, ADEs, clinical outcomes',
      ],
      mid: [
        'Review your clinical competencies and areas of expertise',
        'Prepare to discuss prescription processing accuracy and volume',
        'Document experience with specific patient populations',
        'Review technology proficiency: pharmacy systems, EHR, automation',
        'Prepare examples of clinical interventions with outcomes',
        'Document immunization certifications and experience',
        'Review your approach to staying current with drug updates',
        'Prepare questions about the clinical pharmacy program',
      ],
    },
    behavioural: {
      senior: [
        'Prepare STAR stories about complex clinical interventions with patient outcomes',
        'Document examples of leadership on interdisciplinary teams',
        'Review handling medication errors: disclosure, system improvement',
        'Prepare story about difficult patient or prescriber interactions',
        'Document mentoring students, residents, or junior pharmacists',
        'Review examples of advocating for patient safety or optimal therapy',
        'Prepare to discuss work-life balance in clinical pharmacy',
        'Document continuous learning and professional development',
      ],
      mid: [
        'Prepare patient care stories demonstrating clinical skills and compassion',
        'Document teamwork with physicians, nurses, and other healthcare providers',
        'Review handling high-volume, time-pressure situations',
        'Prepare story about catching a significant medication error',
        'Document examples of patient counseling making a difference',
        'Review managing difficult customers or patients professionally',
        'Prepare to discuss career goals in pharmacy practice',
        'Document continuous improvement in practice',
      ],
    },
  },

  // ==================== PMO (Program Management Office) ====================
  pmo: {
    technical_screen: {
      executive: [
        'Review your experience establishing and leading PMO functions',
        'Prepare to discuss PMO operating models: supportive, controlling, directive',
        'Document portfolio management experience: prioritization, resource allocation, governance',
        'Review project management methodology implementation: Agile, Waterfall, hybrid',
        'Prepare examples of PMO value demonstration with business metrics',
        'Document experience with enterprise PPM tools (Planview, Clarity, Microsoft Project Server)',
        'Review your approach to project portfolio reporting to executives and boards',
        'Prepare to discuss PMO maturity assessment and improvement roadmaps',
        'Document change management and organizational development experience',
        'Review strategic planning alignment: projects to business objectives',
      ],
      senior: [
        'Review portfolio management: demand management, capacity planning, prioritization frameworks',
        'Prepare to discuss project governance: stage gates, steering committees, escalation',
        'Document experience with resource management across multiple projects',
        'Review financial management: project budgets, forecasting, earned value',
        'Prepare examples of implementing PM standards and best practices',
        'Study risk management: portfolio-level risks, contingency planning',
        'Document reporting and dashboards: KPIs, health metrics, executive summaries',
        'Review vendor and contract management for projects',
        'Prepare to discuss change management principles and experience',
        'Document training and capability building for project managers',
        'Review your experience with PPM tools and system administration',
        'Prepare examples of continuous improvement in PMO processes',
      ],
      mid: [
        'Review project management fundamentals: initiation, planning, execution, closure',
        'Prepare to discuss your experience supporting multiple project managers',
        'Document reporting experience: status reports, dashboards, metrics tracking',
        'Review scheduling: work breakdown structures, dependencies, critical path',
        'Prepare examples of maintaining project documentation and standards',
        'Study risk and issue tracking: logs, escalation procedures',
        'Document experience with PM tools (MS Project, Smartsheet, Jira)',
        'Review resource coordination and capacity management basics',
        'Prepare to discuss your organizational and analytical skills',
        'Document any PM certifications or training (CAPM, PMP)',
      ],
    },
    behavioural: {
      executive: [
        'Prepare STAR stories about building PMO functions from scratch',
        'Document examples of influencing without authority at executive levels',
        'Review handling resistance to PMO processes and governance',
        'Prepare story about portfolio-level decision making with trade-offs',
        'Document building and developing high-performing PMO teams',
        'Review managing conflicting priorities across programs and stakeholders',
        'Prepare examples of driving organizational change through PMO initiatives',
        'Document demonstrating PMO value to skeptical stakeholders',
      ],
      senior: [
        'Prepare stories about implementing process improvements across projects',
        'Document collaboration with project managers and functional leaders',
        'Review handling project escalations and executive communications',
        'Prepare story about managing through organizational change',
        'Document mentoring and developing project management talent',
        'Review examples of difficult stakeholder management',
        'Prepare to discuss your PM philosophy and approach',
        'Document continuous improvement examples in PMO operations',
      ],
    },
  },

  // ==================== PROJECT MANAGEMENT ====================
  project_mgmt: {
    technical_screen: {
      executive: [
        'Review your experience leading large, complex projects or programs',
        'Prepare to discuss project governance: steering committees, sponsors, stakeholders',
        'Document major project deliveries with budget, schedule, and scope outcomes',
        'Review risk management: identification, mitigation, contingency planning',
        'Prepare examples of managing distributed or global project teams',
        'Document stakeholder management at executive levels',
        'Review your approach to project recovery: troubled projects, turnarounds',
        'Prepare to discuss methodology selection: Agile, Waterfall, hybrid approaches',
        'Document change management: business readiness, adoption, training',
        'Review vendor management: contracts, SLAs, performance management',
      ],
      senior: [
        'Review project planning: WBS development, scheduling, resource planning',
        'Prepare to discuss your experience with different methodologies (PMP, Agile, PRINCE2)',
        'Document budget management: estimation, tracking, variance analysis',
        'Review risk and issue management: registers, mitigation strategies, escalation',
        'Prepare examples of managing cross-functional project teams',
        'Study stakeholder communication: status reports, steering committees, escalations',
        'Document scope management: requirements, change control, scope creep',
        'Review quality management: testing, acceptance criteria, quality gates',
        'Prepare to discuss resource management: allocation, conflicts, capacity',
        'Document lessons learned facilitation and continuous improvement',
        'Review contract types and vendor management basics',
        'Prepare examples of handling project challenges and recovery',
      ],
      mid: [
        'Review project management fundamentals: triple constraint, lifecycle phases',
        'Prepare to discuss your PM tool proficiency (MS Project, Jira, Asana, Smartsheet)',
        'Document experience managing project schedules and task tracking',
        'Review meeting facilitation: agendas, minutes, action items',
        'Prepare examples of coordinating team activities and deliverables',
        'Study risk identification and basic mitigation strategies',
        'Document communication skills: status reports, stakeholder updates',
        'Review your experience with requirements gathering and documentation',
        'Prepare to discuss handling competing priorities and deadlines',
        'Document any PM certifications (CAPM, PMP, Scrum certifications)',
      ],
      junior: [
        'Review project management basics from coursework or certification',
        'Prepare to discuss any project coordination experience',
        'Study project lifecycle phases and deliverables',
        'Document organizational and time management abilities',
        'Prepare examples demonstrating attention to detail',
        'Review common PM tools and your experience with them',
        'Document any leadership experience: school projects, volunteer work',
        'Prepare questions about project types and team structure',
        'Review the company and industry context for projects',
        'Document your interest in project management as a career',
      ],
    },
    behavioural: {
      senior: [
        'Prepare STAR stories about delivering complex projects successfully',
        'Document examples of managing difficult stakeholders',
        'Review recovering a troubled project: diagnosis, planning, execution',
        'Prepare story about managing team conflicts or performance issues',
        'Document cross-functional leadership without direct authority',
        'Review handling scope changes and competing priorities',
        'Prepare examples of risk management saving a project',
        'Document lessons learned that improved future projects',
        'Review managing under-resourced or over-committed projects',
        'Prepare story about difficult vendor or contractor management',
      ],
      mid: [
        'Prepare stories demonstrating project coordination skills',
        'Document meeting deadlines under pressure',
        'Review handling multiple tasks and priorities effectively',
        'Prepare story about solving a project problem creatively',
        'Document teamwork and collaboration examples',
        'Review examples of clear stakeholder communication',
        'Prepare to discuss career goals in project management',
        'Document organizational improvements you\'ve suggested',
      ],
    },
  },

  // ==================== CUSTOMER SUCCESS ====================
  customer_success: {
    technical_screen: {
      executive: [
        'Review your experience building and leading CS organizations',
        'Prepare to discuss CS strategy: segmentation, coverage models, health scoring',
        'Document retention and expansion metrics: GRR, NRR, upsell/cross-sell rates',
        'Review customer journey design: onboarding, adoption, renewal, advocacy',
        'Prepare examples of reducing churn with quantified results',
        'Document experience with CS technology: Gainsight, ChurnZero, Totango',
        'Review team development: hiring, training, performance management',
        'Prepare to discuss alignment with Sales, Product, and Support',
        'Document escalation management and executive-level customer relationships',
        'Review operationalizing voice of customer programs',
      ],
      senior: [
        'Review account management: business reviews, success plans, stakeholder mapping',
        'Prepare to discuss adoption strategies for complex products',
        'Document experience managing enterprise customer portfolios',
        'Review renewal forecasting and risk identification',
        'Prepare examples of customer expansion: upsell, cross-sell success',
        'Study customer health scoring: leading indicators, intervention triggers',
        'Document handling at-risk customers and churn prevention',
        'Review your approach to customer advocacy and references',
        'Prepare to discuss change management for customer organizations',
        'Document product feedback loops: customer voice to product team',
        'Review executive business review preparation and delivery',
        'Prepare examples of turning difficult customers into advocates',
      ],
      mid: [
        'Review customer success fundamentals: onboarding, adoption, value realization',
        'Prepare to discuss your customer management experience and portfolio size',
        'Document experience with customer health monitoring and check-ins',
        'Review basic metrics: NPS, CSAT, usage analytics, renewal rates',
        'Prepare examples of identifying and addressing customer risks',
        'Study escalation handling: when to escalate, how to manage',
        'Document product training and enablement experience',
        'Review your approach to building customer relationships',
        'Prepare to discuss handling unhappy customers professionally',
        'Document experience with CS tools and CRM systems',
      ],
      junior: [
        'Review customer success basics: what it is, how it differs from support',
        'Prepare to discuss relevant customer-facing experience',
        'Study the company\'s product and typical customer journey',
        'Document communication and relationship-building skills',
        'Prepare examples of helping customers succeed (any context)',
        'Review basic metrics: customer satisfaction, product usage',
        'Document your interest in customer success as a career',
        'Prepare questions about the CS team structure and accounts',
        'Review how to handle difficult customer situations',
        'Document organizational and follow-through abilities',
      ],
    },
    behavioural: {
      senior: [
        'Prepare STAR stories about saving at-risk customer relationships',
        'Document examples of significant upsell or expansion wins',
        'Review managing customer escalations to positive outcomes',
        'Prepare story about building executive relationships',
        'Document cross-functional collaboration: Sales, Product, Support',
        'Review handling difficult conversations: pricing, product gaps, mistakes',
        'Prepare examples of customer advocacy development',
        'Document mentoring or leading CS team members',
        'Review managing large customer portfolios effectively',
        'Prepare story about turning customer feedback into product changes',
      ],
      mid: [
        'Prepare customer stories demonstrating relationship building',
        'Document examples of identifying and solving customer problems',
        'Review handling unhappy customers professionally',
        'Prepare story about driving product adoption with a customer',
        'Document teamwork with internal teams for customer benefit',
        'Review examples of clear customer communication',
        'Prepare to discuss your approach to organization and follow-up',
        'Document handling multiple customers and competing priorities',
      ],
    },
    hiring_manager: {
      senior: [
        'Research the hiring manager and CS organization structure',
        'Prepare questions about portfolio: customer count, ARR, segments',
        'Document your approach to ramping up in a new CS role',
        'Prepare to discuss your customer success philosophy',
        'Review the company\'s product and typical customer challenges',
        'Prepare questions about CS tools, metrics, and team culture',
        'Document your approach to building internal relationships',
        'Prepare to discuss career goals in customer success',
      ],
    },
  },

  // ==================== HUMAN RESOURCES (Expanded) ====================
  hr: {
    technical_screen: {
      executive: [
        'Review your experience leading HR functions: COE vs HRBP models, shared services',
        'Prepare to discuss HR strategy alignment with business objectives',
        'Document organizational design and change management experience',
        'Review compensation philosophy: pay equity, market positioning, total rewards',
        'Prepare examples of talent strategy: workforce planning, succession, development',
        'Document HR technology leadership: HRIS selection, implementation, optimization',
        'Review employee relations at scale: investigations, policy development, compliance',
        'Prepare to discuss M&A HR integration experience',
        'Document diversity, equity, and inclusion program development',
        'Review labor relations and union management (if applicable)',
      ],
      senior: [
        'Review HR business partnering: understanding business strategy, HR solutions',
        'Prepare to discuss employee relations: investigations, performance management, terminations',
        'Document experience with compensation: job evaluation, salary structures, benchmarking',
        'Review talent management: performance reviews, development planning, succession',
        'Prepare examples of organizational change: restructuring, role design, transitions',
        'Study employment law: FMLA, ADA, FLSA, discrimination, harassment',
        'Document recruiting: full-cycle, sourcing strategies, interview training',
        'Review your experience with HRIS systems and HR analytics',
        'Prepare to discuss conflict resolution and mediation',
        'Document policy development and communication',
        'Review benefits administration and open enrollment management',
        'Prepare examples of employee engagement initiatives',
      ],
      mid: [
        'Review HR fundamentals: employee lifecycle, policies, compliance requirements',
        'Prepare to discuss your experience in HR generalist or specialist role',
        'Document recruiting experience: sourcing, screening, interviewing',
        'Review onboarding program development and delivery',
        'Prepare examples of handling employee questions and issues',
        'Study employment law basics: wage and hour, leave, discrimination',
        'Document HRIS experience and data management',
        'Review benefits administration experience',
        'Prepare to discuss your approach to confidentiality',
        'Document performance management process support',
      ],
      junior: [
        'Review HR basics from coursework or certification (PHR, SHRM-CP)',
        'Prepare to discuss relevant HR experience: internships, projects',
        'Study employment law fundamentals',
        'Document organizational and confidentiality abilities',
        'Prepare examples of customer service and communication skills',
        'Review HRIS and Microsoft Office proficiency',
        'Document interest in HR as a career path',
        'Prepare questions about the HR team and learning opportunities',
        'Review the company culture and values',
        'Document attention to detail examples',
      ],
    },
    behavioural: {
      senior: [
        'Prepare STAR stories about navigating complex employee relations issues',
        'Document examples of influencing business leaders on people decisions',
        'Review handling confidential and sensitive situations',
        'Prepare story about organizational change you led or supported',
        'Document building trust with employees and managers',
        'Review examples of creative HR solutions to business problems',
        'Prepare to discuss handling difficult conversations with empathy',
        'Document continuous learning in HR practices and compliance',
        'Review conflict resolution and mediation experience',
        'Prepare story about improving HR processes or programs',
      ],
      mid: [
        'Prepare stories demonstrating HR problem-solving and employee support',
        'Document handling confidential information appropriately',
        'Review examples of customer service to employees and managers',
        'Prepare story about learning new HR processes or systems',
        'Document teamwork within HR and cross-functionally',
        'Review handling high-volume, deadline-driven HR work',
        'Prepare to discuss career goals in human resources',
        'Document attention to detail and accuracy in HR data',
      ],
    },
    recruiter_screening: {
      senior: [
        'Prepare to discuss your HR career progression and specializations',
        'Document experience relevant to this specific HR role',
        'Review salary expectations for HR positions at this level',
        'Prepare to explain your interest in this company and role',
        'Document achievements in previous HR positions',
        'Review company culture and HR department structure',
        'Prepare questions about HR challenges and priorities',
        'Document your HR philosophy and approach',
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
    // Recruiter/Initial screening variations
    'recruiter_screening': ['recruiter_screening', 'phone_screen'],
    'recruiter_screen': ['recruiter_screening', 'phone_screen'],
    'recruiter_call': ['recruiter_screening', 'phone_screen'],
    'initial_screen': ['recruiter_screening', 'phone_screen'],
    'hr_screen': ['recruiter_screening', 'phone_screen'],
    'hr_screening': ['recruiter_screening', 'phone_screen'],
    // Phone screen variations
    'phone_screen': ['phone_screen', 'recruiter_screening'],
    'phone_interview': ['phone_screen', 'recruiter_screening'],
    'phone_call': ['phone_screen', 'recruiter_screening'],
    'screening_call': ['phone_screen', 'recruiter_screening'],
    // Hiring manager variations
    'hiring_manager': ['hiring_manager', 'behavioural', 'final_round'],
    'hiring_manager_interview': ['hiring_manager', 'behavioural'],
    'manager_interview': ['hiring_manager', 'behavioural'],
    'manager_round': ['hiring_manager', 'behavioural'],
    // Final round variations
    'final_round': ['final_round', 'hiring_manager', 'behavioural'],
    'final_interview': ['final_round', 'hiring_manager'],
    'final': ['final_round', 'hiring_manager'],
    'onsite': ['final_round', 'hiring_manager', 'technical_round'],
    'on_site': ['final_round', 'hiring_manager', 'technical_round'],
    'in_person': ['final_round', 'hiring_manager'],
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
    // Offer stage
    'offer': ['final_round'],
    'offer_negotiation': ['final_round'],
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
