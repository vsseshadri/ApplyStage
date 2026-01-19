/**
 * Standard interview stages for dropdown selection
 */
export const STANDARD_INTERVIEW_STAGES = [
  'Applied',
  'Recruiter Screen',
  'Phone Screen',
  'Coding Round',
  'System Design',
  'Behavioral Round',
  'Hiring Manager Round',
  'Onsite Interview',
  'Offer',
  'Rejected',
];

/**
 * Get all unique stages from a job (standard + custom)
 */
export const getAllStages = (customStages: string[] = []): string[] => {
  const allStages = [...STANDARD_INTERVIEW_STAGES, ...customStages];
  // Remove duplicates
  return Array.from(new Set(allStages));
};
