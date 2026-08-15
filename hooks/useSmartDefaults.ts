import { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@bizzy_smart_defaults_';

export interface SmartDefaults {
  lastExpenseCategory?: string;
  lastExpenseAmount?: string;
  lastIncomeCategory?: string;
  lastJobTypeId?: string;
  lastClientId?: string;
  lastNoteTab?: string;
  lastFinanceTab?: 'income' | 'expense';
}

type DefaultKey = keyof SmartDefaults;

export function useSmartDefaults() {
  const save = useCallback(async (key: DefaultKey, value: string) => {
    try {
      await AsyncStorage.setItem(PREFIX + key, value);
    } catch {}
  }, []);

  const load = useCallback(async (key: DefaultKey): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(PREFIX + key);
    } catch {
      return null;
    }
  }, []);

  const loadMany = useCallback(async <K extends DefaultKey>(keys: K[]): Promise<Partial<SmartDefaults>> => {
    try {
      const pairs = await AsyncStorage.multiGet(keys.map(k => PREFIX + k));
      const result: Partial<SmartDefaults> = {};
      pairs.forEach(([storageKey, value]) => {
        if (value !== null) {
          const key = storageKey.replace(PREFIX, '') as DefaultKey;
          (result as any)[key] = value;
        }
      });
      return result;
    } catch {
      return {};
    }
  }, []);

  return { save, load, loadMany };
}
