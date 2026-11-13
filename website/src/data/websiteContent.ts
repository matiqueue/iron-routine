export const GITHUB_REPO = 'https://github.com/matiqueue/iron-routine';
export const APK_DOWNLOAD_URL =
  'https://github.com/matiqueue/iron-routine/releases/latest/download/IronRoutine.apk';
export const RELEASES_URL = 'https://github.com/matiqueue/iron-routine/releases';
export const APP_VERSION = 'v1.0.1';

export type PlatformTab = 'android' | 'ios';
export type ShowcaseScreen = 'workout' | 'progress' | 'creatine';
export type ChartTimeframe = '7d' | '30d' | 'all';

export interface SplinePointData {
  label: string;
  value: number;
}

export const HERO_SPECS = [
  { label: 'PRYWATNOŚĆ', value: '0 B w chmurze', sub: '100% AsyncStorage' },
  { label: 'KALKULACJA', value: '1RM Epley', sub: 'W czasie rzeczywistym' },
  { label: 'LICENCJA', value: 'Open Source', sub: 'MIT / Brak reklam' },
] as const;

export const SPLINE_SERIES: Record<ChartTimeframe, SplinePointData[]> = {
  '7d': [
    { label: 'Pn', value: 102.5 },
    { label: 'Śr', value: 105.0 },
    { label: 'Pt', value: 106.5 },
    { label: 'Nd', value: 108.5 },
  ],
  '30d': [
    { label: 'T1', value: 96.0 },
    { label: 'T2', value: 99.5 },
    { label: 'T3', value: 102.5 },
    { label: 'T4', value: 105.0 },
    { label: 'T5', value: 108.5 },
  ],
  all: [
    { label: 'M1', value: 84.0 },
    { label: 'M2', value: 90.0 },
    { label: 'M3', value: 96.5 },
    { label: 'M4', value: 101.0 },
    { label: 'M5', value: 105.5 },
    { label: 'M6', value: 108.5 },
  ],
};

export interface WorkoutSetPreview {
  id: number;
  label: string;
  reps: string;
  done: boolean;
  active?: boolean;
}

export const WORKOUT_SETS: readonly WorkoutSetPreview[] = [
  { id: 1, label: 'S1', reps: '8×85kg', done: true },
  { id: 2, label: 'S2', reps: '8×85kg', done: true },
  { id: 3, label: 'S3', reps: '7×87.5kg', done: false, active: true },
  { id: 4, label: 'S4', reps: '6×90kg', done: false },
];

export const PROFILE_PREVIEW = [
  { name: 'Szymon', prs: '14 PR', weight: '74.2 kg', active: true },
  { name: 'Gość // Push-Pull', prs: '9 PR', weight: '81.5 kg', active: false },
  { name: 'Blok Siłowy', prs: '22 PR', weight: '75.0 kg', active: false },
] as const;

export const TRAINING_ZONES = [
  { pct: 0.9, label: 'Siła maksymalna', reps: '2–4 powt.' },
  { pct: 0.8, label: 'Siła & Hipertrofia', reps: '6–8 powt.' },
  { pct: 0.7, label: 'Objętość robocza', reps: '10–12 powt.' },
  { pct: 0.6, label: 'Technika / Rozgrzewka', reps: '12–15 powt.' },
] as const;

export const IOS_COMMANDS = [
  'git clone https://github.com/matiqueue/iron-routine.git && cd iron-routine',
  'npm install',
  'npm run deploy',
] as const;

export const ANDROID_STEPS = [
  {
    step: '01',
    title: 'Pobierz paczkę APK',
    desc: 'Pobierz najnowszą kompilację bezpośrednio z oficjalnego wydania GitHub Releases.',
  },
  {
    step: '02',
    title: 'Zainstaluj lokalnie',
    desc: 'Otwórz IronRoutine.apk w folderze Pobrane i zezwól na instalację zaufanego pliku.',
  },
  {
    step: '03',
    title: 'Trenuj w 100% offline',
    desc: 'Skonfiguruj własny profil bez logowania, konta w chmurze i śledzenia.',
  },
] as const;

/** Epley 1RM formula matching src/services/storage.ts */
export function calculate1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return Math.round(weight * 10) / 10;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function formatRestTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
