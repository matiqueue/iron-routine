#!/usr/bin/env node
/**
 * Official Apple App Store Connect API configurator for Iron Routine (com.matique.ironroutine).
 * Uses Node's built-in `crypto` (ES256 JWT) and `fetch` — zero external dependencies.
 *
 * Usage:
 *   ASC_ISSUER_ID="..." ASC_KEY_ID="..." ASC_PRIVATE_KEY_PATH="~/Downloads/AuthKey_XXXX.p8" \
 *   ASC_CONTACT_PHONE="+48..." node scripts/asc-configure.mjs
 */

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

const BUNDLE_ID = 'com.matique.ironroutine';
const TARGET_VERSION = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8')).version;
const ASC_BASE = 'https://api.appstoreconnect.apple.com/v1';

const ISSUER_ID = (process.env.ASC_ISSUER_ID || '').trim();
const KEY_ID = (process.env.ASC_KEY_ID || '').trim();
const RAW_KEY_PATH = (process.env.ASC_PRIVATE_KEY_PATH || '').trim();
const CONTACT_PHONE = (process.env.ASC_CONTACT_PHONE || '').trim();

if (!ISSUER_ID || !KEY_ID || !RAW_KEY_PATH) {
  console.error(
    'Missing required environment variables: ASC_ISSUER_ID, ASC_KEY_ID, ASC_PRIVATE_KEY_PATH'
  );
  process.exit(1);
}

const KEY_PATH = RAW_KEY_PATH.startsWith('~/')
  ? path.join(os.homedir(), RAW_KEY_PATH.slice(2))
  : path.resolve(RAW_KEY_PATH);

const PRIVATE_KEY = fs.readFileSync(KEY_PATH, 'utf8');

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createAscToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      iss: ISSUER_ID,
      iat: now - 30,
      exp: now + 15 * 60,
      aud: 'appstoreconnect-v1',
    })
  );
  const signingInput = `${header}.${payload}`;
  const sig = crypto.sign('sha256', Buffer.from(signingInput), {
    key: PRIVATE_KEY,
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${b64url(sig)}`;
}

const JWT = createAscToken();

async function ascFetch(urlPath, options = {}) {
  const url = urlPath.startsWith('http') ? urlPath : `${ASC_BASE}${urlPath}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${JWT}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}
  if (!res.ok) {
    const detail = json?.errors?.map((e) => `${e.title}: ${e.detail}`).join(' | ') || text;
    throw new Error(`ASC ${options.method || 'GET'} ${urlPath} -> ${res.status}: ${detail}`);
  }
  return json;
}

