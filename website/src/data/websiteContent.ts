export const GITHUB_REPO = 'https://github.com/matiqueue/iron-routine';
export const CONTRIBUTOR_URL = 'https://github.com/matiqueue';
export const BUY_ME_COFFEE_URL = 'https://matiqueue-portfolio.vercel.app';
export const APK_DOWNLOAD_URL =
  'https://github.com/matiqueue/iron-routine/releases/latest/download/IronRoutine.apk';
export const RELEASES_URL = 'https://github.com/matiqueue/iron-routine/releases';
export const APP_VERSION = 'v2.0.0';
export const EXPO_VERSION_LABEL = 'Expo SDK 58';
export const RN_VERSION_LABEL = 'React Native 0.88';

export type AppRoute = '/' | '/funkcje' | '/analityka' | '/instalacja';
export type PlatformTab = 'android' | 'ios';
export type ShowcaseScreen = 'workout' | 'plans' | 'health';
export type ChartTimeframe = '7d' | '30d' | 'all';
export type DayArtTag = 'fbw' | 'pull' | 'legs' | 'shoulders' | 'cardio' | 'rest';

export interface NavItem {
  path: AppRoute;
  label: string;
  pageTitle: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/', label: 'Przegląd', pageTitle: 'Iron Routine v2.0.0 | Monochromatyczny Dziennik Treningowy' },
  { path: '/funkcje', label: 'Funkcje i UI', pageTitle: 'Funkcje i Interfejs | Iron Routine' },
  { path: '/analityka', label: 'Analityka 1RM', pageTitle: 'Analityka 1RM i Zdrowie | Iron Routine' },
  { path: '/instalacja', label: 'Instalacja', pageTitle: 'Instalacja iOS i Android | Iron Routine' },
] as const;

export interface SplinePointData {
  label: string;
  value: number;
  weight: number;
  reps: number;
}

export const HERO_METRICS = [
  { value: '100%', label: 'Offline (AsyncStorage + JSON)' },
  { value: '0 PLN', label: 'Zero kont, reklam i chmury' },
  { value: '1:N', label: 'Jeden profil, wiele planów PR' },
  { value: '0.1s', label: 'Pauza Dynamic Island i alarm' },
] as const;

export const PILLAR_LINKS = [
  {
    route: '/funkcje' as AppRoute,
    kicker: '01 / ERGONOMIA I SESJA',
    title: 'Konfigurator sesji, Live Activity i wspólne PR',
    desc: 'Przeciągaj ćwiczenia przed startem, zatrzymuj przerwę z pełną synchronizacją Dynamic Island i rotuj plany bez utraty historii.',
    cta: 'Zobacz symulator UI',
  },
  {
    route: '/analityka' as AppRoute,
    kicker: '02 / TELEMETRIA SIŁY',
    title: 'Silnik Epley 1RM, objętość i Apple Health',
    desc: 'Wykresy progresu 7d/30d/All, monitorowanie snu i kroków oraz elastyczne dawkowanie suplementów wg masy ciała g/kg.',
    cta: 'Testuj kalkulator 1RM',
  },
  {
    route: '/instalacja' as AppRoute,
    kicker: '03 / WDROŻENIE NA TELEFON',
    title: 'Sideload .APK lub bezpośredni build Xcode na iPhone',
    desc: 'Pełny poradnik włączenia Trybu Dewelopera na iOS, konfiguracji darmowego Apple ID Personal Team i szybkiego startu z terminala.',
    cta: 'Otwórz poradnik',
  },
] as const;

export const DAY_ART_OPTIONS: ReadonlyArray<{
  tag: DayArtTag;
  label: string;
  subtitle: string;
  setsNote: string;
}> = [
  {
    tag: 'fbw',
    label: 'FBW / Klatka',
    subtitle: 'Koncentryczne krążki olimpijskie i oś sztangi',
    setsNote: 'Tłoczenie płaskie, podciąganie, przysiady',
  },
  {
    tag: 'pull',
    label: 'Plecy / Pull',
    subtitle: 'Wektory V-taper i szczytowe spięcie grzbietu',
    setsNote: 'Ściąganie drążka, wiosłowanie T-Bar, RDL',
  },
  {
    tag: 'legs',
    label: 'Nogi / Squat',
    subtitle: 'Łuki siły dolnej połowy ciała i kąt przysiadu',
    setsNote: 'Wyprosty, uginania, prasa 45°, przywodziciele',
  },
  {
    tag: 'shoulders',
    label: 'Barki / Ramię',
    subtitle: 'Łuki napięcia naramiennych i izolacja ramion',
    setsNote: 'Wznosy na wyciągu, JM Press, modlitewnik',
  },
  {
    tag: 'cardio',
    label: 'Cardio / Interwał',
    subtitle: 'Linie toru wydolnościowego i wykres tętna',
    setsNote: 'Bieg tempowy, ergometr, kroki Apple Health',
  },
  {
    tag: 'rest',
    label: 'Regeneracja',
    subtitle: 'Spokojny horyzont snu, mobilności i odbudowy OUN',
    setsNote: 'Sen 8h+, spacer strefy 2, białko i kreatyna',
  },
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
    { label: 'Paź', value: 105, weight: 90, reps: 5 },
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
  { exercise: 'Pec Deck (Maszyna)', series: 1, target: '134 kg x 8', restSeconds: 180, done: true },
  { exercise: 'Incline Chest Press (Maszyna)', series: 1, target: '75 kg x 4', restSeconds: 150, done: false },
  { exercise: 'Wide Grip Lat Pulldown', series: 1, target: '101 kg x 6', restSeconds: 120, done: false },
  { exercise: 'JM Press', series: 1, target: '52 kg x 4', restSeconds: 120, done: false },
];

