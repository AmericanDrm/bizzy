export type ServiceScope = 'full_service' | 'exterior_only' | 'interior_only';

export type PaneType = 'standard' | 'french' | 'storm' | 'skylights' | 'commercial' | string;

export interface PaneTypeSplitConfig {
  exteriorSplitPercent: number | null;
  pricePerPane: number | null;
}

export interface PaneJobType {
  id: string;
  name: string;
  hourly_rate: number;
  exterior_split_percent: number | null;
  exterior_split_percent_standard: number | null;
  exterior_split_percent_french: number | null;
  exterior_split_percent_storm: number | null;
  exterior_split_percent_skylights: number | null;
  interior_split_percent: number | null;
  interior_split_percent_standard: number | null;
  interior_split_percent_french: number | null;
  interior_split_percent_storm: number | null;
  interior_split_percent_skylights: number | null;
  price_per_pane_standard: number | null;
  price_per_pane_french: number | null;
  price_per_pane_storm: number | null;
  price_per_pane_skylights: number | null;
  unit_of_measure: string;
  is_flat_rate: boolean;
}

export function getExteriorSplitForPaneType(
  jobType: Partial<PaneJobType>,
  paneType: PaneType,
): number {
  let pct: number | null = null;
  if (paneType === 'standard') pct = jobType.exterior_split_percent_standard ?? null;
  else if (paneType === 'french') pct = jobType.exterior_split_percent_french ?? null;
  else if (paneType === 'storm') pct = jobType.exterior_split_percent_storm ?? null;
  else if (paneType === 'skylights') pct = jobType.exterior_split_percent_skylights ?? null;
  else {
    const key = `exterior_split_percent_${paneType}` as keyof PaneJobType;
    pct = (jobType as any)[key] ?? null;
  }

  if (pct === null) pct = jobType.exterior_split_percent ?? null;
  return pct ?? 60;
}

export function getInteriorSplitForPaneType(
  jobType: Partial<PaneJobType>,
  paneType: PaneType,
): number {
  let pct: number | null = null;
  if (paneType === 'standard') pct = jobType.interior_split_percent_standard ?? null;
  else if (paneType === 'french') pct = jobType.interior_split_percent_french ?? null;
  else if (paneType === 'storm') pct = jobType.interior_split_percent_storm ?? null;
  else if (paneType === 'skylights') pct = jobType.interior_split_percent_skylights ?? null;
  else {
    const key = `interior_split_percent_${paneType}` as keyof PaneJobType;
    pct = (jobType as any)[key] ?? null;
  }

  if (pct === null) pct = jobType.interior_split_percent ?? null;
  if (pct !== null) return pct;

  const extPct = getExteriorSplitForPaneType(jobType, paneType);
  return 100 - extPct;
}

export function getPriceForPaneType(
  jobType: Partial<PaneJobType>,
  paneType: PaneType,
): number {
  let price: number | null = null;
  if (paneType === 'standard') price = jobType.price_per_pane_standard ?? null;
  else if (paneType === 'french') price = jobType.price_per_pane_french ?? null;
  else if (paneType === 'storm') price = jobType.price_per_pane_storm ?? null;
  else if (paneType === 'skylights') price = jobType.price_per_pane_skylights ?? null;
  else {
    const key = `price_per_pane_${paneType}` as keyof PaneJobType;
    price = (jobType as any)[key] ?? null;
  }

  return price ?? 0;
}

export function getEffectivePanePriceForType(
  jobType: Partial<PaneJobType>,
  paneType: PaneType,
  scope: ServiceScope,
): number {
  const basePrice = getPriceForPaneType(jobType, paneType);
  if (scope === 'full_service') return basePrice;
  if (scope === 'exterior_only') {
    const extPct = getExteriorSplitForPaneType(jobType, paneType);
    return basePrice * (extPct / 100);
  }
  if (scope === 'interior_only') {
    const intPct = getInteriorSplitForPaneType(jobType, paneType);
    return basePrice * (intPct / 100);
  }
  return basePrice;
}

