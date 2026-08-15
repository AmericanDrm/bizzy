import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
  ScrollView,
  Animated,
  SectionList,
  Modal,
  Pressable,
} from 'react-native';
import { Plus, FileText, Gauge, ChartBar as BarChart2, TrendingUp, TrendingDown, DollarSign, Tags, Menu } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { AnimatedTabContent } from '@/components/AnimatedTabContent';
import { getSlideDirection, getDynamicTabOrder } from '@/utils/tabAnimations';
import { useLayout } from '@/contexts/LayoutContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import FinanceModal from '@/components/FinanceModal';
import FinanceTransactionItem from '@/components/FinanceTransactionItem';
import DateRangeFilter from '@/components/DateRangeFilter';
import MileageTrackerModal from '@/components/MileageTrackerModal';
import FinanceAnalyticsPanel from '@/components/FinanceAnalyticsPanel';
import CategoryDrillDownModal from '@/components/CategoryDrillDownModal';
import WorkflowFab from '@/components/WorkflowFab';
import { useQuickActionHandler } from '@/hooks/useQuickActionHandler';
import QuickEntryBottomSheet from '@/components/QuickEntryBottomSheet';
import type { QuickEntryMode } from '@/components/QuickEntryBottomSheet';
import FinanceCategoriesModal from '@/components/FinanceCategoriesModal';
import getDynamicStyles from '@/styles/financesStyles';
import {
  FinanceItem,
  PeriodReport,
  fetchFinanceData,
  processRecurringExpenses,
  generateMonthlyReports,
  generateYearlyReports,
  generateWeeklyReports,
  formatCurrency,
} from '@/lib/financeService';

import { generatePDFReport } from '@/lib/financePdfService';
import { StyleSheet } from 'react-native';

type MainTab = 'income' | 'expenses' | 'analytics';
type GroupMode = 'weekly' | 'monthly' | 'yearly';

interface WeekSection {
  title: string;
  period: string;
  total: number;
  data: FinanceItem[];
}

