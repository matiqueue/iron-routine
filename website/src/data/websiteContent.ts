export const GITHUB_REPO = 'https://github.com/matiqueue/iron-routine';
export const CONTRIBUTOR_URL = 'https://github.com/matiqueue';
export const BUY_ME_COFFEE_URL = 'https://matiqueue-portfolio.vercel.app';
export const APK_DOWNLOAD_URL =
  'https://github.com/matiqueue/iron-routine/releases/latest/download/IronRoutine.apk';
export const RELEASES_URL = 'https://github.com/matiqueue/iron-routine/releases';
export const APP_VERSION = 'v1.0.1';
export const EXPO_VERSION_LABEL = 'Expo SDK 58';
export const RN_VERSION_LABEL = 'React Native 0.88';

export type PlatformTab = 'android' | 'ios';
export type ShowcaseScreen = 'workout' | 'progress' | 'health';
export type ChartTimeframe = '7d' | '30d' | 'all';

export interface SplinePointData {
  label: string;
  value: number;
  weight: number;
  reps: number;
}

export const HERO_SPECS = [
  '100% Offline (AsyncStorage + JSON)',
  'Jeden Profil i Wiele Planow (Wspolne PR)',
  'Apple Health i Health Connect',
  'Alarm Przerw + Live Activities',
] as const;

export const SPLINE_SERIES: Record<ChartTimeframe, SplinePointData[]> = {
  '7d': [
    { label: '08.11', value: 111, weight: 95, reps: 5 },
    { label: '10.11', value: 114, weight: 97.5, reps: 5 },
    { label: '12.11', value: 117, weight: 100, reps: 5 },
    { label: '14.11', value: 116, weight: 102.5, reps: 4 },
  ],
  '30d': [
    { label: '16.10', value: 105, weight: 87.5, reps: 6 },
    { label: '22.10', value: 108, weight: 90, reps: 6 },
    { label: '29.10', value: 108, weight: 92.5, reps: 5 },
    { label: '05.11', value: 111, weight: 95, reps: 5 },
    { label: '10.11', value: 114, weight: 97.5, reps: 5 },
    { label: '14.11', value: 120, weight: 102.5, reps: 5 },
  ],
  all: [
    { label: 'Sie', value: 93, weight: 77.5, reps: 6 },
    { label: 'Wrz', value: 99, weight: 82.5, reps: 6 },
    { label: 'Paz', value: 105, weight: 90, reps: 5 },
    { label: 'Lis', value: 120, weight: 102.5, reps: 5 },
  ],
};

export interface WorkoutSetPreview {
  exercise: string;
  series: number;
  target: string;
  restSeconds: number;
  done: boolean;
}

export const WORKOUT_SETS: readonly WorkoutSetPreview[] = [
  { exercise: 'Wyciskanie Sztangi Plasko', series: 1, target: '102.5 kg x 5', restSeconds: 180, done: true },
  { exercise: 'Wyciskanie Sztangi Plasko', series: 2, target: '102.5 kg x 5', restSeconds: 180, done: false },
  { exercise: 'Podciaganie Szeroko', series: 1, target: '+20 kg x 6', restSeconds: 120, done: false },
  { exercise: 'Wyciskanie Hantli Skos', series: 1, target: '36 kg x 8', restSeconds: 120, done: false },
];

export const PLAN_PREVIEW = [
  { name: 'FBEOD Klatka / Plecy / Nogi', tag: 'FBEOD • 3-4 dni/tyg.', active: true },
  { name: 'Upper / Lower Sila 4D', tag: '4 dni • Aktywuj jednym kliknieciem', active: false },
  { name: 'Push / Pull / Legs Hypertrophy', tag: '6 dni • Wspolna historia 1RM', active: false },
] as const;

export const SUPPLEMENTS_PREVIEW = [
  { name: 'Kreatyna Monohydrat', dose: '0.07 g / kg (~6.0 g)', active: true },
  { name: 'Cytrulina + Beta-Alanina', dose: 'Pre-workout', active: false },
  { name: 'Witamina D3 + Omega-3', dose: 'Rano po posilku', active: true },
] as const;

export const TRAINING_ZONES = [
  { label: 'Strefa Sily', range: '1-5 powt.', formula: 'W x (1 + R / 30)', active: true },
  { label: 'Hipertrofia', range: '6-12 powt.', formula: 'W x (1 + R / 30)', active: false },
  { label: 'Wytrzymalosc', range: '13+ powt.', formula: 'Obj. + czas pracy', active: false },
] as const;

export const IOS_PREREQUISITES = [
  {
    title: 'Komputer Mac + Xcode (wymagane)',
    detail:
      'Apple nie zezwala na kompilacje aplikacji z Live Activities (WidgetKit) i Apple HealthKit spod Windowsa ani Linuksa. Potrzebujesz dowolnego Maca z aktualnym Xcode z Mac App Store.',
  },
  {
    title: 'Tryb Dewelopera na iPhone',
    detail:
      'Na telefonie wejdz w Ustawienia > Prywatnosc i ochrona > Tryb dewelopera, wlacz go i zrestartuj iPhonea. Podlacz go kablem USB-C / Lightning do Maca i kliknij "Zaufaj".',
  },
  {
    title: 'Darmowe konto Apple ID (7-dniowy podpis)',
    detail:
      'Nie potrzebujesz platnego konta Developer ($99). W Xcode > Settings > Accounts zaloguj darmowe Apple ID (Personal Team). Po wgraniu zaufaj certyfikatowi w Ustawienia > Ogolne > VPN i zarzadzanie urzadzeniami (co 7 dni wystarczy kliknac Rebuild).',
  },
] as const;

export const IOS_COMMANDS = [
  'git clone https://github.com/matiqueue/iron-routine.git && cd iron-routine',
  'npm install && open ios/IronRoutine.xcworkspace # ustaw swoj Personal Team w Signing & Capabilities',
  'npm run deploy # buduje Release prosto na podpiety po USB iPhone',
] as const;

export const ANDROID_STEPS = [
  {
    step: '01',
    title: 'Pobierz plik instalacyjny .apk',
    detail: 'Kliknij przycisk "Pobierz APK (Android)" i zapisz najnowsze wydanie bezposrednio z GitHub Releases.',
  },
  {
    step: '02',
    title: 'Zezwol na instalacje z przegladarki',
    detail: 'Android poprosi o jednorazowa zgode "Instaluj nieznane aplikacje" dla Chrome lub Plikow.',
  },
  {
    step: '03',
    title: 'Polacz Health Connect i odpal trening',
    detail: 'Skonfiguruj profil startowy, suplementy i zezwol na powiadomienia przerw na ekranie blokady.',
  },
] as const;

export function calculate1RM(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || weight <= 0) return 0;
  if (!Number.isFinite(reps) || reps <= 1) return Math.round(weight);
  return Math.round(weight * (1 + reps / 30));
}

export function formatRestTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
