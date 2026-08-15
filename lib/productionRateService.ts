import { supabase } from './supabase';
import {
  ServiceScope,
  getEffectivePanePriceForType,
  getExteriorSplitForPaneType,
  getInteriorSplitForPaneType,
  PaneType,
} from './panePricingService';

export interface ProductionRate {
  id: string;
  member_id: string;
  unit_type: string;
  custom_unit_label?: string;
  pane_type?: string | null;
  units_per_hour: number;
}

export interface UnitType {
  unitType: string;
  customUnitLabel?: string;
  displayLabel: string;
}

export interface DurationEstimate {
  estimatedMinutes: number;
  breakdown: {
    totalUnits: number;
    combinedRate: number;
    memberRates: Array<{
      memberId: string;
      memberName?: string;
      rate: number;
    }>;
  };
  confidence: 'high' | 'medium' | 'low';
  warning?: string;
}

const UNIT_DISPLAY_MAP: Record<string, string> = {
  sqft: 'Sq Ft',
  linear_ft: 'Linear Ft',
  mirrors: 'Mirrors',
  windows: 'Pane Windows',
  custom: 'Custom',
};

export const getUnitDisplayLabel = (
  unitType: string,
  customLabel?: string
): string => {
  if (unitType === 'custom' && customLabel) {
    return customLabel;
  }
  return UNIT_DISPLAY_MAP[unitType] || unitType;
};

export const getActiveUnitTypes = async (
  organizationId: string
): Promise<UnitType[]> => {
  const { data: jobTypes, error } = await supabase
    .from('job_types')
    .select('unit_of_measure, custom_unit_label')
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching unit types:', error);
    return [];
  }

  const uniqueUnits = new Map<string, UnitType>();

  jobTypes?.forEach((jt) => {
    const key = `${jt.unit_of_measure}|${jt.custom_unit_label || ''}`;
    if (!uniqueUnits.has(key)) {
      const displayLabel = getUnitDisplayLabel(
        jt.unit_of_measure,
        jt.custom_unit_label
      );

      uniqueUnits.set(key, {
        unitType: jt.unit_of_measure,
        customUnitLabel: jt.custom_unit_label,
        displayLabel,
      });
    }
  });

  return Array.from(uniqueUnits.values());
};

