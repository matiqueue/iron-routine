# Iron Routine — Technical Architecture & Data Reference

> Part of the Iron Routine Central Documentation System. Start with [AGENTS.md](../AGENTS.md) and [PROJECT_MEMORY.md](./PROJECT_MEMORY.md).

---

## 1. Repository Layout

```text
iron-routine/
├── App.tsx                          # Root shell: Splash, Onboarding gate, 5 keep-alive tabs, deep links
├── app.json                         # Expo SDK 58 config, permissions, plugins, iOS/Android metadata
├── AGENTS.md                        # Canonical multi-agent instructions (hub for Claude, Gemini, ChatGPT)
├── CLAUDE.md / GEMINI.md            # Thin agent entrypoints pointing to AGENTS.md
├── docs/
│   ├── PROJECT_MEMORY.md            # Living product vision, invariants, ADRs, debt & roadmap
│   ├── ARCHITECTURE.md              # This file: code map, data schemas, API contract, perf rules
│   └── RELEASE_AND_STORES.md        # SemVer, iOS App Store, Android Google Play, CI/CD runbook
├── plugins/
│   └── withAndroidReleaseSigning.js # Expo config plugin injecting Gradle release signing from env
├── scripts/
│   ├── bump-version.mjs             # Atomic SemVer sync across mobile, iOS, Android, website
│   ├── deploy.sh                    # Local Release build + sign + install on physical iPhone
│   ├── release-ios-appstore.sh      # Archive + upload signed .ipa to App Store Connect / TestFlight
│   ├── asc-configure.mjs            # Zero-dep official App Store Connect REST API configurator
│   └── ExportOptions-AppStore.plist # Xcode export options for Team 3X24W8AX3N
├── assets/
│   ├── appstore-screenshots/        # 5x 1320x2868 iPhone 6.9" App Store screenshots
│   ├── appstore-header-search/      # 3840x1646 Header + 3840x2560 Search Results assets
│   └── playstore-assets/            # 512x512 icon, 1024x500 feature graphic, 5x 1440x2880 shots
├── ios/                             # Native iOS Xcode workspace + LiveActivity WidgetKit + AppIntents
├── src/
│   ├── screens/                     # TodayScreen.tsx, SettingsScreen.tsx
│   ├── components/                  # PlanTab, ProgressTab, FriendsTab, ActiveWorkoutView, Modals
│   ├── context/                     # ThemeContext, LanguageContext, TabActivityContext
│   ├── data/                        # exerciseLibrary (136+), exerciseAnatomyMap (19 muscles), supplements
│   ├── i18n/                        # translations.ts, exerciseTranslations.ts (pl/en/de/fr/es)
│   ├── services/                    # storage, cloudSync, social, health, liveActivity, notifications, calendar, voiceCommands
│   ├── types/workout.ts             # Shared domain TypeScript interfaces
│   └── utils/                       # e2ee, nickname, localDate, rankCalculator, sessionExercises
└── website/                         # Vite + React 19 + Tailwind portal & Vercel Serverless API
    ├── api/
    │   ├── _lib/                    # db.ts (Neon schema), cloudStore.ts (JWT/AES/Clerk), socialStore.ts
    │   ├── cloud/                   # auth.ts (Apple JWKS + Clerk JWT), sync.ts (encrypted backups)
    │   ├── social/index.ts          # Friends, E2EE messages, cheers, activities, block/report
    │   └── alexa.ts                 # Optional Alexa skill webhook (public opt-in profiles only)
    └── src/pages/                   # Home, Features, Analytics, Install, MobileAuth, Privacy, Terms, Support
```

---

## 2. Navigation & Deep Link Architecture

- **No Expo Router (`src/app/` is NOT used).**
- `App.tsx` maintains a lazy keep-alive 5-tab architecture (`today`, `plan`, `progress`, `friends`, `settings`) wrapped in `<TabActivityProvider active={isAppForeground && activeTab === ...}>`.
- **Deep Links (`ironroutine://`):** Parsed by `src/services/voiceCommands.ts` (`parseVoiceDeepLink`) and handled in `App.tsx`:
  - `ironroutine://start-workout` (optional `?day=mon`)
  - `ironroutine://open-plan` / `ironroutine://plan`
  - `ironroutine://open-progress` / `ironroutine://progress`
  - `ironroutine://open-friends` / `ironroutine://add-friend`
  - `ironroutine://open-settings`
  - `ironroutine://log-weight`
  - `ironroutine://sync-calendar`
  - `ironroutine://auth?attemptId=...` (in-app Google OAuth `WebBrowser.openAuthSessionAsync` callback)

---

## 3. Local Storage Keys (`AsyncStorage`)

