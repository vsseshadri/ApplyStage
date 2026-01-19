export const STAGE_COLORS: { [key: string]: string } = {
  'Applied': '#6B7280',
  'Recruiter Screening': '#3B82F6',
  'Phone Screen': '#8B5CF6',
  'Coding Round': '#EC4899',
  'System Design Round': '#F59E0B',
  'Behavioral Round': '#10B981',
  'Hiring Manager': '#06B6D4',
  'Final Onsite Interview': '#EF4444',
  'Initial Screening': '#3B82F6',
  'Technical Assessment': '#8B5CF6',
  'Manager Interview': '#10B981',
  'Partner Interview': '#06B6D4',
  'Final Interview': '#EF4444',
};

export const getStageColor = (stage: string): string => {
  return STAGE_COLORS[stage] || '#6B7280';
};

export const WORK_TYPE_COLORS = {
  onsite: '#3B82F6',
  remote: '#10B981',
  hybrid: '#8B5CF6',
};

export const OUTCOME_COLORS = {
  pending: '#F59E0B',
  passed: '#10B981',
  failed: '#EF4444',
};
