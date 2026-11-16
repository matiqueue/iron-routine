import * as Linking from 'expo-linking';

export type VoiceCommandType =
  | 'start_workout'
  | 'open_plan'
  | 'open_progress'
  | 'open_friends'
  | 'open_settings'
  | 'log_weight'
  | 'sync_calendar';

export interface ParsedVoiceCommand {
  type: VoiceCommandType;
  dayId?: string;
  rawUrl: string;
}

export const VOICE_DEEP_LINKS = {
  startWorkout: 'ironroutine://start-workout',
  openPlan: 'ironroutine://open-plan',
  openProgress: 'ironroutine://open-progress',
  openFriends: 'ironroutine://open-friends',
  logWeight: 'ironroutine://log-weight',
  syncCalendar: 'ironroutine://sync-calendar',
} as const;

export const ALEXA_ENDPOINT_URL = 'https://iron-routine-app.vercel.app/api/alexa';

export function parseVoiceDeepLink(rawUrl: string | null | undefined): ParsedVoiceCommand | null {
  if (!rawUrl) return null;
  try {
    const parsed = Linking.parse(rawUrl);
    const host = (parsed.hostname || '').toLowerCase();
    const cleanPath = (parsed.path || '').replace(/^\/+/, '').toLowerCase();
    const route = host || cleanPath;

    if (
      route === 'start-workout' ||
      route === 'start' ||
      cleanPath === 'start-workout' ||
      route === 'workout'
    ) {
      const explicitDay =
        typeof parsed.queryParams?.day === 'string'
          ? parsed.queryParams.day
          : cleanPath && cleanPath !== 'start' && cleanPath !== 'start-workout'
          ? cleanPath
          : undefined;
      return {
        type: 'start_workout',
        dayId: explicitDay,
        rawUrl,
      };
    }

    if (route === 'open-plan' || route === 'plan') {
      return { type: 'open_plan', rawUrl };
    }
    if (route === 'open-progress' || route === 'progress' || route === 'ranks') {
      return { type: 'open_progress', rawUrl };
    }
    if (route === 'open-friends' || route === 'friends' || route === 'chat') {
      return { type: 'open_friends', rawUrl };
    }
    if (route === 'open-settings' || route === 'settings') {
      return { type: 'open_settings', rawUrl };
    }
    if (route === 'log-weight' || route === 'weight') {
      return { type: 'log_weight', rawUrl };
    }
    if (route === 'sync-calendar' || route === 'calendar') {
      return { type: 'sync_calendar', rawUrl };
    }

    return null;
  } catch {
    return null;
  }
}

export function buildAlexaInteractionModelJson(nickname?: string) {
  return {
    interactionModel: {
      languageModel: {
        invocationName: 'iron routine',
        intents: [
          {
            name: 'StartWorkoutIntent',
            samples: [
              'start a workout',
              'start my workout',
              'begin training',
              'start gym session',
              'rozpocznij trening',
              'zacznij trening',
            ],
          },
          {
            name: 'GetTodayWorkoutIntent',
            slots: [
              {
                name: 'nickname',
                type: 'AMAZON.FirstName',
              },
            ],
            samples: [
              'what is my workout today',
              'what am i training today',
              'check workout for {nickname}',
              'jaki mam dzisiaj trening',
            ],
          },
          {
            name: 'GetStatsIntent',
            slots: [
              {
                name: 'nickname',
                type: 'AMAZON.FirstName',
              },
            ],
            samples: [
              'what is my rank',
              'what is my streak',
              'how am i doing {nickname}',
              'jaka mam range',
            ],
          },
          {
            name: 'SyncScheduleIntent',
            samples: [
              'sync my workout calendar',
              'remind me about training',
            ],
          },
          { name: 'AMAZON.CancelIntent', samples: [] },
          { name: 'AMAZON.HelpIntent', samples: [] },
          { name: 'AMAZON.StopIntent', samples: [] },
        ],
      },
      metadata: {
        endpoint: ALEXA_ENDPOINT_URL,
        linkedNickname: nickname || null,
      },
    },
  };
}
