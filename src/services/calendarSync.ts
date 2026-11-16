import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AppSettings, DayPlan, WorkoutPlan } from '../types/workout';
import { getAppSettings, getCurrentAppLanguage, updateAppSettings } from './settings';
import { DAYS_OF_WEEK } from '../data/planData';
import { translateText } from '../i18n/translations';

function getCalendarModule(): typeof import('expo-calendar') | null {
  if (Platform.OS === 'web') return null;
  return require('expo-calendar');
}

export interface CalendarSyncCapabilities {
  platform: 'ios' | 'android' | 'web';
  calendarSupported: boolean;
  remindersSupported: boolean;
  calendarGranted: boolean;
  remindersGranted: boolean;
  targetCalendarTitle: string | null;
  targetRemindersTitle: string | null;
  providerLabel: string;
}

export interface CalendarSyncResult {
  ok: boolean;
  eventsCreated: number;
  remindersCreated: number;
  targetCalendarName?: string;
  targetRemindersName?: string;
  error?: string;
}

const DAY_INDEX_BY_ID: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const ANDROID_REMINDER_ID_PREFIX = 'ir_workout_rem_';

function pad2(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

function buildUpcomingScheduleDates(
  plan: WorkoutPlan,
  hour: number,
  minute: number,
  daysAhead = 14
): Array<{ day: DayPlan; startDate: Date }> {
  const result: Array<{ day: DayPlan; startDate: Date }> = [];
  const now = new Date();
  const dayByDow = new Map<number, DayPlan>();

  for (const day of plan.days || []) {
    const dow = DAY_INDEX_BY_ID[day.id];
    if (dow !== undefined) {
      dayByDow.set(dow, day);
    }
  }

  for (let offset = 0; offset < daysAhead; offset++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(hour, minute, 0, 0);

    // Skip slots earlier than 5 min from now on today
    if (offset === 0 && candidate.getTime() < now.getTime() - 5 * 60 * 1000) {
      continue;
    }

    const dayPlan = dayByDow.get(candidate.getDay());
    if (!dayPlan || dayPlan.type === 'rest') continue;
    result.push({ day: dayPlan, startDate: candidate });
  }

  return result;
}

async function resolveTargetEventCalendar(Cal: typeof import('expo-calendar')) {
  const calendars = await Cal.getCalendars(Cal.EntityTypes.EVENT);

  if (Platform.OS === 'ios') {
    const dedicated = calendars.find(
      (c) => c.allowsModifications && c.title === 'Iron Routine'
    );
    if (dedicated) return dedicated;

    let defaultCal: import('expo-calendar').ExpoCalendar | null = null;
    try {
      defaultCal = Cal.getDefaultCalendarSync();
    } catch {
      defaultCal = null;
    }

    const icloudCal = calendars.find(
      (c) =>
        c.allowsModifications &&
        (c.source?.type === Cal.SourceType.CALDAV ||
          String(c.source?.name || '').toLowerCase().includes('icloud'))
    );
    const writableCal =
      defaultCal?.allowsModifications
        ? defaultCal
        : icloudCal || calendars.find((c) => c.allowsModifications);

    if (writableCal?.source?.id || writableCal?.sourceId) {
      try {
        return await Cal.createCalendar({
          title: 'Iron Routine',
          color: '#10B981',
          entityType: Cal.EntityTypes.EVENT,
          sourceId: writableCal.source?.id || writableCal.sourceId,
          source: writableCal.source,
        });
      } catch {
        return writableCal;
      }
    }
    return writableCal || null;
  }

  // Android: prefer Google Account primary writable calendar
  const dedicatedAndroid = calendars.find(
    (c) => c.allowsModifications && c.title === 'Iron Routine'
  );
  if (dedicatedAndroid) return dedicatedAndroid;

  const googlePrimary = calendars.find(
    (c) =>
      c.allowsModifications &&
      c.isPrimary &&
      (String(c.source?.type || '').includes('google') ||
        String(c.ownerAccount || '').includes('@'))
  );
  if (googlePrimary) return googlePrimary;

  const anyGoogle = calendars.find(
    (c) =>
      c.allowsModifications &&
      (String(c.source?.type || '').includes('google') ||
        String(c.ownerAccount || '').includes('@'))
  );
  if (anyGoogle) return anyGoogle;

  const primaryAny = calendars.find((c) => c.allowsModifications && c.isPrimary);
  if (primaryAny) return primaryAny;

  const fallbackAny = calendars.find((c) => c.allowsModifications);
  if (fallbackAny) return fallbackAny;

  try {
    return await Cal.createCalendar({
      title: 'Iron Routine',
      name: 'IronRoutine',
      color: '#10B981',
      ownerAccount: 'personal',
      entityType: Cal.EntityTypes.EVENT,
      accessLevel: Cal.CalendarAccessLevel.OWNER,
      isVisible: true,
      isSynced: true,
      source: {
        isLocalAccount: true,
        name: 'Iron Routine',
        type: Cal.SourceType.LOCAL,
      },
    });
  } catch {
    return null;
  }
}

async function resolveTargetRemindersList(Cal: typeof import('expo-calendar')) {
  if (Platform.OS !== 'ios') return null;

  const reminderLists = await Cal.getCalendars(Cal.EntityTypes.REMINDER);
  const dedicated = reminderLists.find(
    (c) => c.allowsModifications && c.title === 'Iron Routine'
  );
  if (dedicated) return dedicated;

  const icloudList = reminderLists.find(
    (c) =>
      c.allowsModifications &&
      (c.source?.type === Cal.SourceType.CALDAV ||
        String(c.source?.name || '').toLowerCase().includes('icloud'))
  );
  const baseList = icloudList || reminderLists.find((c) => c.allowsModifications);
  if (baseList?.source?.id || baseList?.sourceId) {
    try {
      return await Cal.createCalendar({
        title: 'Iron Routine',
        color: '#38BDF8',
        entityType: Cal.EntityTypes.REMINDER,
        sourceId: baseList.source?.id || baseList.sourceId,
        source: baseList.source,
      });
    } catch {
      return baseList;
    }
  }
  return baseList || null;
}

export async function getCalendarSyncCapabilities(): Promise<CalendarSyncCapabilities> {
  const Cal = getCalendarModule();
  if (!Cal) {
    return {
      platform: 'web',
      calendarSupported: false,
      remindersSupported: false,
      calendarGranted: false,
      remindersGranted: false,
      targetCalendarTitle: null,
      targetRemindersTitle: null,
      providerLabel: 'Apple / Google Calendar',
    };
  }

  let calendarGranted = false;
  let remindersGranted = false;
  let targetCalendarTitle: string | null = null;
  let targetRemindersTitle: string | null = null;

  try {
    const calPerm = await Cal.getCalendarPermissions(false);
    calendarGranted = calPerm.status === 'granted';
    if (calendarGranted) {
      const target = await resolveTargetEventCalendar(Cal);
      targetCalendarTitle = target?.title || null;
    }
  } catch {}

  if (Platform.OS === 'ios') {
    try {
      const remPerm = await Cal.getRemindersPermissions();
      remindersGranted = remPerm.status === 'granted';
      if (remindersGranted) {
        const remList = await resolveTargetRemindersList(Cal);
        targetRemindersTitle = remList?.title || null;
      }
    } catch {}
  }

  return {
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    calendarSupported: true,
    remindersSupported: Platform.OS === 'ios' || Platform.OS === 'android',
    calendarGranted,
    remindersGranted,
    targetCalendarTitle,
    targetRemindersTitle,
    providerLabel:
      Platform.OS === 'ios'
        ? 'Apple Calendar & Reminders'
        : 'Google Calendar & Reminders',
  };
}

export async function requestCalendarAccess(withReminders: boolean): Promise<{
  calendarGranted: boolean;
  remindersGranted: boolean;
}> {
  const Cal = getCalendarModule();
  if (!Cal) return { calendarGranted: false, remindersGranted: false };

  let calendarGranted = false;
  let remindersGranted = false;

  try {
    const res = await Cal.requestCalendarPermissions(false);
    calendarGranted = res.status === 'granted';
  } catch {
    calendarGranted = false;
  }

  if (withReminders && Platform.OS === 'ios') {
    try {
      const remRes = await Cal.requestRemindersPermissions();
      remindersGranted = remRes.status === 'granted';
    } catch {
      remindersGranted = false;
    }
  } else if (withReminders && Platform.OS === 'android') {
    remindersGranted = true;
  }

  return { calendarGranted, remindersGranted };
}

async function clearPreviousSyncedIds(
  Cal: typeof import('expo-calendar') | null,
  settings: AppSettings
): Promise<void> {
  if (Cal && Array.isArray(settings.calendarSyncedIds) && settings.calendarSyncedIds.length > 0) {
    for (const id of settings.calendarSyncedIds) {
      try {
        const ev = await Cal.ExpoCalendarEvent.get(id);
        await ev.delete();
      } catch {
        // Already removed by user or OS
      }
    }
  }

  if (
    Cal &&
    Platform.OS === 'ios' &&
    Array.isArray(settings.reminderSyncedIds) &&
    settings.reminderSyncedIds.length > 0
  ) {
    for (const id of settings.reminderSyncedIds) {
      try {
        const rem = await Cal.ExpoCalendarReminder.get(id);
        await rem.delete();
      } catch {
        // Already removed or completed by user
      }
    }
  }

  if (Platform.OS !== 'web') {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const req of scheduled) {
        if (String(req.identifier || '').startsWith(ANDROID_REMINDER_ID_PREFIX)) {
          await Notifications.cancelScheduledNotificationAsync(req.identifier).catch(() => {});
        }
      }
    } catch {}
  }
}