export function getEffectivePanePrice(
  basePrice: number,
  exteriorSplitPercent: number | null,
  scope: ServiceScope,
  interiorSplitPercent?: number | null,
): number {
  if (scope === 'full_service') return basePrice;
  if (scope === 'exterior_only') {
    const extPct = exteriorSplitPercent ?? 60;
    return basePrice * (extPct / 100);
  }
  if (scope === 'interior_only') {
    const intPct = interiorSplitPercent ?? (100 - (exteriorSplitPercent ?? 60));
    return basePrice * (intPct / 100);
  }
  return basePrice;
}

export function getEffectivePanePriceFromJobType(
  jobType: Partial<PaneJobType>,
  scope: ServiceScope,
  paneType?: PaneType,
): number {
  if (paneType) {
    return getEffectivePanePriceForType(jobType, paneType, scope);
  }
  const basePrice = jobType.hourly_rate ?? 0;
  return getEffectivePanePrice(basePrice, jobType.exterior_split_percent ?? null, scope, jobType.interior_split_percent ?? null);
}

const BASE_PANE_TYPES = ['standard', 'french', 'storm', 'skylights', 'commercial'] as const;

export function normalizePaneDetails(
  paneDetails: Record<string, number> | null | undefined,
  fallbackQuantity?: number,
): Record<string, number> | null {
  if (!paneDetails || typeof paneDetails !== 'object') return null;
  const hasDirectional = Object.keys(paneDetails).some(
    k => k.endsWith('_exterior') || k.endsWith('_interior') || k.endsWith('_divisional'),
  );
  if (!hasDirectional) {
    const cleaned: Record<string, number> = {};
    for (const [k, v] of Object.entries(paneDetails)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) cleaned[k] = n;
    }
    return Object.keys(cleaned).length > 0 ? cleaned : null;
  }
  const out: Record<string, number> = {};
  let sum = 0;
  for (const bt of BASE_PANE_TYPES) {
    const modern = Number(paneDetails[bt]) || 0;
    const ext = Number(paneDetails[`${bt}_exterior`]) || 0;
    const intr = Number(paneDetails[`${bt}_interior`]) || 0;
    const div = Number(paneDetails[`${bt}_divisional`]) || 0;
    const val = modern > 0 ? modern : Math.max(ext, intr) + div;
    if (val > 0) {
      out[bt] = val;
      sum += val;
    }
  }
  if (typeof fallbackQuantity === 'number' && fallbackQuantity >= 0 && sum !== fallbackQuantity) {
    return fallbackQuantity > 0 ? { standard: fallbackQuantity } : null;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function getClientPaneCount(
  clientUnitQuantities: any[],
  jobTypeId: string,
  addressId?: string | null,
): number {
  const resolvedAddressId = addressId && addressId.trim() !== '' ? addressId : null;
  if (clientUnitQuantities?.length) {
    if (resolvedAddressId) {
      const addressMatch = clientUnitQuantities.find(
        (q: any) => q.job_type_id === jobTypeId && q.address_id === resolvedAddressId,
      );
      if (addressMatch) return Number(addressMatch.quantity) || 1;
    }
    const match = clientUnitQuantities.find(
      (q: any) => q.job_type_id === jobTypeId && !q.address_id,
    );
    if (match) return Number(match.quantity) || 1;
  }
  return 1;
}

export function formatPricingSplitLabel(
  basePrice: number,
  exteriorSplitPercent: number | null,
  scope?: ServiceScope,
  interiorSplitPercent?: number | null,
): string {
  const extPct = exteriorSplitPercent ?? 60;
  const intPct = interiorSplitPercent ?? (100 - extPct);
  const extPrice = basePrice * (extPct / 100);
  const intPrice = basePrice * (intPct / 100);

  if (scope === 'exterior_only') {
    return `Ext: ${extPct}% ($${extPrice.toFixed(2)}/pane)`;
  }
  if (scope === 'interior_only') {
    return `Int: ${intPct}% ($${intPrice.toFixed(2)}/pane)`;
  }
  return `${extPct}% ext / ${intPct}% int`;
}

export const SERVICE_SCOPE_OPTIONS: { value: ServiceScope; label: string }[] = [
  { value: 'full_service', label: 'Full Service' },
  { value: 'exterior_only', label: 'Exterior Only' },
];

export const PANE_TYPES: { value: PaneType; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'french', label: 'French' },
  { value: 'storm', label: 'Storm' },
  { value: 'skylights', label: 'Skylights' },
  { value: 'commercial', label: 'Commercial' },
];

