import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  Search,
  X,
  Receipt,
  Calendar,
  CalendarClock,
  UserPlus,
  DollarSign,
  ArrowRight,
  Clock,
  TrendingUp,
  Zap,
  Users,
  FileText,
  ChevronRight,
  Bell,
  ClipboardList,
  Send,
  PenLine,
  ShoppingCart,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useQuickAction } from '@/contexts/QuickActionContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { parseQuickAction, QUICK_SUGGESTIONS } from '@/lib/quickActionParser';
import { getSmartSuggestions, invalidateSuggestionsCache } from '@/lib/smartSuggestionsService';
import type { ParsedAction } from '@/lib/quickActionParser';
import type { SmartSuggestion } from '@/lib/smartSuggestionsService';

const ACTION_ICONS: Record<string, any> = {
  invoice_client: Receipt,
  schedule_client: Calendar,
  reschedule_job: CalendarClock,
  add_client: UserPlus,
  direct_create_client: UserPlus,
  add_expense: DollarSign,
  add_income: TrendingUp,
  navigate: ArrowRight,
  search_client: Users,
  complete_job: FileText,
  create_estimate: ClipboardList,
  send_invoice: Send,
  send_estimate: Send,
  direct_create_note: PenLine,
  direct_create_shopping_list: ShoppingCart,
};

const SUGGESTION_ICONS: Record<string, any> = {
  uninvoiced_job: Receipt,
  unpaid_reminder: Bell,
  recurring_visit: Calendar,
  pending_estimate: FileText,
  account_balance: DollarSign,
};

interface FabQuickActionPanelProps {
  onAction: (action: ParsedAction) => void;
  onClose: () => void;
}

