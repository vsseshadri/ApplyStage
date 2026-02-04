import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import Constants from 'expo-constants';
import { COUNTRIES } from '../utils/countries';

// Get backend URL from configuration
const getBackendUrl = (): string => {
  const configUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL;
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  return configUrl || envUrl || '';
};
const BACKEND_URL = getBackendUrl();

export default function OnboardingScreen() {
  const { user, sessionToken, refreshUser } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [domicileCountry, setDomicileCountry] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [displayNameError, setDisplayNameError] = useState('');
  const [countryError, setCountryError] = useState('');

  const filteredCountries = COUNTRIES.filter(country =>
    country.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const validateForm = () => {
    let isValid = true;
    
    if (!displayName.trim()) {
      setDisplayNameError('Display Name is required');
      isValid = false;
    } else {
      setDisplayNameError('');
    }
    
    if (!domicileCountry) {
      setCountryError('Please select your country');
      isValid = false;
    } else {
      setCountryError('');
    }
    
    return isValid;
  };

  const handleContinue = async () => {
    if (!validateForm()) return;
    
    if (!sessionToken) {
      Alert.alert('Error', 'Session expired. Please login again.');
      router.replace('/');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/user/onboarding`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferred_display_name: displayName.trim(),
          domicile_country: domicileCountry,
        }),
      });

      if (response.ok) {
        await refreshUser();
        router.replace('/(tabs)/my-jobs');
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Onboarding error:', errorData);
        Alert.alert('Error', errorData.detail || 'Failed to save your preferences. Please try again.');
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
      Alert.alert('Error', 'Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectCountry = (country: string) => {
    setDomicileCountry(country);
    setShowCountryDropdown(false);
    setCountrySearch('');
    setCountryError('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Welcome Header */}
          <View style={styles.headerSection}>
            <View style={styles.iconContainer}>
              <Ionicons name="rocket" size={50} color="#007AFF" />
            </View>
            <Text style={styles.welcomeTitle}>Let's Get Started! 🎯</Text>
            <Text style={styles.welcomeSubtitle}>
              Ready to organize your job applications like a pro? Just a couple quick details and you're all set!
            </Text>
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            {/* Display Name Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>What should we call you?</Text>
              <TextInput
                style={[styles.input, displayNameError ? styles.inputError : null]}
                placeholder="Your name"
                placeholderTextColor="#999"
                value={displayName}
                onChangeText={(text) => {
                  setDisplayName(text);
                  if (displayNameError) setDisplayNameError('');
                }}
                autoCapitalize="words"
                returnKeyType="next"
              />
              {displayNameError ? (
                <Text style={styles.errorText}>{displayNameError}</Text>
              ) : null}
            </View>

            {/* Domicile Country Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Where are you based?</Text>
              <TouchableOpacity
                style={[styles.dropdownButton, countryError ? styles.inputError : null]}
                onPress={() => setShowCountryDropdown(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dropdownText, !domicileCountry && styles.placeholderText]}>
                  {domicileCountry || 'Select your country'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
              {countryError ? (
                <Text style={styles.errorText}>{countryError}</Text>
              ) : null}
            </View>
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            style={[styles.continueButton, isSubmitting && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.continueButtonText}>Continue</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFF" style={styles.buttonIcon} />
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Country Selection Modal */}
      <Modal
        visible={showCountryDropdown}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Country</Text>
            <TouchableOpacity 
              onPress={() => {
                setShowCountryDropdown(false);
                setCountrySearch('');
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search countries..."
              placeholderTextColor="#999"
              value={countrySearch}
              onChangeText={setCountrySearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {countrySearch.length > 0 && (
              <TouchableOpacity onPress={() => setCountrySearch('')}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.countryItem,
                  domicileCountry === item && styles.countryItemSelected
                ]}
                onPress={() => selectCountry(item)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.countryItemText,
                  domicileCountry === item && styles.countryItemTextSelected
                ]}>
                  {item}
                </Text>
                {domicileCountry === item && (
                  <Ionicons name="checkmark" size={20} color="#007AFF" />
                )}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No countries found</Text>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#E8F2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  formSection: {
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 6,
  },
  dropdownButton: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
  },
  placeholderText: {
    color: '#999',
  },
  continueButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600',
  },
  buttonIcon: {
    marginLeft: 8,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    margin: 16,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  countryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingHorizontal: 20,
  },
  countryItemSelected: {
    backgroundColor: '#E8F2FF',
  },
  countryItemText: {
    fontSize: 16,
    color: '#333',
  },
  countryItemTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});