export const getProductionRatesForMembers = async (
  memberIds: string[],
  unitType: string,
  customUnitLabel?: string,
  paneType?: string | null
): Promise<ProductionRate[]> => {
  if (memberIds.length === 0) return [];

  const query = supabase
    .from('team_member_production_rates')
    .select('*')
    .in('member_id', memberIds)
    .eq('unit_type', unitType);

  if (customUnitLabel) {
    query.eq('custom_unit_label', customUnitLabel);
  } else {
    query.is('custom_unit_label', null);
  }

  if (paneType !== undefined) {
    if (paneType === null) {
      query.is('pane_type', null);
    } else {
      query.eq('pane_type', paneType);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching production rates:', error);
    return [];
  }

  return data || [];
};

export const getProductionRatesByPaneType = async (
  memberIds: string[],
  unitType: string
): Promise<Map<string, Map<string, number>>> => {
  if (memberIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('team_member_production_rates')
    .select('member_id, pane_type, units_per_hour')
    .in('member_id', memberIds)
    .eq('unit_type', unitType)
    .not('pane_type', 'is', null);

  if (error) {
    console.error('Error fetching pane type production rates:', error);
    return new Map();
  }

  const result = new Map<string, Map<string, number>>();
  (data || []).forEach((r: any) => {
    if (!result.has(r.member_id)) result.set(r.member_id, new Map());
    result.get(r.member_id)!.set(r.pane_type, r.units_per_hour);
  });
  return result;
};

export const saveProductionRate = async (params: {
  memberId: string;
  organizationId: string;
  unitType: string;
  unitsPerHour: number;
  customUnitLabel?: string;
  paneType?: string | null;
}): Promise<{ success: boolean; error?: string }> => {
  const { memberId, organizationId, unitType, unitsPerHour, customUnitLabel, paneType } = params;

  const matchQuery = supabase
    .from('team_member_production_rates')
    .select('id')
    .eq('member_id', memberId)
    .eq('organization_id', organizationId)
    .eq('unit_type', unitType);

  if (customUnitLabel) {
    matchQuery.eq('custom_unit_label', customUnitLabel);
  } else {
    matchQuery.is('custom_unit_label', null);
  }

  if (paneType !== undefined && paneType !== null) {
    matchQuery.eq('pane_type', paneType);
  } else {
    matchQuery.is('pane_type', null);
  }

  const { data: existing } = await matchQuery.maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from('team_member_production_rates')
      .update({ units_per_hour: unitsPerHour, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) return { success: false, error: error.message };
  } else {
    const insertPayload: Record<string, unknown> = {
      member_id: memberId,
      organization_id: organizationId,
      unit_type: unitType,
      units_per_hour: unitsPerHour,
      custom_unit_label: customUnitLabel ?? null,
      pane_type: paneType ?? null,
    };
    const { error } = await supabase
      .from('team_member_production_rates')
      .insert(insertPayload);
    if (error) return { success: false, error: error.message };
  }

  return { success: true };
};

export const calculateCombinedDuration = async (
  memberIds: string[],
  totalUnits: number,
  unitType: string,
  customUnitLabel?: string,
  memberNames?: Record<string, string>,
  paneType?: string | null
): Promise<DurationEstimate> => {
  if (memberIds.length === 0 || totalUnits <= 0) {
    return {
      estimatedMinutes: 0,
      breakdown: {
        totalUnits: 0,
        combinedRate: 0,
        memberRates: [],
      },
      confidence: 'low',
      warning: 'No team members assigned',
    };
  }

  const rates = await getProductionRatesForMembers(
    memberIds,
    unitType,
    customUnitLabel,
    paneType
  );

  const ratesMap = new Map<string, number>();
  rates.forEach((rate) => {
    ratesMap.set(rate.member_id, rate.units_per_hour);
  });

  let combinedRate = 0;
  const memberRates = memberIds.map((memberId) => {
    const rate = ratesMap.get(memberId) || 0;
    combinedRate += rate;
    return {
      memberId,
      memberName: memberNames?.[memberId],
      rate,
    };
  });

  const missingRates = memberRates.filter((mr) => mr.rate === 0).length;

  let confidence: 'high' | 'medium' | 'low' = 'high';
  let warning: string | undefined;

  if (missingRates === memberIds.length) {
    confidence = 'low';
    warning = 'No production rates set for any team members';
  } else if (missingRates > 0) {
    confidence = 'medium';
    warning = `${missingRates} team member(s) missing production rates`;
  }

  if (combinedRate === 0) {
    return {
      estimatedMinutes: 0,
      breakdown: {
        totalUnits,
        combinedRate: 0,
        memberRates,
      },
      confidence: 'low',
      warning: warning || 'No production rates available',
    };
  }

  const estimatedHours = totalUnits / combinedRate;
  const estimatedMinutes = Math.round(estimatedHours * 60);

  return {
    estimatedMinutes,
    breakdown: {
      totalUnits,
      combinedRate,
      memberRates,
    },
    confidence,
    warning,
  };
};

export const saveClientJobQuantity = async (
  organizationId: string,
  clientId: string,
  jobTypeId: string,
  quantity: number,
  notes?: string
): Promise<void> => {
  const { error } = await supabase.from('client_job_quantities').upsert(
    {
      organization_id: organizationId,
      client_id: clientId,
      job_type_id: jobTypeId,
      quantity,
      notes,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'client_id,job_type_id',
    }
  );

  if (error) {
    console.error('Error saving client job quantity:', error);
    throw error;
  }
};

export interface PaneDetails {
  standard_exterior: number;
  standard_interior: number;
  standard_divisional: number;
  french_exterior: number;
  french_interior: number;
  french_divisional: number;
  storm_exterior: number;
  storm_interior: number;
  skylights_exterior: number;
  skylights_interior: number;
  commercial_exterior: number;
  commercial_interior: number;
}

export const EMPTY_PANE_DETAILS: PaneDetails = {
  standard_exterior: 0,
  standard_interior: 0,
  standard_divisional: 0,
  french_exterior: 0,
  french_interior: 0,
  french_divisional: 0,
  storm_exterior: 0,
  storm_interior: 0,
  skylights_exterior: 0,
  skylights_interior: 0,
  commercial_exterior: 0,
  commercial_interior: 0,
};

const VALID_PANE_KEYS: Array<keyof PaneDetails> = [
  'standard_exterior', 'standard_interior', 'standard_divisional',
  'french_exterior', 'french_interior', 'french_divisional',
  'storm_exterior', 'storm_interior',
  'skylights_exterior', 'skylights_interior',
  'commercial_exterior', 'commercial_interior',
];

export type PaneTypeFilter = {
  standard_exterior?: boolean;
  standard_interior?: boolean;
  standard_divisional?: boolean;
  french_exterior?: boolean;
  french_interior?: boolean;
  french_divisional?: boolean;
  storm_exterior?: boolean;
  storm_interior?: boolean;
  skylights_exterior?: boolean;
  skylights_interior?: boolean;
  commercial_exterior?: boolean;
  commercial_interior?: boolean;
  [key: string]: boolean | undefined;
};

export const ALL_PANE_TYPES: PaneTypeFilter = {
  standard_exterior: true,
  standard_interior: true,
  standard_divisional: true,
  french_exterior: true,
  french_interior: true,
  french_divisional: true,
  storm_exterior: true,
  storm_interior: true,
  skylights_exterior: true,
  skylights_interior: true,
  commercial_exterior: true,
  commercial_interior: true,
};

export const EXTERIOR_ONLY_FILTER: PaneTypeFilter = {
  standard_exterior: true,
  french_exterior: true,
  storm_exterior: true,
  skylights_exterior: true,
  commercial_exterior: true,
};

export const INTERIOR_ONLY_FILTER: PaneTypeFilter = {
  standard_interior: true,
  french_interior: true,
  storm_interior: true,
  skylights_interior: true,
  commercial_interior: true,
};

export type PaneStyle = 'standard' | 'french' | 'storm' | 'skylights' | 'commercial' | string;

export const PANE_STYLE_LABELS: Record<string, string> = {
  standard: 'Standard Panes',
  french: 'French Panes',
  storm: 'Storm Windows',
  skylights: 'Skylights',
  commercial: 'Commercial',
};

export const PANE_TYPE_LABELS: Record<string, string> = {
  standard_exterior: 'Standard',
  standard_interior: 'Standard',
  standard_divisional: 'Standard',
  french_exterior: 'French Panes',
  french_interior: 'French Panes',
  french_divisional: 'French Panes',
  storm_exterior: 'Storm',
  storm_interior: 'Storm',
  skylights_exterior: 'Skylights',
  skylights_interior: 'Skylights',
  commercial_exterior: 'Commercial',
  commercial_interior: 'Commercial',
};

export const PANE_PRIMARY_KEYS: Array<keyof PaneDetails> = [
  'standard_exterior',
  'french_exterior',
  'storm_exterior',
  'skylights_exterior',
  'commercial_exterior',
];

export function getPrimaryPaneLabel(key: keyof PaneDetails): string {
  const k = String(key);
  if (k.startsWith('standard')) return 'Standard';
  if (k.startsWith('french')) return 'French Panes';
  if (k.startsWith('storm')) return 'Storm';
  if (k.startsWith('skylights')) return 'Skylights';
  if (k.startsWith('commercial')) return 'Commercial';
  const base = k.split('_')[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function getPrimaryKeyForStyle(style: string): keyof PaneDetails {
  if (style === 'french') return 'french_exterior';
  if (style === 'storm') return 'storm_exterior';
  if (style === 'skylights') return 'skylights_exterior';
  if (style === 'commercial') return 'commercial_exterior';
  if (style === 'standard') return 'standard_exterior';
  return `${style}_exterior` as keyof PaneDetails;
}

export function getStyleForKey(key: keyof PaneDetails): PaneStyle {
  const k = String(key);
  if (k.startsWith('french')) return 'french';
  if (k.startsWith('storm')) return 'storm';
  if (k.startsWith('skylights')) return 'skylights';
  if (k.startsWith('commercial')) return 'commercial';
  if (k.startsWith('standard')) return 'standard';
  return k.split('_')[0] as PaneStyle;
}

export function getPaneCountForStyle(details: PaneDetails, style: PaneStyle): number {
  if (style === 'standard') {
    return (details.standard_exterior || 0) + (details.standard_interior || 0) + (details.standard_divisional || 0);
  }
  if (style === 'french') {
    return (details.french_exterior || 0) + (details.french_interior || 0) + (details.french_divisional || 0);
  }
  if (style === 'storm') {
    return (details.storm_exterior || 0) + (details.storm_interior || 0);
  }
  const ext = (details as any)[`${style}_exterior`] || 0;
  const int = (details as any)[`${style}_interior`] || 0;
  return ext + int;
}

export function buildPaneDetailsFromStyleCounts(counts: Partial<Record<string, number>>): PaneDetails {
  const result = { ...EMPTY_PANE_DETAILS };
  for (const [style, qty] of Object.entries(counts)) {
    if (qty) {
      (result as any)[`${style}_exterior`] = qty;
    }
  }
  return result;
}

export function getActivePaneStyles(details: PaneDetails): PaneStyle[] {
  const styleSet = new Set<string>();
  for (const key of Object.keys(details)) {
    const val = (details as any)[key];
    if (typeof val === 'number' && val > 0) {
      const style = key.split('_')[0];
      styleSet.add(style);
    }
  }
  const ordered: PaneStyle[] = ['standard', 'french', 'storm', 'skylights', 'commercial'];
  const result: PaneStyle[] = [];
  for (const s of ordered) {
    if (styleSet.has(s)) result.push(s);
  }
  for (const s of styleSet) {
    if (!ordered.includes(s)) result.push(s);
  }
  return result;
}

export function inferPaneDetailsFromDescription(description: string, quantity: number): PaneDetails | null {
  const normalized = description.toLowerCase().trim();
  let style: PaneStyle | null = null;
  if (normalized.includes('french')) style = 'french';
  else if (normalized.includes('storm')) style = 'storm';
  else if (normalized.includes('standard') || normalized.includes('window') || normalized.includes('pane')) style = 'standard';
  if (!style) return null;
  return buildPaneDetailsFromStyleCounts({ [style]: quantity });
}

export interface PaneJobTypeConfig {
  exterior_pct_standard?: number | null;
  exterior_pct_french?: number | null;
}

export function applyExteriorPercentages(
  details: PaneDetails,
  config: PaneJobTypeConfig
): PaneDetails {
  const result = { ...details };

  if (config.exterior_pct_standard != null) {
    const total = details.standard_exterior + details.standard_interior + details.standard_divisional;
    result.standard_exterior = Math.round(total * config.exterior_pct_standard / 100);
    result.standard_interior = Math.max(0, total - details.standard_divisional - result.standard_exterior);
  }

  if (config.exterior_pct_french != null) {
    const total = details.french_exterior + details.french_interior + details.french_divisional;
    result.french_exterior = Math.round(total * config.exterior_pct_french / 100);
    result.french_interior = Math.max(0, total - details.french_divisional - result.french_exterior);
  }

  return result;
}

export function computePaneTotalForScope(
  details: PaneDetails,
  scope: 'all' | 'exterior_only' | 'interior_only',
  config?: PaneJobTypeConfig
): number {
  const d = config ? applyExteriorPercentages(details, config) : details;

  if (scope === 'exterior_only') {
    return d.standard_exterior + d.french_exterior + d.storm_exterior + d.storm_interior;
  }
  if (scope === 'interior_only') {
    return d.standard_interior + d.standard_divisional + d.french_interior + d.french_divisional;
  }
  return computePaneTotal(d);
}

export function computePaneTotal(details: PaneDetails, filter?: PaneTypeFilter): number {
  if (!filter) {
    return VALID_PANE_KEYS.reduce((s, k) => s + (details[k] || 0), 0);
  }
  let total = 0;
  for (const key of VALID_PANE_KEYS) {
    if (filter[key] === false) continue;
    total += details[key] || 0;
  }
  return total;
}

export type PaneRates = Partial<Record<keyof PaneDetails, number>>;

export function computePanePrice(
  details: PaneDetails,
  baseRate: number,
  filter?: PaneTypeFilter,
  paneRates?: PaneRates | null
): number {
  let total = 0;
  for (const key of VALID_PANE_KEYS) {
    if (filter && filter[key] === false) continue;
    const count = details[key] || 0;
    if (count === 0) continue;
    const rate = paneRates?.[key] ?? baseRate;
    total += count * rate;
  }
  return total;
}

export function computePanePriceWithScope(
  details: PaneDetails,
  jobType: { hourly_rate: number; pane_rates?: PaneRates | null; exterior_split_percent?: number | null; exterior_split_percent_standard?: number | null; exterior_split_percent_french?: number | null; exterior_split_percent_storm?: number | null; price_per_pane_standard?: number | null; price_per_pane_french?: number | null; price_per_pane_storm?: number | null; interior_split_percent_standard?: number | null; interior_split_percent_french?: number | null; interior_split_percent_storm?: number | null; interior_split_percent?: number | null },
  filter: PaneTypeFilter | undefined,
  scope: ServiceScope
): number {
  let total = 0;
  for (const key of VALID_PANE_KEYS) {
    if (filter && filter[key] === false) continue;
    const count = details[key] || 0;
    if (count === 0) continue;
    const paneType: PaneType = key.startsWith('french') ? 'french' : key.startsWith('storm') ? 'storm' : 'standard';
    let perPanePrice: number | null = null;
    if (paneType === 'standard') perPanePrice = jobType.price_per_pane_standard ?? null;
    else if (paneType === 'french') perPanePrice = jobType.price_per_pane_french ?? null;
    else if (paneType === 'storm') perPanePrice = jobType.price_per_pane_storm ?? null;
    const baseRate = jobType.pane_rates?.[key] ?? perPanePrice ?? jobType.hourly_rate;
    let effectiveRate = baseRate;
    if (scope === 'exterior_only') {
      const extPct = getExteriorSplitForPaneType(jobType, paneType);
      effectiveRate = baseRate * (extPct / 100);
    } else if (scope === 'interior_only') {
      const intPct = getInteriorSplitForPaneType(jobType, paneType);
      effectiveRate = baseRate * (intPct / 100);
    }
    total += count * effectiveRate;
  }
  return total;
}

export const getClientPaneDetails = async (
  clientId: string,
  jobTypeId: string,
  addressId?: string | null
): Promise<{ details: PaneDetails | null; totalQuantity: number }> => {
  let query = supabase
    .from('client_unit_quantities')
    .select('quantity, pane_details')
    .eq('client_id', clientId)
    .eq('job_type_id', jobTypeId);

  if (addressId) {
    query = query.eq('address_id', addressId);
  } else {
    query = query.is('address_id', null);
  }

  const { data } = await query.maybeSingle();

  if (!data) {
    if (addressId) {
      return getClientPaneDetails(clientId, jobTypeId, null);
    }
    const fallback = await getClientPaneDetailsAnyJobType(clientId, addressId);
    return fallback;
  }
  return {
    details: data.pane_details as PaneDetails | null,
    totalQuantity: Number(data.quantity) || 0,
  };
};

export const getClientPaneDetailsAnyJobType = async (
  clientId: string,
  addressId?: string | null
): Promise<{ details: PaneDetails | null; totalQuantity: number }> => {
  const { data: jobTypesWithPanes } = await supabase
    .from('job_types')
    .select('id')
    .eq('unit_of_measure', 'pane')
    .eq('is_active', true);

  if (!jobTypesWithPanes || jobTypesWithPanes.length === 0) {
    return { details: null, totalQuantity: 0 };
  }

  const paneJobTypeIds = jobTypesWithPanes.map(jt => jt.id);

  let query = supabase
    .from('client_unit_quantities')
    .select('quantity, pane_details')
    .eq('client_id', clientId)
    .in('job_type_id', paneJobTypeIds)
    .not('pane_details', 'is', null);

  if (addressId) {
    query = query.eq('address_id', addressId);
  }

  const { data } = await query.limit(1).maybeSingle();

  if (!data && addressId) {
    const fallbackQuery = supabase
      .from('client_unit_quantities')
      .select('quantity, pane_details')
      .eq('client_id', clientId)
      .in('job_type_id', paneJobTypeIds)
      .not('pane_details', 'is', null)
      .is('address_id', null)
      .limit(1);

    const { data: fallbackData } = await fallbackQuery.maybeSingle();
    if (fallbackData) {
      return {
        details: fallbackData.pane_details as PaneDetails | null,
        totalQuantity: Number(fallbackData.quantity) || 0,
      };
    }
  }

  if (!data) {
    return { details: null, totalQuantity: 0 };
  }

  return {
    details: data.pane_details as PaneDetails | null,
    totalQuantity: Number(data.quantity) || 0,
  };
};

export const getClientPaneDetailsForAddresses = async (
  clientId: string,
  jobTypeId: string,
  addressIds: string[]
): Promise<Array<{ addressId: string; details: PaneDetails | null; totalQuantity: number }>> => {
  const results = await Promise.all(
    addressIds.map(async (addressId) => {
      const result = await getClientPaneDetails(clientId, jobTypeId, addressId);
      return { addressId, ...result };
    })
  );
  return results;
};

export const saveClientPaneDetails = async (
  clientId: string,
  jobTypeId: string,
  organizationId: string,
  details: PaneDetails,
  addressId?: string | null
): Promise<void> => {
  const totalQuantity = computePaneTotal(details, undefined);

  let existingQuery = supabase
    .from('client_unit_quantities')
    .select('id')
    .eq('client_id', clientId)
    .eq('job_type_id', jobTypeId);

  if (addressId) {
    existingQuery = existingQuery.eq('address_id', addressId);
  } else {
    existingQuery = existingQuery.is('address_id', null);
  }

  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    await supabase
      .from('client_unit_quantities')
      .update({ quantity: totalQuantity, pane_details: details, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase.from('client_unit_quantities').insert({
      client_id: clientId,
      job_type_id: jobTypeId,
      organization_id: organizationId,
      quantity: totalQuantity,
      pane_details: details,
      address_id: addressId || null,
    });
  }
};

const WINDOW_KEYWORDS = /window|cleaning|interior|exterior|pane|glass|squeegee/i;
const GUTTER_KEYWORDS = /gutter|fascia|downspout/i;

export function isWindowRelatedJob(jobType: { unit_of_measure: string; name: string }): boolean {
  if (jobType.unit_of_measure === 'pane') return true;
  return WINDOW_KEYWORDS.test(jobType.name);
}

export function isGutterRelatedJob(jobType: { unit_of_measure: string; name: string }): boolean {
  if (jobType.unit_of_measure === 'linear_ft') return GUTTER_KEYWORDS.test(jobType.name);
  return GUTTER_KEYWORDS.test(jobType.name);
}

const LABEL_TO_PANE_KEY: Record<string, keyof PaneDetails> = {
  'standard exterior': 'standard_exterior',
  'standard interior': 'standard_interior',
  'standard divisional': 'standard_divisional',
  'french exterior': 'french_exterior',
  'french interior': 'french_interior',
  'french divisional': 'french_divisional',
  'french panes': 'french_exterior',
  'storm exterior': 'storm_exterior',
  'storm interior': 'storm_interior',
  'storm windows': 'storm_exterior',
  exterior: 'standard_exterior',
  interior: 'standard_interior',
  standard: 'standard_exterior',
  french: 'french_exterior',
  storm: 'storm_exterior',
};

export function buildPaneDetailsFromPropertyQualities(
  qualities: Array<{ label: string; unit_type: string; quantity: number }>
): PaneDetails | null {
  const paneQualities = qualities.filter(q => q.unit_type === 'pane');
  if (paneQualities.length === 0) return null;

  const details: PaneDetails = {
    standard_exterior: 0,
    standard_interior: 0,
    standard_divisional: 0,
    french_exterior: 0,
    french_interior: 0,
    french_divisional: 0,
    storm_exterior: 0,
    storm_interior: 0,
    skylights_exterior: 0,
    skylights_interior: 0,
    commercial_exterior: 0,
    commercial_interior: 0,
  };

  let hasAny = false;
  for (const q of paneQualities) {
    if (q.quantity <= 0) continue;
    const normalized = q.label.toLowerCase().trim();
    let paneKey: keyof PaneDetails | undefined;
    for (const [pattern, key] of Object.entries(LABEL_TO_PANE_KEY)) {
      if (normalized.includes(pattern)) {
        paneKey = key;
        break;
      }
    }
    if (!paneKey) {
      paneKey = 'standard_exterior';
    }
    details[paneKey] = (details[paneKey] || 0) + q.quantity;
    hasAny = true;
  }

  return hasAny ? details : null;
}

export const getClientJobQuantity = async (
  clientId: string,
  jobTypeId: string,
  paneFilter?: PaneTypeFilter
): Promise<number> => {
  const { data: unitData } = await supabase
    .from('client_unit_quantities')
    .select('quantity, pane_details')
    .eq('client_id', clientId)
    .eq('job_type_id', jobTypeId)
    .maybeSingle();

  if (unitData) {
    if (paneFilter && unitData.pane_details) {
      return computePaneTotal(unitData.pane_details as PaneDetails, paneFilter);
    }
    return Number(unitData.quantity) || 0;
  }

  const { data, error } = await supabase
    .from('client_job_quantities')
    .select('quantity')
    .eq('client_id', clientId)
    .eq('job_type_id', jobTypeId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching client job quantity:', error);
    return 0;
  }

  return data?.quantity || 0;
};

export const saveScheduleEventTeamMembers = async (
  scheduleEventId: string,
  organizationId: string,
  memberIds: string[]
): Promise<void> => {
  await supabase
    .from('schedule_event_team_members')
    .delete()
    .eq('schedule_event_id', scheduleEventId);

  if (memberIds.length > 0) {
    const assignments = memberIds.map((memberId) => ({
      schedule_event_id: scheduleEventId,
      member_id: memberId,
      organization_id: organizationId,
    }));

    const { error } = await supabase
      .from('schedule_event_team_members')
      .insert(assignments);

    if (error) {
      console.error('Error saving team member assignments:', error);
      throw error;
    }
  }
};

export const getScheduleEventTeamMembers = async (
  scheduleEventId: string
): Promise<string[]> => {
  const { data, error } = await supabase
    .from('schedule_event_team_members')
    .select('member_id')
    .eq('schedule_event_id', scheduleEventId);

  if (error) {
    console.error('Error fetching schedule event team members:', error);
    return [];
  }

  return data?.map((d) => d.member_id) || [];
};