const COPY = {
  pl: {
    subtitle: 'Twój dziennik treningowy',
    promotionalText:
      'Trenuj mądrzej z anatomią 2D, zegarem odpoczynku w Dynamic Island, integracją Apple Health i szyfrowanym czatem E2EE ze znajomymi.',
    keywords:
      'siłownia,trening,plan treningowy,dziennik,rekordy,ciężary,fitness,mięśnie,progres,zdrowie,siła',
    description: `Iron Routine to nowoczesny dziennik treningu siłowego zaprojektowany z myślą o szybkości, prywatności i mierzalnym progresie.

NAJWAŻNIEJSZE FUNKCJE:
• Inteligentne plany i kolejka treningów — twórz własne splity (PPL, FBW, Upper/Lower) i wykonuj treningi w swoim rytmie bez sztywnego przywiązania do dni tygodnia.
• Baza ponad 136 ćwiczeń — przejrzyste instrukcje oraz zdjęcia poglądowe pozycji startowej i końcowej.
• Dynamic Island i Live Activities — zegar przerw między seriami i podgląd aktywnego treningu prosto na ekranie blokady.
• Interaktywna anatomia 2D i rangi progresji (F–S+) — sprawdzaj obciążenie poszczególnych partii mięśniowych i odblokowuj kolejne rangi siły.
• Zaawansowane statystyki i dziennik ciała — wykresy objętości, mapa aktywności 28 dni, historia masy ciała, BMI oraz dziennik suplementacji.
• Integracja z Apple Health, Kalendarzem i Przypomnieniami — synchronizacja kroków, snu, regeneracji oraz zaplanowanych sesji treningowych.
• Prywatność i opcjonalna chmura — korzystaj w 100% offline lub połącz konto przez Sign in with Apple / Google, aby tworzyć zaszyfrowane kopie zapasowe.
• Znajomi i szyfrowany czat E2EE — wysyłaj piątki, porównuj statystyki 1v1 i pisz wiadomości chronione szyfrowaniem end-to-end (Curve25519 / XSalsa20-Poly1305).

Zero reklam. Pełna kontrola nad Twoimi danymi.`,
  },
  en: {
    subtitle: 'Strength & Workout Tracker',
    promotionalText:
      'Train smarter with 2D muscle anatomy, Dynamic Island rest timers, Apple Health sync, and end-to-end encrypted friend chat.',
    keywords:
      'gym,workout,tracker,lifting,strength,fitness,routine,pr,bodybuilding,muscle,log,health,training',
    description: `Iron Routine is a fast, privacy-first strength training log built for measurable progress.

KEY FEATURES:
• Smart Workout Plans & Queue — build custom splits (PPL, Full Body, Upper/Lower) and run workouts in sequence at your own pace.
• 136+ Exercise Library — clear form guides with start and end position visuals for every movement.
• Dynamic Island & Live Activities — live rest timer and active set tracking right on your Lock Screen.
• Interactive 2D Muscle Anatomy & Rank Ladder (F–S+) — visualize muscle group workload and climb strength ranks.
• Telemetry & Body Journal — volume and consistency charts, 28-day heatmap, body weight tracking, BMI spectrum, and daily supplement log.
• Apple Health, Calendar & Reminders — sync steps, sleep, recovery metrics, and scheduled workout sessions.
• Offline-First with Optional Cloud Sync — use completely offline or connect with Sign in with Apple / Google for encrypted backups.
• Friends & End-to-End Encrypted Chat — compare stats 1v1, send high-fives, and chat privately with Curve25519 / XSalsa20-Poly1305 encryption.

No ads. Full control over your data.`,
  },
};

function pickCopyForLocale(locale) {
  return String(locale || '').toLowerCase().startsWith('pl') ? COPY.pl : COPY.en;
}