export const PLAN_PREVIEW = [
  { name: 'FBEOD Klatka / Plecy / Nogi', tag: 'FBEOD • 3-4 dni/tyg.', active: true },
  { name: 'Upper / Lower Siła 4D', tag: '4 dni • Wspólna historia PR', active: false },
  { name: 'Push / Pull / Legs 6D', tag: '6 dni • Kanoniczna baza', active: false },
] as const;

export const SUPPLEMENTS_PREVIEW = [
  { name: 'Kreatyna Monohydrat', perKg: 0.07, mode: 'perkg' as const, fixed: '6.0 g' },
  { name: 'Cytrulina + Beta-Alanina', perKg: 0, mode: 'fixed' as const, fixed: 'Pre-workout' },
  { name: 'Witamina D3 + Omega-3', perKg: 0, mode: 'fixed' as const, fixed: 'Rano po posiłku' },
] as const;

export const MUSCLE_VOLUME_SAMPLE = [
  { group: 'Klatka', sets: 14, target: 16 },
  { group: 'Plecy', sets: 16, target: 16 },
  { group: 'Nogi', sets: 12, target: 14 },
  { group: 'Barki', sets: 11, target: 12 },
  { group: 'Ramiona', sets: 10, target: 12 },
] as const;

export const TRAINING_ZONES = [
  { label: 'Strefa Siły', range: '1-5 powt.', formula: 'W x (1 + R / 30)' },
  { label: 'Hipertrofia', range: '6-12 powt.', formula: 'W x (1 + R / 30)' },
  { label: 'Wytrzymałość', range: '13+ powt.', formula: 'Obj. + czas pracy' },
] as const;

export const IOS_CHECKLIST = [
  {
    id: 'mac',
    title: '1. Przygotuj Maca z Xcode (App Store)',
    detail:
      'Apple wymaga kompilacji macOS dla Live Activities (WidgetKit) oraz Apple HealthKit. Windows ani Linux nie zbudują binarki iOS z natywnymi uprawnieniami.',
  },
  {
    id: 'devmode',
    title: '2. Włącz Tryb Dewelopera na iPhone',
    detail:
      'Otwórz Ustawienia > Prywatność i ochrona > Tryb dewelopera, włącz przełącznik, zrestartuj telefon, podepnij kablem USB i kliknij "Zaufaj komputerowi".',
  },
  {
    id: 'appleid',
    title: '3. Podpisz aplikację darmowym Apple ID',
    detail:
      'Nie potrzebujesz płatnego konta Developer ($99/rok). W Xcode > Settings > Accounts dodaj swoje darmowe Apple ID (Personal Team) i wybierz je dla targetów IronRoutine oraz LiveActivity.',
  },
  {
    id: 'trust',
    title: '4. Zaufaj certyfikatowi po pierwszym wgraniu',
    detail:
      'Po instalacji z terminala wejdź w Ustawienia > Ogólne > VPN i zarządzanie urządzeniami, wybierz swoje Apple ID i kliknij Zaufaj. Co 7 dni odświeżysz podpis jednym poleceniem npm run deploy.',
  },
] as const;

export const IOS_COMMANDS = [
  'git clone https://github.com/matiqueue/iron-routine.git && cd iron-routine',
  'npm install && open ios/IronRoutine.xcworkspace',
  'npm run deploy',
] as const;

export const ANDROID_STEPS = [
  {
    step: '01',
    title: 'Pobierz paczkę IronRoutine.apk',
    detail: 'Pobierz najnowszego gotowego klienta Release prosto z GitHub Releases (bez sklepu Google Play).',
  },
  {
    step: '02',
    title: 'Zezwól na instalację z przeglądarki',
    detail: 'Android poprosi o jednorazowe zaufanie dla Chrome lub menedżera plików przy pierwszym uruchomieniu instalatora.',
  },
  {
    step: '03',
    title: 'Połącz Health Connect i odpal trening',
    detail: 'Przejdź 4-krokowy animowany onboarding, skonfiguruj suplementy i zezwól na alarm końca przerwy na ekranie blokady.',
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
