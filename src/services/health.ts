import { Platform } from 'react-native';
import { HealthDailySummary } from '../types/workout';
import { getCurrentAppLanguage } from './settings';
import { getLocaleCode, translateText } from '../i18n/translations';

function getIosHealthKit(): typeof import('@kingstinct/react-native-healthkit') {
  return require('@kingstinct/react-native-healthkit');
}

function getAndroidHealthConnect(): typeof import('react-native-health-connect') {
  return require('react-native-health-connect');
}

const IOS_READ_IDENTIFIERS = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKCategoryTypeIdentifierSleepAnalysis',
] as const;

const EMPTY_SUMMARY: HealthDailySummary = {
  platformAvailable: false,
  authorized: false,
  steps: null,
  sleepHours: null,
  activeCalories: null,
  distanceKm: null,
};

function getStartOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function getSleepWindowStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(16, 0, 0, 0);
  return d;
}

/**
 * Merges overlapping [startMs, endMs] intervals so HealthKit / Health Connect
 * multi-source samples (e.g. Apple Watch + iPhone) never double-count sleep duration.
 */
function sumMergedDurationHours(intervals: Array<[number, number]>): number | null {
  const valid = intervals
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);

  if (valid.length === 0) return null;

  let totalMs = 0;
  let [curStart, curEnd] = valid[0];
  for (let i = 1; i < valid.length; i++) {
    const [s, e] = valid[i];
    if (s <= curEnd) {
      curEnd = Math.max(curEnd, e);
    } else {
      totalMs += curEnd - curStart;
      curStart = s;
      curEnd = e;
    }
  }
  totalMs += curEnd - curStart;

  return Math.round((totalMs / 3600000) * 10) / 10;
}

export async function isPlatformHealthAvailable(): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      const { isHealthDataAvailableAsync } = getIosHealthKit();
      return await isHealthDataAvailableAsync();
    }
    if (Platform.OS === 'android') {
      const { getSdkStatus, SdkAvailabilityStatus } = getAndroidHealthConnect();
      const status = await getSdkStatus();
      return status === SdkAvailabilityStatus.SDK_AVAILABLE;
    }
    return false;
  } catch {
    return false;
  }
}

export async function requestHealthPermissions(): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      const { isHealthDataAvailableAsync, requestAuthorization } = getIosHealthKit();
      const available = await isHealthDataAvailableAsync();
      if (!available) return false;
      const granted = await requestAuthorization({
        toRead: [...IOS_READ_IDENTIFIERS],
        toShare: [],
      });
      return Boolean(granted);
    }

    if (Platform.OS === 'android') {
      const {
        getSdkStatus,
        SdkAvailabilityStatus,
        initialize: initializeHealthConnect,
        requestPermission: requestHealthConnectPermission,
      } = getAndroidHealthConnect();
      const status = await getSdkStatus();
      if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return false;
      const ok = await initializeHealthConnect();
      if (!ok) return false;
      const granted = await requestHealthConnectPermission([
        { accessType: 'read', recordType: 'Steps' },
        { accessType: 'read', recordType: 'SleepSession' },
        { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
        { accessType: 'read', recordType: 'Distance' },
      ]);
      return granted.length > 0;
    }

    return false;
  } catch (e) {
    console.warn('Health permission error:', e);
    return false;
  }
}

export async function hasHealthAccessAlreadyRequested(): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      const {
        isHealthDataAvailableAsync,
        getRequestStatusForAuthorization,
        AuthorizationRequestStatus,
      } = getIosHealthKit();
      const available = await isHealthDataAvailableAsync();
      if (!available) return false;
      const status = await getRequestStatusForAuthorization({
        toRead: [...IOS_READ_IDENTIFIERS],
        toShare: [],
      });
      return status === AuthorizationRequestStatus.unnecessary;
    }
    if (Platform.OS === 'android') {
      const {
        getSdkStatus,
        SdkAvailabilityStatus,
        initialize: initializeHealthConnect,
        getGrantedPermissions,
      } = getAndroidHealthConnect();
      const status = await getSdkStatus();
      if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return false;
      await initializeHealthConnect();
      const granted = await getGrantedPermissions();
      return granted.length > 0;
    }
    return false;
  } catch {
    return false;
  }
}

