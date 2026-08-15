import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Keyboard,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import {
  Search,
  X,
  Receipt,
  Calendar,
  UserPlus,
  DollarSign,
  ArrowRight,
  Clock,
  TrendingUp,
  Zap,
  Users,
  FileText,
  ChevronRight,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useQuickAction } from '@/contexts/QuickActionContext';
import { parseQuickAction, QUICK_SUGGESTIONS } from '@/lib/quickActionParser';
import type { ParsedAction } from '@/lib/quickActionParser';

const ACTION_ICONS: Record<string, any> = {
  invoice_client: Receipt,
  schedule_client: Calendar,
  add_client: UserPlus,
  direct_create_client: UserPlus,
  add_expense: DollarSign,
  add_income: TrendingUp,
  navigate: ArrowRight,
  search_client: Users,
  complete_job: FileText,
};

interface QuickActionBarProps {
  onAction: (action: ParsedAction) => void;
}

export default function QuickActionBar({ onAction }: QuickActionBarProps) {
  const { isOpen, open, close, recentActions, clients, recordAction } = useQuickAction();
  const { colors } = useTheme();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ParsedAction[]>([]);
  const inputRef = useRef<TextInput>(null);

  const backdropOpacity = useSharedValue(0);
  const panelTranslateY = useSharedValue(-20);
  const panelOpacity = useSharedValue(0);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          close();
        } else {
          open();
        }
      }
      if (e.key === 'Escape' && isOpen) {
        close();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, close]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      backdropOpacity.value = withTiming(1, { duration: 200 });
      panelTranslateY.value = withSpring(0, { damping: 20, stiffness: 300 });
      panelOpacity.value = withTiming(1, { duration: 150 });
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      backdropOpacity.value = withTiming(0, { duration: 150 });
      panelTranslateY.value = withTiming(-20, { duration: 150 });
      panelOpacity.value = withTiming(0, { duration: 120 });
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.trim().length > 0) {
      const parsed = parseQuickAction(query, clients);
      setResults(parsed);
    } else {
      setResults([]);
    }
  }, [query, clients]);

  const handleSelect = useCallback(async (action: ParsedAction) => {
    close();
    setQuery('');

    if (action.type === 'navigate' && action.navigateTo) {
      await recordAction(action);
      router.push(action.navigateTo as any);
      return;
    }

    await recordAction(action);
    onAction(action);
  }, [close, recordAction, router, onAction]);

  const handleRecentSelect = useCallback(async (recent: any) => {
    close();
    setQuery('');

    const action: ParsedAction = {
      type: recent.action_type,
      label: recent.label,
      description: recent.description,
      raw: recent.raw_input,
      clientName: recent.metadata?.clientName,
      amount: recent.metadata?.amount,
      day: recent.metadata?.day,
      navigateTo: recent.metadata?.navigateTo,
    };

    if (action.type === 'navigate' && action.navigateTo) {
      await recordAction(action);
      router.push(action.navigateTo as any);
      return;
    }

    await recordAction(action);
    onAction(action);
  }, [close, recordAction, router, onAction]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: panelTranslateY.value }],
    opacity: panelOpacity.value,
  }));

  const ds = getDynamicStyles(colors);

  const showSuggestions = query.length === 0 && results.length === 0;
  const topRecent = recentActions.slice(0, 5);
  const hasRecent = topRecent.length > 0;

  const getIconComponent = (type: string) => ACTION_ICONS[type] || Zap;

  const renderActionItem = (action: ParsedAction, index: number) => {
    const IconComp = getIconComponent(action.type);
    return (
      <TouchableOpacity
        key={`${action.type}-${index}`}
        style={ds.resultItem}
        onPress={() => handleSelect(action)}
        activeOpacity={0.7}
      >
        <View style={ds.resultIconWrap}>
          <IconComp size={18} color={colors.primary} />
        </View>
        <View style={ds.resultTextWrap}>
          <Text style={ds.resultLabel} numberOfLines={1}>{action.label}</Text>
          <Text style={ds.resultDescription} numberOfLines={1}>{action.description}</Text>
        </View>
        <ChevronRight size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  if (!isOpen) return null;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      onRequestClose={close}
      statusBarTranslucent
    >
      <View style={ds.container}>
        <Animated.View style={[ds.backdrop, backdropStyle]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={close} />
        </Animated.View>

        <Animated.View style={[ds.panel, panelStyle]}>
          <View style={ds.searchRow}>
            <View style={ds.searchInputWrap}>
              <Search size={18} color={colors.textSecondary} />
              <TextInput
                ref={inputRef}
                style={ds.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder={Platform.OS === 'web' ? 'Quick action...  (Ctrl+K)' : 'Quick action...'}
                placeholderTextColor={colors.textSecondary}
                returnKeyType="done"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={ds.closeBtn} onPress={close}>
              <Text style={ds.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={ds.divider} />

          <FlatList
            data={results.length > 0 ? [] : []}
            renderItem={() => null}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={ds.listContainer}
            ListHeaderComponent={
              <>
                {results.length > 0 && (
                  <View style={ds.sectionWrap}>
                    <Text style={ds.sectionTitle}>Actions</Text>
                    {results.map((r, i) => renderActionItem(r, i))}
                  </View>
                )}

                {showSuggestions && hasRecent && (
                  <View style={ds.sectionWrap}>
                    <View style={ds.sectionHeader}>
                      <Clock size={14} color={colors.textSecondary} />
                      <Text style={ds.sectionTitle}>Recent</Text>
                    </View>
                    {topRecent.map((recent, i) => {
                      const IconComp = getIconComponent(recent.action_type);
                      return (
                        <TouchableOpacity
                          key={recent.id}
                          style={ds.resultItem}
                          onPress={() => handleRecentSelect(recent)}
                          activeOpacity={0.7}
                        >
                          <View style={ds.resultIconWrap}>
                            <IconComp size={18} color={colors.primary} />
                          </View>
                          <View style={ds.resultTextWrap}>
                            <Text style={ds.resultLabel} numberOfLines={1}>{recent.label}</Text>
                            <Text style={ds.resultDescription} numberOfLines={1}>{recent.description}</Text>
                          </View>
                          {recent.use_count > 1 && (
                            <View style={ds.countBadge}>
                              <Text style={ds.countBadgeText}>{recent.use_count}x</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {showSuggestions && (
                  <View style={ds.sectionWrap}>
                    <View style={ds.sectionHeader}>
                      <Zap size={14} color={colors.textSecondary} />
                      <Text style={ds.sectionTitle}>Quick Commands</Text>
                    </View>
                    <View style={ds.suggestionsGrid}>
                      {QUICK_SUGGESTIONS.map((s, i) => {
                        const IconComp = getIconComponent(s.type);
                        return (
                          <TouchableOpacity
                            key={i}
                            style={ds.suggestionChip}
                            onPress={() => handleSelect(s)}
                            activeOpacity={0.7}
                          >
                            <IconComp size={14} color={colors.primary} />
                            <Text style={ds.suggestionChipText} numberOfLines={1}>{s.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {results.length === 0 && query.length > 0 && (
                  <View style={ds.emptyWrap}>
                    <Search size={32} color={colors.border} />
                    <Text style={ds.emptyText}>No matching actions</Text>
                    <Text style={ds.emptyHint}>Try "invoice", "schedule", "expense", or a client name</Text>
                  </View>
                )}
              </>
            }
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

const getDynamicStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    panel: {
      marginTop: Platform.OS === 'web' ? 60 : 80,
      marginHorizontal: Platform.OS === 'web' ? '10%' as any : 12,
      maxWidth: 600,
      alignSelf: 'center' as any,
      width: Platform.OS === 'web' ? '80%' as any : undefined,
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      maxHeight: '70%',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 24,
      elevation: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 10,
    },
    searchInputWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'web' ? 10 : 8,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      paddingVertical: 0,
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
    },
    closeBtn: {
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    closeBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
    listContainer: {
      flex: 1,
    },
    sectionWrap: {
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 6,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 2,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    resultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 4,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '30',
    },
    resultIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    resultTextWrap: {
      flex: 1,
    },
    resultLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    resultDescription: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 1,
    },
    countBadge: {
      backgroundColor: colors.inputBackground,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    countBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    suggestionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    suggestionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.inputBackground,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    suggestionChipText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.text,
    },
    emptyWrap: {
      alignItems: 'center',
      paddingVertical: 32,
      gap: 8,
    },
    emptyText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    emptyHint: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      maxWidth: 240,
    },
  });