export default function FinancesScreen() {
  const [items, setItems] = useState<FinanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'income' | 'expense'>('income');
  const [selectedItem, setSelectedItem] = useState<FinanceItem | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>('income');
  const [groupMode, setGroupMode] = useState<GroupMode>('weekly');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [mileageModalVisible, setMileageModalVisible] = useState(false);
  const [drillDownCategory, setDrillDownCategory] = useState<string | null>(null);
  const [drillDownType, setDrillDownType] = useState<'expense' | 'income'>('expense');
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { currentTab, previousTab } = useTabNavigation();
  const { visibleTabs, dominantHand } = useLayout();
  const { currentOrganization, isAdminOrOwner } = useOrganization();
  const [fabOpen, setFabOpen] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [quickEntryVisible, setQuickEntryVisible] = useState(false);
  const [categoriesModalVisible, setCategoriesModalVisible] = useState(false);
  const [quickEntryMode, setQuickEntryMode] = useState<QuickEntryMode>('expense');
  const dynamicOrder = getDynamicTabOrder(visibleTabs);
  const slideDirection = getSlideDirection(previousTab, currentTab, dynamicOrder);
  const dynamicStyles = getDynamicStyles(colors);
  const handleQuickAction = useQuickActionHandler({
    onAddExpense: () => { setModalType('expense'); setSelectedItem(null); setModalVisible(true); },
    onAddIncome: () => { setModalType('income'); setSelectedItem(null); setModalVisible(true); },
  });
  const incomeIconAnim = useRef(new Animated.Value(0)).current;
  const expenseIconAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(incomeIconAnim, {
      toValue: modalVisible && modalType === 'income' ? 1 : 0,
      useNativeDriver: true,
      friction: 6,
      tension: 80,
    }).start();
  }, [modalVisible, modalType]);

  useEffect(() => {
    Animated.spring(expenseIconAnim, {
      toValue: modalVisible && modalType === 'expense' ? 1 : 0,
      useNativeDriver: true,
      friction: 6,
      tension: 80,
    }).start();
  }, [modalVisible, modalType]);

  useEffect(() => {
    if (!user?.id || !currentOrganization?.id) return;
    processRecurringExpenses(user.id, currentOrganization.id)
      .then(() => fetchFinances())
      .catch(() => fetchFinances());
  }, [user?.id, currentOrganization?.id]);

  const fetchFinances = useCallback(async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }
    try {
      const data = await fetchFinanceData(currentOrganization.id);
      setItems(data);
    } catch (error) {
      console.error('Error fetching finances:', error);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  const handleAddIncome = useCallback(() => {
    setSelectedItem(null);
    setModalType('income');
    setModalVisible(true);
  }, []);

  const handleAddExpense = useCallback(() => {
    setSelectedItem(null);
    setModalType('expense');
    setModalVisible(true);
  }, []);

  const handleEditItem = useCallback((item: FinanceItem) => {
    setSelectedItem(item);
    setModalType(item.type);
    setModalVisible(true);
  }, []);

  const handleRepeatItem = useCallback((item: FinanceItem) => {
    const today = new Date().toISOString().split('T')[0];
    const repeated: FinanceItem = { ...item, id: '', date: today };
    setSelectedItem(repeated);
    setModalType(item.type);
    setModalVisible(true);
  }, []);

  const handleDeleteItem = useCallback(async (item: FinanceItem) => {
    const confirmDelete = () => {
      if (Platform.OS === 'web') {
        return window.confirm('Are you sure you want to delete this item?');
      }
      return new Promise<boolean>((resolve) => {
        Alert.alert(
          `Delete ${item.type === 'income' ? 'Income' : 'Expense'}`,
          'Are you sure you want to delete this item?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
          ]
        );
      });
    };

    const confirmed = await confirmDelete();
    if (!confirmed) return;

    try {
      const table = item.type === 'income' ? 'income' : 'expenses';
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', item.id)
        .eq('user_id', user?.id);

      if (error) throw error;
      fetchFinances();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  }, [user?.id, fetchFinances]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (startDate || endDate) {
        const itemDate = new Date(item.date);
        if (startDate && itemDate < startDate) return false;
        if (endDate && itemDate > endDate) return false;
      }
      return true;
    });
  }, [items, startDate, endDate]);

  const incomeItems = useMemo(() => filteredItems.filter(i => i.type === 'income'), [filteredItems]);
  const expenseItems = useMemo(() => filteredItems.filter(i => i.type === 'expense'), [filteredItems]);

  const { totalIncome, totalExpenses, netIncome } = useMemo(() => {
    const income = incomeItems.reduce((sum, item) => sum + Number(item.amount), 0);
    const expenses = expenseItems.reduce((sum, item) => sum + Number(item.amount), 0);
    return { totalIncome: income, totalExpenses: expenses, netIncome: income - expenses };
  }, [incomeItems, expenseItems]);

  const incomeSections = useMemo((): WeekSection[] => {
    let reports: PeriodReport[];
    if (groupMode === 'weekly') reports = generateWeeklyReports(incomeItems);
    else if (groupMode === 'monthly') reports = generateMonthlyReports(incomeItems);
    else reports = generateYearlyReports(incomeItems);

    return reports.map(r => ({
      title: r.displayDate,
      period: r.period,
      total: r.income,
      data: incomeItems.filter(item => {
        const date = new Date(item.date + 'T12:00:00');
        if (groupMode === 'weekly') {
          const day = date.getDay();
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - day);
          return weekStart.toISOString().split('T')[0] === r.period;
        } else if (groupMode === 'monthly') {
          const yr = date.getFullYear();
          const mo = String(date.getMonth() + 1).padStart(2, '0');
          return `${yr}-${mo}` === r.period;
        } else {
          return String(date.getFullYear()) === r.period;
        }
      }),
    })).filter(s => s.data.length > 0);
  }, [incomeItems, groupMode]);

  const expenseSections = useMemo((): WeekSection[] => {
    let reports: PeriodReport[];
    if (groupMode === 'weekly') reports = generateWeeklyReports(expenseItems);
    else if (groupMode === 'monthly') reports = generateMonthlyReports(expenseItems);
    else reports = generateYearlyReports(expenseItems);

    return reports.map(r => ({
      title: r.displayDate,
      period: r.period,
      total: r.expenses,
      data: expenseItems.filter(item => {
        const date = new Date(item.date + 'T12:00:00');
        if (groupMode === 'weekly') {
          const day = date.getDay();
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - day);
          return weekStart.toISOString().split('T')[0] === r.period;
        } else if (groupMode === 'monthly') {
          const yr = date.getFullYear();
          const mo = String(date.getMonth() + 1).padStart(2, '0');
          return `${yr}-${mo}` === r.period;
        } else {
          return String(date.getFullYear()) === r.period;
        }
      }),
    })).filter(s => s.data.length > 0);
  }, [expenseItems, groupMode]);

  const handleExportPdf = useCallback(() => {
    generatePDFReport(filteredItems, 'all', totalIncome, totalExpenses, netIncome, startDate, endDate);
  }, [filteredItems, totalIncome, totalExpenses, netIncome, startDate, endDate]);

  const toggleSectionExpansion = useCallback((period: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(period)) next.delete(period);
      else next.add(period);
      return next;
    });
  }, []);

  const handleModalClose = useCallback(() => {
    setModalVisible(false);
    setSelectedItem(null);
  }, []);

  const handleModalSave = useCallback(() => {
    setModalVisible(false);
    setSelectedItem(null);
    fetchFinances();
  }, [fetchFinances]);

  const renderTransactionItem = useCallback(({ item }: { item: FinanceItem }) => (
    <FinanceTransactionItem
      item={item}
      onEdit={handleEditItem}
      onDelete={handleDeleteItem}
      onRepeat={handleRepeatItem}
      dynamicStyles={dynamicStyles}
      canDelete={isAdminOrOwner}
    />
  ), [handleEditItem, handleDeleteItem, handleRepeatItem, dynamicStyles, isAdminOrOwner]);

  const isIncome = mainTab === 'income';
  const currentSections = isIncome ? incomeSections : expenseSections;
  const accentColor = isIncome ? '#2D8B57' : '#dc2626';

  const renderSectionHeader = useCallback(({ section }: { section: WeekSection }) => {
    const isExpanded = expandedSections.has(section.period);
    return (
      <TouchableOpacity
        style={[localStyles.sectionHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => toggleSectionExpansion(section.period)}
        activeOpacity={0.7}
      >
        <View style={localStyles.sectionHeaderLeft}>
          <Text style={[localStyles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
          <Text style={[localStyles.sectionCount, { color: colors.textSecondary }]}>
            {section.data.length} {section.data.length === 1 ? 'entry' : 'entries'}
          </Text>
        </View>
        <View style={localStyles.sectionHeaderRight}>
          <Text style={[localStyles.sectionTotal, { color: accentColor }]}>
            {formatCurrency(section.total)}
          </Text>
          <Text style={[localStyles.chevron, { color: colors.textSecondary }]}>
            {isExpanded ? '▲' : '▼'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [expandedSections, toggleSectionExpansion, colors, accentColor]);

  const renderSectionItem = useCallback(({ item, section }: { item: FinanceItem; section: WeekSection }) => {
    if (!expandedSections.has(section.period)) return null;
    return renderTransactionItem({ item });
  }, [expandedSections, renderTransactionItem]);

  return (
    <AnimatedTabContent activeTab={currentTab} tabKey="finances" direction={slideDirection}>
      <View style={dynamicStyles.container}>
        <View style={dynamicStyles.header}>
          <Text style={dynamicStyles.headerTitle}>{t('finances_title')}</Text>
          <Text style={dynamicStyles.headerMonthLabel}>
            {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
          </Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={dynamicStyles.iconButton} onPress={() => setMenuVisible(true)} activeOpacity={0.7}>
            <Menu size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Modal
          transparent
          visible={menuVisible}
          animationType="fade"
          onRequestClose={() => setMenuVisible(false)}
        >
          <Pressable style={localStyles.menuOverlay} onPress={() => setMenuVisible(false)}>
            <View style={[localStyles.menuDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity
                style={localStyles.menuItem}
                onPress={() => { setMenuVisible(false); setCategoriesModalVisible(true); }}
                activeOpacity={0.7}
              >
                <Tags size={16} color={colors.textSecondary} />
                <Text style={[localStyles.menuItemText, { color: colors.text }]}>Categories</Text>
              </TouchableOpacity>
              <View style={[localStyles.menuDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity
                style={localStyles.menuItem}
                onPress={() => { setMenuVisible(false); setMileageModalVisible(true); }}
                activeOpacity={0.7}
              >
                <Gauge size={16} color={colors.textSecondary} />
                <Text style={[localStyles.menuItemText, { color: colors.text }]}>Mileage Tracker</Text>
              </TouchableOpacity>
              <View style={[localStyles.menuDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity
                style={localStyles.menuItem}
                onPress={() => { setMenuVisible(false); handleExportPdf(); }}
                activeOpacity={0.7}
              >
                <FileText size={16} color={colors.textSecondary} />
                <Text style={[localStyles.menuItemText, { color: colors.text }]}>Export PDF</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        {isAdminOrOwner && (
          <View style={dynamicStyles.summaryContainer}>
            <TouchableOpacity
              style={[
                dynamicStyles.summaryCard,
                mainTab === 'income' && localStyles.summaryCardActive,
                mainTab === 'income' && { borderColor: '#2D8B57' },
              ]}
              onPress={() => setMainTab('income')}
              activeOpacity={0.75}
            >
              <View style={dynamicStyles.summaryIconRow}>
                <TrendingUp size={12} color={colors.success} />
                <Text style={dynamicStyles.summaryLabel}>{t('finances_income')}</Text>
              </View>
              <Text style={[dynamicStyles.summaryAmount, dynamicStyles.incomeAmount]}>
                {formatCurrency(totalIncome)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                dynamicStyles.summaryCard,
                mainTab === 'expenses' && localStyles.summaryCardActive,
                mainTab === 'expenses' && { borderColor: '#dc2626' },
              ]}
              onPress={() => setMainTab('expenses')}
              activeOpacity={0.75}
            >
              <View style={dynamicStyles.summaryIconRow}>
                <TrendingDown size={12} color={colors.error} />
                <Text style={dynamicStyles.summaryLabel}>{t('finances_expenses')}</Text>
              </View>
              <Text style={[dynamicStyles.summaryAmount, dynamicStyles.expenseAmount]}>
                {formatCurrency(totalExpenses)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                dynamicStyles.summaryCard,
                mainTab === 'analytics' && localStyles.summaryCardActive,
                mainTab === 'analytics' && { borderColor: colors.primary },
              ]}
              onPress={() => setMainTab('analytics')}
              activeOpacity={0.75}
            >
              <View style={dynamicStyles.summaryIconRow}>
                <BarChart2 size={12} color={colors.primary} />
                <Text style={dynamicStyles.summaryLabel}>{t('finances_net')}</Text>
              </View>
              <Text style={[dynamicStyles.summaryAmount, netIncome >= 0 ? dynamicStyles.incomeAmount : dynamicStyles.expenseAmount]}>
                {formatCurrency(netIncome)}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={dynamicStyles.filterContainer}>
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />
        </View>

        {mainTab !== 'analytics' && (
          <>
            <View style={[localStyles.groupModeRow, { backgroundColor: colors.surface }]}>
              {(['weekly', 'monthly', 'yearly'] as GroupMode[]).map(mode => (
                <TouchableOpacity
                  key={mode}
                  style={[
                    localStyles.groupModeBtn,
                    groupMode === mode && { backgroundColor: accentColor },
                  ]}
                  onPress={() => setGroupMode(mode)}
                >
                  <Text style={[
                    localStyles.groupModeBtnText,
                    { color: groupMode === mode ? '#fff' : colors.textSecondary },
                  ]}>
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[dynamicStyles.buttonRow, { paddingHorizontal: 16, paddingVertical: 8, gap: 8 }]}>
              <TouchableOpacity
                style={[dynamicStyles.actionButton, dynamicStyles.incomeButton]}
                onPress={handleAddIncome}
                activeOpacity={0.8}
              >
                <LinearGradient colors={['#2D8B57', '#34a065']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={dynamicStyles.actionButtonGradient}>
                  <Animated.View style={{ transform: [{ rotate: incomeIconAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }}>
                    <Plus size={18} color="#fff" />
                  </Animated.View>
                  <Text style={dynamicStyles.actionButtonText}>{t('finances_add_income')}</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dynamicStyles.actionButton, dynamicStyles.expenseButton]}
                onPress={handleAddExpense}
                activeOpacity={0.8}
              >
                <LinearGradient colors={['#dc2626', '#b91c1c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={dynamicStyles.actionButtonGradient}>
                  <Animated.View style={{ transform: [{ rotate: expenseIconAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }}>
                    <Plus size={18} color="#fff" />
                  </Animated.View>
                  <Text style={dynamicStyles.actionButtonText}>{t('finances_add_expense')}</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dynamicStyles.actionButton, { flex: 0, paddingHorizontal: 0 }]}
                onPress={() => {
                  setQuickEntryMode(mainTab === 'income' ? 'income' : 'expense');
                  setQuickEntryVisible(true);
                }}
                activeOpacity={0.8}
              >
                <LinearGradient colors={['#374151', '#1f2937']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[dynamicStyles.actionButtonGradient, { paddingHorizontal: 14 }]}>
                  <TrendingDown size={16} color="#fff" />
                  <Text style={dynamicStyles.actionButtonText}>Quick</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {currentSections.length === 0 ? (
              <View style={dynamicStyles.emptyContainer}>
                <Text style={dynamicStyles.emptyText}>{t('finances_no_transactions')}</Text>
                <Text style={dynamicStyles.emptySubtext}>{t('finances_no_transactions_sub')}</Text>
              </View>
            ) : (
              <SectionList
                sections={currentSections}
                keyExtractor={(item) => `${item.type}-${item.id}`}
                renderItem={renderSectionItem}
                renderSectionHeader={renderSectionHeader}
                contentContainerStyle={[dynamicStyles.list, { paddingBottom: 100 }]}
                stickySectionHeadersEnabled={false}
              />
            )}
          </>
        )}

        {mainTab === 'analytics' && (
          <>
            <View style={[dynamicStyles.buttonRow, { paddingHorizontal: 16, paddingVertical: 8 }]}>
              <TouchableOpacity style={[dynamicStyles.actionButton, dynamicStyles.incomeButton]} onPress={handleAddIncome} activeOpacity={0.8}>
                <LinearGradient colors={['#2D8B57', '#34a065']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={dynamicStyles.actionButtonGradient}>
                  <Plus size={18} color="#fff" />
                  <Text style={dynamicStyles.actionButtonText}>{t('finances_add_income')}</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={[dynamicStyles.actionButton, dynamicStyles.expenseButton]} onPress={handleAddExpense} activeOpacity={0.8}>
                <LinearGradient colors={['#dc2626', '#b91c1c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={dynamicStyles.actionButtonGradient}>
                  <Plus size={18} color="#fff" />
                  <Text style={dynamicStyles.actionButtonText}>{t('finances_add_expense')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingTop: 8, paddingBottom: 100, alignItems: 'center' }}
            >
              <View style={{ width: '100%', maxWidth: 860, alignSelf: 'center' }}>
                <FinanceAnalyticsPanel
                  items={filteredItems}
                  totalIncome={totalIncome}
                  totalExpenses={totalExpenses}
                  netIncome={netIncome}
                  colors={colors}
                  onExpenseCategoryPress={(cat) => {
                    setDrillDownCategory(cat);
                    setDrillDownType('expense');
                  }}
                  onIncomeCategoryPress={(cat) => {
                    setDrillDownCategory(cat);
                    setDrillDownType('income');
                  }}
                />
              </View>
            </ScrollView>
          </>
        )}

        <FinanceModal
          visible={modalVisible}
          type={modalType}
          item={selectedItem}
          onClose={handleModalClose}
          onSave={handleModalSave}
        />

        <QuickEntryBottomSheet
          visible={quickEntryVisible}
          initialMode={quickEntryMode}
          onClose={() => setQuickEntryVisible(false)}
          onSaved={fetchFinances}
        />

        <FinanceCategoriesModal
          visible={categoriesModalVisible}
          initialTab={mainTab === 'income' ? 'income' : 'expense'}
          onClose={() => setCategoriesModalVisible(false)}
          onChanged={fetchFinances}
        />

        <MileageTrackerModal
          visible={mileageModalVisible}
          onClose={() => setMileageModalVisible(false)}
        />

        <CategoryDrillDownModal
          visible={drillDownCategory !== null}
          category={drillDownCategory}
          items={filteredItems}
          type={drillDownType}
          colors={colors}
          onClose={() => setDrillDownCategory(null)}
        />
        <WorkflowFab
          actions={[]}
          isOpen={fabOpen}
          onToggle={() => setFabOpen(!fabOpen)}
          onClose={() => setFabOpen(false)}
          onQuickAction={handleQuickAction}
          dominantHand={dominantHand}
        />
      </View>
    </AnimatedTabContent>
  );
}

const localStyles = StyleSheet.create({
  summaryCardActive: {
    borderWidth: 1.5,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 56,
    paddingRight: 12,
  },
  menuDropdown: {
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 180,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
  },
  groupModeRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 8,
    padding: 3,
    gap: 3,
  },
  groupModeBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  groupModeBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
    marginHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  sectionHeaderLeft: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionCount: {
    fontSize: 11,
    marginTop: 1,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTotal: {
    fontSize: 15,
    fontWeight: '700',
  },
  chevron: {
    fontSize: 10,
  },
});