export async function fetchTodayHealthSummary(): Promise<HealthDailySummary> {
  const startOfToday = getStartOfToday();
  const sleepStart = getSleepWindowStart();
  const now = new Date();

  try {
    if (Platform.OS === 'ios') {
      const {
        isHealthDataAvailableAsync,
        queryStatisticsForQuantity,
        queryCategorySamples,
        CategoryValueSleepAnalysis,
      } = getIosHealthKit();
      const available = await isHealthDataAvailableAsync();
      if (!available) return { ...EMPTY_SUMMARY, platformAvailable: false };

      const [stepsStats, kcalStats, distStats, sleepSamples] = await Promise.all([
        queryStatisticsForQuantity('HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], {
          filter: { date: { startDate: startOfToday, endDate: now } },
          unit: 'count',
        }).catch(() => null),
        queryStatisticsForQuantity('HKQuantityTypeIdentifierActiveEnergyBurned', ['cumulativeSum'], {
          filter: { date: { startDate: startOfToday, endDate: now } },
          unit: 'kcal',
        }).catch(() => null),
        queryStatisticsForQuantity(
          'HKQuantityTypeIdentifierDistanceWalkingRunning',
          ['cumulativeSum'],
          {
            filter: { date: { startDate: startOfToday, endDate: now } },
            unit: 'km',
          }
        ).catch(() => null),
        queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
          limit: 0,
          ascending: true,
          filter: { date: { startDate: sleepStart, endDate: now } },
        }).catch(() => []),
      ]);

      const asleepStages = new Set<number>([
        CategoryValueSleepAnalysis.asleepUnspecified,
        CategoryValueSleepAnalysis.asleepCore,
        CategoryValueSleepAnalysis.asleepDeep,
        CategoryValueSleepAnalysis.asleepREM,
      ]);

      const asleepIntervals: Array<[number, number]> = [];
      const inBedIntervals: Array<[number, number]> = [];

      for (const sample of sleepSamples || []) {
        const sMs = new Date(sample.startDate).getTime();
        const eMs = new Date(sample.endDate).getTime();
        if (asleepStages.has(sample.value)) {
          asleepIntervals.push([sMs, eMs]);
        } else if (sample.value === CategoryValueSleepAnalysis.inBed) {
          inBedIntervals.push([sMs, eMs]);
        }
      }

      const sleepHours =
        sumMergedDurationHours(asleepIntervals) ?? sumMergedDurationHours(inBedIntervals);

      return {
        platformAvailable: true,
        authorized: true,
        steps:
          stepsStats?.sumQuantity?.quantity !== undefined
            ? Math.round(stepsStats.sumQuantity.quantity)
            : null,
        activeCalories:
          kcalStats?.sumQuantity?.quantity !== undefined
            ? Math.round(kcalStats.sumQuantity.quantity)
            : null,
        distanceKm:
          distStats?.sumQuantity?.quantity !== undefined
            ? Math.round(distStats.sumQuantity.quantity * 10) / 10
            : null,
        sleepHours,
        lastSyncedAt: now.toISOString(),
      };
    }

    if (Platform.OS === 'android') {
      const {
        getSdkStatus,
        SdkAvailabilityStatus,
        initialize: initializeHealthConnect,
        getGrantedPermissions,
        aggregateRecord,
        readRecords,
      } = getAndroidHealthConnect();
      const status = await getSdkStatus();
      if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
        return { ...EMPTY_SUMMARY, platformAvailable: false };
      }
      const initialized = await initializeHealthConnect();
      if (!initialized) {
        return { ...EMPTY_SUMMARY, platformAvailable: false };
      }

      const granted = await getGrantedPermissions();
      if (granted.length === 0) {
        return { ...EMPTY_SUMMARY, platformAvailable: true, authorized: false };
      }

      const todayRange = {
        operator: 'between' as const,
        startTime: startOfToday.toISOString(),
        endTime: now.toISOString(),
      };
      const sleepRange = {
        operator: 'between' as const,
        startTime: sleepStart.toISOString(),
        endTime: now.toISOString(),
      };

      const [stepsAgg, kcalAgg, distAgg, sleepRecords] = await Promise.all([
        aggregateRecord({ recordType: 'Steps', timeRangeFilter: todayRange }).catch(() => null),
        aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter: todayRange }).catch(
          () => null
        ),
        aggregateRecord({ recordType: 'Distance', timeRangeFilter: todayRange }).catch(() => null),
        readRecords('SleepSession', { timeRangeFilter: sleepRange }).catch(() => ({ records: [] })),
      ]);

      const sleepIntervals: Array<[number, number]> = (sleepRecords?.records || []).map((rec) => [
        new Date(rec.startTime).getTime(),
        new Date(rec.endTime).getTime(),
      ]);

      return {
        platformAvailable: true,
        authorized: true,
        steps: stepsAgg ? Math.round(stepsAgg.COUNT_TOTAL || 0) : null,
        activeCalories: kcalAgg?.ACTIVE_CALORIES_TOTAL?.inKilocalories
          ? Math.round(kcalAgg.ACTIVE_CALORIES_TOTAL.inKilocalories)
          : null,
        distanceKm: distAgg?.DISTANCE?.inKilometers
          ? Math.round(distAgg.DISTANCE.inKilometers * 10) / 10
          : null,
        sleepHours: sumMergedDurationHours(sleepIntervals),
        lastSyncedAt: now.toISOString(),
      };
    }

    return EMPTY_SUMMARY;
  } catch (e) {
    console.warn('Error fetching health summary:', e);
    return { ...EMPTY_SUMMARY, platformAvailable: Platform.OS === 'ios' || Platform.OS === 'android' };
  }
}

