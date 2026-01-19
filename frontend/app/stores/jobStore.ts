import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Job {
  job_id: string;
  company: string;
  position: string;
  job_family: string;
  location: string;
  salary_range?: { min: number; max: number; currency: string };
  work_type: string;
  applied_date: string;
  current_stage: string;
  total_business_days_aging: number;
  stage_business_days_aging: number;
  url?: string;
  notes?: string;
  ai_insights?: any;
}

interface JobState {
  jobs: Job[];
  loading: boolean;
  error: string | null;
  fetchJobs: () => Promise<void>;
  addJob: (jobData: any) => Promise<void>;
  updateJob: (jobId: string, jobData: any) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  updateStage: (jobId: string, stage: string, outcome: string) => Promise<void>;
}

const getAuthHeader = async () => {
  const token = await SecureStore.getItemAsync('session_token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

export const useJobStore = create<JobState>((set, get) => ({
  jobs: [],
  loading: false,
  error: null,

  fetchJobs: async () => {
    set({ loading: true, error: null });
    try {
      const headers = await getAuthHeader();
      const response = await fetch(`${API_URL}/api/jobs`, { headers });
      if (response.ok) {
        const jobs = await response.json();
        set({ jobs, loading: false });
      } else {
        throw new Error('Failed to fetch jobs');
      }
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  addJob: async (jobData: any) => {
    try {
      const headers = await getAuthHeader();
      const response = await fetch(`${API_URL}/api/jobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify(jobData),
      });
      if (response.ok) {
        await get().fetchJobs();
      } else {
        throw new Error('Failed to add job');
      }
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  updateJob: async (jobId: string, jobData: any) => {
    try {
      const headers = await getAuthHeader();
      const response = await fetch(`${API_URL}/api/jobs/${jobId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(jobData),
      });
      if (response.ok) {
        await get().fetchJobs();
      } else {
        throw new Error('Failed to update job');
      }
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  deleteJob: async (jobId: string) => {
    try {
      const headers = await getAuthHeader();
      const response = await fetch(`${API_URL}/api/jobs/${jobId}`, {
        method: 'DELETE',
        headers,
      });
      if (response.ok) {
        set({ jobs: get().jobs.filter(j => j.job_id !== jobId) });
      } else {
        throw new Error('Failed to delete job');
      }
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  updateStage: async (jobId: string, stage: string, outcome: string = 'pending') => {
    try {
      const headers = await getAuthHeader();
      const response = await fetch(`${API_URL}/api/jobs/${jobId}/stage`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ stage, outcome }),
      });
      if (response.ok) {
        await get().fetchJobs();
      } else {
        throw new Error('Failed to update stage');
      }
    } catch (error: any) {
      set({ error: error.message });
    }
  },
}));
