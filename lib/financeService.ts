import { supabase } from './supabase';

export interface IncomeItem {
  id: string;
  amount: number;
  description: string;
  date: string;
  category: string;
  type: 'income';
  schedule_event_id?: string;
}

export interface ExpenseItem {
  id: string;
  amount: number;
  description: string;
  date: string;
  category: string;
  type: 'expense';
  is_recurring?: boolean;
  recurrence_type?: string;
  recurrence_interval?: number;
  recurrence_end_date?: string;
  parent_expense_id?: string;
}

export type FinanceItem = IncomeItem | ExpenseItem;

export interface CategoryBreakdown {
  [category: string]: number;
}

export interface PeriodReport {
  period: string;
  income: number;
  expenses: number;
  net: number;
  displayDate: string;
  incomeByCategory: CategoryBreakdown;
  expensesByCategory: CategoryBreakdown;
}

export async function fetchFinanceData(organizationId: string): Promise<FinanceItem[]> {
  const [incomeResult, expenseResult] = await Promise.all([
    supabase
      .from('income')
      .select('*')
      .eq('organization_id', organizationId)
      .order('date', { ascending: false }),
    supabase
      .from('expenses')
      .select('*')
      .eq('organization_id', organizationId)
      .order('date', { ascending: false }),
  ]);

  if (incomeResult.error) throw incomeResult.error;
  if (expenseResult.error) throw expenseResult.error;

  const incomeItems: IncomeItem[] = (incomeResult.data || []).map((item) => ({
    ...item,
    type: 'income' as const,
  }));

  const expenseItems: ExpenseItem[] = (expenseResult.data || []).map((item) => ({
    ...item,
    type: 'expense' as const,
  }));

  return [...incomeItems, ...expenseItems].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export async function processRecurringExpenses(userId: string, organizationId: string): Promise<void> {
  const { data: recurringExpenses, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .eq('is_recurring', true)
    .is('parent_expense_id', null);

  if (error) throw error;
  if (!recurringExpenses || recurringExpenses.length === 0) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const expense of recurringExpenses) {
    const lastGenerated = expense.last_generated_date ? new Date(expense.last_generated_date) : new Date(expense.date);
    lastGenerated.setHours(0, 0, 0, 0);

    if (expense.recurrence_end_date) {
      const endDate = new Date(expense.recurrence_end_date);
      endDate.setHours(0, 0, 0, 0);
      if (today > endDate) continue;
    }

    let nextDate = new Date(lastGenerated);
    const interval = expense.recurrence_interval || 1;

    advanceDate(nextDate, expense.recurrence_type, interval);

    while (nextDate <= today) {
      if (expense.recurrence_end_date) {
        const endDate = new Date(expense.recurrence_end_date);
        endDate.setHours(0, 0, 0, 0);
        if (nextDate > endDate) break;
      }

      const dateStr = nextDate.toISOString().split('T')[0];

      const { data: existing } = await supabase
        .from('expenses')
        .select('id')
        .eq('parent_expense_id', expense.id)
        .eq('date', dateStr)
        .maybeSingle();

      if (!existing) {
        await supabase.from('expenses').insert({
          user_id: userId,
          amount: expense.amount,
          description: expense.description,
          date: dateStr,
          category: expense.category,
          parent_expense_id: expense.id,
          is_recurring: false,
        });
      }

      await supabase
        .from('expenses')
        .update({ last_generated_date: dateStr })
        .eq('id', expense.id)
        .eq('user_id', userId);

      advanceDate(nextDate, expense.recurrence_type, interval);
    }
  }
}

function advanceDate(date: Date, recurrenceType: string, interval: number): void {
  switch (recurrenceType) {
    case 'weekly':
      date.setDate(date.getDate() + 7 * interval);
      break;
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + interval);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + interval);
      break;
  }
}

