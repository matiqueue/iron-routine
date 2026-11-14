import { SupplementDosingMode, SupplementItem } from '../types/workout';

export const DEFAULT_SUPPLEMENTS: SupplementItem[] = [
  {
    id: 'supp_creatine',
    name: 'Kreatyna Monohydrat',
    enabled: true,
    dosingMode: 'per_kg',
    recommendedText: '3–5 g / dzień (ok. 0.05 g/kg m.c.)',
    perKgGrams: 0.05,
    fixedAmountText: '4 g',
    timing: 'anytime',
  },
  {
    id: 'supp_whey',
    name: 'Białko WPC / WPI',
    enabled: false,
    dosingMode: 'recommended',
    recommendedText: '1 porcja wg braków w diecie',
    fixedAmountText: '30 g',
    timing: 'post_workout',
  },
  {
    id: 'supp_vitd',
    name: 'Witamina D3 + K2',
    enabled: false,
    dosingMode: 'recommended',
    recommendedText: '2000–4000 IU dziennie',
    fixedAmountText: '2000 IU',
    timing: 'morning',
  },
  {
    id: 'supp_magnesium',
    name: 'Magnez + B6',
    enabled: false,
    dosingMode: 'recommended',
    recommendedText: '300–400 mg przed snem',
    fixedAmountText: '350 mg',
    timing: 'evening',
  },
  {
    id: 'supp_omega3',
    name: 'Omega-3 (EPA/DHA)',
    enabled: false,
    dosingMode: 'recommended',
    recommendedText: '1000–2000 mg dziennie',
    fixedAmountText: '1000 mg',
    timing: 'morning',
  },
  {
    id: 'supp_citrulline',
    name: 'Cytrulina',
    enabled: false,
    dosingMode: 'recommended',
    recommendedText: '6–8 g przed treningiem',
    fixedAmountText: '6 g',
    timing: 'pre_workout',
  },
  {
    id: 'supp_electrolytes',
    name: 'Elektrolity',
    enabled: false,
    dosingMode: 'recommended',
    recommendedText: '1 porcja w trakcie treningu',
    fixedAmountText: '1 porcja',
    timing: 'pre_workout',
  },
];

export function mergeWithDefaultSupplements(saved?: SupplementItem[] | null): SupplementItem[] {
  if (!Array.isArray(saved) || saved.length === 0) {
    return DEFAULT_SUPPLEMENTS.map((s) => ({ ...s }));
  }

  const byId = new Map(saved.map((item) => [item.id, item]));
  const mergedDefaults = DEFAULT_SUPPLEMENTS.map((def) => {
    const existing = byId.get(def.id);
    if (!existing) return { ...def };
    return {
      ...def,
      ...existing,
      recommendedText: existing.recommendedText || def.recommendedText,
    };
  });

  const defaultIds = new Set(DEFAULT_SUPPLEMENTS.map((d) => d.id));
  const customOnes = saved
    .filter((item) => !defaultIds.has(item.id) && item.name?.trim())
    .map((item) => ({
      ...item,
      isCustom: true,
      recommendedText: item.recommendedText || 'Wg indywidualnego zapotrzebowania',
    }));

  return [...mergedDefaults, ...customOnes];
}

export function formatSupplementDose(item: SupplementItem, weightKg?: number): string {
  if (item.dosingMode === 'per_kg') {
    const ratio = item.perKgGrams && item.perKgGrams > 0 ? item.perKgGrams : 0.05;
    if (weightKg && weightKg > 25) {
      const computed = Math.round(weightKg * ratio * 10) / 10;
      const gramsStr = Number.isInteger(computed) ? `${computed}` : computed.toFixed(1);
      return `${gramsStr} g (${ratio} g/kg)`;
    }
    return `Zalecane (${ratio} g/kg m.c.)`;
  }

  if (item.dosingMode === 'fixed') {
    const clean = item.fixedAmountText?.trim();
    return clean ? clean : item.recommendedText;
  }

  return item.recommendedText || 'Zalecane';
}

export function buildActiveSupplementsSummary(
  supplements: SupplementItem[],
  weightKg?: number
): string {
  const active = supplements.filter((s) => s.enabled);
  if (active.length === 0) {
    return 'Brak wybranych suplementów';
  }
  if (active.length === 1) {
    return `${active[0].name} (${formatSupplementDose(active[0], weightKg)})`;
  }
  const primary = `${active[0].name} (${formatSupplementDose(active[0], weightKg)})`;
  return `${primary} + ${active.length - 1} inne`;
}

export function createCustomSupplement(params: {
  name: string;
  dosingMode: SupplementDosingMode;
  fixedAmountText?: string;
  perKgGrams?: number;
}): SupplementItem {
  const trimmedName = params.name.trim();
  const cleanFixed = params.fixedAmountText?.trim();
  const cleanPerKg =
    params.perKgGrams && !isNaN(params.perKgGrams) && params.perKgGrams > 0
      ? Math.round(params.perKgGrams * 100) / 100
      : 0.05;

  return {
    id: `supp_custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name: trimmedName,
    enabled: true,
    dosingMode: params.dosingMode,
    recommendedText: 'Wg indywidualnych zaleceń',
    perKgGrams: cleanPerKg,
    fixedAmountText: cleanFixed || undefined,
    timing: 'anytime',
    isCustom: true,
  };
}
