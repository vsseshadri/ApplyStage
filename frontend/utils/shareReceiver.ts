/**
 * Share Receiver Utility
 * Handles shared content from other apps on both iOS and Android
 * 
 * iOS: Uses App Groups to receive data from Share Extension via native bridge
 * Android: Uses react-native-receive-sharing-intent for intent handling
 */

import { Platform, Linking, AppState, AppStateStatus, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReceiveSharingIntent from 'react-native-receive-sharing-intent';

// Native module for iOS Share Extension data bridge
const { ShareDataBridge } = NativeModules;

export interface SharedJobData {
  url: string;
  text?: string;
  timestamp: number;
}

export interface ParsedJobData {
  company_name: string;
  position: string;
  job_type: string;
  work_mode: string;
  location: {
    state: string;
    city: string;
  };
  min_salary: string;
  max_salary: string;
  status: string;
  job_url: string;
  date_applied: string;
}

const SHARED_DATA_KEY = 'SHARED_JOB_DATA';
const PROCESSED_URLS_KEY = 'PROCESSED_SHARE_URLS';
const APP_GROUP_KEY = 'SharedJobData'; // Must match iOS Share Extension

/**
 * Parse job details from URL and text using common patterns
 */
export function parseJobDetailsFromContent(url: string, text?: string): ParsedJobData {
  const today = new Date().toISOString().split('T')[0];
  
  // Initialize with defaults
  const parsed: ParsedJobData = {
    company_name: '',
    position: '',
    job_type: 'full_time',
    work_mode: 'hybrid',
    location: {
      state: '',
      city: '',
    },
    min_salary: '',
    max_salary: '',
    status: 'applied',
    job_url: url,
    date_applied: today,
  };

  // Combine URL and text for parsing
  const content = `${url} ${text || ''}`.toLowerCase();
  const originalContent = `${url} ${text || ''}`;

  // Extract company name from URL patterns
  if (url.includes('linkedin.com')) {
    // LinkedIn URL pattern: /jobs/view/JOBID or /company/COMPANY-NAME
    const companyMatch = url.match(/linkedin\.com\/(?:company\/|jobs\/view\/[^/]+\/?)([^/?]+)/i);
    if (companyMatch) {
      parsed.company_name = formatCompanyName(companyMatch[1]);
    }
  } else if (url.includes('indeed.com')) {
    // Indeed patterns
    const companyMatch = url.match(/indeed\.com.*?cmp=([^&]+)/i);
    if (companyMatch) {
      parsed.company_name = formatCompanyName(decodeURIComponent(companyMatch[1]));
    }
  } else if (url.includes('glassdoor.com')) {
    // Glassdoor patterns
    const companyMatch = url.match(/glassdoor\.com\/.*?-([^-]+)-/i);
    if (companyMatch) {
      parsed.company_name = formatCompanyName(companyMatch[1]);
    }
  }

  // Try to extract company name from text if not found in URL
  if (!parsed.company_name && text) {
    // Look for "at Company" or "- Company" patterns
    const atMatch = text.match(/(?:at|@)\s+([A-Z][A-Za-z0-9\s&.]+?)(?:\s+[-|·]|\s*$)/);
    const dashMatch = text.match(/[-|·]\s*([A-Z][A-Za-z0-9\s&.]+?)(?:\s+[-|·]|\s*$)/);
    if (atMatch) {
      parsed.company_name = atMatch[1].trim();
    } else if (dashMatch) {
      parsed.company_name = dashMatch[1].trim();
    }
  }

  // Extract position/title from text
  if (text) {
    // LinkedIn often has: "Position at Company | Location"
    const positionMatch = text.match(/^([^|·\-]+?)(?:\s+at\s+|\s*[-|·])/i);
    if (positionMatch) {
      parsed.position = positionMatch[1].trim();
    }
  }

  // Detect job type
  if (content.includes('full-time') || content.includes('full time') || content.includes('fulltime')) {
    parsed.job_type = 'full_time';
  } else if (content.includes('part-time') || content.includes('part time') || content.includes('parttime')) {
    parsed.job_type = 'part_time';
  } else if (content.includes('contract') || content.includes('contractor')) {
    parsed.job_type = 'contract';
  } else if (content.includes('internship') || content.includes('intern ')) {
    parsed.job_type = 'internship';
  }

  // Detect work mode
  if (content.includes('remote') || content.includes('work from home') || content.includes('wfh')) {
    parsed.work_mode = 'remote';
  } else if (content.includes('hybrid')) {
    parsed.work_mode = 'hybrid';
  } else if (content.includes('on-site') || content.includes('onsite') || content.includes('in-office')) {
    parsed.work_mode = 'onsite';
  }

  // Extract location (city, state patterns)
  const locationPatterns = [
    // "City, State" or "City, ST"
    /(?:in|at|location[:\s]*)([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),?\s*([A-Z]{2}|[A-Z][a-z]+)/i,
    // Just state abbreviation
    /\b(San Francisco|New York|Los Angeles|Chicago|Seattle|Austin|Boston|Denver|Atlanta|Miami|Dallas|Houston)\b/i,
  ];

  for (const pattern of locationPatterns) {
    const match = originalContent.match(pattern);
    if (match) {
      if (match[2]) {
        parsed.location.city = match[1].trim();
        parsed.location.state = match[2].trim();
      } else {
        parsed.location.city = match[1].trim();
      }
      break;
    }
  }

  // Extract salary if present
  const salaryPatterns = [
    // "$100,000 - $150,000" or "$100K - $150K"
    /\$\s*([\d,]+)(?:k|K)?\s*[-–to]+\s*\$?\s*([\d,]+)(?:k|K)?/,
    // "100,000 - 150,000 per year"
    /([\d,]+)\s*[-–to]+\s*([\d,]+)(?:\s*(?:per|a)\s*year)?/i,
  ];

  for (const pattern of salaryPatterns) {
    const match = originalContent.match(pattern);
    if (match) {
      let min = parseInt(match[1].replace(/,/g, ''));
      let max = parseInt(match[2].replace(/,/g, ''));
      
      // Handle K notation
      if (originalContent.match(/\$\s*[\d,]+k/i)) {
        if (min < 1000) min *= 1000;
        if (max < 1000) max *= 1000;
      }
      
      parsed.min_salary = min.toLocaleString();
      parsed.max_salary = max.toLocaleString();
      break;
    }
  }

  return parsed;
}

/**
 * Format company name from URL slug
 */
function formatCompanyName(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

/**
 * Initialize share intent listener (for Android)
 */
export function initializeShareListener(callback: (data: SharedJobData) => void): () => void {
  if (Platform.OS === 'android') {
    // Get initial shared files on app launch
    ReceiveSharingIntent.getReceivedFiles(
      (files: any[]) => {
        if (files && files.length > 0) {
          const file = files[0];
          const url = file.weblink || file.text || '';
          if (url) {
            callback({
              url: url,
              text: file.text,
              timestamp: Date.now(),
            });
          }
        }
      },
      (error: any) => {
        console.log('Error getting shared files:', error);
      },
      'com.vsseshadri.careerflow' // Your app's package name
    );

    // Clear intent after processing
    return () => {
      ReceiveSharingIntent.clearReceivedFiles();
    };
  }
  
  return () => {};
}

/**
 * Check for shared data from iOS App Group
 */
export async function checkIOSAppGroupData(): Promise<SharedJobData | null> {
  if (Platform.OS !== 'ios') return null;
  
  try {
    // On iOS, we check AsyncStorage which should be bridged to App Group
    // The Share Extension writes to the shared UserDefaults
    const sharedData = await AsyncStorage.getItem(SHARED_DATA_KEY);
    if (sharedData) {
      const parsed = JSON.parse(sharedData);
      // Clear after reading
      await AsyncStorage.removeItem(SHARED_DATA_KEY);
      return parsed;
    }
  } catch (error) {
    console.log('Error checking iOS App Group data:', error);
  }
  return null;
}

/**
 * Check for shared content on app launch or resume
 */
export async function checkForSharedContent(): Promise<SharedJobData | null> {
  // Check AsyncStorage for any pending shared data
  try {
    const storedData = await AsyncStorage.getItem(SHARED_DATA_KEY);
    if (storedData) {
      const parsed = JSON.parse(storedData);
      await AsyncStorage.removeItem(SHARED_DATA_KEY);
      return parsed;
    }
  } catch (error) {
    console.error('Error checking shared content:', error);
  }
  
  return null;
}

/**
 * Store shared data (called from native bridge or deep link)
 */
export async function storeSharedData(data: SharedJobData): Promise<void> {
  try {
    await AsyncStorage.setItem(SHARED_DATA_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error storing shared data:', error);
  }
}

/**
 * Mark a URL as processed to prevent duplicate entries
 */
export async function markUrlAsProcessed(url: string): Promise<void> {
  try {
    const processed = await AsyncStorage.getItem(PROCESSED_URLS_KEY);
    const urls: string[] = processed ? JSON.parse(processed) : [];
    if (!urls.includes(url)) {
      urls.push(url);
      // Keep only last 100 URLs
      if (urls.length > 100) urls.shift();
      await AsyncStorage.setItem(PROCESSED_URLS_KEY, JSON.stringify(urls));
    }
  } catch (error) {
    console.error('Error marking URL as processed:', error);
  }
}

/**
 * Check if a URL has already been processed
 */
export async function isUrlProcessed(url: string): Promise<boolean> {
  try {
    const processed = await AsyncStorage.getItem(PROCESSED_URLS_KEY);
    if (processed) {
      const urls: string[] = JSON.parse(processed);
      return urls.includes(url);
    }
  } catch (error) {
    console.error('Error checking processed URLs:', error);
  }
  return false;
}

/**
 * Setup URL listener for deep linking
 */
export function setupShareListener(callback: (data: SharedJobData) => void): () => void {
  const handleUrl = (event: { url: string }) => {
    if (event.url.startsWith('careerflow://share')) {
      try {
        const params = new URLSearchParams(event.url.split('?')[1]);
        const url = params.get('url');
        const text = params.get('text');
        
        if (url) {
          callback({
            url: decodeURIComponent(url),
            text: text ? decodeURIComponent(text) : undefined,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        console.error('Error parsing share URL:', error);
      }
    }
  };

  const subscription = Linking.addEventListener('url', handleUrl);
  
  return () => {
    subscription.remove();
  };
}
