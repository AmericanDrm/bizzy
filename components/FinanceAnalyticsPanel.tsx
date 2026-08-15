import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { TrendingUp, TrendingDown, ArrowRight, BarChart3 } from 'lucide-react-native';
import { FinanceItem, formatCurrency, generateMonthlyReports } from '@/lib/financeService';
import ExpensePieChart from './ExpensePieChart';

interface FinanceAnalyticsPanelProps {
  items: FinanceItem[];
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  colors: any;
  onExpenseCategoryPress: (category: string) => void;
  onIncomeCategoryPress: (category: string) => void;
}

export default function FinanceAnalyticsPanel({
  items,
  totalIncome,
  totalExpenses,
  netIncome,
  colors,
  onExpenseCategoryPress,
  onIncomeCategoryPress,
}: FinanceAnalyticsPanelProps) {
  const expenseItems = items.filter((i) => i.type === 'expense');
  const incomeItems = items.filter((i) => i.type === 'income');

  const expensesByCategory = useMemo(() => {
    const map: { [k: string]: number } = {};
    expenseItems.forEach((i) => {
      map[i.category] = (map[i.category] || 0) + Number(i.amount);
    });
    return map;
  }, [expenseItems]);

  const incomeByCategory = useMemo(() => {
    const map: { [k: string]: number } = {};
    incomeItems.forEach((i) => {
      map[i.category] = (map[i.category] || 0) + Number(i.amount);
    });
    return map;
  }, [incomeItems]);

  const monthlyReports = useMemo(() => generateMonthlyReports(items).slice(0, 6).reverse(), [items]);

  const topExpenseCategories = Object.entries(expensesByCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const topIncomeCategories = Object.entries(incomeByCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const maxMonthlyIncome = Math.max(...monthlyReports.map(r => r.income), 1);
  const maxMonthlyExpense = Math.max(...monthlyReports.map(r => r.expenses), 1);
  const barMax = Math.max(maxMonthlyIncome, maxMonthlyExpense);

  const profitMargin = totalIncome > 0 ? ((netIncome / totalIncome) * 100).toFixed(1) : '0.0';

  return (
    <View style={styles.container}>
      <View style={[styles.kpiRow]}>
        <View style={[styles.kpiCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Profit Margin</Text>
          <Text style={[styles.kpiValue, { color: Number(profitMargin) >= 0 ? colors.success : colors.error }]}>
            {profitMargin}%
          </Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Expense Ratio</Text>
          <Text style={[styles.kpiValue, { color: colors.primary }]}>
            {totalIncome > 0 ? ((totalExpenses / totalIncome) * 100).toFixed(1) : '0.0'}%
          </Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Transactions</Text>
          <Text style={[styles.kpiValue, { color: colors.text }]}>{items.length}</Text>
        </View>
      </View>

      {monthlyReports.length >= 2 && (
        <View style={[styles.section, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <BarChart3 size={15} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Monthly Trend</Text>
          </View>
          <View style={styles.barChart}>
            {monthlyReports.map((report) => {
              const incomeH = barMax > 0 ? (report.income / barMax) * 80 : 0;
              const expenseH = barMax > 0 ? (report.expenses / barMax) * 80 : 0;
              const label = report.displayDate.split(' ')[0].slice(0, 3);
              return (
                <View key={report.period} style={styles.barGroup}>
                  <View style={styles.barPair}>
                    <View style={[styles.bar, { height: Math.max(incomeH, 2), backgroundColor: colors.success }]} />
                    <View style={[styles.bar, { height: Math.max(expenseH, 2), backgroundColor: colors.error + 'cc' }]} />
                  </View>
                  <Text style={[styles.barLabel, { color: colors.textSecondary }]}>{label}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.barLegend}>
            <View style={styles.barLegendItem}>
              <View style={[styles.barLegendDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.barLegendText, { color: colors.textSecondary }]}>Income</Text>
            </View>
            <View style={styles.barLegendItem}>
              <View style={[styles.barLegendDot, { backgroundColor: colors.error }]} />
              <Text style={[styles.barLegendText, { color: colors.textSecondary }]}>Expenses</Text>
            </View>
          </View>
        </View>
      )}

      <View style={[styles.section, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <TrendingDown size={15} color={colors.error} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Expenses by Category</Text>
        </View>
        <ExpensePieChart
          expensesByCategory={expensesByCategory}
          totalExpenses={totalExpenses}
          colors={colors}
          onCategoryPress={onExpenseCategoryPress}
        />
      </View>

      {topExpenseCategories.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <TrendingDown size={15} color={colors.error} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Top Expense Categories</Text>
          </View>
          {topExpenseCategories.map(([cat, amount], idx) => {
            const pct = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
            return (
              <TouchableOpacity
                key={cat}
                style={styles.categoryRow}
                onPress={() => onExpenseCategoryPress(cat)}
                activeOpacity={0.7}
              >
                <View style={styles.categoryLeft}>
                  <View style={[styles.rankBadge, { backgroundColor: colors.inputBackground }]}>
                    <Text style={[styles.rankText, { color: colors.textSecondary }]}>{idx + 1}</Text>
                  </View>
                  <View style={styles.categoryInfo}>
                    <Text style={[styles.categoryName, { color: colors.text }]}>{cat}</Text>
                    <View style={[styles.progressBar, { backgroundColor: colors.inputBackground }]}>
                      <View
                        style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: colors.error }]}
                      />
                    </View>
                  </View>
                </View>
                <View style={styles.categoryRight}>
                  <Text style={[styles.categoryAmount, { color: colors.error }]}>{formatCurrency(amount)}</Text>
                  <Text style={[styles.categoryPct, { color: colors.textSecondary }]}>{pct.toFixed(1)}%</Text>
                </View>
                <ArrowRight size={14} color={colors.textSecondary} style={styles.arrow} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {topIncomeCategories.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <TrendingUp size={15} color={colors.success} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Top Income Categories</Text>
          </View>
          {topIncomeCategories.map(([cat, amount], idx) => {
            const pct = totalIncome > 0 ? (amount / totalIncome) * 100 : 0;
            return (
              <TouchableOpacity
                key={cat}
                style={styles.categoryRow}
                onPress={() => onIncomeCategoryPress(cat)}
                activeOpacity={0.7}
              >
                <View style={styles.categoryLeft}>
                  <View style={[styles.rankBadge, { backgroundColor: colors.inputBackground }]}>
                    <Text style={[styles.rankText, { color: colors.textSecondary }]}>{idx + 1}</Text>
                  </View>
                  <View style={styles.categoryInfo}>
                    <Text style={[styles.categoryName, { color: colors.text }]}>{cat}</Text>
                    <View style={[styles.progressBar, { backgroundColor: colors.inputBackground }]}>
                      <View
                        style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: colors.success }]}
                      />
                    </View>
                  </View>
                </View>
                <View style={styles.categoryRight}>
                  <Text style={[styles.categoryAmount, { color: colors.success }]}>{formatCurrency(amount)}</Text>
                  <Text style={[styles.categoryPct, { color: colors.textSecondary }]}>{pct.toFixed(1)}%</Text>
                </View>
                <ArrowRight size={14} color={colors.textSecondary} style={styles.arrow} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    alignItems: 'center',
    ...Platform.select({
      web: { boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
    }),
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  section: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    ...Platform.select({
      web: { boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 100,
    paddingBottom: 8,
  },
  barGroup: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  barPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  bar: {
    width: 10,
    borderRadius: 4,
    minHeight: 2,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  barLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 4,
  },
  barLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  barLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  barLegendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  categoryLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rankText: {
    fontSize: 11,
    fontWeight: '700',
  },
  categoryInfo: {
    flex: 1,
    gap: 4,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  categoryRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  categoryAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
  categoryPct: {
    fontSize: 11,
  },
  arrow: {
    flexShrink: 0,
  },
});
