import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useFilter } from '../../contexts/FilterContext';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { format, differenceInDays, subDays, isAfter } from 'date-fns';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from '@react-navigation/native';
import { US_STATES_AND_CITIES, US_STATES } from '../../utils/usStatesAndCities';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

const STATUSES = ['applied', 'recruiter_screening', 'phone_screen', 'coding_round_1', 'coding_round_2', 'system_design', 'behavioural', 'hiring_manager', 'final_round', 'offer', 'rejected'];
const DEFAULT_POSITIONS = ['Software Engineer', 'Senior Software Engineer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer', 'DevOps Engineer', 'Data Scientist', 'Product Manager', 'UI/UX Designer'];
const WORK_MODES = ['remote', 'onsite', 'hybrid'];

// Status colors for the distinct display
const STATUS_COLORS: {[key: string]: string} = {
  applied: '#3B82F6',
  recruiter_screening: '#F59E0B',
  phone_screen: '#EF4444',
  coding_round_1: '#8B5CF6',
  coding_round_2: '#A855F7',
  system_design: '#C084FC',
  behavioural: '#06B6D4',
  hiring_manager: '#14B8A6',
  final_round: '#10B981',
  offer: '#22C55E',
  rejected: '#DC2626'
};

// State abbreviation mapping
const STATE_ABBREVIATIONS: {[key: string]: string} = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
  'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
};

const getStateAbbreviation = (state: string): string => {
  return STATE_ABBREVIATIONS[state] || state.substring(0, 2).toUpperCase();
};

