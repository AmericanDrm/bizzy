import React, { useState, useMemo, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Dimensions,
  Platform,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { X, Search } from 'lucide-react-native';
import { FAQ_DATA, FAQ_CATEGORIES, FAQCategory as FAQCategoryType } from '@/constants/faqData';
import FAQCategoryComponent from './FAQCategory';
import { trackFAQEvent, generateSessionId } from '@/lib/analyticsService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FAQModalProps {
  visible: boolean;
  onClose: () => void;
  initialCategory?: FAQCategoryType;
  initialSearchQuery?: string;
}

export default function FAQModal({
  visible,
  onClose,
  initialCategory,
  initialSearchQuery,
}: FAQModalProps) {
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(initialCategory ? [initialCategory] : [])
  );

  useEffect(() => {
    if (visible) {
      generateSessionId();
    }
  }, [visible]);

  const filteredFAQs = useMemo(() => {
    if (!searchQuery.trim()) {
      return FAQ_DATA;
    }

    const query = searchQuery.toLowerCase();
    const results = FAQ_DATA.filter((faq) => {
      return (
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query) ||
        faq.keywords.some((keyword) => keyword.toLowerCase().includes(query))
      );
    });

    if (searchQuery.trim()) {
      trackFAQEvent({
        faqItemId: 'search',
        category: 'search',
        actionType: 'search',
        searchQuery: searchQuery.trim(),
      });
    }

    return results;
  }, [searchQuery]);

  const categorizedFAQs = useMemo(() => {
    const grouped: Record<string, typeof FAQ_DATA> = {};
    filteredFAQs.forEach((faq) => {
      if (!grouped[faq.category]) {
        grouped[faq.category] = [];
      }
      grouped[faq.category].push(faq);
    });
    return grouped;
  }, [filteredFAQs]);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  useEffect(() => {
    if (searchQuery.trim()) {
      setExpandedCategories(new Set(Object.keys(categorizedFAQs)));
    }
  }, [searchQuery, categorizedFAQs]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={styles.headerTop}>
            <Text style={[styles.title, { color: colors.text }]}>Help & FAQ</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={[styles.searchContainer, { backgroundColor: colors.background }]}>
            <Search size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search for help..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {filteredFAQs.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No results found for "{searchQuery}"
              </Text>
              <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
                Try browsing categories below or search with different keywords
              </Text>
            </View>
          ) : (
            Object.keys(categorizedFAQs).map((categoryKey) => {
              const category = categoryKey as FAQCategoryType;
              const items = categorizedFAQs[category];
              return (
                <FAQCategoryComponent
                  key={category}
                  category={category}
                  title={FAQ_CATEGORIES[category].title}
                  icon={FAQ_CATEGORIES[category].icon}
                  items={items}
                  expanded={expandedCategories.has(category)}
                  onToggle={() => toggleCategory(category)}
                />
              );
            })
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  } as any,
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