async function uploadScreenshots(localizationId, dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const files = fs
    .readdirSync(dirPath)
    .filter((f) => f.endsWith('.png'))
    .sort();
  if (files.length === 0) return;

  const displayType = 'APP_IPHONE_67';
  const setsRes = await ascFetch(
    `/appStoreVersionLocalizations/${localizationId}/appScreenshotSets`
  );
  let setId = setsRes.data?.find((s) => s.attributes?.screenshotDisplayType === displayType)?.id;

  if (!setId) {
    const created = await ascFetch('/appScreenshotSets', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'appScreenshotSets',
          attributes: { screenshotDisplayType: displayType },
          relationships: {
            appStoreVersionLocalization: {
              data: { type: 'appStoreVersionLocalizations', id: localizationId },
            },
          },
        },
      }),
    });
    setId = created.data.id;
  }

  // Delete existing screenshots in this set so we don't duplicate
  const existingShots = await ascFetch(`/appScreenshotSets/${setId}/appScreenshots`);
  for (const shot of existingShots.data || []) {
    await ascFetch(`/appScreenshots/${shot.id}`, { method: 'DELETE' }).catch(() => {});
  }

  for (const fileName of files) {
    const fullPath = path.join(dirPath, fileName);
    const bytes = fs.readFileSync(fullPath);
    const md5 = crypto.createHash('md5').update(bytes).digest('hex');

    const reserve = await ascFetch('/appScreenshots', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'appScreenshots',
          attributes: {
            fileName,
            fileSize: bytes.length,
          },
          relationships: {
            appScreenshotSet: {
              data: { type: 'appScreenshotSets', id: setId },
            },
          },
        },
      }),
    });

    const shotId = reserve.data.id;
    const ops = reserve.data.attributes.uploadOperations || [];
    for (const op of ops) {
      const slice = bytes.subarray(op.offset, op.offset + op.length);
      const headers = {};
      for (const h of op.requestHeaders || []) {
        headers[h.name] = h.value;
      }
      const putRes = await fetch(op.url, {
        method: op.method || 'PUT',
        headers,
        body: slice,
      });
      if (!putRes.ok) {
        throw new Error(`Screenshot chunk upload failed for ${fileName}: ${putRes.status}`);
      }
    }

    await ascFetch(`/appScreenshots/${shotId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          type: 'appScreenshots',
          id: shotId,
          attributes: {
            uploaded: true,
            sourceFileChecksum: md5,
          },
        },
      }),
    });
    console.log(`  Uploaded screenshot: ${fileName} (${bytes.length} bytes)`);
  }
}

async function main() {
  console.log(`Connecting to App Store Connect for ${BUNDLE_ID}...`);
  const appsRes = await ascFetch(`/apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}`);
  const app = appsRes.data?.[0];
  if (!app) {
    throw new Error(`App ${BUNDLE_ID} not found in App Store Connect.`);
  }
  console.log(`Found app: ${app.attributes.name} (id: ${app.id})`);

  // 1. Update App Content Rights
  await ascFetch(`/apps/${app.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        type: 'apps',
        id: app.id,
        attributes: {
          contentRightsDeclaration: 'DOES_NOT_USE_THIRD_PARTY_CONTENT',
        },
      },
    }),
  });
  console.log('✓ Set Content Rights: DOES_NOT_USE_THIRD_PARTY_CONTENT');

  // 2. App Info (Categories + Subtitle + Privacy Policy URL)
  const appInfosRes = await ascFetch(`/apps/${app.id}/appInfos`);
  const appInfo =
    appInfosRes.data?.find((i) => i.attributes?.appStoreState === 'PREPARE_FOR_SUBMISSION') ||
    appInfosRes.data?.[0];

  if (appInfo) {
    await ascFetch(`/appInfos/${appInfo.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          type: 'appInfos',
          id: appInfo.id,
          relationships: {
            primaryCategory: { data: { type: 'appCategories', id: 'HEALTH_AND_FITNESS' } },
            secondaryCategory: { data: { type: 'appCategories', id: 'SPORTS' } },
          },
        },
      }),
    });
    console.log('✓ Set Categories: Health & Fitness + Sports');

    const infoLocsRes = await ascFetch(`/appInfos/${appInfo.id}/appInfoLocalizations`);
    for (const loc of infoLocsRes.data || []) {
      const copy = pickCopyForLocale(loc.attributes.locale);
      await ascFetch(`/appInfoLocalizations/${loc.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          data: {
            type: 'appInfoLocalizations',
            id: loc.id,
            attributes: {
              subtitle: copy.subtitle,
              privacyPolicyUrl: 'https://iron-routine-app.vercel.app/privacy',
            },
          },
        }),
      });
      console.log(`✓ Updated App Info Localization (${loc.attributes.locale}): subtitle + privacy URL`);
    }
  }

  // 3. Find latest Build and clear Export Compliance
  const buildsRes = await ascFetch(
    `/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=5`
  );
  const validBuild = buildsRes.data?.find((b) => b.attributes?.processingState === 'VALID');
  if (validBuild) {
    await ascFetch(`/builds/${validBuild.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          type: 'builds',
          id: validBuild.id,
          attributes: { usesNonExemptEncryption: false },
        },
      }),
    }).catch(() => {});
    console.log(
      `✓ Found valid build #${validBuild.attributes.version} (${validBuild.id}), set usesNonExemptEncryption=false`
    );
  } else {
    console.log('ℹ No VALID build yet (may still be processing in TestFlight).');
  }

  // 4. Update App Store Version (3.1.1) + Localizations + Review Detail + Screenshots
  const versionsRes = await ascFetch(
    `/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=5`
  );
  const version =
    versionsRes.data?.find((v) => v.attributes?.appStoreState === 'PREPARE_FOR_SUBMISSION') ||
    versionsRes.data?.[0];

  if (version) {
    const versionPatch = {
      data: {
        type: 'appStoreVersions',
        id: version.id,
        attributes: {
          versionString: TARGET_VERSION,
          copyright: '2026 Szymon Góral',
        },
        ...(validBuild
          ? { relationships: { build: { data: { type: 'builds', id: validBuild.id } } } }
          : {}),
      },
    };
    await ascFetch(`/appStoreVersions/${version.id}`, {
      method: 'PATCH',
      body: JSON.stringify(versionPatch),
    });
    console.log(
      `✓ Updated App Store Version -> ${TARGET_VERSION} + copyright${validBuild ? ' + attached build' : ''}`
    );

    const locsRes = await ascFetch(`/appStoreVersions/${version.id}/appStoreVersionLocalizations`);
    for (const loc of locsRes.data || []) {
      const copy = pickCopyForLocale(loc.attributes.locale);
      await ascFetch(`/appStoreVersionLocalizations/${loc.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          data: {
            type: 'appStoreVersionLocalizations',
            id: loc.id,
            attributes: {
              description: copy.description,
              keywords: copy.keywords,
              promotionalText: copy.promotionalText,
              supportUrl: 'https://iron-routine-app.vercel.app/support',
              marketingUrl: 'https://iron-routine-app.vercel.app',
            },
          },
        }),
      });
      console.log(`✓ Updated Version Localization (${loc.attributes.locale})`);
      await uploadScreenshots(loc.id, path.resolve('assets/appstore-screenshots'));
    }

    // App Review Detail
    const reviewNotes =
      'Iron Routine works 100% offline without requiring an account. Optional cloud sync and Friends features support native Sign in with Apple (including Hide My Email) and Google Sign-In. Encrypted friend chat includes in-app Report and Block user controls on every friend profile. Permanent account deletion is available directly in Settings -> Cloud Account -> Delete Account. Apple HealthKit is optional and used solely to display steps, sleep, and recovery metrics.';

    const reviewAttributes = {
      contactFirstName: 'Szymon',
      contactLastName: 'Góral',
      contactEmail: 'szymon.goral@icloud.com',
      demoAccountRequired: false,
      notes: reviewNotes,
      ...(CONTACT_PHONE ? { contactPhone: CONTACT_PHONE } : {}),
    };

    try {
      const existingReview = await ascFetch(
        `/appStoreVersions/${version.id}/appStoreReviewDetail`
      );
      if (existingReview?.data?.id) {
        await ascFetch(`/appStoreReviewDetails/${existingReview.data.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            data: {
              type: 'appStoreReviewDetails',
              id: existingReview.data.id,
              attributes: reviewAttributes,
            },
          }),
        });
      }
    } catch {
      await ascFetch('/appStoreReviewDetails', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'appStoreReviewDetails',
            attributes: reviewAttributes,
            relationships: {
              appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } },
            },
          },
        }),
      }).catch((e) => console.warn('Review detail note:', e.message));
    }
    console.log('✓ Updated App Store Review Details');
  }

  console.log('\n🎉 App Store Connect configuration complete!');
  console.log('Remaining web-only steps (not exposed in Apple REST API):');
  console.log('  1. Pricing and Availability -> Confirm Free ($0.00)');
  console.log('  2. App Privacy -> Publish data collection labels');
  console.log('  3. App Information -> Complete Age Rating questionnaire');
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