export default function MyJobsScreen() {
  const { user, sessionToken, refreshUser } = useAuth();
  const { colors, isDark } = useTheme();
  const { filter, filterTitle, clearFilter, setFilter } = useFilter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingJob, setEditingJob] = useState<any | null>(null);
  const [customPositions, setCustomPositions] = useState<string[]>([]);
  const [showPositionInput, setShowPositionInput] = useState(false);
  const [newPosition, setNewPosition] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [resumeFile, setResumeFile] = useState<any>(null);
  const [dateAppliedText, setDateAppliedText] = useState('');
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  
  // Filter states
  const [localFilter, setLocalFilter] = useState<string>('all');
  const [workModeFilter, setWorkModeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Filter dropdown modals
  const [showWorkModeFilterDropdown, setShowWorkModeFilterDropdown] = useState(false);
  const [showStatusFilterDropdown, setShowStatusFilterDropdown] = useState(false);
  
  // Selection mode state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  
  // Swipe action state
  const [swipedJobId, setSwipedJobId] = useState<string | null>(null);
  
  // Detect tablet (width > 768)
  const isTablet = screenWidth >= 768;
  
  // Listen for screen size changes
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);

  // Clear filter when leaving screen
  useFocusEffect(
    React.useCallback(() => {
      fetchJobs();
      // Return cleanup function to clear filter when leaving
      return () => {
        clearFilter();
      };
    }, [])
  );
  
  // State/City dropdown modal states
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [showPositionDropdown, setShowPositionDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [customStatuses, setCustomStatuses] = useState<string[]>([]);
  const [newStatus, setNewStatus] = useState('');
  const [showStatusInput, setShowStatusInput] = useState(false);

  const [formData, setFormData] = useState({
    company_name: '',
    position: '',
    min_salary: '',
    max_salary: '',
    work_mode: 'remote',
    job_url: '',
    recruiter_email: '',
    status: 'applied',
    follow_up_days: '',
    is_priority: false,
  });

  useFocusEffect(
    React.useCallback(() => {
      fetchJobs();
    }, [])
  );

  useEffect(() => {
    fetchJobs();
    fetchCustomPositions();
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/jobs`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setJobs(data);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchCustomPositions = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/positions`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setCustomPositions(data.map((p: any) => p.position_name));
      }
    } catch (error) {
      console.error('Error fetching custom positions:', error);
    }
  };

  // Filter jobs based on the current filter from context
  const getFilteredJobs = () => {
    const now = new Date();
    const tenDaysAgo = subDays(now, 10);
    
    let result = [...jobs];
    
    // Apply global filter from context (from Dashboard navigation)
    if (filter === 'last_10_days') {
      result = result.filter(job => {
        const dateApplied = job.date_applied ? new Date(job.date_applied) : null;
        return dateApplied && isAfter(dateApplied, tenDaysAgo);
      });
    } else if (filter === 'final_round') {
      result = result.filter(job => job.status === 'final_round');
    } else if (filter === 'offers') {
      result = result.filter(job => job.status === 'offer');
    }
    
    // Apply local "Last 10 Days" filter (only if global filter is 'all')
    if (filter === 'all' && localFilter === 'last_10_days') {
      result = result.filter(job => {
        const dateApplied = job.date_applied ? new Date(job.date_applied) : null;
        return dateApplied && isAfter(dateApplied, tenDaysAgo);
      });
    }
    
    // Apply work mode filter
    if (workModeFilter !== 'all') {
      result = result.filter(job => job.work_mode?.toLowerCase() === workModeFilter.toLowerCase());
    }
    
    if (statusFilter !== 'all') {
      result = result.filter(job => job.status === statusFilter);
    }
    
    return result;
  };

  const filteredJobs = getFilteredJobs();
  
  // Selection functions
  const toggleSelectMode = () => {
    setSelectMode(!selectMode);
    setSelectedJobs(new Set());
  };
  
  const toggleJobSelection = (jobId: string) => {
    const newSelected = new Set(selectedJobs);
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId);
    } else {
      newSelected.add(jobId);
    }
    setSelectedJobs(newSelected);
  };
  
  const selectAllJobs = () => {
    const allIds = new Set(filteredJobs.map((job: any) => job.job_id));
    setSelectedJobs(allIds);
  };
  
  const deleteSelectedJobs = async () => {
    if (selectedJobs.size === 0) return;
    
    Alert.alert(
      'Delete Jobs',
      `Are you sure you want to delete ${selectedJobs.size} job(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const deletePromises = Array.from(selectedJobs).map(jobId =>
                fetch(`${BACKEND_URL}/api/jobs/${jobId}`, {
                  method: 'DELETE',
                  headers: { 'Authorization': `Bearer ${sessionToken}` }
                })
              );
              await Promise.all(deletePromises);
              setSelectedJobs(new Set());
              setSelectMode(false);
              fetchJobs();
            } catch (error) {
              console.error('Error deleting jobs:', error);
              Alert.alert('Error', 'Failed to delete some jobs');
            }
          }
        }
      ]
    );
  };
  
  // Single job deletion (for swipe action)
  const deleteJob = async (jobId: string) => {
    Alert.alert(
      'Delete Job',
      'Are you sure you want to delete this job application?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${BACKEND_URL}/api/jobs/${jobId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${sessionToken}` }
              });
              setSwipedJobId(null);
              fetchJobs();
            } catch (error) {
              console.error('Error deleting job:', error);
              Alert.alert('Error', 'Failed to delete job');
            }
          }
        }
      ]
    );
  };

  const handleAddCustomPosition = async () => {
    if (!newPosition.trim()) return;
    
    const trimmedPosition = newPosition.trim();
    
    // Add to custom positions locally FIRST
    setCustomPositions(prev => [...prev, trimmedPosition]);
    setFormData(prev => ({ ...prev, position: trimmedPosition }));
    setNewPosition('');
    setShowPositionInput(false);
    
    // Sync with backend async (non-blocking)
    try {
      await fetch(`${BACKEND_URL}/api/positions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ position_name: trimmedPosition })
      });
    } catch (error) {
      console.error('Error syncing custom position:', error);
      // Position is already added locally, so we can continue
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchJobs();
  };

  // Auto-format date as user types (MM/DD/YYYY)
  const handleDateChange = (text: string) => {
    // Remove any non-numeric characters except /
    let cleaned = text.replace(/[^0-9]/g, '');
    
    // Auto-add slashes
    let formatted = '';
    if (cleaned.length > 0) {
      formatted = cleaned.substring(0, 2);
    }
    if (cleaned.length > 2) {
      formatted += '/' + cleaned.substring(2, 4);
    }
    if (cleaned.length > 4) {
      formatted += '/' + cleaned.substring(4, 8);
    }
    
    setDateAppliedText(formatted);
  };

  const openAddModal = () => {
    setEditingJob(null);
    setFormData({
      company_name: '',
      position: '',
      min_salary: '',
      max_salary: '',
      work_mode: 'remote',
      job_url: '',
      recruiter_email: '',
      status: 'applied',
      follow_up_days: '',
      is_priority: false,
    });
    setSelectedState('');
    setSelectedCity('');
    setResumeFile(null);
    setDateAppliedText(format(new Date(), 'MM/dd/yyyy'));
    setShowPositionInput(false);
    setNewPosition('');
    setModalVisible(true);
  };

  const openEditModal = (job: any) => {
    setEditingJob(job);
    setFormData({
      company_name: job.company_name,
      position: job.position,
      min_salary: job.salary_range.min.toString(),
      max_salary: job.salary_range.max.toString(),
      work_mode: job.work_mode,
      job_url: job.job_url || '',
      recruiter_email: job.recruiter_email || '',
      status: job.status,
      follow_up_days: job.follow_up_days?.toString() || '',
      is_priority: job.is_priority || false,
    });
    setSelectedState(job.location.state || '');
    setSelectedCity(job.location.city || '');
    setResumeFile(job.resume_file ? { name: 'Uploaded Resume' } : null);
    const dateApplied = job.date_applied ? new Date(job.date_applied) : new Date();
    setDateAppliedText(format(dateApplied, 'MM/dd/yyyy'));
    setShowPositionInput(false);
    setNewPosition('');
    setModalVisible(true);
  };

  const handlePickResume = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const response = await fetch(file.uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setResumeFile({
            name: file.name,
            base64: reader.result
          });
        };
        reader.readAsDataURL(blob);
      }
    } catch (error) {
      console.error('Error picking document:', error);
    }
  };

  const parseDate = (text: string): Date | null => {
    // Parse MM/DD/YYYY format
    const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      const [, month, day, year] = match;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    // Debug logging
    console.log('Form Data on Submit:', formData);
    console.log('Position Value:', formData.position);
    
    // Only Company Name, Position, Location (State & City), and Date Applied are mandatory
    if (!formData.company_name.trim()) {
      Alert.alert('Error', 'Company Name is required');
      return;
    }
    if (!formData.position || !formData.position.trim()) {
      Alert.alert('Error', 'Position is required');
      console.log('Position validation failed:', formData.position);
      return;
    }
    if (!selectedState || !selectedCity) {
      Alert.alert('Error', 'Location (State and City) is required');
      return;
    }

    // Date Applied is mandatory
    if (!dateAppliedText.trim()) {
      Alert.alert('Error', 'Date Applied is required');
      return;
    }

    const parsedDate = parseDate(dateAppliedText);
    if (!parsedDate) {
      Alert.alert('Error', 'Please enter a valid date (MM/DD/YYYY)');
      return;
    }

    // Date validation: No future dates
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (parsedDate > today) {
      Alert.alert('Invalid Date', 'Date applied cannot be in the future');
      return;
    }

    // Date validation: No dates older than 1 year
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    if (parsedDate < oneYearAgo) {
      Alert.alert('Invalid Date', 'Date applied cannot be more than 1 year ago');
      return;
    }

    // Parse salary if provided (optional)
    let minSal = 0;
    let maxSal = 0;
    if (formData.min_salary && formData.max_salary) {
      minSal = parseFloat(formData.min_salary);
      maxSal = parseFloat(formData.max_salary);
      if (minSal >= maxSal) {
        Alert.alert('Error', 'Maximum salary must be greater than minimum salary');
        return;
      }
    }

    try {
      const payload: any = {
        company_name: formData.company_name.trim(),
        position: formData.position.trim(),
        location: { state: selectedState, city: selectedCity },
        salary_range: { min: minSal, max: maxSal },
        work_mode: formData.work_mode,
        job_url: formData.job_url.trim() || null,
        recruiter_email: formData.recruiter_email.trim() || null,
        resume_file: resumeFile?.base64 || null,
        date_applied: parsedDate.toISOString(),
        status: formData.status,
        custom_stages: [],
        is_priority: formData.is_priority
      };

      if (formData.follow_up_days.trim()) {
        const days = parseInt(formData.follow_up_days);
        if (!isNaN(days) && days > 0) {
          payload.follow_up_days = days;
        }
      }

      const url = editingJob ? `${BACKEND_URL}/api/jobs/${editingJob.job_id}` : `${BACKEND_URL}/api/jobs`;
      const method = editingJob ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        await refreshUser();
        await fetchJobs();
        setModalVisible(false);
        Alert.alert('Success', editingJob ? 'Job updated successfully' : 'Job added successfully');
      } else if (response.status === 403) {
        Alert.alert('Trial Expired', 'Your 7-day trial has ended. Please upgrade to continue adding jobs.');
      } else {
        Alert.alert('Error', 'Failed to save job application');
      }
    } catch (error) {
      console.error('Error saving job:', error);
      Alert.alert('Error', 'Failed to save job application');
    }
  };

  const getStatusColor = (status: string): string => {
    return STATUS_COLORS[status] || '#6B7280';
  };

  const formatStatus = (status: string): string => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const formatWorkMode = (mode: string): string => {
    return mode.charAt(0).toUpperCase() + mode.slice(1);
  };

  const getDaysAgo = (dateString: string): number => {
    try {
      return differenceInDays(new Date(), new Date(dateString));
    } catch {
      return 0;
    }
  };

  const allPositions = [...DEFAULT_POSITIONS, ...customPositions];
  const allStatuses = [...STATUSES, ...customStatuses];
  const availableCities = selectedState ? US_STATES_AND_CITIES[selectedState] || [] : [];

  const dynamicStyles = createStyles(colors, isDark, isTablet);

  if (loading) {
    return (
      <SafeAreaView style={[dynamicStyles.container]} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primary} style={dynamicStyles.loader} />
      </SafeAreaView>
    );
  }

  // Tablet Table View
  const renderTableView = () => (
    <View style={dynamicStyles.tableContainer}>
      {/* Table Header */}
      <View style={dynamicStyles.tableHeader}>
        <View style={[dynamicStyles.tableHeaderCellContainer, { flex: 1.3 }]}>
          <Text style={dynamicStyles.tableHeaderCell}>Company</Text>
        </View>
        <View style={[dynamicStyles.tableHeaderCellContainer, { flex: 1.2 }]}>
          <Text style={dynamicStyles.tableHeaderCell}>Position</Text>
        </View>
        <View style={[dynamicStyles.tableHeaderCellContainer, { flex: 0.9 }]}>
          <Text style={dynamicStyles.tableHeaderCell}>Location</Text>
        </View>
        <View style={[dynamicStyles.tableHeaderCellContainer, { flex: 0.7 }]}>
          <Text style={dynamicStyles.tableHeaderCell}>Salary</Text>
        </View>
        <View style={[dynamicStyles.tableHeaderCellContainer, { flex: 0.5 }]}>
          <Text style={dynamicStyles.tableHeaderCell}>Mode</Text>
        </View>
        <View style={[dynamicStyles.tableHeaderCellContainer, { flex: 0.7 }]}>
          <Text style={dynamicStyles.tableHeaderCell}>Applied</Text>
        </View>
        <View style={[dynamicStyles.tableHeaderCellContainer, { flex: 0.8 }]}>
          <Text style={dynamicStyles.tableHeaderCell}>Status</Text>
        </View>
        <View style={[dynamicStyles.tableHeaderCellContainer, { flex: 0.3 }]}>
          <Text style={dynamicStyles.tableHeaderCell}>Days</Text>
        </View>
      </View>
      
      {/* Table Rows */}
      {filteredJobs.map((job) => {
        const daysAgo = getDaysAgo(job.date_applied || job.created_at);
        const appliedDate = job.date_applied ? format(new Date(job.date_applied), 'MM/dd/yy') : '-';
        return (
          <TouchableOpacity
            key={job.job_id}
            style={dynamicStyles.tableRow}
            onPress={() => openEditModal(job)}
            activeOpacity={0.7}
          >
            <View style={[dynamicStyles.tableCellContainer, { flex: 1.3 }]}>
              <Text style={[dynamicStyles.tableCell, { fontWeight: '600' }]} numberOfLines={1}>
                {job.company_name}
              </Text>
            </View>
            <View style={[dynamicStyles.tableCellContainer, { flex: 1.2 }]}>
              <Text style={dynamicStyles.tableCell} numberOfLines={1}>
                {job.position}
              </Text>
            </View>
            <View style={[dynamicStyles.tableCellContainer, { flex: 0.9 }]}>
              <Text style={dynamicStyles.tableCell} numberOfLines={1}>
                {job.location.city}, {getStateAbbreviation(job.location.state)}
              </Text>
            </View>
            <View style={[dynamicStyles.tableCellContainer, { flex: 0.7 }]}>
              <Text style={dynamicStyles.tableCell}>
                ${(job.salary_range.min / 1000).toFixed(0)}k-${(job.salary_range.max / 1000).toFixed(0)}k
              </Text>
            </View>
            <View style={[dynamicStyles.tableCellContainer, { flex: 0.5 }]}>
              <View style={dynamicStyles.tableModeCell}>
                <Text style={dynamicStyles.tableModeText}>{formatWorkMode(job.work_mode)}</Text>
              </View>
            </View>
            <View style={[dynamicStyles.tableCellContainer, { flex: 0.7 }]}>
              <Text style={[dynamicStyles.tableCell, { textAlign: 'center' }]}>
                {appliedDate}
              </Text>
            </View>
            <View style={[dynamicStyles.tableCellContainer, { flex: 0.8 }]}>
              <View style={[dynamicStyles.tableStatusCell, { backgroundColor: getStatusColor(job.status) }]}>
                <Text style={dynamicStyles.tableStatusText}>{formatStatus(job.status)}</Text>
              </View>
            </View>
            <View style={[dynamicStyles.tableCellContainer, { flex: 0.3 }]}>
              <Text style={dynamicStyles.tableCellDays}>
                {daysAgo}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderJobCard = (job: any) => {
    const daysAgo = getDaysAgo(job.date_applied || job.created_at);
    const appliedDate = job.date_applied ? format(new Date(job.date_applied), 'MMM d, yyyy') : '-';
    
    return (
      <TouchableOpacity 
        key={job.job_id} 
        style={dynamicStyles.jobCard}
        onPress={() => openEditModal(job)}
        activeOpacity={0.7}
      >
        {/* Row 1: Company Name + Days Counter */}
        <View style={dynamicStyles.cardRow1}>
          <Text style={dynamicStyles.companyName} numberOfLines={1}>{job.company_name}</Text>
          <View style={dynamicStyles.daysCounter}>
            <Text style={dynamicStyles.daysNumber}>{daysAgo}</Text>
            <Text style={dynamicStyles.daysLabel}>days</Text>
          </View>
        </View>
        
        {/* Row 2: Position + Work Mode (right aligned) */}
        <View style={dynamicStyles.cardRow2}>
          <Text style={dynamicStyles.position} numberOfLines={1}>{job.position}</Text>
          <View style={dynamicStyles.workModeBadge}>
            <Text style={dynamicStyles.workModeText}>{formatWorkMode(job.work_mode)}</Text>
          </View>
        </View>

        {/* Row 3: Location + Salary (right aligned) */}
        <View style={dynamicStyles.cardRow3}>
          <View style={dynamicStyles.iconText}>
            <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
            <Text style={dynamicStyles.detailText}>{job.location.city}, {getStateAbbreviation(job.location.state)}</Text>
          </View>
          <Text style={dynamicStyles.salaryText}>
            ${(job.salary_range.min / 1000).toFixed(0)}k-${(job.salary_range.max / 1000).toFixed(0)}k
          </Text>
        </View>

        {/* Row 4: Status Badge + Date (right aligned) */}
        <View style={dynamicStyles.cardRow4}>
          <View style={[dynamicStyles.statusBadge, { backgroundColor: getStatusColor(job.status) }]}>
            <Text style={dynamicStyles.statusText}>{formatStatus(job.status)}</Text>
          </View>
          <View style={dynamicStyles.dateContainer}>
            <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
            <Text style={dynamicStyles.dateText}>{appliedDate}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // State Dropdown Modal
  const renderStateDropdown = () => (
    <Modal visible={showStateDropdown} transparent animationType="fade" onRequestClose={() => setShowStateDropdown(false)}>
      <View style={dynamicStyles.dropdownOverlay}>
        <TouchableOpacity style={dynamicStyles.dropdownBackdrop} activeOpacity={1} onPress={() => setShowStateDropdown(false)} />
        <View style={dynamicStyles.dropdownContainer}>
          <View style={dynamicStyles.dropdownHeader}>
            <Text style={dynamicStyles.dropdownTitle}>Select State</Text>
            <TouchableOpacity onPress={() => setShowStateDropdown(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={dynamicStyles.dropdownScroll} nestedScrollEnabled={true}>
            {US_STATES.map((state) => (
              <TouchableOpacity
                key={state}
                style={[dynamicStyles.dropdownItem, selectedState === state && dynamicStyles.dropdownItemSelected]}
                onPress={() => {
                  setSelectedState(state);
                  setSelectedCity('');
                  setShowStateDropdown(false);
                }}
              >
                <Text style={[dynamicStyles.dropdownItemText, selectedState === state && dynamicStyles.dropdownItemTextSelected]}>
                  {state}
                </Text>
                {selectedState === state && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // City Dropdown Modal
  const renderCityDropdown = () => (
    <Modal visible={showCityDropdown} transparent animationType="fade" onRequestClose={() => setShowCityDropdown(false)}>
      <View style={dynamicStyles.dropdownOverlay}>
        <TouchableOpacity style={dynamicStyles.dropdownBackdrop} activeOpacity={1} onPress={() => setShowCityDropdown(false)} />
        <View style={dynamicStyles.dropdownContainer}>
          <View style={dynamicStyles.dropdownHeader}>
            <Text style={dynamicStyles.dropdownTitle}>Select City</Text>
            <TouchableOpacity onPress={() => setShowCityDropdown(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={dynamicStyles.dropdownScroll} nestedScrollEnabled={true}>
            {availableCities.length === 0 ? (
              <View style={dynamicStyles.dropdownEmpty}>
                <Text style={dynamicStyles.dropdownEmptyText}>Please select a state first</Text>
              </View>
            ) : (
              availableCities.map((city) => (
                <TouchableOpacity
                  key={city}
                  style={[dynamicStyles.dropdownItem, selectedCity === city && dynamicStyles.dropdownItemSelected]}
                  onPress={() => {
                    setSelectedCity(city);
                    setShowCityDropdown(false);
                  }}
                >
                  <Text style={[dynamicStyles.dropdownItemText, selectedCity === city && dynamicStyles.dropdownItemTextSelected]}>
                    {city}
                  </Text>
                  {selectedCity === city && (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Position Dropdown Modal
  const renderPositionDropdown = () => (
    <Modal visible={showPositionDropdown} transparent animationType="fade" onRequestClose={() => setShowPositionDropdown(false)}>
      <View style={dynamicStyles.dropdownOverlay}>
        <TouchableOpacity style={dynamicStyles.dropdownBackdrop} activeOpacity={1} onPress={() => setShowPositionDropdown(false)} />
        <View style={dynamicStyles.dropdownContainer}>
          <View style={dynamicStyles.dropdownHeader}>
            <Text style={dynamicStyles.dropdownTitle}>Select Position</Text>
            <TouchableOpacity onPress={() => setShowPositionDropdown(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={dynamicStyles.dropdownScroll} nestedScrollEnabled={true}>
            {allPositions.map((pos) => (
              <TouchableOpacity
                key={pos}
                style={[dynamicStyles.dropdownItem, formData.position === pos && dynamicStyles.dropdownItemSelected]}
                onPress={() => {
                  setFormData(prev => ({ ...prev, position: pos }));
                  setShowPositionDropdown(false);
                }}
              >
                <Text style={[dynamicStyles.dropdownItemText, formData.position === pos && dynamicStyles.dropdownItemTextSelected]}>
                  {pos}
                </Text>
                {formData.position === pos && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Status Dropdown Modal
  const renderStatusDropdown = () => (
    <Modal visible={showStatusDropdown} transparent animationType="fade" onRequestClose={() => setShowStatusDropdown(false)}>
      <View style={dynamicStyles.dropdownOverlay}>
        <TouchableOpacity style={dynamicStyles.dropdownBackdrop} activeOpacity={1} onPress={() => setShowStatusDropdown(false)} />
        <View style={dynamicStyles.dropdownContainer}>
          <View style={dynamicStyles.dropdownHeader}>
            <Text style={dynamicStyles.dropdownTitle}>Select Status</Text>
            <TouchableOpacity onPress={() => setShowStatusDropdown(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={dynamicStyles.dropdownScroll} nestedScrollEnabled={true}>
            {allStatuses.map((status) => (
              <TouchableOpacity
                key={status}
                style={[dynamicStyles.dropdownItem, formData.status === status && dynamicStyles.dropdownItemSelected]}
                onPress={() => {
                  setFormData({ ...formData, status });
                  setShowStatusDropdown(false);
                }}
              >
                <View style={[dynamicStyles.statusDot, { backgroundColor: getStatusColor(status) }]} />
                <Text style={[dynamicStyles.dropdownItemText, { flex: 1 }, formData.status === status && dynamicStyles.dropdownItemTextSelected]}>
                  {formatStatus(status)}
                </Text>
                {formData.status === status && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Job card render with select mode support (no swipe)
  const renderSelectableJobCard = (job: any) => {
    const jobId = job.job_id;
    const isSelected = selectedJobs.has(jobId);
    const daysAgo = getDaysAgo(job.date_applied || job.created_at);
    const appliedDate = job.date_applied ? format(new Date(job.date_applied), 'MMM d, yyyy') : '-';
    const isPriority = job.is_priority || false;
    
    return (
      <TouchableOpacity
        key={jobId}
        activeOpacity={0.7}
        style={[
          dynamicStyles.jobCard,
          selectMode && isSelected && dynamicStyles.jobCardSelected,
          isPriority && dynamicStyles.priorityJobCard,
        ]}
        onPress={() => {
          if (selectMode) {
            toggleJobSelection(jobId);
          } else {
            openEditModal(job);
          }
        }}
      >
        {selectMode && (
          <View style={dynamicStyles.selectionCheckbox}>
            <Ionicons 
              name={isSelected ? 'checkbox' : 'square-outline'} 
              size={24} 
              color={isSelected ? colors.primary : colors.textSecondary} 
            />
          </View>
        )}
        <View style={[dynamicStyles.cardContentWrapper, selectMode && { marginLeft: 8 }]}>
          {/* Row 1: Company Name + Priority Badge + Days Counter */}
          <View style={dynamicStyles.cardRow1}>
            <View style={dynamicStyles.companyWithPriority}>
              <Text style={dynamicStyles.companyName} numberOfLines={1}>{job.company_name}</Text>
              {isPriority && (
                <View style={dynamicStyles.priorityIndicator}>
                  <Ionicons name="star" size={12} color="#F59E0B" />
                </View>
              )}
            </View>
            <View style={dynamicStyles.daysCounter}>
              <Text style={dynamicStyles.daysNumber}>{daysAgo}</Text>
              <Text style={dynamicStyles.daysLabel}>days</Text>
            </View>
          </View>
          
          {/* Row 2: Position + Work Mode (right aligned) */}
          <View style={dynamicStyles.cardRow2}>
            <Text style={dynamicStyles.position} numberOfLines={1}>{job.position}</Text>
            <View style={dynamicStyles.workModeBadge}>
              <Text style={dynamicStyles.workModeText}>{formatWorkMode(job.work_mode)}</Text>
            </View>
          </View>

          {/* Row 3: Location + Salary (right aligned) */}
          <View style={dynamicStyles.cardRow3}>
            <View style={dynamicStyles.iconText}>
              <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
              <Text style={dynamicStyles.detailText}>{job.location?.city}, {getStateAbbreviation(job.location?.state)}</Text>
            </View>
            <Text style={dynamicStyles.salaryText}>
              ${(job.salary_range?.min / 1000).toFixed(0)}k-${(job.salary_range?.max / 1000).toFixed(0)}k
            </Text>
          </View>

          {/* Row 4: Status Badge + Date (right aligned) */}
          <View style={dynamicStyles.cardRow4}>
            <View style={[dynamicStyles.statusBadge, { backgroundColor: getStatusColor(job.status) }]}>
              <Text style={dynamicStyles.statusText}>{formatStatus(job.status)}</Text>
            </View>
            <View style={dynamicStyles.dateContainer}>
              <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
              <Text style={dynamicStyles.dateText}>{appliedDate}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      {/* Horizontal Filters */}
      <View style={dynamicStyles.filterContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={dynamicStyles.filterScroll}
        >
          <TouchableOpacity
            style={[dynamicStyles.filterChip, localFilter === 'all' && filter === 'all' && workModeFilter === 'all' && statusFilter === 'all' && dynamicStyles.filterChipActive]}
            onPress={() => { setLocalFilter('all'); setWorkModeFilter('all'); setStatusFilter('all'); clearFilter(); }}
          >
            <Text style={[dynamicStyles.filterChipText, localFilter === 'all' && filter === 'all' && workModeFilter === 'all' && statusFilter === 'all' && dynamicStyles.filterChipTextActive]}>
              All ({jobs.length})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[dynamicStyles.filterChip, (localFilter === 'last_10_days' || filter === 'last_10_days') && dynamicStyles.filterChipActive]}
            onPress={() => { 
              if (localFilter === 'last_10_days' || filter === 'last_10_days') {
                setLocalFilter('all'); 
                clearFilter();
              } else {
                setLocalFilter('last_10_days'); 
              }
            }}
          >
            <Ionicons name="time-outline" size={14} color={(localFilter === 'last_10_days' || filter === 'last_10_days') ? 'white' : colors.text} />
            <Text style={[dynamicStyles.filterChipText, (localFilter === 'last_10_days' || filter === 'last_10_days') && dynamicStyles.filterChipTextActive]}>
              Last 10 Days
            </Text>
          </TouchableOpacity>
          
          {/* Work Mode Filter - Opens Dropdown */}
          <TouchableOpacity
            style={[dynamicStyles.filterChip, workModeFilter !== 'all' && dynamicStyles.filterChipActive]}
            onPress={() => setShowWorkModeFilterDropdown(true)}
          >
            <Ionicons name="briefcase-outline" size={14} color={workModeFilter !== 'all' ? 'white' : colors.text} />
            <Text style={[dynamicStyles.filterChipText, workModeFilter !== 'all' && dynamicStyles.filterChipTextActive]}>
              {workModeFilter === 'all' ? 'Work Mode' : workModeFilter.charAt(0).toUpperCase() + workModeFilter.slice(1)}
            </Text>
            <Ionicons name="chevron-down" size={12} color={workModeFilter !== 'all' ? 'white' : colors.text} />
          </TouchableOpacity>
          
          {/* Status Filter - Opens Dropdown */}
          <TouchableOpacity
            style={[dynamicStyles.filterChip, statusFilter !== 'all' && dynamicStyles.filterChipActive]}
            onPress={() => setShowStatusFilterDropdown(true)}
          >
            <Ionicons name="flag-outline" size={14} color={statusFilter !== 'all' ? 'white' : colors.text} />
            <Text style={[dynamicStyles.filterChipText, statusFilter !== 'all' && dynamicStyles.filterChipTextActive]}>
              {statusFilter === 'all' ? 'Status' : formatStatus(statusFilter)}
            </Text>
            <Ionicons name="chevron-down" size={12} color={statusFilter !== 'all' ? 'white' : colors.text} />
          </TouchableOpacity>
        </ScrollView>
        
        {/* Select/Delete Button */}
        <TouchableOpacity 
          style={dynamicStyles.selectButton}
          onPress={selectMode ? (selectedJobs.size > 0 ? deleteSelectedJobs : toggleSelectMode) : toggleSelectMode}
        >
          <Ionicons 
            name={selectMode ? (selectedJobs.size > 0 ? 'trash' : 'close') : 'checkmark-circle-outline'} 
            size={20} 
            color={selectMode && selectedJobs.size > 0 ? '#EF4444' : colors.primary} 
          />
        </TouchableOpacity>
      </View>
      
      {/* Select Mode Header */}
      {selectMode && (
        <View style={dynamicStyles.selectModeHeader}>
          <Text style={dynamicStyles.selectModeText}>
            {selectedJobs.size} selected
          </Text>
          <TouchableOpacity onPress={selectAllJobs}>
            <Text style={dynamicStyles.selectAllText}>Select All</Text>
          </TouchableOpacity>
        </View>
      )}

      {filteredJobs.length === 0 ? (
        <View style={dynamicStyles.emptyState}>
          <Ionicons name="briefcase-outline" size={64} color={colors.textSecondary} />
          <Text style={dynamicStyles.emptyText}>
            {filter === 'all' && localFilter === 'all' && workModeFilter === 'all' && statusFilter === 'all' 
              ? 'No job applications yet' 
              : 'No matching applications'}
          </Text>
          {filter === 'all' && localFilter === 'all' && (
            <TouchableOpacity style={dynamicStyles.emptyAddButton} onPress={openAddModal}>
              <Text style={dynamicStyles.emptyAddButtonText}>Add Your First Job</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView
          style={dynamicStyles.scrollView}
          contentContainerStyle={dynamicStyles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {isTablet ? renderTableView() : filteredJobs.map((job) => renderSelectableJobCard(job))}
        </ScrollView>
      )}
      
      {/* Work Mode Filter Dropdown Modal */}
      <Modal visible={showWorkModeFilterDropdown} transparent animationType="fade" onRequestClose={() => setShowWorkModeFilterDropdown(false)}>
        <View style={dynamicStyles.dropdownOverlay}>
          <TouchableOpacity style={dynamicStyles.dropdownBackdrop} activeOpacity={1} onPress={() => setShowWorkModeFilterDropdown(false)} />
          <View style={dynamicStyles.filterDropdownContainer}>
            <View style={dynamicStyles.dropdownHeader}>
              <Text style={dynamicStyles.dropdownTitle}>Filter by Work Mode</Text>
              <TouchableOpacity onPress={() => setShowWorkModeFilterDropdown(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={dynamicStyles.dropdownScroll}>
              {['all', 'remote', 'onsite', 'hybrid'].map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[dynamicStyles.dropdownItem, workModeFilter === mode && dynamicStyles.dropdownItemSelected]}
                  onPress={() => {
                    setWorkModeFilter(mode);
                    setShowWorkModeFilterDropdown(false);
                  }}
                >
                  <Text style={[dynamicStyles.dropdownItemText, workModeFilter === mode && dynamicStyles.dropdownItemTextSelected]}>
                    {mode === 'all' ? 'All Work Modes' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Text>
                  {workModeFilter === mode && (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Status Filter Dropdown Modal */}
      <Modal visible={showStatusFilterDropdown} transparent animationType="fade" onRequestClose={() => setShowStatusFilterDropdown(false)}>
        <View style={dynamicStyles.dropdownOverlay}>
          <TouchableOpacity style={dynamicStyles.dropdownBackdrop} activeOpacity={1} onPress={() => setShowStatusFilterDropdown(false)} />
          <View style={dynamicStyles.filterDropdownContainer}>
            <View style={dynamicStyles.dropdownHeader}>
              <Text style={dynamicStyles.dropdownTitle}>Filter by Status</Text>
              <TouchableOpacity onPress={() => setShowStatusFilterDropdown(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={dynamicStyles.dropdownScroll}>
              {['all', 'applied', 'recruiter_screening', 'phone_screen', 'coding_round_1', 'coding_round_2', 'system_design', 'behavioural', 'hiring_manager', 'final_round', 'offer', 'rejected'].map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[dynamicStyles.dropdownItem, statusFilter === status && dynamicStyles.dropdownItemSelected]}
                  onPress={() => {
                    setStatusFilter(status);
                    setShowStatusFilterDropdown(false);
                  }}
                >
                  {status !== 'all' && (
                    <View style={[dynamicStyles.statusIndicator, { backgroundColor: getStatusColor(status) }]} />
                  )}
                  <Text style={[dynamicStyles.dropdownItemText, statusFilter === status && dynamicStyles.dropdownItemTextSelected]}>
                    {status === 'all' ? 'All Statuses' : formatStatus(status)}
                  </Text>
                  {statusFilter === status && (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Floating Add Button */}
      {jobs.length > 0 && (
        <TouchableOpacity style={dynamicStyles.fab} onPress={openAddModal}>
          <Ionicons name="add" size={32} color="white" />
        </TouchableOpacity>
      )}

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={[dynamicStyles.modalContainer]}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={dynamicStyles.modalKeyboard}>
            <View style={dynamicStyles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
              <Text style={dynamicStyles.modalTitle}>{editingJob ? 'Edit Job' : 'Add Job'}</Text>
              <TouchableOpacity onPress={handleSubmit}>
                <Text style={dynamicStyles.saveButton}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={dynamicStyles.modalScroll} contentContainerStyle={dynamicStyles.modalScrollContent} keyboardShouldPersistTaps="handled">
              {/* Company Name with Priority Badge */}
              <View style={dynamicStyles.formSection}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={dynamicStyles.label}>Company Name *</Text>
                  <TouchableOpacity 
                    style={dynamicStyles.priorityBadge}
                    onPress={() => setFormData(prev => ({...prev, is_priority: !prev.is_priority}))}
                  >
                    <Ionicons 
                      name={formData.is_priority ? "star" : "star-outline"} 
                      size={18} 
                      color={formData.is_priority ? "#F59E0B" : colors.textSecondary} 
                    />
                    <Text style={[dynamicStyles.priorityBadgeText, formData.is_priority && { color: '#F59E0B' }]}>
                      Priority
                    </Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={dynamicStyles.input}
                  value={formData.company_name}
                  onChangeText={(text) => setFormData({ ...formData, company_name: text })}
                  placeholder="e.g., Google, Microsoft"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              {/* Position with Dropdown + Custom Option */}
              <View style={dynamicStyles.formSection}>
                <View style={dynamicStyles.labelRow}>
                  <Text style={dynamicStyles.label}>Position *</Text>
                  <TouchableOpacity onPress={() => setShowPositionInput(!showPositionInput)}>
                    <Text style={dynamicStyles.addCustomText}>{showPositionInput ? 'Select from list' : '+ Add custom'}</Text>
                  </TouchableOpacity>
                </View>
                
                {showPositionInput ? (
                  <View style={dynamicStyles.customPositionRow}>
                    <TextInput
                      style={[dynamicStyles.input, dynamicStyles.customPositionInput]}
                      value={newPosition}
                      onChangeText={setNewPosition}
                      placeholder="Enter custom position"
                      placeholderTextColor={colors.textSecondary}
                    />
                    <TouchableOpacity style={dynamicStyles.addPositionButton} onPress={handleAddCustomPosition}>
                      <Text style={dynamicStyles.addPositionButtonText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={dynamicStyles.dropdownButton}
                    onPress={() => setShowPositionDropdown(true)}
                  >
                    <Text style={[dynamicStyles.dropdownButtonText, !formData.position && dynamicStyles.dropdownPlaceholder]}>
                      {formData.position || 'Select Position'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* State and City - Custom Dropdowns */}
              <View style={dynamicStyles.formSection}>
                <Text style={dynamicStyles.label}>Location *</Text>
                <View style={dynamicStyles.locationRow}>
                  {/* State Dropdown Button */}
                  <TouchableOpacity 
                    style={dynamicStyles.dropdownButton}
                    onPress={() => setShowStateDropdown(true)}
                  >
                    <Text style={[dynamicStyles.dropdownButtonText, !selectedState && dynamicStyles.dropdownPlaceholder]}>
                      {selectedState || 'Select State'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>

                  {/* City Dropdown Button */}
                  <TouchableOpacity 
                    style={[dynamicStyles.dropdownButton, !selectedState && dynamicStyles.dropdownDisabled]}
                    onPress={() => selectedState && setShowCityDropdown(true)}
                    disabled={!selectedState}
                  >
                    <Text style={[dynamicStyles.dropdownButtonText, !selectedCity && dynamicStyles.dropdownPlaceholder]}>
                      {selectedCity || 'Select City'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Salary Range */}
              <View style={dynamicStyles.formSection}>
                <Text style={dynamicStyles.label}>Salary Range (USD)</Text>
                <View style={dynamicStyles.salaryRow}>
                  <TextInput
                    style={[dynamicStyles.input, dynamicStyles.halfInput]}
                    value={formData.min_salary}
                    onChangeText={(text) => setFormData({ ...formData, min_salary: text })}
                    placeholder="Min (e.g., 100000)"
                    keyboardType="numeric"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <TextInput
                    style={[dynamicStyles.input, dynamicStyles.halfInput]}
                    value={formData.max_salary}
                    onChangeText={(text) => setFormData({ ...formData, max_salary: text })}
                    placeholder="Max (e.g., 150000)"
                    keyboardType="numeric"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>

              {/* Date Applied - Auto-formatting Text Input */}
              <View style={dynamicStyles.formSection}>
                <Text style={dynamicStyles.label}>Date Applied</Text>
                <TextInput
                  style={dynamicStyles.input}
                  value={dateAppliedText}
                  onChangeText={handleDateChange}
                  placeholder="MM/DD/YYYY"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>

              {/* Follow-up Reminder */}
              <View style={dynamicStyles.formSection}>
                <Text style={dynamicStyles.label}>Follow-up Reminder (days)</Text>
                <TextInput
                  style={dynamicStyles.input}
                  value={formData.follow_up_days}
                  onChangeText={(text) => setFormData({ ...formData, follow_up_days: text })}
                  placeholder="e.g., 7 (for push notification)"
                  keyboardType="numeric"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              {/* Resume */}
              <View style={dynamicStyles.formSection}>
                <Text style={dynamicStyles.label}>Resume</Text>
                <TouchableOpacity style={dynamicStyles.resumeButton} onPress={handlePickResume}>
                  <Ionicons name="document-attach" size={20} color={colors.primary} />
                  <Text style={dynamicStyles.resumeButtonText}>
                    {resumeFile ? resumeFile.name : 'Upload Resume (PDF/DOC)'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Job URL */}
              <View style={dynamicStyles.formSection}>
                <Text style={dynamicStyles.label}>Job URL</Text>
                <TextInput
                  style={dynamicStyles.input}
                  value={formData.job_url}
                  onChangeText={(text) => setFormData({ ...formData, job_url: text })}
                  placeholder="https://linkedin.com/jobs/..."
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>

              {/* Recruiter Email */}
              <View style={dynamicStyles.formSection}>
                <Text style={dynamicStyles.label}>Recruiter Email</Text>
                <TextInput
                  style={dynamicStyles.input}
                  value={formData.recruiter_email}
                  onChangeText={(text) => setFormData({ ...formData, recruiter_email: text })}
                  placeholder="recruiter@company.com"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              {/* Work Mode */}
              <View style={dynamicStyles.formSection}>
                <Text style={dynamicStyles.label}>Work Mode *</Text>
                <View style={dynamicStyles.workModeContainer}>
                  {WORK_MODES.map((mode) => (
                    <TouchableOpacity
                      key={mode}
                      style={[dynamicStyles.workModeButton, formData.work_mode === mode && dynamicStyles.workModeButtonSelected]}
                      onPress={() => setFormData({ ...formData, work_mode: mode })}
                    >
                      <Text style={[dynamicStyles.workModeButtonText, formData.work_mode === mode && dynamicStyles.workModeButtonTextSelected]}>
                        {formatWorkMode(mode)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Status with Dropdown + Custom Option */}
              <View style={dynamicStyles.formSection}>
                <View style={dynamicStyles.labelRow}>
                  <Text style={dynamicStyles.label}>Current Status *</Text>
                  <TouchableOpacity onPress={() => setShowStatusInput(!showStatusInput)}>
                    <Text style={dynamicStyles.addCustomText}>{showStatusInput ? 'Select from list' : '+ Add custom'}</Text>
                  </TouchableOpacity>
                </View>
                
                {showStatusInput ? (
                  <View style={dynamicStyles.customPositionRow}>
                    <TextInput
                      style={[dynamicStyles.input, dynamicStyles.customPositionInput]}
                      value={newStatus}
                      onChangeText={setNewStatus}
                      placeholder="Enter custom status"
                      placeholderTextColor={colors.textSecondary}
                    />
                    <TouchableOpacity 
                      style={dynamicStyles.addPositionButton} 
                      onPress={() => {
                        if (newStatus.trim()) {
                          const formatted = newStatus.trim().toLowerCase().replace(/\s+/g, '_');
                          setCustomStatuses([...customStatuses, formatted]);
                          setFormData({ ...formData, status: formatted });
                          setNewStatus('');
                          setShowStatusInput(false);
                        }
                      }}
                    >
                      <Text style={dynamicStyles.addPositionButtonText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={dynamicStyles.dropdownButton}
                    onPress={() => setShowStatusDropdown(true)}
                  >
                    <View style={[dynamicStyles.statusIndicator, { backgroundColor: getStatusColor(formData.status) }]} />
                    <Text style={[dynamicStyles.dropdownButtonText, !formData.status && dynamicStyles.dropdownPlaceholder]}>
                      {formData.status ? formatStatus(formData.status) : 'Select Status'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
          
          {/* Dropdown Modals - Inside the form modal */}
          {renderStateDropdown()}
          {renderCityDropdown()}
          {renderPositionDropdown()}
          {renderStatusDropdown()}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, isTablet: boolean = false) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  loader: { 
    flex: 1 
  },
  // Filter bar styles
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 60,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: isDark ? '#2C2C2E' : '#F3F4F6',
    gap: 4,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: 'white',
  },
  selectButton: {
    padding: 12,
    marginLeft: 8,
    backgroundColor: isDark ? '#2C2C2E' : '#F3F4F6',
    borderRadius: 20,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectModeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.primary + '15',
  },
  selectModeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  // Swipeable card styles
  swipeableContainer: {
    position: 'relative',
    marginBottom: 12,
    overflow: 'hidden',
    borderRadius: 12,
  },
  swipeActions: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  swipeAction: {
    width: 60,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeActionEdit: {
    backgroundColor: '#3B82F6',
  },
  swipeActionDelete: {
    backgroundColor: '#EF4444',
  },
  swipeActionText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  selectionCheckbox: {
    marginRight: 8,
  },
  jobCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  cardContent: {
    flex: 1,
  },
  cardContentWrapper: {
    flex: 1,
  },
  filterDropdownContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    maxHeight: '60%',
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  header: { 
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.headerBackground,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: colors.headerText,
  },
  headerSubtitle: { 
    fontSize: 14, 
    marginTop: 2, 
    opacity: 0.9,
    color: colors.headerText,
  },
  clearFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  clearFilterText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  scrollView: { 
    flex: 1 
  },
  scrollContent: { 
    padding: isTablet ? 24 : 16,
    paddingBottom: 100,
  },
  emptyState: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 32 
  },
  emptyText: { 
    fontSize: 18, 
    marginTop: 16, 
    marginBottom: 24,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyAddButton: { 
    paddingHorizontal: 24, 
    paddingVertical: 12, 
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  emptyAddButtonText: { 
    color: 'white', 
    fontSize: 16, 
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  // Job Card Styles
  jobCard: { 
    borderRadius: 12, 
    padding: 14, 
    marginBottom: 12, 
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardRow1: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 4 
  },
  companyName: { 
    fontSize: 17, 
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  daysCounter: {
    alignItems: 'center',
    backgroundColor: isDark ? '#2C2C2E' : '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  daysNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  daysLabel: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  cardRow2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  position: { 
    fontSize: 14, 
    color: colors.textSecondary,
    flex: 1,
  },
  workModeBadge: {
    backgroundColor: isDark ? '#3A3A3C' : '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  workModeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  cardRow3: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10, 
  },
  iconText: { 
    flexDirection: 'row', 
    alignItems: 'center',
  },
  salaryText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  cardRow4: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  detailText: { 
    fontSize: 12, 
    marginLeft: 4,
    color: colors.textSecondary,
  },
  statusBadge: { 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: 6, 
    alignSelf: 'flex-start' 
  },
  statusText: { 
    color: 'white', 
    fontSize: 12, 
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.3,
  },
  // Dropdown Styles
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dropdownContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    width: '85%',
    maxHeight: '70%',
    overflow: 'hidden',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  dropdownScroll: {
    maxHeight: 400,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownItemSelected: {
    backgroundColor: colors.primary + '15',
  },
  dropdownItemText: {
    fontSize: 16,
    color: colors.text,
  },
  dropdownItemTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  dropdownEmpty: {
    padding: 24,
    alignItems: 'center',
  },
  dropdownEmptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  dropdownButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
  },
  dropdownButtonText: {
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  dropdownPlaceholder: {
    color: colors.textSecondary,
  },
  dropdownDisabled: {
    opacity: 0.5,
  },
  // Modal Styles
  modalContainer: { 
    flex: 1,
    backgroundColor: colors.background,
  },
  modalKeyboard: { 
    flex: 1 
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    borderBottomWidth: 1,
    backgroundColor: colors.card,
    borderBottomColor: colors.border,
  },
  modalTitle: { 
    fontSize: 18, 
    fontWeight: 'bold',
    color: colors.text,
  },
  saveButton: { 
    fontSize: 16, 
    fontWeight: '600',
    color: colors.primary,
  },
  modalScroll: { 
    flex: 1 
  },
  modalScrollContent: { 
    padding: 16 
  },
  formSection: { 
    marginBottom: 20 
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: { 
    fontSize: 15, 
    fontWeight: '600', 
    marginBottom: 8,
    color: colors.text,
  },
  addCustomText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  input: { 
    borderRadius: 8, 
    padding: 12, 
    fontSize: 15, 
    borderWidth: 1,
    backgroundColor: colors.inputBackground,
    color: colors.inputText,
    borderColor: colors.inputBorder,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  priorityBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginLeft: 4,
  },
  customPositionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customPositionInput: {
    flex: 1,
  },
  addPositionButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addPositionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  locationRow: { 
    flexDirection: 'row', 
  },
  salaryRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    gap: 8,
  },
  halfInput: { 
    flex: 1,
  },
  positionScroll: { 
    marginBottom: 8 
  },
  positionChip: { 
    paddingHorizontal: 14, 
    paddingVertical: 8, 
    borderRadius: 16, 
    marginRight: 8, 
    borderWidth: 1,
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  positionChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  positionChipText: { 
    fontSize: 13,
    color: colors.text,
  },
  positionChipTextSelected: {
    color: 'white',
  },
  resumeButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12, 
    borderRadius: 8, 
    borderWidth: 1,
    backgroundColor: colors.inputBackground,
    borderColor: colors.inputBorder,
  },
  resumeButtonText: { 
    marginLeft: 8, 
    fontSize: 15, 
    flex: 1,
    color: colors.text,
  },
  workModeContainer: { 
    flexDirection: 'row', 
    gap: 8 
  },
  workModeButton: { 
    flex: 1, 
    padding: 12, 
    borderRadius: 8, 
    borderWidth: 1, 
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  workModeButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  workModeButtonText: { 
    fontSize: 14,
    color: colors.text,
  },
  workModeButtonTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  statusContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 8 
  },
  statusButton: { 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 6, 
    borderWidth: 1,
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  statusButtonText: { 
    fontSize: 13,
    color: colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statusButtonTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  // Tablet Table Styles
  tableContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: isDark ? '#1C1C1E' : '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  tableHeaderCellContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableCellContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableCell: {
    fontSize: 13,
    color: colors.text,
    textAlign: 'center',
  },
  tableCellDays: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  tableModeCell: {
    backgroundColor: isDark ? '#3A3A3C' : '#E5E7EB',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    alignItems: 'center',
  },
  tableModeText: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.text,
  },
  tableStatusCell: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    alignItems: 'center',
  },
  tableStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
