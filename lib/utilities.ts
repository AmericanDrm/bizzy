import { Linking, Platform } from 'react-native';

// Country-specific phone formatting rules keyed by ISO 3166-1 alpha-2 code.
// Each entry defines: country dial code, local digit length, and a formatter fn.
const PHONE_FORMATS: Record<string, { code: string; localDigits: number; format: (d: string) => string }> = {
  US: { code: '1',  localDigits: 10, format: (d) => `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6,10)}` },
  CA: { code: '1',  localDigits: 10, format: (d) => `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6,10)}` },
  GB: { code: '44', localDigits: 10, format: (d) => `${d.slice(0,4)} ${d.slice(4,7)} ${d.slice(7,10)}` },
  AU: { code: '61', localDigits: 9,  format: (d) => `${d.slice(0,4)} ${d.slice(4,7)} ${d.slice(7,9)}` },
  NZ: { code: '64', localDigits: 9,  format: (d) => `${d.slice(0,2)} ${d.slice(2,5)} ${d.slice(5,9)}` },
  DE: { code: '49', localDigits: 11, format: (d) => `${d.slice(0,4)} ${d.slice(4,7)} ${d.slice(7,11)}` },
  FR: { code: '33', localDigits: 9,  format: (d) => `${d.slice(0,1)} ${d.slice(1,3)} ${d.slice(3,5)} ${d.slice(5,7)} ${d.slice(7,9)}` },
  MX: { code: '52', localDigits: 10, format: (d) => `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6,10)}` },
  JP: { code: '81', localDigits: 10, format: (d) => `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7,10)}` },
  IN: { code: '91', localDigits: 10, format: (d) => `${d.slice(0,5)} ${d.slice(5,10)}` },
  BR: { code: '55', localDigits: 11, format: (d) => `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7,11)}` },
};

// Progressive (as-you-type) US/CA formatting used while the field is focused.
const formatUsProgressively = (digits: string): string => {
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6,10)}`;
};

export const formatPhoneNumber = (phone: string, countryCode = 'US'): string => {
  if (!phone) return '';

  const allDigits = phone.replace(/\D/g, '');
  if (allDigits.length === 0) return '';

  const fmt = PHONE_FORMATS[countryCode.toUpperCase()] || PHONE_FORMATS['US'];

  // Detect and strip a leading country dial code (e.g. '1' for US, '44' for GB)
  let localDigits = allDigits;
  const dialCode = fmt.code;
  if (allDigits.startsWith(dialCode) && allDigits.length > fmt.localDigits) {
    localDigits = allDigits.slice(dialCode.length);
  }

  // Trim to max local digits
  localDigits = localDigits.slice(0, fmt.localDigits);

  if (localDigits.length < fmt.localDigits) {
    // Not enough digits yet — use progressive US/CA style for those countries
    if (countryCode === 'US' || countryCode === 'CA') {
      return formatUsProgressively(localDigits);
    }
    return localDigits;
  }

  return fmt.format(localDigits);
};

export const unformatPhoneNumber = (phone: string): string => {
  return phone.replace(/\D/g, '');
};

export const normalizePhoneForComparison = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone: string, countryCode = 'US'): boolean => {
  const cleaned = unformatPhoneNumber(phone);
  const fmt = PHONE_FORMATS[countryCode.toUpperCase()] || PHONE_FORMATS['US'];
  // Accept the exact local digit count, or with country code prepended
  return cleaned.length === fmt.localDigits || cleaned.length === fmt.localDigits + fmt.code.length;
};

export const makePhoneCall = async (phoneNumber: string): Promise<void> => {
  const cleaned = unformatPhoneNumber(phoneNumber);
  const url = `tel:${cleaned}`;

  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  }
};

export const sendSMS = async (phoneNumber: string, message?: string): Promise<void> => {
  const cleaned = unformatPhoneNumber(phoneNumber);
  const url = Platform.OS === 'ios'
    ? `sms:${cleaned}${message ? `&body=${encodeURIComponent(message)}` : ''}`
    : `sms:${cleaned}${message ? `?body=${encodeURIComponent(message)}` : ''}`;

  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  }
};

export const sendEmail = async (email: string, subject?: string, body?: string): Promise<void> => {
  let url = `mailto:${email}`;
  const params: string[] = [];

  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);

  if (params.length > 0) {
    url += `?${params.join('&')}`;
  }

  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  }
};

export const formatCurrency = (amount: number | string): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '$0.00';
  return `$${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

export const calculateLateFee = (
  subtotal: number,
  dueDate: Date,
  lateFeePercentage: number = 0,
  gracePeriodDays: number = 0
): number => {
  const today = new Date();
  const due = new Date(dueDate);

  const daysPastDue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));

  if (daysPastDue <= gracePeriodDays) {
    return 0;
  }

  return (subtotal * lateFeePercentage) / 100;
};

export const getInvoiceStatusColor = (status: string): { bg: string; text: string; border: string } => {
  switch (status.toLowerCase()) {
    case 'paid':
      return { bg: '#d4edda', text: '#155724', border: '#c3e6cb' };
    case 'sent':
      return { bg: '#fff3cd', text: '#856404', border: '#ffeaa7' };
    case 'overdue':
      return { bg: '#f8d7da', text: '#721c24', border: '#f5c6cb' };
    case 'cancelled':
      return { bg: '#d6d8db', text: '#383d41', border: '#c6c8ca' };
    default: // draft
      return { bg: '#e7f3ff', text: '#004085', border: '#b8daff' };
  }
};

export const parseCSV = (csvContent: string): Record<string, string>[] => {
  const lines = csvContent.trim().split('\n');
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const data: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    if (values.length === headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      data.push(row);
    }
  }

  return data;
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export interface PriceRoundingSettings {
  price_rounding_enabled: boolean;
  price_rounding_target: string;
  price_rounding_custom_amount: number | null;
}

export const roundPrice = (
  amount: number,
  settings: PriceRoundingSettings | null
): number => {
  if (!settings?.price_rounding_enabled) return amount;

  let increment: number;
  if (settings.price_rounding_target === 'custom') {
    increment = settings.price_rounding_custom_amount ?? 1;
  } else {
    increment = Number(settings.price_rounding_target) || 1;
  }

  if (increment <= 0) return amount;

  return Math.round(amount / increment) * increment;
};
