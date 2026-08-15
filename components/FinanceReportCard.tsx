import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { PeriodReport, formatCurrency } from '@/lib/financeService';

interface FinanceReportCardProps {
  item: PeriodReport;
  isExpanded: boolean;
  onToggle: (period: string) => void;
  dynamicStyles: any;
}

export default function FinanceReportCard({ item, isExpanded, onToggle, dynamicStyles }: FinanceReportCardProps) {
  const { colors } = useTheme();
  const hasCategories =
    Object.keys(item.incomeByCategory).length > 0 ||
    Object.keys(item.expensesByCategory).length > 0;

  return (
    <View style={dynamicStyles.reportCard}>
      <TouchableOpacity
        style={dynamicStyles.reportHeader}
        onPress={() => onToggle(item.period)}
        disabled={!hasCategories}
      >
        <Text style={dynamicStyles.reportPeriod}>{item.displayDate}</Text>
        {hasCategories &&
          (isExpanded ? (
            <ChevronUp size={20} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={20} color={colors.textSecondary} />
          ))}
      </TouchableOpacity>

      <View style={dynamicStyles.reportRow}>
        <View style={dynamicStyles.reportItem}>
          <Text style={dynamicStyles.reportLabel}>Income</Text>
          <Text style={[dynamicStyles.reportAmount, dynamicStyles.incomeAmount]}>
            {formatCurrency(item.income)}
          </Text>
        </View>
        <View style={dynamicStyles.reportItem}>
          <Text style={dynamicStyles.reportLabel}>Expenses</Text>
          <Text style={[dynamicStyles.reportAmount, dynamicStyles.expenseAmount]}>
            {formatCurrency(item.expenses)}
          </Text>
        </View>
        <View style={dynamicStyles.reportItem}>
          <Text style={dynamicStyles.reportLabel}>Net</Text>
          <Text
            style={[
              dynamicStyles.reportAmount,
              item.net >= 0 ? dynamicStyles.incomeAmount : dynamicStyles.expenseAmount,
            ]}
          >
            {formatCurrency(item.net)}
          </Text>
        </View>
      </View>

      {isExpanded && (
        <View style={dynamicStyles.categoryBreakdown}>
          {Object.keys(item.expensesByCategory).length > 0 && (
            <View style={dynamicStyles.categorySection}>
              <Text style={dynamicStyles.categorySectionTitle}>Expense Breakdown</Text>
              {Object.entries(item.expensesByCategory)
                .sort(([, a], [, b]) => b - a)
                .map(([category, amount]) => (
                  <View key={`expense-${category}`} style={dynamicStyles.categoryRow}>
                    <Text style={dynamicStyles.categoryName}>{category}</Text>
                    <Text style={[dynamicStyles.categoryAmount, dynamicStyles.expenseAmount]}>
                      {formatCurrency(amount)}
                    </Text>
                  </View>
                ))}
            </View>
          )}

          {Object.keys(item.incomeByCategory).length > 0 && (
            <View style={dynamicStyles.categorySection}>
              <Text style={dynamicStyles.categorySectionTitle}>Income Breakdown</Text>
              {Object.entries(item.incomeByCategory)
                .sort(([, a], [, b]) => b - a)
                .map(([category, amount]) => (
                  <View key={`income-${category}`} style={dynamicStyles.categoryRow}>
                    <Text style={dynamicStyles.categoryName}>{category}</Text>
                    <Text style={[dynamicStyles.categoryAmount, dynamicStyles.incomeAmount]}>
                      {formatCurrency(amount)}
                    </Text>
                  </View>
                ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