export interface HealthSleepSchedule {
  available: boolean;
  authorized: boolean;
  sourceName: 'Apple Health' | 'Health Connect' | 'none';
  wakeHour: number;
  wakeMinute: number;
  bedHour: number;
  bedMinute: number;
  morningHour: number;
  morningMinute: number;
  eveningHour: number;
  eveningMinute: number;
  nightsAnalyzed: number;
}

function mergeSleepSessionsWithGap(
  intervals: Array<[number, number]>,
  maxGapMs = 90 * 60 * 1000,
  minNightMs = 3 * 60 * 60 * 1000
): Array<[number, number]> {
  const valid = intervals
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  if (valid.length === 0) return [];

  const merged: Array<[number, number]> = [];
  let [curStart, curEnd] = valid[0];
  for (let i = 1; i < valid.length; i++) {
    const [s, e] = valid[i];
    if (s <= curEnd + maxGapMs) {
      curEnd = Math.max(curEnd, e);
    } else {
      merged.push([curStart, curEnd]);
      curStart = s;
      curEnd = e;
    }
  }
  merged.push([curStart, curEnd]);

  return merged.filter(([s, e]) => e - s >= minNightMs);
}

function computeMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function clampMinutesOfDay(mins: number, minVal: number, maxVal: number): number {
  return Math.max(minVal, Math.min(maxVal, Math.round(mins)));
}

function splitClockMinutes(totalMins: number): { hour: number; minute: number } {
  const norm = ((Math.round(totalMins) % 1440) + 1440) % 1440;
  return {
    hour: Math.floor(norm / 60),
    minute: norm % 60,
  };
}

/**
 * Reads recent sleep sessions from Apple HealthKit (iOS) or Health Connect / Samsung Health (Android)
 * to derive the user's real wake-up & bedtime and schedule supplement reminders accordingly.
 */