| Key / Prefix | Owner | Contents |
| --- | --- | --- |
| `@iron_routine_profiles` | `storage.ts` | Array of `UserProfile` |
| `@iron_routine_active_profile_id` | `storage.ts` | Active `profileId` |
| `@iron_routine_plans_<profileId>` | `storage.ts` | Array of `WorkoutPlan` |
| `@iron_routine_active_plan_<profileId>` | `storage.ts` | Active `planId` |
| `@iron_routine_history_<profileId>` | `storage.ts` | Array of `WorkoutHistoryEntry` |
| `@iron_routine_week_<profileId>_<YYYY-MM-DD>` | `storage.ts` | In-progress / completed weekly `DayProgress` |
| `@iron_routine_prs_<profileId>_<exerciseId>` | `storage.ts` | Array of `PRRecord` |
| `@iron_routine_weight_<profileId>` | `storage.ts` | Array of `WeightEntry` |
| `@iron_routine_app_settings` | `settings.ts` | `AppSettings` (language, timers, supplements, sync flags) |
| `@iron_routine_theme_dark_mode` | `ThemeContext.tsx` | `'true'` / `'false'` |
| `@iron_routine:cloud_session_v2` | `cloudSync.ts` | Signed cloud `CloudSession` (stored in **Keychain/Keystore via `expo-secure-store`** with auto-migration) |
| `@iron_routine:e2ee_keypair_v1_<userId>` | `e2ee.ts` | Curve25519 keypair (stored in **Keychain/Keystore via `expo-secure-store`** with auto-migration) |
| `@iron_routine_chat_cache_*` | `social.ts` | Persistent chat messages (base64 media stripped before disk write!) |

---

## 4. Backend Architecture (Vercel Serverless + Neon PostgreSQL)

### PostgreSQL Tables (`website/api/_lib/db.ts`)
- `users`: `user_id`, `clerk_user_id`, `email`, `provider`, `display_name`, `nickname`, `nickname_updated_at`, `avatar_url`, `e2ee_public_key`, `backup_summary`, `last_synced_at`
- `cloud_backups`: `user_id` (FK cascade), `encrypted_blob` (JSONB `AES-256-GCM` ciphertext)
- `oauth_attempts`: `attempt_id`, `provider`, `status`, `token`, `user_payload`, `created_at` (10-minute TTL, deleted immediately on first `poll_attempt`)
- `athlete_profiles`: public/friends stats snapshot (`overall_rank`, `streak`, `top_muscles`, `recent_prs`, `show_activity_to_friends`)
- `friend_requests` & `friendships`: bidirectional friend graph
- `social_activities`, `activity_cheers`, `friend_cheers`: feed & high-five streak tracking
- `chat_messages` & `chat_pair_themes`: E2EE ciphertext messages (`ciphertext`, `nonce`, `sender_public_key`, `alg`) + shared conversation themes
- `blocked_users` & `abuse_reports`: App Store & Play Store UGC safety enforcement
- `api_rate_limits`: atomic fixed-window rate-limiting counters for `/api/cloud/auth` and `/api/social` (`website/api/_lib/rateLimit.ts`)

### API Endpoints (`https://iron-routine-app.vercel.app/api/...`)
1. **`POST /api/cloud/auth`**:
   - `apple_native`: verifies iOS `identityToken` against Apple JWKS, returns signed `ir_tok_...` HMAC-SHA256 token (90d).
   - `create_attempt` / `complete_clerk_attempt` / `poll_attempt`: Google OAuth handoff via Clerk + `WebBrowser.openAuthSessionAsync`.
2. **`GET | POST | DELETE /api/cloud/sync`** (`Authorization: Bearer ir_tok_...`):
   - Encrypted profile backup download/upload (4.5 MB cap) and permanent GDPR account deletion (`DELETE` wipes PostgreSQL rows + Clerk user).
3. **`GET | POST /api/social`** (`Authorization: Bearer ir_tok_...`):
   - Hub sync, nickname claim, friend requests, E2EE chat send/fetch (`markRead=0` for silent background prefetch), cheers, reactions, pair themes, `block_user`, `unblock_user`, `report_user`.
4. **`GET | POST /api/alexa`**:
   - Alexa Skill webhook; only exposes profiles where `show_activity_to_friends = TRUE`.

---

## 5. Performance & Thermal Discipline Rules

Past thermal/battery heating was caused by continuously running loops and un-gated background animations. Every contributor MUST follow:
1. **Gate all `Animated.loop` and intervals with `useIsScreenActive()`** (`TabActivityContext`) + `AppState === 'active'`. Never leave an infinite animation running on a hidden keep-alive tab.
2. **Never poll APIs aggressively:** Social hub refreshes only on foreground focus or user action; chat prefetch uses `markRead=0` with local disk cache hydration first.
3. **Always use `useNativeDriver: true`** for opacity/transform animations and prefer native horizontal paging (`ScrollView` / `FlatList` with `pagingEnabled` / `snapToInterval`) over JS pan responders for carousels.
4. **Protect Android AsyncStorage (2 MB CursorWindow limit):** Never persist raw base64 images or audio blobs inside AsyncStorage caches — strip bulky media fields before caching to disk.
5. **Prevent Stale Async Races:** When switching friends/plans/profiles, guard async responses with an active-ID `ref` check before calling `setState`.
