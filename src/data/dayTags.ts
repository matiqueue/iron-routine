import { DayBannerTag, DayPlan, MuscleCategory } from '../types/workout';

export interface DayBannerTagMeta {
  id: DayBannerTag;
  label: string;
  shortLabel: string;
  badge: string;
  icon: string;
}

export const DAY_BANNER_TAG_OPTIONS: DayBannerTagMeta[] = [
  { id: 'fbw', label: 'FBW / Całe ciało', shortLabel: 'FBW', badge: 'FULL BODY', icon: 'barbell-outline' },
  { id: 'push', label: 'Push / Wypychanie', shortLabel: 'Push', badge: 'PUSH BLOCK', icon: 'flash-outline' },
  { id: 'pull', label: 'Pull / Przyciąganie', shortLabel: 'Pull', badge: 'PULL BLOCK', icon: 'git-pull-request-outline' },
  { id: 'legs', label: 'Nogi / Legs', shortLabel: 'Nogi', badge: 'LOWER BODY', icon: 'fitness-outline' },
  { id: 'upper', label: 'Góra / Upper', shortLabel: 'Upper', badge: 'UPPER BODY', icon: 'body-outline' },
  { id: 'lower', label: 'Dół / Lower', shortLabel: 'Lower', badge: 'LOWER SPLIT', icon: 'walk-outline' },
  { id: 'chest', label: 'Klatka piersiowa', shortLabel: 'Klatka', badge: 'CHEST FOCUS', icon: 'shield-outline' },
  { id: 'back', label: 'Plecy', shortLabel: 'Plecy', badge: 'BACK FOCUS', icon: 'layers-outline' },
  { id: 'shoulders', label: 'Barki', shortLabel: 'Barki', badge: 'DELTS FOCUS', icon: 'triangle-outline' },
  { id: 'arms', label: 'Ramiona (Bic/Tric)', shortLabel: 'Ramiona', badge: 'ARM DAY', icon: 'flame-outline' },
  { id: 'cardio', label: 'Cardio / Bieganie', shortLabel: 'Cardio', badge: 'CONDITIONING', icon: 'pulse-outline' },
  { id: 'rest', label: 'Odpoczynek / Rest', shortLabel: 'Rest', badge: 'RECOVERY', icon: 'moon-outline' },
];

const VALID_TAGS = new Set<DayBannerTag>(DAY_BANNER_TAG_OPTIONS.map((t) => t.id));

export function isValidDayBannerTag(tag: unknown): tag is DayBannerTag {
  return typeof tag === 'string' && VALID_TAGS.has(tag as DayBannerTag);
}

export function getDayBannerTagMeta(tag: DayBannerTag): DayBannerTagMeta {
  return DAY_BANNER_TAG_OPTIONS.find((item) => item.id === tag) || DAY_BANNER_TAG_OPTIONS[0];
}

export function resolveDayBannerTag(day: Pick<DayPlan, 'type' | 'name' | 'subtitle' | 'bannerTag' | 'exercises'>): DayBannerTag {
  if (isValidDayBannerTag(day.bannerTag)) {
    return day.bannerTag;
  }

  if (day.type === 'rest') return 'rest';
  if (day.type === 'walk') return 'cardio';

  const text = `${day.name || ''} ${day.subtitle || ''}`.toLowerCase();

  if (/\bfull\s*body\b|\bfbw\b|\bfbeod\b|\bcałe ciało\b|\bcale cialo\b/.test(text)) {
    return 'fbw';
  }
  if (/\bpush\b|\bwypychanie\b/.test(text)) return 'push';
  if (/\bpull\b|\bprzyciąganie\b|\bprzyciaganie\b/.test(text)) return 'pull';
  if (/\bupper\b|\bgóra\b|\bgora\b/.test(text)) return 'upper';
  if (/\blower\b|\bdół\b|\bdol\b/.test(text)) return 'lower';
  if (/\bbiegan|\bcardio\b|\binterwa|\bspacer\b|\bsprint\b/.test(text)) return 'cardio';
  if (/\bregeneracj|\bodpoczyn|\brest\b|\bdeload\b/.test(text)) return 'rest';
  if (/\bleg|\bnog|\buda\b|\bpoślad|\bposlad|\bczworog/.test(text)) return 'legs';
  if (/\bklat|\bchest\b/.test(text)) return 'chest';
  if (/\bplec|\bback\b/.test(text)) return 'back';
  if (/\bbark|\bdelts|\bshoulder/.test(text)) return 'shoulders';
  if (/\bramion|\bbicep|\btrice|\barm/.test(text)) return 'arms';

  const exercises = day.exercises || [];
  if (exercises.length > 0) {
    const counts: Partial<Record<MuscleCategory, number>> = {};
    for (const ex of exercises) {
      counts[ex.category] = (counts[ex.category] || 0) + 1;
    }
    const distinctMajor = (['klatka', 'plecy', 'nogi', 'barki'] as MuscleCategory[]).filter(
      (cat) => (counts[cat] || 0) > 0
    );
    if (distinctMajor.length >= 3 && (counts.nogi || 0) > 0) {
      return 'fbw';
    }
    const topCategory = Object.entries(counts).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0]?.[0] as MuscleCategory | undefined;
    switch (topCategory) {
      case 'klatka':
        return 'chest';
      case 'plecy':
        return 'back';
      case 'nogi':
        return 'legs';
      case 'barki':
        return 'shoulders';
      case 'ramiona':
        return 'arms';
      case 'ogolne':
        return 'cardio';
      default:
        break;
    }
  }

  return 'fbw';
}