export default function FabQuickActionPanel({ onAction, onClose }: FabQuickActionPanelProps) {
  const { colors } = useTheme();
  const { recentActions, clients, recordAction } = useQuickAction();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ParsedAction[]>([]);
  const [smartSuggestions, setSmartSuggestions] = useState<SmartSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!user?.id || !currentOrganization?.id) {
      setLoadingSuggestions(false);
      return;
    }
    let cancelled = false;
    setLoadingSuggestions(true);
    getSmartSuggestions(user.id, currentOrganization.id).then((suggestions) => {
      if (!cancelled) {
        setSmartSuggestions(suggestions);
        setLoadingSuggestions(false);
      }
    }).catch(() => {
      if (!cancelled) setLoadingSuggestions(false);
    });
    return () => { cancelled = true; };
  }, [user?.id, currentOrganization?.id]);

  useEffect(() => {
    if (query.trim().length > 0) {
      setResults(parseQuickAction(query, clients));
    } else {
      setResults([]);
    }
  }, [query, clients]);

  const handleSelect = useCallback(async (action: ParsedAction) => {
    await recordAction(action);
    onAction(action);
  }, [recordAction, onAction]);

  const handleRecentSelect = useCallback(async (recent: any) => {
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
    await recordAction(action);
    onAction(action);
  }, [recordAction, onAction]);

  const ds = getDynamicStyles(colors);
  const showSuggestions = query.length === 0 && results.length === 0;
  const topRecent = recentActions.slice(0, 4);
  const hasSmartSuggestions = smartSuggestions.length > 0;
  const getIconComponent = (type: string) => ACTION_ICONS[type] || Zap;
  const getSuggestionIcon = (type: string) => SUGGESTION_ICONS[type] || Zap;

  return (
    <View style={ds.panel}>
      <View style={ds.searchRow}>
        <View style={ds.searchInputWrap}>
          <Search size={16} color={colors.textSecondary} />
          <TextInput
            ref={inputRef}
            style={ds.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder='Try "invoice John" or "schedule Tuesday"'
            placeholderTextColor={colors.textSecondary}
            returnKeyType="done"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={ds.divider} />

      <ScrollView
        style={ds.listContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {results.length > 0 && (
          <View style={ds.sectionWrap}>
            <Text style={ds.sectionTitle}>Actions</Text>
            {results.map((r, i) => {
              const IconComp = getIconComponent(r.type);
              return (
                <TouchableOpacity
                  key={`${r.type}-${i}`}
                  style={ds.resultItem}
                  onPress={() => handleSelect(r)}
                  activeOpacity={0.7}
                >
                  <View style={ds.resultIconWrap}>
                    <IconComp size={16} color={colors.primary} />
                  </View>
                  <View style={ds.resultTextWrap}>
                    <Text style={ds.resultLabel} numberOfLines={1}>{r.label}</Text>
                    <Text style={ds.resultDescription} numberOfLines={1}>{r.description}</Text>
                  </View>
                  <ChevronRight size={14} color={colors.textSecondary} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {showSuggestions && (hasSmartSuggestions || loadingSuggestions) && (
          <View style={ds.sectionWrap}>
            <View style={ds.sectionHeader}>
              <Zap size={12} color="#1B6B3A" fill="#1B6B3A" />
              <Text style={[ds.sectionTitle, ds.suggestedTitle]}>Bizzy Suggestions</Text>
            </View>
            {loadingSuggestions ? (
              <View style={ds.loadingWrap}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : (
              smartSuggestions.slice(0, 4).map((s) => {
                const IconComp = getSuggestionIcon(s.type);
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={ds.suggestionItem}
                    onPress={() => handleSelect(s.action)}
                    activeOpacity={0.7}
                  >
                    <View style={[ds.suggestionIconWrap, getSuggestionColor(s.type, colors)]}>
                      <IconComp size={15} color={getSuggestionIconColor(s.type)} />
                    </View>
                    <View style={ds.resultTextWrap}>
                      <Text style={ds.resultLabel} numberOfLines={1}>{s.label}</Text>
                      <Text style={ds.resultDescription} numberOfLines={1}>{s.description}</Text>
                    </View>
                    <ChevronRight size={14} color={colors.textSecondary} />
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {showSuggestions && topRecent.length > 0 && (
          <View style={ds.sectionWrap}>
            <View style={ds.sectionHeader}>
              <Clock size={12} color={colors.textSecondary} />
              <Text style={ds.sectionTitle}>Recent</Text>
            </View>
            {topRecent.map((recent) => {
              const IconComp = getIconComponent(recent.action_type);
              return (
                <TouchableOpacity
                  key={recent.id}
                  style={ds.resultItem}
                  onPress={() => handleRecentSelect(recent)}
                  activeOpacity={0.7}
                >
                  <View style={ds.resultIconWrap}>
                    <IconComp size={16} color={colors.primary} />
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
            <Text style={ds.sectionTitle}>Quick Commands</Text>
            <View style={ds.chipsGrid}>
              {QUICK_SUGGESTIONS.slice(0, 6).map((s, i) => {
                const IconComp = getIconComponent(s.type);
                return (
                  <TouchableOpacity
                    key={i}
                    style={ds.chip}
                    onPress={() => handleSelect(s)}
                    activeOpacity={0.7}
                  >
                    <IconComp size={12} color={colors.primary} />
                    <Text style={ds.chipText} numberOfLines={1}>{s.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {results.length === 0 && query.length > 0 && (
          <View style={ds.emptyWrap}>
            <Search size={24} color={colors.border} />
            <Text style={ds.emptyText}>No matching actions</Text>
          </View>
        )}

        <View style={{ height: 8 }} />
      </ScrollView>
    </View>
  );
}

function getSuggestionColor(type: string, colors: any): { backgroundColor: string } {
  switch (type) {
    case 'uninvoiced_job': return { backgroundColor: '#dcfce7' };
    case 'unpaid_reminder': return { backgroundColor: '#fef3c7' };
    case 'recurring_visit': return { backgroundColor: colors.primaryLight };
    case 'pending_estimate': return { backgroundColor: '#e0e7ff' };
    default: return { backgroundColor: colors.primaryLight };
  }
}

function getSuggestionIconColor(type: string): string {
  switch (type) {
    case 'uninvoiced_job': return '#16a34a';
    case 'unpaid_reminder': return '#d97706';
    case 'recurring_visit': return '#1B4D6E';
    case 'pending_estimate': return '#4f46e5';
    default: return '#1B4D6E';
  }
}

const getDynamicStyles = (colors: any) =>
  StyleSheet.create({
    panel: {
      backgroundColor: colors.cardBackground,
      borderRadius: 14,
      maxHeight: 360,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchRow: {
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    searchInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: Platform.OS === 'web' ? 8 : 7,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
      paddingVertical: 0,
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
    listContainer: {
      maxHeight: 300,
    },
    sectionWrap: {
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 4,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginBottom: 2,
    },
    sectionTitle: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
      marginBottom: 6,
    },
    suggestedTitle: {
      color: '#1B6B3A',
    },
    resultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 2,
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '20',
    },
    resultIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    resultTextWrap: {
      flex: 1,
    },
    resultLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    resultDescription: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 1,
    },
    countBadge: {
      backgroundColor: colors.inputBackground,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    countBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    suggestionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 2,
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '20',
    },
    suggestionIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.inputBackground,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipText: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.text,
    },
    emptyWrap: {
      alignItems: 'center',
      paddingVertical: 24,
      gap: 6,
    },
    emptyText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    loadingWrap: {
      paddingVertical: 16,
      alignItems: 'center',
    },
  });
