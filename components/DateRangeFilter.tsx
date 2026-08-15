import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Calendar, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import DatePicker from './DatePicker';

type QuickFilter = 'today' | 'week' | 'month' | 'all' | 'custom';

interface DateRangeFilterProps {
  startDate: Date | null;
  endDate: Date | null;
  onStartDateChange: (date: Date | null) => void;
  onEndDateChange: (date: Date | null) => void;
}

export default function DateRangeFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: DateRangeFilterProps) {
  const { colors } = useTheme();
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [activeFilter, setActiveFilter] = useState<QuickFilter>('all');

  const applyQuickFilter = (filter: QuickFilter) => {
    setActiveFilter(filter);
    const now = new Date();

    switch (filter) {
      case 'today':
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        onStartDateChange(today);
        onEndDateChange(new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1));
        break;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        onStartDateChange(weekStart);
        onEndDateChange(weekEnd);
        break;
      case 'month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        onStartDateChange(monthStart);
        onEndDateChange(monthEnd);
        break;
      case 'all':
        onStartDateChange(null);
        onEndDateChange(null);
        break;
      case 'custom':
        break;
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Select';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const dateToString = (date: Date | null) => {
    if (!date) return new Date().toISOString().split('T')[0];
    return date.toISOString().split('T')[0];
  };

  const clearFilters = () => {
    onStartDateChange(null);
    onEndDateChange(null);
    setActiveFilter('all');
  };

  return (
    <View style={styles.container}>
      <View style={styles.quickFilters}>
        <TouchableOpacity
          style={[
            styles.quickButton,
            { backgroundColor: colors.cardBackground },
            activeFilter === 'today' && { backgroundColor: colors.primary },
          ]}
          onPress={() => applyQuickFilter('today')}
        >
          <Text
            style={[
              styles.quickButtonText,
              { color: colors.text },
              activeFilter === 'today' && { color: '#FFFFFF' },
            ]}
          >
            Today
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.quickButton,
            { backgroundColor: colors.cardBackground },
            activeFilter === 'week' && { backgroundColor: colors.primary },
          ]}
          onPress={() => applyQuickFilter('week')}
        >
          <Text
            style={[
              styles.quickButtonText,
              { color: colors.text },
              activeFilter === 'week' && { color: '#FFFFFF' },
            ]}
          >
            This Week
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.quickButton,
            { backgroundColor: colors.cardBackground },
            activeFilter === 'month' && { backgroundColor: colors.primary },
          ]}
          onPress={() => applyQuickFilter('month')}
        >
          <Text
            style={[
              styles.quickButtonText,
              { color: colors.text },
              activeFilter === 'month' && { color: '#FFFFFF' },
            ]}
          >
            This Month
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.quickButton,
            { backgroundColor: colors.cardBackground },
            activeFilter === 'all' && { backgroundColor: colors.primary },
          ]}
          onPress={() => applyQuickFilter('all')}
        >
          <Text
            style={[
              styles.quickButtonText,
              { color: colors.text },
              activeFilter === 'all' && { color: '#FFFFFF' },
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.customRange}>
        <TouchableOpacity
          style={[styles.dateButton, { backgroundColor: colors.cardBackground }]}
          onPress={() => setShowStartPicker(true)}
        >
          <Calendar size={16} color={colors.primary} />
          <Text style={[styles.dateButtonText, { color: colors.text }]}>
            {formatDate(startDate)}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.toText, { color: colors.textSecondary }]}>to</Text>

        <TouchableOpacity
          style={[styles.dateButton, { backgroundColor: colors.cardBackground }]}
          onPress={() => setShowEndPicker(true)}
        >
          <Calendar size={16} color={colors.primary} />
          <Text style={[styles.dateButtonText, { color: colors.text }]}>
            {formatDate(endDate)}
          </Text>
        </TouchableOpacity>

        {(startDate || endDate) && (
          <TouchableOpacity onPress={clearFilters} style={styles.clearButton}>
            <X size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <DatePicker
        visible={showStartPicker}
        value={dateToString(startDate)}
        onConfirm={(d) => {
          onStartDateChange(new Date(d + 'T00:00:00'));
          setActiveFilter('custom');
          setShowStartPicker(false);
        }}
        onCancel={() => setShowStartPicker(false)}
        title="Select Start Date"
      />

      <DatePicker
        visible={showEndPicker}
        value={dateToString(endDate)}
        onConfirm={(d) => {
          onEndDateChange(new Date(d + 'T23:59:59'));
          setActiveFilter('custom');
          setShowEndPicker(false);
        }}
        onCancel={() => setShowEndPicker(false)}
        title="Select End Date"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  quickFilters: {
    flexDirection: 'row',
    gap: 8,
  },
  quickButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  customRange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  dateButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  toText: {
    fontSize: 14,
  },
  clearButton: {
    padding: 4,
  },
});
