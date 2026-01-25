import { format, parseISO } from 'date-fns';

/**
 * Format date based on user's locale
 * Automatically formats dates according to device/browser locale
 */
export const formatDate = (date: string | Date, formatStr: string = 'MMM dd, yyyy'): string => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, formatStr);
  } catch (error) {
    console.error('Date formatting error:', error);
    return String(date);
  }
};

export const formatDateTime = (date: string | Date): string => {
  return formatDate(date, 'MMM dd, yyyy HH:mm');
};

export const formatShortDate = (date: string | Date): string => {
  return formatDate(date, 'MMM dd');
};

export const formatLongDate = (date: string | Date): string => {
  return formatDate(date, 'MMMM dd, yyyy');
};
