# Changelog

All notable changes to **Iron Routine** follow [Semantic Versioning](https://semver.org/):
- **MAJOR (`X.0.0`)** — breaking architecture changes or complete redesigns
- **MINOR (`3.X.0`)** — new features, screens, integrations, and App Store milestones
- **PATCH (`3.1.X`)** — bug fixes, performance improvements, and UI polish

Use `npm run version:patch`, `npm run version:minor`, or `npm run version:major` to bump all platforms (`package.json`, `app.json`, `Info.plist`, `project.pbxproj`, `website`) in sync, then tag `vX.Y.Z` on `main`.

---

## [Unreleased]

### Security, Reliability & Testing
- Updated transitive `minimatch` dependency to `11.0.9` with an npm override, eliminating the npm audit findings while preserving the existing Expo fingerprint dependency.
- Migrated Cloud Session tokens (`@iron_routine:cloud_session_v2`) and Curve25519 E2EE private keys to hardware-backed OS Keychain / Android Keystore (`expo-secure-store` via `src/utils/secureStorage.ts`) with seamless one-time migration from legacy `AsyncStorage`.
- Added atomic Neon PostgreSQL-backed rate limiting (`website/api/_lib/rateLimit.ts`, `api_rate_limits` table) on `/api/cloud/auth` and `/api/social` returning HTTP `429` with `Retry-After`.
- Fixed `website/api/alexa.ts` privacy query column (`show_activity = TRUE`).
- Added Vitest unit test suite (`npm test` — 10 tests covering Curve25519 E2EE encryption/downgrade guard, nicknames, SecureStore key sanitization, HMAC-SHA256 cloud tokens, and AES-256-GCM backups) integrated into GitHub Actions CI.
- Established unified multi-agent documentation hub (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`) and central living memory (`docs/PROJECT_MEMORY.md`, `docs/ARCHITECTURE.md`, `docs/RELEASE_AND_STORES.md`).

## [3.1.1] - 2026-11-22

### Native Authentication & Apple Developer Release Prep
- Added **native Sign in with Apple** on iOS (`expo-apple-authentication` with Face ID / Touch ID + cryptographic server-side Apple JWKS `identityToken` verification in `/api/cloud/auth`), complying with Apple App Store Review Guideline 4.8.
- Upgraded **Google Sign-In** on iOS & Android to native in-app **`ASWebAuthenticationSession` / Chrome Custom Tabs** (`expo-web-browser` `openAuthSessionAsync`) with graceful cancellation handling, complying with App Store Review Guideline 4.0.
- Updated Sign in with Apple button branding (`Apple` / `Continue with Apple`) across all 5 languages to match Apple Human Interface Guidelines.
- Enabled paid Apple Developer Program capabilities (`com.apple.developer.applesignin` and remote push notifications `aps-environment`) for Team `3X24W8AX3N`.

## [3.1.0] - 2026-11-21

### Security & App Store Readiness
- Hardened `/api/cloud/auth` with server-side Clerk session JWT verification, 10-minute OAuth attempt TTL, single-use token consumption, and removal of unauthenticated `clerk_direct` and hardcoded fallback secrets.
- Added in-app permanent **Delete Account** (`Usuń konto na stałe`) and **Cloud Sign-Out** in Settings (deletes PostgreSQL user, encrypted backups, friendships, chats, and Clerk user record).
- Added **Block & Report User** safety controls in Friend Profile modal and backend (`blocked_users`, `abuse_reports`) plus friendship authorization and payload-size limits on social endpoints.
- Added full bilingual **Privacy Policy** (`/privacy`), **Terms of Service** (`/terms`), and **Support Center** (`/support`) pages on `iron-routine-app.vercel.app` and linked them in Settings.
- Populated iOS `PrivacyInfo.xcprivacy` collected data declarations and hid external donation links on iOS per App Store Review Guideline 3.1.1.
- Fixed E2EE plaintext downgrade guard, Android AsyncStorage media cache size protection, stale chat switch race condition, and onboarding nickname collision fallback.

### Features & UI Polish
- Redesigned **Osiągi → Statystyki** with an atmospheric 30-day telemetry hero ring, interactive tappable spline chart, BMI spectrum needle bar, 7-week volume/sets bar chart, weekday-aligned 28-day intensity heatmap, past-day weight logger, auto daily weigh-in prompt, and one-way animated supplement check-ins.
- Upgraded **Trening** hero cards to a silky 120 FPS native horizontal pager with distinct per-card artwork and equalized card heights.
- Added fullscreen 2D anatomy zoom explorer with smooth enter/shrink transitions, muscle-switch animations, flip lock during focus, and compact detail card.
- Added instant persistent chat caching with silent background sync and `markRead=0` prefetching.
- Added daily rotating dismissible training tips in **Plan**.
- Synchronized versioning across iOS, Android, GitHub Releases, and Website via `scripts/bump-version.mjs`.

## [3.0.0] - 2026-11-16
- Added E2EE Friend Chat (Curve25519 + XSalsa20-Poly1305), social rankings, high-five streaks, cloud sync via Neon PostgreSQL + Clerk, and 136+ exercise visual library.

## [2.0.0] - 2026-11-14
- Added 2D interactive anatomy silhouette, rank ladder (`F`–`S+`), Dynamic Island Live Activity rest timer, Apple HealthKit / Health Connect recovery integration, and 5-language localization.