export async function clearAllSyncedCalendarItems(): Promise<void> {
  const Cal = getCalendarModule();
  const settings = await getAppSettings();
  await clearPreviousSyncedIds(Cal, settings);
  await updateAppSettings({
    calendarSyncedIds: [],
    reminderSyncedIds: [],
  });
}

export async function syncWorkoutScheduleWithDevice(
  plan: WorkoutPlan,
  overrideSettings?: AppSettings
): Promise<CalendarSyncResult> {
  const Cal = getCalendarModule();
  if (!Cal) {
    return {
      ok: false,
      eventsCreated: 0,
      remindersCreated: 0,
      error: 'Calendar sync is available on iOS and Android devices.',
    };
  }

  const settings = overrideSettings || (await getAppSettings());
  if (!settings.calendarSyncEnabled && !settings.remindersSyncEnabled) {
    await clearPreviousSyncedIds(Cal, settings);
    await updateAppSettings({ calendarSyncedIds: [], reminderSyncedIds: [] });
    return { ok: true, eventsCreated: 0, remindersCreated: 0 };
  }

  const lang = getCurrentAppLanguage();
  const hour = Number.isFinite(settings.preferredWorkoutHour) ? settings.preferredWorkoutHour : 18;
  const minute = Number.isFinite(settings.preferredWorkoutMinute) ? settings.preferredWorkoutMinute : 0;
  const durationMin = Math.max(20, settings.workoutDurationMinutes || 60);

  const slots = buildUpcomingScheduleDates(plan, hour, minute, 14);
  const nextEventIds: string[] = [];
  const nextReminderIds: string[] = [];

  await clearPreviousSyncedIds(Cal, settings);

  let targetCalName: string | undefined;
  let targetRemName: string | undefined;

  if (settings.calendarSyncEnabled) {
    const perm = await Cal.requestCalendarPermissions(false);
    if (perm.status !== 'granted') {
      return {
        ok: false,
        eventsCreated: 0,
        remindersCreated: 0,
        error: translateText(lang, 'calendarPermDeniedError'),
      };
    }

    const calObj = await resolveTargetEventCalendar(Cal);
    if (!calObj) {
      return {
        ok: false,
        eventsCreated: 0,
        remindersCreated: 0,
        error: translateText(lang, 'calendarNoWritableError'),
      };
    }
    targetCalName = calObj.title;

    for (const { day, startDate } of slots) {
      const endDate = new Date(startDate.getTime() + durationMin * 60 * 1000);
      const dayMeta = DAYS_OF_WEEK.find((d) => d.id === day.id);
      const exList = (day.exercises || [])
        .slice(0, 8)
        .map((ex, idx) => `${idx + 1}. ${ex.name} (${ex.sets}x${ex.reps})`)
        .join('\n');
      const deepLink = `ironroutine://workout/${day.id}`;

      try {
        const created = await calObj.createEvent({
          title: `Iron Routine: ${day.name}`,
          startDate,
          endDate,
          location: 'Gym · Iron Routine',
          url: Platform.OS === 'ios' ? deepLink : undefined,
          notes: `${dayMeta ? dayMeta.label : ''} (${pad2(hour)}:${pad2(minute)})\n${exList}\n\n${deepLink}`,
          alarms: [{ relativeOffset: -30, method: Cal.AlarmMethod.ALERT }],
        });
        if (created?.id) nextEventIds.push(created.id);
      } catch (err) {
        console.warn('Create calendar event error:', err);
      }
    }
  }

  if (settings.remindersSyncEnabled) {
    if (Platform.OS === 'ios') {
      const remPerm = await Cal.requestRemindersPermissions();
      if (remPerm.status === 'granted') {
        const remCal = await resolveTargetRemindersList(Cal);
        targetRemName = remCal?.title || 'Reminders';
        if (remCal) {
          for (const { day, startDate } of slots.slice(0, 7)) {
            const reminderDue = new Date(startDate.getTime() - 30 * 60 * 1000);
            const exSummary = (day.exercises || [])
              .slice(0, 5)
              .map((ex) => ex.name)
              .join(', ');
            try {
              const rem = await remCal.createReminder({
                title: `Iron Routine · ${day.name}`,
                startDate: reminderDue,
                dueDate: startDate,
                completed: false,
                url: `ironroutine://workout/${day.id}`,
                notes: exSummary
                  ? `${exSummary}\nironroutine://workout/${day.id}`
                  : `ironroutine://workout/${day.id}`,
                alarms: [{ relativeOffset: -30 }],
              });
              if (rem?.id) nextReminderIds.push(rem.id);
            } catch (err) {
              console.warn('Create iOS reminder error:', err);
            }
          }
        }
      }
    } else if (Platform.OS === 'android') {
      targetRemName = 'Google / Android Reminders';
      for (const { day, startDate } of slots.slice(0, 7)) {
        const triggerDate = new Date(startDate.getTime() - 30 * 60 * 1000);
        if (triggerDate.getTime() <= Date.now() + 10000) continue;
        try {
          const notifId = `${ANDROID_REMINDER_ID_PREFIX}${day.id}_${startDate.getTime()}`;
          await Notifications.scheduleNotificationAsync({
            identifier: notifId,
            content: {
              title: `Iron Routine · ${day.name}`,
              body: translateText(lang, 'calendarReminderNotifBody', {
                time: `${pad2(hour)}:${pad2(minute)}`,
              }),
              data: { deepLink: `ironroutine://workout/${day.id}` },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: triggerDate,
            },
          });
          nextReminderIds.push(notifId);
        } catch {}
      }
    }
  }

  await updateAppSettings({
    lastCalendarSyncAt: new Date().toISOString(),
    calendarSyncedIds: nextEventIds,
    reminderSyncedIds: nextReminderIds,
  });

  return {
    ok: true,
    eventsCreated: nextEventIds.length,
    remindersCreated: nextReminderIds.length,
    targetCalendarName: targetCalName,
    targetRemindersName: targetRemName,
  };
}
