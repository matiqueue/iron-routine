import { ensureSchema, getSql } from './_lib/db.js';
import { jsonResponse } from './_lib/cloudStore.js';

function askResponse(
  speechText: string,
  cardTitle = 'Iron Routine',
  shouldEndSession = true,
  repromptText?: string
): Response {
  const payload: Record<string, unknown> = {
    version: '1.0',
    response: {
      outputSpeech: {
        type: 'PlainText',
        text: speechText,
      },
      card: {
        type: 'Simple',
        title: cardTitle,
        content: speechText,
      },
      shouldEndSession,
      ...(repromptText
        ? {
            reprompt: {
              outputSpeech: {
                type: 'PlainText',
                text: repromptText,
              },
            },
          }
        : {}),
    },
  };

  return jsonResponse(payload, 200);
}

async function lookupAthleteByNickname(nicknameRaw?: string) {
  const cleanNick = String(nicknameRaw || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
  if (!cleanNick) return null;

  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT u.display_name, u.nickname, a.overall_rank, a.overall_progress_pct, a.streak, a.weekly_workouts, a.total_workouts
    FROM users u
    INNER JOIN athlete_profiles a ON a.user_id = u.user_id
    WHERE LOWER(u.nickname) = ${cleanNick}
      AND a.show_activity_to_friends = TRUE
    LIMIT 1
  `) as Array<{
    display_name?: string;
    nickname?: string;
    overall_rank?: string;
    overall_progress_pct?: number;
    streak?: number;
    weekly_workouts?: number;
    total_workouts?: number;
  }>;

  return rows[0] || null;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return jsonResponse({ ok: true }, 200);
    }

    if (request.method === 'GET') {
      return jsonResponse(
        {
          ok: true,
          service: 'Iron Routine Alexa Skill Webhook',
          intents: [
            'StartWorkoutIntent',
            'GetTodayWorkoutIntent',
            'GetStatsIntent',
            'SyncScheduleIntent',
          ],
          deepLinks: [
            'ironroutine://start-workout',
            'ironroutine://open-plan',
            'ironroutine://open-progress',
            'ironroutine://open-friends',
            'ironroutine://log-weight',
            'ironroutine://sync-calendar',
          ],
        },
        200
      );
    }

    if (request.method !== 'POST') {
      return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
    }

    try {
      const body: any = await request.json();
      const reqType = body?.request?.type;
      const locale = String(body?.request?.locale || 'en-US').toLowerCase();
      const isPolish = locale.startsWith('pl');

      if (reqType === 'LaunchRequest') {
        return askResponse(
          isPolish
            ? 'Witaj w Iron Routine. Powiedz: rozpocznij trening, jaki mam plan na dzisiaj, albo sprawdz moja range.'
            : 'Welcome to Iron Routine. Say start a workout, check my rank, or check today training plan.',
          'Iron Routine',
          false,
          isPolish
            ? 'Co mam uruchomic: trening, plan czy range?'
            : 'Would you like to start a workout or check your rank?'
        );
      }

      if (reqType === 'SessionEndedRequest') {
        return jsonResponse({ version: '1.0', response: {} }, 200);
      }

      if (reqType === 'IntentRequest') {
        const intent = body?.request?.intent || {};
        const intentName = String(intent.name || '');
        const slotNick = intent?.slots?.nickname?.value;

        if (intentName === 'StartWorkoutIntent') {
          return askResponse(
            isPolish
              ? 'Przygotowano sesje treningowa w Iron Routine. Otworz link ironroutine://start-workout na swoim telefonie lub uruchom rutyne Alexy, aby wejsc od razu do aktywnego treningu.'
              : 'Your workout session in Iron Routine is ready. Open ironroutine://start-workout via your Alexa Routine or companion card on your phone to launch straight into your session.',
            'Start Workout · ironroutine://start-workout',
            true
          );
        }

        if (intentName === 'GetTodayWorkoutIntent') {
          const athlete = await lookupAthleteByNickname(slotNick).catch(() => null);
          if (athlete) {
            return askResponse(
              isPolish
                ? `Zawodnik ${athlete.display_name}, ranga ${athlete.overall_rank || 'F'}, seria ${athlete.streak || 0} dni. Otworz Iron Routine, aby zobaczyc dzisiejsze cwiczenia.`
                : `Athlete ${athlete.display_name}, overall rank ${athlete.overall_rank || 'F'} with a ${athlete.streak || 0} day streak. Open Iron Routine to launch today training plan.`,
              'Today Training · Iron Routine',
              true
            );
          }
          return askResponse(
            isPolish
              ? 'Sprawdz swoj aktualny dzien treningowy w zakladce Plan lub powiedz start a workout, aby zaczac cwiczenia.'
              : 'Open the Plan tab in Iron Routine to view today training exercises, or launch ironroutine://start-workout on your phone.',
            'Today Plan · Iron Routine',
            true
          );
        }

        if (intentName === 'GetStatsIntent') {
          const athlete = await lookupAthleteByNickname(slotNick).catch(() => null);
          if (athlete) {
            return askResponse(
              isPolish
                ? `${athlete.display_name} ma obecnie range ${athlete.overall_rank || 'F'}, ${athlete.total_workouts || 0} ukonczonych treningow i serie ${athlete.streak || 0} dni.`
                : `${athlete.display_name} currently holds rank ${athlete.overall_rank || 'F'} with ${athlete.total_workouts || 0} completed workouts and a ${athlete.streak || 0} day streak.`,
              'Athlete Rank · Iron Routine',
              true
            );
          }
          return askResponse(
            isPolish
              ? 'Podaj swoj nick w zapytaniu lub otworz zakladke Osiagi w aplikacji Iron Routine, aby zobaczyc model sylwetki i rangi.'
              : 'Include your nickname or open Progress in Iron Routine to inspect your rank and physique scores.',
            'Progress · Iron Routine',
            true
          );
        }

        if (intentName === 'SyncScheduleIntent') {
          return askResponse(
            isPolish
              ? 'Terminy treningow mozesz odswiezyc w kalendarzu linkiem ironroutine://sync-calendar lub w Ustawieniach aplikacji.'
              : 'Open ironroutine://sync-calendar or Settings in Iron Routine to push your next 14 days of workouts into your calendar.',
            'Calendar Sync · Iron Routine',
            true
          );
        }

        if (intentName === 'AMAZON.HelpIntent') {
          return askResponse(
            isPolish
              ? 'Mozesz powiedziec: start a workout, sprawdz moja range, albo zsynchronizuj kalendarz treningowy.'
              : 'You can say start a workout, check my rank for nickname, or sync workout calendar.',
            'Iron Routine Help',
            false
          );
        }

        if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
          return askResponse(isPolish ? 'Do zobaczenia na silowni!' : 'See you at the gym!', 'Iron Routine', true);
        }
      }

      return askResponse(
        'Iron Routine received your request. Say start a workout or check my rank.',
        'Iron Routine',
        true
      );
    } catch (error) {
      console.error('Alexa handler error:', error);
      return askResponse('Sorry, Iron Routine encountered a temporary error.', 'Iron Routine', true);
    }
  },
};