export function calculateMixedPaneTotal(
  paneDetails: Record<string, number> | null | undefined,
  jobType: Partial<PaneJobType>,
  scope: ServiceScope,
): number {
  if (!paneDetails || Object.keys(paneDetails).length === 0) return 0;
  return Object.entries(paneDetails).reduce((sum, [paneType, count]) => {
    if (!count || count <= 0) return sum;
    const price = getEffectivePanePriceForType(jobType, paneType as PaneType, scope);
    return sum + count * price;
  }, 0);
}

export function hasMixedPaneTypes(paneDetails: Record<string, number> | null | undefined): boolean {
  if (!paneDetails) return false;
  const entries = Object.entries(paneDetails).filter(([, v]) => v > 0);
  return entries.length > 1;
}

export function hasSplitPaneDetails(paneDetails: Record<string, number> | null | undefined): boolean {
  if (!paneDetails) return false;
  return Object.keys(paneDetails).some(k => k.endsWith('_exterior') || k.endsWith('_interior'));
}

export function getPaneTypesFromSplitDetails(paneDetails: Record<string, number>): string[] {
  const types = new Set<string>();
  for (const key of Object.keys(paneDetails)) {
    if (key.endsWith('_exterior')) types.add(key.replace('_exterior', ''));
    else if (key.endsWith('_interior')) types.add(key.replace('_interior', ''));
  }
  return Array.from(types);
}

export function calculateSplitPaneTotal(
  paneDetails: Record<string, number> | null | undefined,
  jobType: Partial<PaneJobType>,
  scope: ServiceScope = 'full_service',
): number {
  if (!paneDetails || Object.keys(paneDetails).length === 0) return 0;
  const paneTypes = getPaneTypesFromSplitDetails(paneDetails);
  let total = 0;
  for (const pt of paneTypes) {
    const extCount = Number(paneDetails[`${pt}_exterior`]) || 0;
    const basePrice = getPriceForPaneType(jobType, pt as PaneType);
    const extPct = getExteriorSplitForPaneType(jobType, pt as PaneType);

    if (scope === 'exterior_only') {
      total += extCount * basePrice * (extPct / 100);
    } else if (scope === 'interior_only') {
      const intPct = getInteriorSplitForPaneType(jobType, pt as PaneType);
      total += extCount * basePrice * (intPct / 100);
    } else {
      // full_service: all exterior panes cleaned on both sides
      total += extCount * basePrice;
    }
  }
  return total;
}

export function calculateSplitPaneTotalWithClientPrices(
  paneDetails: Record<string, number> | null | undefined,
  jobType: Partial<PaneJobType>,
  clientPaneTypePrices: ClientPaneTypePriceEntry[],
  jobTypeId: string,
  addressId?: string | null,
  scope: ServiceScope = 'full_service',
): number {
  if (!paneDetails || Object.keys(paneDetails).length === 0) return 0;
  const paneTypes = getPaneTypesFromSplitDetails(paneDetails);
  let total = 0;
  let flatRateAccumulator = 0;
  let hasFlatRate = false;

  for (const pt of paneTypes) {
    const extCount = Number(paneDetails[`${pt}_exterior`]) || 0;
    const intCount = Math.min(Number(paneDetails[`${pt}_interior`]) || 0, extCount);

    const clientEntry = getClientPriceForPaneType(clientPaneTypePrices, jobTypeId, pt, addressId);

    if (clientEntry?.price_mode === 'flat_rate' && clientEntry.flat_rate_amount != null) {
      flatRateAccumulator += clientEntry.flat_rate_amount;
      hasFlatRate = true;
      continue;
    }

    let basePrice: number;
    if (clientEntry?.price_mode === 'per_pane' && clientEntry.price_per_pane != null) {
      basePrice = clientEntry.price_per_pane;
    } else {
      basePrice = getPriceForPaneType(jobType, pt as PaneType);
    }

    const extPct = getExteriorSplitForPaneType(jobType, pt as PaneType);

    if (scope === 'exterior_only') {
      total += extCount * basePrice * (extPct / 100);
    } else if (scope === 'interior_only') {
      const intPct = getInteriorSplitForPaneType(jobType, pt as PaneType);
      total += extCount * basePrice * (intPct / 100);
    } else {
      // full_service: all exterior panes cleaned on both sides
      total += extCount * basePrice;
    }
  }

  return total + (hasFlatRate ? flatRateAccumulator : 0);
}

