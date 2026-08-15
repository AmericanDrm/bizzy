import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  MapPin,
  Coffee,
  ShoppingCart,
  AlertCircle,
  Home,
  Truck,
  Clock,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

export type LocationContext =
  | 'on_site'
  | 'on_break'
  | 'getting_supplies'
  | 'stuck'
  | 'at_home'
  | 'traveling'
  | 'unknown';

interface LocationContextChipsProps {
  context: LocationContext;
  onPress?: () => void;
  clientName?: string;
  stoppedMinutes?: number;
}

const getContextConfig = (context: LocationContext) => {
  switch (context) {
    case 'on_site':
      return {
        icon: MapPin,
        label: 'On Site',
        color: '#10b981',
        bgColor: '#d1fae5',
        darkBgColor: '#064e3b',
      };
    case 'on_break':
      return {
        icon: Coffee,
        label: 'On Break',
        color: '#f59e0b',
        bgColor: '#fef3c7',
        darkBgColor: '#78350f',
      };
    case 'getting_supplies':
      return {
        icon: ShoppingCart,
        label: 'Getting Supplies',
        color: '#3b82f6',
        bgColor: '#dbeafe',
        darkBgColor: '#1e3a8a',
      };
    case 'stuck':
      return {
        icon: AlertCircle,
        label: 'Stuck in Traffic',
        color: '#ef4444',
        bgColor: '#fee2e2',
        darkBgColor: '#7f1d1d',
      };
    case 'at_home':
      return {
        icon: Home,
        label: 'At Home Base',
        color: '#8b5cf6',
        bgColor: '#ede9fe',
        darkBgColor: '#4c1d95',
      };
    case 'traveling':
      return {
        icon: Truck,
        label: 'Traveling',
        color: '#d97706',
        bgColor: '#fef3c7',
        darkBgColor: '#78350f',
      };
    default:
      return {
        icon: Clock,
        label: 'Working',
        color: '#6b7280',
        bgColor: '#f3f4f6',
        darkBgColor: '#374151',
      };
  }
};

export default function LocationContextChips({
  context,
  onPress,
  clientName,
  stoppedMinutes,
}: LocationContextChipsProps) {
  const { colors, isDark } = useTheme();
  const config = getContextConfig(context);
  const Icon = config.icon;

  const displayLabel = context === 'on_site' && clientName
    ? `At ${clientName}`
    : config.label;

  const Component = onPress ? TouchableOpacity : View;

  return (
    <Component
      style={[
        styles.chip,
        {
          backgroundColor: isDark ? config.darkBgColor : config.bgColor,
          borderColor: config.color,
        },
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Icon size={14} color={config.color} />
      <Text style={[styles.chipText, { color: config.color }]}>
        {displayLabel}
      </Text>
      {stoppedMinutes !== undefined && stoppedMinutes > 0 && (
        <Text style={[styles.minutesText, { color: config.color }]}>
          {stoppedMinutes}m
        </Text>
      )}
    </Component>
  );
}

interface MultipleChipsProps {
  contexts: Array<{
    context: LocationContext;
    clientName?: string;
    stoppedMinutes?: number;
  }>;
  onChipPress?: (context: LocationContext) => void;
}

export function LocationContextChipGroup({
  contexts,
  onChipPress,
}: MultipleChipsProps) {
  return (
    <View style={styles.chipGroup}>
      {contexts.map((ctx, index) => (
        <LocationContextChips
          key={`${ctx.context}-${index}`}
          context={ctx.context}
          clientName={ctx.clientName}
          stoppedMinutes={ctx.stoppedMinutes}
          onPress={onChipPress ? () => onChipPress(ctx.context) : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  minutesText: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.8,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
