import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { TrendingUp, TrendingDown, Calendar, Briefcase, Repeat, Trash2, Copy } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { FinanceItem, IncomeItem, ExpenseItem, formatCurrency, formatFinanceDate } from '@/lib/financeService';

interface FinanceTransactionItemProps {
  item: FinanceItem;
  onEdit: (item: FinanceItem) => void;
  onDelete: (item: FinanceItem) => void;
  onRepeat?: (item: FinanceItem) => void;
  dynamicStyles: any;
  canDelete?: boolean;
}

export default function FinanceTransactionItem({ item, onEdit, onDelete, onRepeat, dynamicStyles, canDelete = true }: FinanceTransactionItemProps) {
  const { colors } = useTheme();
  const isIncome = item.type === 'income';
  const incomeItem = item as IncomeItem;
  const expenseItem = item as ExpenseItem;
  const isJobPayment = isIncome && incomeItem.schedule_event_id;
  const isRecurringExpense = !isIncome && expenseItem.is_recurring;

  return (
    <TouchableOpacity
      style={dynamicStyles.financeCard}
      onPress={() => onEdit(item)}
      activeOpacity={0.7}
    >
      <View style={dynamicStyles.financeHeader}>
        <View style={dynamicStyles.iconContainer}>
          {isIncome ? (
            <TrendingUp size={20} color={colors.success} />
          ) : (
            <TrendingDown size={20} color={colors.error} />
          )}
        </View>
        <View style={dynamicStyles.financeInfo}>
          <View style={dynamicStyles.descriptionRow}>
            <Text style={dynamicStyles.financeDescription}>{item.description}</Text>
            {isJobPayment && (
              <View style={dynamicStyles.jobBadge}>
                <Briefcase size={10} color="#fff" />
              </View>
            )}
            {isRecurringExpense && (
              <View style={dynamicStyles.recurringBadge}>
                <Repeat size={10} color="#fff" />
              </View>
            )}
          </View>
          <View style={dynamicStyles.financeMeta}>
            <Calendar size={12} color={colors.textSecondary} />
            <Text style={dynamicStyles.financeDate}>{formatFinanceDate(item.date)}</Text>
            <View style={dynamicStyles.categoryBadge}>
              <Text style={dynamicStyles.categoryText}>{item.category}</Text>
            </View>
          </View>
        </View>
        <View style={dynamicStyles.amountAndActions}>
          <Text
            style={[
              dynamicStyles.financeAmount,
              isIncome ? dynamicStyles.incomeAmount : dynamicStyles.expenseAmount,
            ]}
          >
            {isIncome ? '+' : '-'}
            {formatCurrency(item.amount)}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, alignItems: 'center' }}>
            {onRepeat && (
              <TouchableOpacity
                style={[dynamicStyles.deleteButton, { backgroundColor: colors.primaryLight || 'rgba(27,77,110,0.08)' }]}
                onPress={(e) => {
                  e.stopPropagation();
                  onRepeat(item);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <Copy size={15} color={colors.primary} />
              </TouchableOpacity>
            )}
            {canDelete && (
              <TouchableOpacity
                style={dynamicStyles.deleteButton}
                onPress={(e) => {
                  e.stopPropagation();
                  onDelete(item);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <Trash2 size={15} color={colors.error} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