export function hasPerTypePricing(jobType: Partial<PaneJobType>, paneDetails: Record<string, number> | null | undefined): boolean {
  if (!paneDetails || !hasMixedPaneTypes(paneDetails)) return false;
  const types = Object.keys(paneDetails).filter(k => (paneDetails[k] ?? 0) > 0);
  const prices = types.map(t => getPriceForPaneType(jobType, t as PaneType));
  return prices.some(p => p !== prices[0]);
}

export interface ClientPaneTypePriceEntry {
  job_type_id: string;
  pane_type_key: string;
  price_mode: 'per_pane' | 'flat_rate';
  price_per_pane: number | null;
  flat_rate_amount: number | null;
  address_id?: string | null;
}

export function getClientPriceForPaneType(
  clientPaneTypePrices: ClientPaneTypePriceEntry[],
  jobTypeId: string,
  paneTypeKey: string,
  addressId?: string | null,
): ClientPaneTypePriceEntry | null {
  if (!clientPaneTypePrices?.length) return null;
  const resolvedAddressId = addressId && addressId.trim() !== '' ? addressId : null;
  if (resolvedAddressId) {
    const addrMatch = clientPaneTypePrices.find(
      p => p.job_type_id === jobTypeId && p.pane_type_key === paneTypeKey && p.address_id === resolvedAddressId,
    );
    if (addrMatch) return addrMatch;
  }
  const globalMatch = clientPaneTypePrices.find(
    p => p.job_type_id === jobTypeId && p.pane_type_key === paneTypeKey && !p.address_id,
  );
  return globalMatch ?? null;
}

export function getEffectivePanePriceWithClientOverride(
  jobType: Partial<PaneJobType>,
  paneType: PaneType,
  scope: ServiceScope,
  clientPaneTypePrices: ClientPaneTypePriceEntry[],
  jobTypeId: string,
  addressId?: string | null,
): { price: number; isFlatRate: boolean } {
  const clientEntry = getClientPriceForPaneType(clientPaneTypePrices, jobTypeId, paneType, addressId);

  if (clientEntry) {
    if (clientEntry.price_mode === 'flat_rate' && clientEntry.flat_rate_amount != null) {
      return { price: clientEntry.flat_rate_amount, isFlatRate: true };
    }
    if (clientEntry.price_mode === 'per_pane' && clientEntry.price_per_pane != null) {
      const basePrice = clientEntry.price_per_pane;
      if (scope === 'exterior_only') {
        const extPct = getExteriorSplitForPaneType(jobType, paneType);
        return { price: basePrice * (extPct / 100), isFlatRate: false };
      }
      if (scope === 'interior_only') {
        const intPct = getInteriorSplitForPaneType(jobType, paneType);
        return { price: basePrice * (intPct / 100), isFlatRate: false };
      }
      return { price: basePrice, isFlatRate: false };
    }
  }

  return { price: getEffectivePanePriceForType(jobType, paneType, scope), isFlatRate: false };
}

export function calculateMixedPaneTotalWithClientPrices(
  paneDetails: Record<string, number> | null | undefined,
  jobType: Partial<PaneJobType>,
  scope: ServiceScope,
  clientPaneTypePrices: ClientPaneTypePriceEntry[],
  jobTypeId: string,
  addressId?: string | null,
): number {
  if (!paneDetails || Object.keys(paneDetails).length === 0) return 0;

  let total = 0;
  let flatRateAccumulator = 0;
  let hasFlatRate = false;

  for (const [paneType, count] of Object.entries(paneDetails)) {
    if (!count || count <= 0) continue;
    const { price, isFlatRate } = getEffectivePanePriceWithClientOverride(
      jobType, paneType as PaneType, scope, clientPaneTypePrices, jobTypeId, addressId,
    );
    if (isFlatRate) {
      flatRateAccumulator += price;
      hasFlatRate = true;
    } else {
      total += count * price;
    }
  }

  return total + (hasFlatRate ? flatRateAccumulator : 0);
}
