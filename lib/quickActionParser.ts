export type ActionType =
  | 'invoice_client'
  | 'schedule_client'
  | 'add_client'
  | 'direct_create_client'
  | 'add_expense'
  | 'add_income'
  | 'navigate'
  | 'search_client'
  | 'complete_job'
  | 'reschedule_job'
  | 'create_estimate'
  | 'send_invoice'
  | 'send_estimate'
  | 'direct_create_note'
  | 'direct_create_shopping_list';

export interface ParsedAction {
  type: ActionType;
  label: string;
  description: string;
  clientName?: string;
  clientAddress?: string;
  clientLanguage?: string;
  phone?: string;
  amount?: number;
  day?: string;
  targetDate?: string;
  navigateTo?: string;
  jobTitle?: string;
  serviceScope?: 'interior' | 'exterior' | 'both';
  jobTypeName?: string;
  startHour?: number;
  startMinute?: number;
  noteTitle?: string;
  noteContent?: string;
  shoppingItems?: string[];
  raw: string;
}

interface Client {
  id: string;
  name: string;
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_ABBREVIATIONS: Record<string, string> = {
  sun: 'sunday', mon: 'monday', tue: 'tuesday', wed: 'wednesday',
  thu: 'thursday', fri: 'friday', sat: 'saturday',
  tues: 'tuesday', weds: 'wednesday', thurs: 'thursday',
};

const NAV_ROUTES: Record<string, { route: string; label: string }> = {
  home: { route: '/(tabs)', label: 'Go to Home' },
  dashboard: { route: '/(tabs)', label: 'Go to Dashboard' },
  clients: { route: '/(tabs)/clients', label: 'Go to Clients' },
  schedule: { route: '/(tabs)/schedule', label: 'Go to Schedule' },
  calendar: { route: '/(tabs)/schedule', label: 'Go to Schedule' },
  invoices: { route: '/(tabs)/invoices', label: 'Go to Invoices' },
  billing: { route: '/(tabs)/invoices', label: 'Go to Invoices' },
  finances: { route: '/(tabs)/finances', label: 'Go to Finances' },
  money: { route: '/(tabs)/finances', label: 'Go to Finances' },
  time: { route: '/(tabs)/time', label: 'Go to Time Clock' },
  clock: { route: '/(tabs)/time', label: 'Go to Time Clock' },
  notes: { route: '/(tabs)/notes', label: 'Go to Notes' },
  routes: { route: '/(tabs)/routes', label: 'Go to Routes' },
  camera: { route: '/(tabs)/camera', label: 'Go to Camera' },
};

function extractPhone(input: string): { phone: string; cleaned: string } | undefined {
  const phonePattern = /(?:(?:with|number|#|phone|ph|tel|call)\s*:?\s*)?((?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4})/i;
  const contextPattern = /(?:with\s+(?:(?:the\s+)?(?:number|phone|ph|#)\s*:?\s*)?|number\s*:?\s*|phone\s*:?\s*|ph\s*:?\s*|#\s*)((?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4})/i;
  const contextMatch = input.match(contextPattern);
  if (contextMatch) {
    const phone = contextMatch[1];
    const fullMatchStart = input.indexOf(contextMatch[0]);
    const cleaned = (input.substring(0, fullMatchStart) + input.substring(fullMatchStart + contextMatch[0].length)).replace(/\s+/g, ' ').trim();
    return { phone, cleaned };
  }
  const words = input.toLowerCase();
  if (words.includes('with') || words.includes('number') || words.includes('phone') || words.includes('#')) {
    const match = input.match(phonePattern);
    if (match) {
      const phone = match[1];
      const fullMatchStart = input.indexOf(match[0]);
      const cleaned = (input.substring(0, fullMatchStart) + input.substring(fullMatchStart + match[0].length)).replace(/\s+/g, ' ').trim();
      return { phone, cleaned };
    }
  }
  return undefined;
}

function extractAmount(input: string): number | undefined {
  const match = input.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  if (match) return parseFloat(match[1].replace(/,/g, ''));
  const numMatch = input.match(/(\d+(?:\.\d{1,2})?)\s*(?:dollars?|bucks?)/i);
  if (numMatch) return parseFloat(numMatch[1]);
  return undefined;
}

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const MONTH_ABBREVIATIONS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function extractDay(input: string): string | undefined {
  const lower = input.toLowerCase();
  if (lower.includes('today')) return 'today';
  if (lower.includes('tomorrow')) return 'tomorrow';
  for (const day of DAY_NAMES) {
    if (lower.includes(day)) return day;
  }
  for (const [abbr, full] of Object.entries(DAY_ABBREVIATIONS)) {
    const regex = new RegExp(`\\b${abbr}\\b`, 'i');
    if (regex.test(lower)) return full;
  }
  return undefined;
}

function extractTargetDate(input: string): string | undefined {
  const lower = input.toLowerCase();

  for (let mi = 0; mi < MONTH_NAMES.length; mi++) {
    const monthName = MONTH_NAMES[mi];
    const regex = new RegExp(`${monthName}\\s+(\\d{1,2})(?:st|nd|rd|th)?`, 'i');
    const match = lower.match(regex);
    if (match) {
      const dayNum = parseInt(match[1], 10);
      return resolveDate(mi, dayNum);
    }
  }

  for (const [abbr, monthIdx] of Object.entries(MONTH_ABBREVIATIONS)) {
    const regex = new RegExp(`\\b${abbr}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?`, 'i');
    const match = lower.match(regex);
    if (match) {
      const dayNum = parseInt(match[1], 10);
      return resolveDate(monthIdx, dayNum);
    }
  }

  const ordinalMatch = lower.match(/(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)/);
  if (ordinalMatch) {
    const dayNum = parseInt(ordinalMatch[1], 10);
    if (dayNum >= 1 && dayNum <= 31) {
      const now = new Date();
      let month = now.getMonth();
      let year = now.getFullYear();
      const candidate = new Date(year, month, dayNum);
      if (candidate < now) {
        month++;
        if (month > 11) { month = 0; year++; }
      }
      return new Date(year, month, dayNum).toISOString();
    }
  }

  const slashMatch = lower.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (slashMatch) {
    const m = parseInt(slashMatch[1], 10) - 1;
    const d = parseInt(slashMatch[2], 10);
    let y = slashMatch[3] ? parseInt(slashMatch[3], 10) : new Date().getFullYear();
    if (y < 100) y += 2000;
    return new Date(y, m, d).toISOString();
  }

  return undefined;
}

function resolveDate(month: number, day: number): string {
  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(year, month, day);
  if (candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    year++;
  }
  return new Date(year, month, day).toISOString();
}

function extractTime(input: string): { hour: number; minute: number } | undefined {
  const lower = input.toLowerCase();
  const timeMatch = lower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const ampm = timeMatch[3]?.toLowerCase();
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    if (hour >= 0 && hour <= 23) return { hour, minute };
  }
  const standaloneTime = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (standaloneTime) {
    let hour = parseInt(standaloneTime[1], 10);
    const minute = standaloneTime[2] ? parseInt(standaloneTime[2], 10) : 0;
    const ampm = standaloneTime[3]?.toLowerCase();
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    if (hour >= 0 && hour <= 23) return { hour, minute };
  }
  return undefined;
}

function extractServiceScope(input: string): 'interior' | 'exterior' | 'both' | undefined {
  const lower = input.toLowerCase();
  const hasBoth = (lower.includes('inside and out') || lower.includes('in and out') ||
    lower.includes('interior and exterior') || lower.includes('interior & exterior') ||
    lower.includes('inside & outside') || lower.includes('inside and outside') ||
    (lower.includes('interior') && lower.includes('exterior')) ||
    (lower.includes('inside') && lower.includes('outside')));
  if (hasBoth) return 'both';
  if (lower.includes('interior') || lower.includes('inside')) return 'interior';
  if (lower.includes('exterior') || lower.includes('outside') || lower.includes('out only')) return 'exterior';
  return undefined;
}

function extractJobTypeName(input: string): string | undefined {
  const lower = input.toLowerCase();
  const serviceKeywords = [
    'window cleaning', 'window washing', 'window wash',
    'gutter cleaning', 'gutter cleaning',
    'pressure washing', 'power washing',
    'roof cleaning', 'roof wash',
    'solar panel cleaning',
    'house washing', 'house wash',
    'deck cleaning', 'deck wash',
    'driveway cleaning', 'driveway wash',
    'carpet cleaning',
    'lawn care', 'lawn mowing', 'mowing',
    'landscaping',
    'snow removal', 'snow plowing',
    'pest control',
  ];
  for (const kw of serviceKeywords) {
    if (lower.includes(kw)) return kw;
  }
  return undefined;
}

function findBestClientMatch(query: string, clients: Client[]): Client | undefined {
  if (!query || clients.length === 0) return undefined;
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return undefined;

  const exact = clients.find(c => c.name.toLowerCase() === lowerQuery);
  if (exact) return exact;

  const startsWith = clients.filter(c => c.name.toLowerCase().startsWith(lowerQuery));
  if (startsWith.length === 1) return startsWith[0];

  const contains = clients.filter(c => c.name.toLowerCase().includes(lowerQuery));
  if (contains.length === 1) return contains[0];

  const words = lowerQuery.split(/\s+/);
  const multiWord = clients.filter(c => {
    const cLower = c.name.toLowerCase();
    return words.every(w => cLower.includes(w));
  });
  if (multiWord.length === 1) return multiWord[0];

  if (startsWith.length > 0) return startsWith[0];
  if (contains.length > 0) return contains[0];
  if (multiWord.length > 0) return multiWord[0];

  return undefined;
}

function stripKeywords(input: string, keywords: string[]): string {
  let result = input;
  for (const kw of keywords) {
    result = result.replace(new RegExp(`\\b${kw}\\b`, 'gi'), '');
  }
  result = result.replace(/\$\s*[\d,]+(?:\.\d{1,2})?/, '');
  result = result.replace(/\d+(?:\.\d{1,2})?\s*(?:dollars?|bucks?)/i, '');
  for (const day of DAY_NAMES) {
    result = result.replace(new RegExp(`\\b${day}\\b`, 'gi'), '');
  }
  for (const abbr of Object.keys(DAY_ABBREVIATIONS)) {
    result = result.replace(new RegExp(`\\b${abbr}\\b`, 'gi'), '');
  }
  result = result.replace(/\b(today|tomorrow|next)\b/gi, '');
  return result.replace(/\s+/g, ' ').trim();
}

function stripTimeAndDate(input: string): string {
  let result = input;
  result = result.replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi, '');
  result = result.replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '');
  for (let mi = 0; mi < MONTH_NAMES.length; mi++) {
    result = result.replace(new RegExp(`\\b${MONTH_NAMES[mi]}\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, 'gi'), '');
  }
  for (const abbr of Object.keys(MONTH_ABBREVIATIONS)) {
    result = result.replace(new RegExp(`\\b${abbr}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, 'gi'), '');
  }
  result = result.replace(/\b\d{1,2}(?:st|nd|rd|th)\b/gi, '');
  result = result.replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, '');
  result = result.replace(/\b(for|on|at)\b\s*$/gi, '');
  return result.replace(/\s+/g, ' ').trim();
}

function extractNoteContent(input: string): { title: string; content: string } | undefined {
  const notePrefixes = ['note:', 'jot:', 'write:', 'remember:', 'note down:', 'write down:', 'jot down:', 'remind me:'];
  const lower = input.toLowerCase();
  for (const prefix of notePrefixes) {
    const idx = lower.indexOf(prefix);
    if (idx !== -1) {
      const afterPrefix = input.substring(idx + prefix.length).trim();
      const colonIdx = afterPrefix.indexOf(':');
      if (colonIdx !== -1 && colonIdx < 40) {
        return {
          title: afterPrefix.substring(0, colonIdx).trim(),
          content: afterPrefix.substring(colonIdx + 1).trim(),
        };
      }
      const parts = afterPrefix.split(/\s+/);
      const title = parts.slice(0, Math.min(5, parts.length)).join(' ');
      const content = parts.length > 5 ? parts.slice(5).join(' ') : '';
      return { title, content };
    }
  }
  const noteKeywords = ['note', 'jot', 'remember', 'remind'];
  for (const kw of noteKeywords) {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    if (regex.test(lower)) {
      let cleaned = input.replace(regex, '').replace(/\b(down|me|that|to)\b/gi, '').replace(/\s+/g, ' ').trim();
      const colonIdx = cleaned.indexOf(':');
      if (colonIdx !== -1 && colonIdx < 40) {
        return {
          title: cleaned.substring(0, colonIdx).trim(),
          content: cleaned.substring(colonIdx + 1).trim(),
        };
      }
      const parts = cleaned.split(/\s+/);
      const title = parts.slice(0, Math.min(6, parts.length)).join(' ');
      const content = parts.length > 6 ? parts.slice(6).join(' ') : '';
      return { title: title || 'Note', content };
    }
  }
  return undefined;
}

function extractShoppingItems(input: string): string[] {
  const listPrefixes = [
    'shopping list:', 'supply list:', 'supplies needed:', 'buy list:', 'pick up:', 'need to buy:',
    'shopping list', 'supply list', 'supplies needed', 'buy list', 'pick up',
  ];
  const lower = input.toLowerCase();
  let itemSection = input;
  for (const prefix of listPrefixes) {
    const idx = lower.indexOf(prefix);
    if (idx !== -1) {
      itemSection = input.substring(idx + prefix.length).trim();
      break;
    }
  }
  const raw = itemSection
    .replace(/\band\b/gi, ',')
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  return raw;
}

function extractJobTitleFromSchedule(input: string, clientName?: string): string | undefined {
  const knownJobType = extractJobTypeName(input);
  if (knownJobType) return knownJobType;

  let result = input.toLowerCase();
  const scheduleKeywords = ['schedule', 'book', 'appointment', 'visit', 'for', 'on'];
  for (const kw of scheduleKeywords) {
    result = result.replace(new RegExp(`^${kw}\\s+`, 'i'), '');
    result = result.replace(new RegExp(`\\b${kw}\\b`, 'gi'), ' ');
  }
  if (clientName) {
    result = result.replace(new RegExp(clientName.toLowerCase(), 'gi'), '');
  }
  result = stripTimeAndDate(result);
  for (const day of DAY_NAMES) {
    result = result.replace(new RegExp(`\\b${day}\\b`, 'gi'), '');
  }
  result = result.replace(/\b(today|tomorrow|next)\b/gi, '');
  result = result.replace(/inside and out|in and out|interior and exterior|interior & exterior|inside & outside|inside and outside/gi, '');
  result = result.replace(/\b(interior|exterior|inside|outside)\b/gi, '');
  result = result.replace(/\s+/g, ' ').trim();
  if (result.length > 2) return result;
  return undefined;
}

export function parseQuickAction(input: string, clients: Client[]): ParsedAction[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const lower = trimmed.toLowerCase();
  const results: ParsedAction[] = [];

  const invoiceKeywords = ['invoice', 'bill', 'charge'];
  const scheduleKeywords = ['schedule', 'book', 'appointment', 'visit'];
  const expenseKeywords = ['expense', 'spent', 'cost', 'buy', 'bought', 'purchase', 'purchased', 'paid for'];
  const incomeKeywords = ['income', 'earned', 'received', 'payment', 'deposit', 'log income'];
  const clientKeywords = ['new client', 'add client', 'create client', 'new customer', 'add customer'];
  const navKeywords = ['go to', 'open', 'show', 'view', 'navigate'];
  const rescheduleKeywords = ['move', 'reschedule', 'push', 'shift', 'bump', 'change date'];
  const estimateKeywords = ['estimate', 'quote', 'bid'];
  const sendInvoiceKeywords = ['send invoice', 'email invoice', 'mail invoice', 'send the invoice', 'email the invoice'];
  const sendEstimateKeywords = ['send estimate', 'email estimate', 'send quote', 'email quote', 'send the estimate', 'email the estimate'];
  const noteKeywords = ['note', 'jot', 'write down', 'jot down', 'remember', 'remind me'];
  const shoppingKeywords = ['shopping list', 'supply list', 'supplies needed', 'buy list', 'pick up', 'need to buy'];

  const isInvoice = invoiceKeywords.some(k => lower.includes(k));
  const isSchedule = scheduleKeywords.some(k => lower.includes(k));
  const isExpense = expenseKeywords.some(k => lower.includes(k));
  const isIncome = incomeKeywords.some(k => lower.includes(k));
  const isNewClient = clientKeywords.some(k => lower.includes(k));
  const isNav = navKeywords.some(k => lower.startsWith(k));
  const isReschedule = rescheduleKeywords.some(k => lower.includes(k));
  const isSendInvoice = sendInvoiceKeywords.some(k => lower.includes(k));
  const isSendEstimate = sendEstimateKeywords.some(k => lower.includes(k));
  const isEstimate = !isSendEstimate && estimateKeywords.some(k => lower.includes(k));
  const isNote = noteKeywords.some(k => lower.includes(k));
  const isShopping = shoppingKeywords.some(k => lower.includes(k));

  const amount = extractAmount(trimmed);
  const day = extractDay(trimmed);

  if (isNewClient) {
    let nameCandidate = stripKeywords(trimmed, ['new', 'add', 'create', 'client', 'customer']);
    let extractedPhone: string | undefined;
    let extractedAddress: string | undefined;
    let extractedLanguage: string | undefined;

    const phoneResult = extractPhone(nameCandidate);
    if (phoneResult) {
      extractedPhone = phoneResult.phone;
      nameCandidate = phoneResult.cleaned;
    }

    const languageMatch = nameCandidate.match(/\b(?:speaks?|language[:\s]+|native[:\s]+)([a-zA-Z]+)/i);
    if (languageMatch) {
      extractedLanguage = languageMatch[1];
      nameCandidate = nameCandidate.replace(languageMatch[0], '').trim();
    }

    const atAddressMatch = nameCandidate.match(/^(.+?)\s+at\s+(\d.+)$/i);
    if (atAddressMatch) {
      nameCandidate = atAddressMatch[1].trim();
      extractedAddress = atAddressMatch[2].trim();
    }

    nameCandidate = nameCandidate.replace(/\s*with\s*$/i, '').trim();

    const hasEnoughInfo = nameCandidate.length > 1;
    const actionType: ActionType = hasEnoughInfo ? 'direct_create_client' : 'add_client';

    let descParts: string[] = [];
    if (extractedPhone) descParts.push(`phone ${extractedPhone}`);
    if (extractedAddress) descParts.push(`address ${extractedAddress}`);
    if (extractedLanguage) descParts.push(`speaks ${extractedLanguage}`);

    results.push({
      type: actionType,
      label: nameCandidate ? `Add client "${nameCandidate}"` : 'Add new client',
      description: descParts.length > 0
        ? `Create client with ${descParts.join(', ')}`
        : hasEnoughInfo
          ? `Quickly create ${nameCandidate}`
          : 'Create a new client record',
      clientName: nameCandidate || undefined,
      clientAddress: extractedAddress,
      clientLanguage: extractedLanguage,
      phone: extractedPhone,
      raw: trimmed,
    });
  }

  if (isReschedule) {
    const stripped = stripKeywords(trimmed, [...rescheduleKeywords, 'job', 'event', 'to', 'for', 'on']);
    const nameCandidate = stripped.replace(/\d{1,2}(?:st|nd|rd|th)?/g, '').replace(/\s+/g, ' ').trim();
    const client = findBestClientMatch(nameCandidate, clients);
    const targetDate = extractTargetDate(trimmed);
    const dayName = extractDay(trimmed);
    const dateLabel = targetDate
      ? new Date(targetDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : dayName || 'a new date';

    results.push({
      type: 'reschedule_job',
      label: client ? `Move ${client.name}'s job` : nameCandidate ? `Move "${nameCandidate}" job` : 'Move a job',
      description: `Reschedule to ${dateLabel}`,
      clientName: client?.name || nameCandidate || undefined,
      day: dayName,
      targetDate,
      raw: trimmed,
    });
  }

  if (isInvoice) {
    const nameCandidate = stripKeywords(trimmed, invoiceKeywords);
    const client = findBestClientMatch(nameCandidate, clients);
    results.push({
      type: 'invoice_client',
      label: client ? `Invoice ${client.name}` : nameCandidate ? `Invoice "${nameCandidate}"` : 'Create new invoice',
      description: amount ? `Create invoice for $${amount.toFixed(2)}` : 'Create and send a new invoice',
      clientName: client?.name || nameCandidate || undefined,
      amount,
      raw: trimmed,
    });
  }

  if (isSchedule) {
    const nameCandidate = stripKeywords(trimmed, scheduleKeywords);
    const client = findBestClientMatch(nameCandidate, clients);
    const resolvedName = client?.name || undefined;
    const targetDate = extractTargetDate(trimmed);
    const parsedTime = extractTime(trimmed);
    const serviceScope = extractServiceScope(trimmed);
    const jobTypeName = extractJobTypeName(trimmed);
    const jobTitle = extractJobTitleFromSchedule(trimmed, resolvedName || nameCandidate);

    let dateLabel = day ? `Add to ${day}'s schedule` : 'Add a new schedule event';
    if (targetDate) {
      const d = new Date(targetDate);
      dateLabel = `Schedule for ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    if (parsedTime) {
      const h = parsedTime.hour > 12 ? parsedTime.hour - 12 : parsedTime.hour || 12;
      const ampm = parsedTime.hour >= 12 ? 'PM' : 'AM';
      const mStr = parsedTime.minute > 0 ? `:${parsedTime.minute.toString().padStart(2, '0')}` : '';
      dateLabel += ` at ${h}${mStr} ${ampm}`;
    }

    results.push({
      type: 'schedule_client',
      label: client ? `Schedule ${client.name}` : nameCandidate ? `Schedule "${nameCandidate}"` : 'Create new event',
      description: dateLabel,
      clientName: resolvedName || nameCandidate || undefined,
      day,
      targetDate,
      jobTitle,
      serviceScope,
      jobTypeName,
      startHour: parsedTime?.hour,
      startMinute: parsedTime?.minute,
      raw: trimmed,
    });
  }

  if (isExpense) {
    const desc = stripKeywords(trimmed, expenseKeywords);
    results.push({
      type: 'add_expense',
      label: amount ? `Log expense $${amount.toFixed(2)}` : 'Log new expense',
      description: desc || 'Record a business expense',
      amount,
      raw: trimmed,
    });
  }

  if (isIncome) {
    const desc = stripKeywords(trimmed, [...incomeKeywords, 'log']);
    results.push({
      type: 'add_income',
      label: amount ? `Log income $${amount.toFixed(2)}` : 'Log new income',
      description: desc || 'Record income received',
      amount,
      raw: trimmed,
    });
  }

  if (isSendInvoice) {
    const nameCandidate = stripKeywords(trimmed, ['send', 'email', 'mail', 'the', 'invoice', 'bill']);
    const client = findBestClientMatch(nameCandidate, clients);
    results.push({
      type: 'send_invoice',
      label: client ? `Send invoice to ${client.name}` : nameCandidate ? `Send invoice to "${nameCandidate}"` : 'Send an invoice',
      description: 'Review invoice and send via email or SMS',
      clientName: client?.name || nameCandidate || undefined,
      raw: trimmed,
    });
  }

  if (isSendEstimate) {
    const nameCandidate = stripKeywords(trimmed, ['send', 'email', 'mail', 'the', 'estimate', 'quote']);
    const client = findBestClientMatch(nameCandidate, clients);
    results.push({
      type: 'send_estimate',
      label: client ? `Send estimate to ${client.name}` : nameCandidate ? `Send estimate to "${nameCandidate}"` : 'Send an estimate',
      description: 'Review estimate and send via email or SMS',
      clientName: client?.name || nameCandidate || undefined,
      raw: trimmed,
    });
  }

  if (isEstimate) {
    const nameCandidate = stripKeywords(trimmed, [...estimateKeywords, 'create', 'new', 'for']);
    const client = findBestClientMatch(nameCandidate, clients);
    results.push({
      type: 'create_estimate',
      label: client ? `Create estimate for ${client.name}` : nameCandidate ? `Create estimate for "${nameCandidate}"` : 'Create new estimate',
      description: amount ? `Build estimate for $${amount.toFixed(2)}` : 'Build and send a new estimate',
      clientName: client?.name || nameCandidate || undefined,
      amount,
      raw: trimmed,
    });
  }

  if (isNote) {
    const extracted = extractNoteContent(trimmed);
    const title = extracted?.title || stripKeywords(trimmed, noteKeywords).replace(/\b(down|me|that|to)\b/gi, '').trim() || 'Quick note';
    const content = extracted?.content || '';
    results.push({
      type: 'direct_create_note',
      label: `Create note: "${title.substring(0, 30)}${title.length > 30 ? '…' : ''}"`,
      description: content ? `"${content.substring(0, 40)}${content.length > 40 ? '…' : ''}"` : 'Saved silently to Notes',
      noteTitle: title,
      noteContent: content,
      raw: trimmed,
    });
  }

  if (isShopping) {
    const items = extractShoppingItems(trimmed);
    const listTitle = stripKeywords(trimmed, [...shoppingKeywords, 'create', 'new', 'make', 'a', 'my']).trim() || 'Shopping List';
    results.push({
      type: 'direct_create_shopping_list',
      label: items.length > 0 ? `Create list with ${items.length} item${items.length > 1 ? 's' : ''}` : 'Create shopping list',
      description: items.length > 0 ? items.slice(0, 3).join(', ') + (items.length > 3 ? '…' : '') : 'Saved silently to Supplies',
      noteTitle: listTitle,
      shoppingItems: items,
      raw: trimmed,
    });
  }

  if (isNav) {
    for (const [keyword, config] of Object.entries(NAV_ROUTES)) {
      if (lower.includes(keyword)) {
        results.push({
          type: 'navigate',
          label: config.label,
          description: `Navigate to the ${keyword} tab`,
          navigateTo: config.route,
          raw: trimmed,
        });
        break;
      }
    }
  }

  if (results.length === 0) {
    const client = findBestClientMatch(trimmed, clients);
    if (client) {
      results.push(
        {
          type: 'invoice_client',
          label: `Invoice ${client.name}`,
          description: 'Create invoice for this client',
          clientName: client.name,
          raw: trimmed,
        },
        {
          type: 'schedule_client',
          label: `Schedule ${client.name}`,
          description: 'Add event for this client',
          clientName: client.name,
          raw: trimmed,
        },
        {
          type: 'search_client',
          label: `View ${client.name}`,
          description: 'Open client details',
          clientName: client.name,
          raw: trimmed,
        },
      );
    } else {
      for (const [keyword, config] of Object.entries(NAV_ROUTES)) {
        if (lower.includes(keyword)) {
          results.push({
            type: 'navigate',
            label: config.label,
            description: `Navigate to the ${keyword} tab`,
            navigateTo: config.route,
            raw: trimmed,
          });
        }
      }
    }
  }

  return results;
}

export const QUICK_SUGGESTIONS: ParsedAction[] = [
  { type: 'add_client', label: 'Add new client', description: 'Create a new client record', raw: 'new client' },
  { type: 'invoice_client', label: 'Create invoice', description: 'Generate a new invoice', raw: 'invoice' },
  { type: 'create_estimate', label: 'Create estimate', description: 'Build and send a new estimate', raw: 'estimate' },
  { type: 'schedule_client', label: 'Schedule job', description: 'Add a new schedule event', raw: 'schedule' },
  { type: 'reschedule_job', label: 'Move a job', description: 'Reschedule a job to a new date', raw: 'move' },
  { type: 'add_expense', label: 'Log expense', description: 'Record a business expense', raw: 'expense' },
  { type: 'direct_create_note', label: 'Create note', description: 'Jot a quick note', noteTitle: 'Quick note', noteContent: '', raw: 'note' },
  { type: 'direct_create_shopping_list', label: 'Shopping list', description: 'Start a supply list', noteTitle: 'Shopping List', shoppingItems: [], raw: 'shopping list' },
  { type: 'navigate', label: 'Go to Clients', description: 'View all clients', navigateTo: '/(tabs)/clients', raw: 'clients' },
  { type: 'navigate', label: 'Go to Invoices', description: 'View all invoices', navigateTo: '/(tabs)/invoices', raw: 'invoices' },
];