export function generateMonthlyReports(items: FinanceItem[]): PeriodReport[] {
  const monthlyData: Record<string, { income: number; expenses: number; incomeByCategory: CategoryBreakdown; expensesByCategory: CategoryBreakdown }> = {};

  items.forEach((item) => {
    const date = new Date(item.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { income: 0, expenses: 0, incomeByCategory: {}, expensesByCategory: {} };
    }

    if (item.type === 'income') {
      monthlyData[monthKey].income += Number(item.amount);
      monthlyData[monthKey].incomeByCategory[item.category] =
        (monthlyData[monthKey].incomeByCategory[item.category] || 0) + Number(item.amount);
    } else {
      monthlyData[monthKey].expenses += Number(item.amount);
      monthlyData[monthKey].expensesByCategory[item.category] =
        (monthlyData[monthKey].expensesByCategory[item.category] || 0) + Number(item.amount);
    }
  });

  return Object.entries(monthlyData)
    .map(([period, data]) => {
      const [year, month] = period.split('-');
      const date = new Date(Number(year), Number(month) - 1);
      return {
        period,
        income: data.income,
        expenses: data.expenses,
        net: data.income - data.expenses,
        displayDate: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        incomeByCategory: data.incomeByCategory,
        expensesByCategory: data.expensesByCategory,
      };
    })
    .sort((a, b) => b.period.localeCompare(a.period));
}

export function generateYearlyReports(items: FinanceItem[]): PeriodReport[] {
  const yearlyData: Record<string, { income: number; expenses: number; incomeByCategory: CategoryBreakdown; expensesByCategory: CategoryBreakdown }> = {};

  items.forEach((item) => {
    const date = new Date(item.date);
    const yearKey = String(date.getFullYear());

    if (!yearlyData[yearKey]) {
      yearlyData[yearKey] = { income: 0, expenses: 0, incomeByCategory: {}, expensesByCategory: {} };
    }

    if (item.type === 'income') {
      yearlyData[yearKey].income += Number(item.amount);
      yearlyData[yearKey].incomeByCategory[item.category] =
        (yearlyData[yearKey].incomeByCategory[item.category] || 0) + Number(item.amount);
    } else {
      yearlyData[yearKey].expenses += Number(item.amount);
      yearlyData[yearKey].expensesByCategory[item.category] =
        (yearlyData[yearKey].expensesByCategory[item.category] || 0) + Number(item.amount);
    }
  });

  return Object.entries(yearlyData)
    .map(([period, data]) => ({
      period,
      income: data.income,
      expenses: data.expenses,
      net: data.income - data.expenses,
      displayDate: period,
      incomeByCategory: data.incomeByCategory,
      expensesByCategory: data.expensesByCategory,
    }))
    .sort((a, b) => b.period.localeCompare(a.period));
}

export function generateWeeklyReports(items: FinanceItem[]): PeriodReport[] {
  const weeklyData: Record<string, { income: number; expenses: number; incomeByCategory: CategoryBreakdown; expensesByCategory: CategoryBreakdown; weekStart: Date }> = {};

  items.forEach((item) => {
    const date = new Date(item.date + 'T12:00:00');
    const day = date.getDay();
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - day);
    weekStart.setHours(0, 0, 0, 0);
    const weekKey = weekStart.toISOString().split('T')[0];

    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = { income: 0, expenses: 0, incomeByCategory: {}, expensesByCategory: {}, weekStart };
    }

    if (item.type === 'income') {
      weeklyData[weekKey].income += Number(item.amount);
      weeklyData[weekKey].incomeByCategory[item.category] =
        (weeklyData[weekKey].incomeByCategory[item.category] || 0) + Number(item.amount);
    } else {
      weeklyData[weekKey].expenses += Number(item.amount);
      weeklyData[weekKey].expensesByCategory[item.category] =
        (weeklyData[weekKey].expensesByCategory[item.category] || 0) + Number(item.amount);
    }
  });

  return Object.entries(weeklyData)
    .map(([period, data]) => {
      const weekEnd = new Date(data.weekStart);
      weekEnd.setDate(data.weekStart.getDate() + 6);
      const startLabel = data.weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endLabel = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return {
        period,
        income: data.income,
        expenses: data.expenses,
        net: data.income - data.expenses,
        displayDate: `${startLabel} – ${endLabel}`,
        incomeByCategory: data.incomeByCategory,
        expensesByCategory: data.expensesByCategory,
      };
    })
    .sort((a, b) => b.period.localeCompare(a.period));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatFinanceDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