export async function detectHealthSleepSchedule(): Promise<HealthSleepSchedule> {
  const empty: HealthSleepSchedule = {
    available: false,
    authorized: false,
    sourceName: 'none',
    wakeHour: 8,
    wakeMinute: 45,
    bedHour: 22,
    bedMinute: 45,
    morningHour: 9,
    morningMinute: 0,
    eveningHour: 22,
    eveningMinute: 0,
    nightsAnalyzed: 0,
  };

  try {
    const now = new Date();
    const lookbackStart = new Date(now);
    lookbackStart.setDate(lookbackStart.getDate() - 10);
    lookbackStart.setHours(12, 0, 0, 0);

    let nightEpisodes: Array<[number, number]> = [];
    let sourceName: HealthSleepSchedule['sourceName'] = 'none';

    if (Platform.OS === 'ios') {
      const {
        isHealthDataAvailableAsync,
        queryCategorySamples,
        CategoryValueSleepAnalysis,
      } = getIosHealthKit();
      const available = await isHealthDataAvailableAsync();
      if (!available) return empty;
      sourceName = 'Apple Health';

      const sleepSamples = await queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
        limit: 0,
        ascending: true,
        filter: { date: { startDate: lookbackStart, endDate: now } },
      }).catch(() => []);

      const asleepStages = new Set<number>([
        CategoryValueSleepAnalysis.asleepUnspecified,
        CategoryValueSleepAnalysis.asleepCore,
        CategoryValueSleepAnalysis.asleepDeep,
        CategoryValueSleepAnalysis.asleepREM,
      ]);

      const asleepRaw: Array<[number, number]> = [];
      const inBedRaw: Array<[number, number]> = [];
      for (const s of sleepSamples || []) {
        const sMs = new Date(s.startDate).getTime();
        const eMs = new Date(s.endDate).getTime();
        if (asleepStages.has(s.value)) {
          asleepRaw.push([sMs, eMs]);
        } else if (s.value === CategoryValueSleepAnalysis.inBed) {
          inBedRaw.push([sMs, eMs]);
        }
      }
      const primary = asleepRaw.length > 0 ? asleepRaw : inBedRaw;
      nightEpisodes = mergeSleepSessionsWithGap(primary);
    } else if (Platform.OS === 'android') {
      const {
        getSdkStatus,
        SdkAvailabilityStatus,
        initialize: initializeHealthConnect,
        getGrantedPermissions,
        readRecords,
      } = getAndroidHealthConnect();
      const status = await getSdkStatus();
      if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return empty;
      const initialized = await initializeHealthConnect();
      if (!initialized) return empty;
      const granted = await getGrantedPermissions();
      if (granted.length === 0) return { ...empty, available: true, sourceName: 'Health Connect' };
      sourceName = 'Health Connect';

      const sleepRecords = await readRecords('SleepSession', {
        timeRangeFilter: {
          operator: 'between',
          startTime: lookbackStart.toISOString(),
          endTime: now.toISOString(),
        },
      }).catch(() => ({ records: [] }));

      const rawIntervals: Array<[number, number]> = (sleepRecords?.records || []).map((rec) => [
        new Date(rec.startTime).getTime(),
        new Date(rec.endTime).getTime(),
      ]);
      nightEpisodes = mergeSleepSessionsWithGap(rawIntervals);
    } else {
      return empty;
    }

    if (nightEpisodes.length === 0) {
      return {
        ...empty,
        available: true,
        authorized: true,
        sourceName,
        nightsAnalyzed: 0,
      };
    }

    const wakeMinsList: number[] = [];
    const bedMinsList: number[] = [];
    for (const [startMs, endMs] of nightEpisodes) {
      const sDate = new Date(startMs);
      const eDate = new Date(endMs);
      const wakeMins = eDate.getHours() * 60 + eDate.getMinutes();
      let bedMins = sDate.getHours() * 60 + sDate.getMinutes();
      if (bedMins < 12 * 60) {
        // Past midnight bedtime (e.g. 00:30 -> 24:30) keeps median near midnight accurate
        bedMins += 1440;
      }
      if (wakeMins >= 3 * 60 && wakeMins <= 14 * 60) {
        wakeMinsList.push(wakeMins);
      }
      bedMinsList.push(bedMins);
    }

    if (wakeMinsList.length === 0 || bedMinsList.length === 0) {
      return {
        ...empty,
        available: true,
        authorized: true,
        sourceName,
        nightsAnalyzed: nightEpisodes.length,
      };
    }

    const medianWakeMins = computeMedian(wakeMinsList);
    const medianBedMinsWrapped = computeMedian(bedMinsList);

    const morningTargetMins = clampMinutesOfDay(medianWakeMins + 15, 5 * 60 + 30, 12 * 60 + 30);
    const eveningTargetMins = clampMinutesOfDay(
      medianBedMinsWrapped - 45,
      19 * 60,
      23 * 60 + 45
    );

    const wakeClock = splitClockMinutes(medianWakeMins);
    const bedClock = splitClockMinutes(medianBedMinsWrapped);
    const morningClock = splitClockMinutes(morningTargetMins);
    const eveningClock = splitClockMinutes(eveningTargetMins);

    return {
      available: true,
      authorized: true,
      sourceName,
      wakeHour: wakeClock.hour,
      wakeMinute: wakeClock.minute,
      bedHour: bedClock.hour,
      bedMinute: bedClock.minute,
      morningHour: morningClock.hour,
      morningMinute: morningClock.minute,
      eveningHour: eveningClock.hour,
      eveningMinute: eveningClock.minute,
      nightsAnalyzed: wakeMinsList.length,
    };
  } catch {
    return empty;
  }
}

