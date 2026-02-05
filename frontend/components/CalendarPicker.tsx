import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isToday, isBefore, isAfter, startOfWeek, endOfWeek, isWeekend } from 'date-fns';

interface CalendarPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectDate: (date: Date) => void;
  selectedDate?: Date;
  minDate?: Date;
  maxDate?: Date;
  businessDaysOnly?: boolean;
  colors: {
    background: string;
    card: string;
    text: string;
    textSecondary: string;
    primary: string;
    border: string;
  };
}

const CalendarPicker: React.FC<CalendarPickerProps> = ({
  visible,
  onClose,
  onSelectDate,
  selectedDate,
  minDate,
  maxDate,
  businessDaysOnly = false,
  colors,
}) => {
  const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date());
  
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Generate calendar days for the current month view
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);
  
  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };
  
  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };
  
  const handleSelectDate = (date: Date) => {
    onSelectDate(date);
    onClose();
  };
  
  const isDateDisabled = (date: Date): boolean => {
    if (minDate && isBefore(date, minDate)) return true;
    if (maxDate && isAfter(date, maxDate)) return true;
    return false;
  };
  
  const renderDay = (date: Date, index: number) => {
    const isCurrentMonth = isSameMonth(date, currentMonth);
    const isSelected = selectedDate && isSameDay(date, selectedDate);
    const isTodayDate = isToday(date);
    const disabled = isDateDisabled(date);
    
    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.dayCell,
          isSelected && { backgroundColor: colors.primary },
          isTodayDate && !isSelected && styles.todayCell,
        ]}
        onPress={() => !disabled && handleSelectDate(date)}
        disabled={disabled}
      >
        <Text
          style={[
            styles.dayText,
            { color: isCurrentMonth ? colors.text : colors.textSecondary + '50' },
            isSelected && styles.selectedDayText,
            isTodayDate && !isSelected && { color: colors.primary, fontWeight: '700' },
            disabled && { color: colors.textSecondary + '30' },
          ]}
        >
          {format(date, 'd')}
        </Text>
        {isTodayDate && !isSelected && (
          <View style={[styles.todayDot, { backgroundColor: colors.primary }]} />
        )}
      </TouchableOpacity>
    );
  };
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.container, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton}>
              <Ionicons name="chevron-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Text style={[styles.monthTitle, { color: colors.text }]}>
              {format(currentMonth, 'MMMM yyyy')}
            </Text>
            <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
              <Ionicons name="chevron-forward" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
          
          {/* Today Button */}
          <TouchableOpacity 
            style={[styles.todayButton, { borderColor: colors.primary }]}
            onPress={() => {
              setCurrentMonth(new Date());
              if (!maxDate || !isAfter(new Date(), maxDate)) {
                handleSelectDate(new Date());
              }
            }}
          >
            <Text style={[styles.todayButtonText, { color: colors.primary }]}>Today</Text>
          </TouchableOpacity>
          
          {/* Week Day Headers */}
          <View style={styles.weekDaysRow}>
            {weekDays.map((day, index) => (
              <View key={index} style={styles.weekDayCell}>
                <Text style={[styles.weekDayText, { color: colors.textSecondary }]}>
                  {day}
                </Text>
              </View>
            ))}
          </View>
          
          {/* Calendar Grid */}
          <View style={styles.calendarGrid}>
            {calendarDays.map((date, index) => renderDay(date, index))}
          </View>
          
          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity 
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={onClose}
            >
              <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    width: '90%',
    maxWidth: 360,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  navButton: {
    padding: 8,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  todayButton: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
  },
  todayButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  weekDaysRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    position: 'relative',
  },
  dayText: {
    fontSize: 16,
    fontWeight: '400',
  },
  selectedDayText: {
    color: 'white',
    fontWeight: '600',
  },
  todayCell: {
    borderWidth: 0,
  },
  todayDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default CalendarPicker;
