import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useWalkthrough } from '@/contexts/WalkthroughContext';
import { ChevronDown, ChevronRight, Play } from 'lucide-react-native';
import { FAQItem as FAQItemType } from '@/constants/faqData';
import { trackFAQEvent } from '@/lib/analyticsService';

interface FAQItemProps {
  item: FAQItemType;
}

export default function FAQItem({ item }: FAQItemProps) {
  const { colors } = useTheme();
  const { jumpToStep, startWalkthrough } = useWalkthrough();
  const [expanded, setExpanded] = useState(false);

  const handleToggle = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);

    if (newExpanded) {
      trackFAQEvent({
        faqItemId: item.id,
        category: item.category,
        actionType: 'viewed',
      });
    }
  };

  const handleShowMe = () => {
    if (item.relatedWalkthroughStep) {
      trackFAQEvent({
        faqItemId: item.id,
        category: item.category,
        actionType: 'show_me_clicked',
      });

      startWalkthrough('help_button');
      setTimeout(() => {
        jumpToStep(item.relatedWalkthroughStep!);
      }, 300);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <TouchableOpacity
        style={styles.questionContainer}
        onPress={handleToggle}
        activeOpacity={0.7}
      >
        <View style={styles.questionLeft}>
          {expanded ? (
            <ChevronDown size={18} color={colors.textSecondary} />
          ) : (
            <ChevronRight size={18} color={colors.textSecondary} />
          )}
          <Text style={[styles.question, { color: colors.text }]}>{item.question}</Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.answerContainer}>
          <Text style={[styles.answer, { color: colors.textSecondary }]}>{item.answer}</Text>

          {item.relatedWalkthroughStep && (
            <TouchableOpacity
              style={[styles.showMeButton, { backgroundColor: colors.primary + '15' }]}
              onPress={handleShowMe}
              activeOpacity={0.7}
            >
              <Play size={16} color={colors.primary} />
              <Text style={[styles.showMeText, { color: colors.primary }]}>Show Me</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  questionContainer: {
    padding: 16,
  },
  questionLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  question: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  answerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingLeft: 46,
  },
  answer: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
  showMeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  showMeText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
