import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import * as Icons from 'lucide-react-native';
import { FAQItem as FAQItemType } from '@/constants/faqData';
import FAQItemComponent from './FAQItem';

interface FAQCategoryProps {
  category: string;
  title: string;
  icon: string;
  items: FAQItemType[];
  expanded: boolean;
  onToggle: () => void;
}

export default function FAQCategory({
  category,
  title,
  icon,
  items,
  expanded,
  onToggle,
}: FAQCategoryProps) {
  const { colors } = useTheme();
  const IconComponent = (Icons as any)[icon];

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.header, { backgroundColor: colors.card }]}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
            <IconComponent size={20} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>{items.length}</Text>
          </View>
        </View>
        {expanded ? (
          <ChevronDown size={20} color={colors.textSecondary} />
        ) : (
          <ChevronRight size={20} color={colors.textSecondary} />
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={styles.items}>
          {items.map((item) => (
            <FAQItemComponent key={item.id} item={item} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 28,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  items: {
    marginTop: 8,
    gap: 8,
  },
});
