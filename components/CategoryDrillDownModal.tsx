import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { X, TrendingDown, TrendingUp } from 'lucide-react-native';
import { FinanceItem, formatCurrency, formatFinanceDate } from '@/lib/financeService';

interface CategoryDrillDownModalProps {
  visible: boolean;
  category: string | null;
  items: FinanceItem[];
  type: 'expense' | 'income' | 'both';
  colors: any;
  onClose: () => void;
}

export default function CategoryDrillDownModal({
  visible,
  category,
  items,
  type,
  colors,
  onClose,
}: CategoryDrillDownModalProps) {
  if (!category) return null;

  const filtered = items.filter((item) => {
    if (item.category !== category) return false;
    if (type === 'both') return true;
    return item.type === type;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const total = filtered.reduce((sum, item) => sum + Number(item.amount), 0);

  const byMonth: { [key: string]: FinanceItem[] } = {};
  filtered.forEach((item) => {
    const key = item.date.slice(0, 7);
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(item);
  });

  const monthKeys = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.categoryIcon, { backgroundColor: type === 'income' ? colors.success + '20' : colors.error + '18' }]}>
                {type === 'income' ? (
                  <TrendingUp size={16} color={colors.success} />
                ) : (
                  <TrendingDown size={16} color={colors.error} />
                )}
              </View>
              <View>
                <Text style={[styles.categoryName, { color: colors.text }]}>{category}</Text>
                <Text style={[styles.totalText, { color: type === 'income' ? colors.success : colors.error }]}>
                  {formatCurrency(total)} · {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {monthKeys.map((monthKey) => {
              const monthItems = byMonth[monthKey];
              const monthTotal = monthItems.reduce((s, i) => s + Number(i.amount), 0);
              const [year, month] = monthKey.split('-');
              const monthLabel = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
              return (
                <View key={monthKey} style={styles.monthGroup}>
                  <View style={[styles.monthHeader, { backgroundColor: colors.inputBackground }]}>
                    <Text style={[styles.monthLabel, { color: colors.text }]}>{monthLabel}</Text>
                    <Text style={[styles.monthTotal, { color: type === 'income' ? colors.success : colors.error }]}>
                      {formatCurrency(monthTotal)}
                    </Text>
                  </View>
                  {monthItems.map((item) => (
                    <View key={`${item.type}-${item.id}`} style={[styles.row, { borderBottomColor: colors.border }]}>
                      <View style={styles.rowLeft}>
                        <Text style={[styles.rowDate, { color: colors.textSecondary }]}>
                          {formatFinanceDate(item.date)}
                        </Text>
                        <Text style={[styles.rowDesc, { color: colors.text }]} numberOfLines={2}>
                          {item.description}
                        </Text>
                      </View>
                      <Text style={[styles.rowAmount, { color: type === 'income' ? colors.success : colors.error }]}>
                        {type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })}

            {filtered.length === 0 && (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No transactions in this category</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    ...Platform.select({
      web: { boxShadow: '0 -4px 20px rgba(0,0,0,0.15)' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12 },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontSize: 17,
    fontWeight: '700',
  },
  totalText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  scroll: {
    flex: 1,
  },
  monthGroup: {
    marginBottom: 4,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  monthLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  monthTotal: {
    fontSize: 13,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    justifyContent: 'space-between',
  },
  rowLeft: {
    flex: 1,
    marginRight: 12,
  },
  rowDate: {
    fontSize: 11,
    marginBottom: 2,
  },
  rowDesc: {
    fontSize: 14,
    fontWeight: '500',
  },
  rowAmount: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 0,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
  },
});