export interface HealthCoachingInsight {
  id: string;
  icon: 'moon-outline' | 'footsteps-outline' | 'flame-outline' | 'battery-charging-outline';
  headline: string;
  tip: string;
  tone: 'warning' | 'good' | 'neutral';
}

export function generateHealthCoachingInsight(
  summary: HealthDailySummary | null,
  isWorkoutDay: boolean
): HealthCoachingInsight {
  const lang = getCurrentAppLanguage();
  const locale = getLocaleCode(lang);

  if (!summary || !summary.authorized) {
    return {
      id: 'connect-tip',
      icon: 'moon-outline',
      headline: translateText(lang, 'healthTipConnectHead'),
      tip: translateText(lang, 'healthTipConnectBody'),
      tone: 'neutral',
    };
  }

  if (summary.sleepHours !== null && summary.sleepHours < 6.5) {
    return {
      id: 'low-sleep',
      icon: 'moon-outline',
      headline: translateText(lang, 'healthTipLowSleepHead', { hours: summary.sleepHours }),
      tip: isWorkoutDay
        ? translateText(lang, 'healthTipLowSleepWork')
        : translateText(lang, 'healthTipLowSleepRest'),
      tone: 'warning',
    };
  }

  if (summary.steps !== null && summary.steps < 4500) {
    return {
      id: 'low-steps',
      icon: 'footsteps-outline',
      headline: translateText(lang, 'healthTipLowStepsHead', {
        steps: summary.steps.toLocaleString(locale),
      }),
      tip: translateText(lang, 'healthTipLowStepsBody'),
      tone: 'neutral',
    };
  }

  if (summary.sleepHours !== null && summary.sleepHours >= 7.5 && (summary.steps ?? 0) >= 7000) {
    return {
      id: 'optimal-recovery',
      icon: 'battery-charging-outline',
      headline: translateText(lang, 'healthTipOptimalHead', { hours: summary.sleepHours }),
      tip: translateText(lang, 'healthTipOptimalBody'),
      tone: 'good',
    };
  }

  return {
    id: 'steady-recovery',
    icon: 'flame-outline',
    headline: translateText(lang, 'healthTipSteadyHead'),
    tip: translateText(lang, 'healthTipSteadyBody'),
    tone: 'good',
  };
}
