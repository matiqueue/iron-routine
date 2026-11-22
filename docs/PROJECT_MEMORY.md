# Iron Routine — Central Project Memory (Single Source of Truth)

> **Purpose:** This document is the canonical living memory of **Iron Routine**. Every AI coding agent (ChatGPT/Codex, Claude, Gemini/Antigravity) and contributor MUST read this before making architectural decisions and MUST update it whenever product goals, features, security invariants, schemas, or store configurations change.
>
> **Last synchronized:** 2026-11-22 (`v3.1.1`, iOS build `6`, Android `versionCode 6`)

---

## 1. Product Vision & Non-Negotiable Principles

**Iron Routine** is a minimalist, privacy-first, high-performance strength training tracker and social gym companion for **iOS, Android, and Web** (5 languages: `pl`, `en`, `de`, `fr`, `es`).

### Core Product Tenets (Never Violate)
1. **Offline-First Forever:** Every workout feature (plans, active workout logging, rest timer, PRs, 2D anatomy, ranks, body telemetry, supplement journal) MUST work 100% offline with zero sign-in required. Cloud Sync and Friends are strictly optional.
2. **Privacy & True E2EE:** Zero ads, zero ad-trackers, zero data selling. Friend chat is End-to-End Encrypted (`Curve25519` + `XSalsa20-Poly1305` via `tweetnacl` + `expo-crypto`). Cloud backups are encrypted at rest (`AES-256-GCM`).
3. **Sequential Workout Queue (Not Day-Locked):** Plans assign workouts to days (`mon`–`sun`), but users train in sequence rather than rigid calendar days. **Trening** (`TodayScreen`) presents a horizontal 120 FPS swipeable Hero queue of workout cards so users can start/resume the next logical session anytime.
4. **Monochrome AMOLED Flagship UI & 120 FPS Feel:** Deep obsidian `#000000` / `#121214` surfaces (plus light mode), crisp typography, subtle architectural backdrops, zero frame drops, zero jank on tab switches, zero thermal/battery waste.
5. **Store-Compliant by Design:** Always respect Apple App Store Review Guidelines (no external donation/payment links on iOS [3.1.1], native Sign in with Apple [4.8], in-app auth sessions [4.0], permanent in-app account deletion [5.1.1(v)], UGC Report/Block moderation [1.2], HealthKit transparency [5.1.3]) and Google Play Policies (Health Connect declaration, signed `.aab`, data safety).

---

## 2. Production Identifiers & Live Infrastructure

| System | Identifier / URL | Notes |
| --- | --- | --- |
| **Bundle ID / Android Package** | `com.matique.ironroutine` | Live Activity widget: `com.matique.ironroutine.LiveActivity` |
| **Apple Developer Team** | `3X24W8AX3N` (Szymon Góral) | Paid Individual membership; local `Apple Distribution` cert required (see ADR #2) |
| **App Store Connect App ID** | `6837838394` | `v3.1.1 (6)` submitted `WAITING_FOR_REVIEW`; 174 territories (CHN excluded) |
| **Google Play Account** | `matiqueue@gmail.com` | Signed `.aab` via `plugins/withAndroidReleaseSigning.js` + GitHub Actions |
| **Production Website & API** | `https://iron-routine-app.vercel.app` | Deployed automatically from GitHub `main` (`website/` root) |
| **Legal & Support URLs** | `/privacy`, `/terms`, `/support` | Bilingual PL/EN; linked in Settings & both App Stores |
| **Cloud Database** | Neon PostgreSQL (`@neondatabase/serverless`) | Schema managed in `website/api/_lib/db.ts` |
| **Identity Provider** | Clerk + Native Apple JWKS | `website/api/cloud/auth.ts` |
| **Local Key Vault (Mac)** | `~/Documents/Text Vaults/IronRoutine-Keys/` | Stores Android `.p12` keystore & Apple `.p8` API key (**NEVER commit to Git**) |

---

## 3. Feature Inventory (Current State — `v3.1.1`)

1. **Trening (`src/screens/TodayScreen.tsx`):**
   - 120 FPS native horizontal Hero pager (`Push`, `Pull`, `Legs`, `Upper`, `Lower`, `FBW`, etc.) with distinct per-card artwork and equalized card heights.
   - Weekly consistency badge, daily sets counter, quick body weight entry, Apple Health / Health Connect readiness strip (steps, sleep, active calories).
   - Start / Resume workout button + transition launch animation into `ActiveWorkoutView`.
2. **Active Workout (`src/components/ActiveWorkoutView.tsx`):**
   - Set-by-set weight/reps logging, estimated 1RM calculation, PR detection, exercise swap/add/reorder, rest timer with 3-wave `rest_alarm.wav` + iOS Dynamic Island **Live Activity**.
   - Exit dialog with two explicit options: **Wstrzymaj (Pause & Save progress)** vs **Skasuj postęp (Discard & Exit)**.
3. **Plan (`src/components/PlanTab.tsx`):**
   - Multi-plan manager (`FBW`, `Upper/Lower`, `PPL`, `Split 4D`, custom), day editor, 136+ canonical exercise library (`src/data/exerciseLibrary.ts`) with start/end position swipeable visual guides (shown strictly inside exercise info modals).
   - Daily rotating dismissible training hint card (returns next day with a fresh tip).
4. **Osiągi (`src/components/ProgressTab.tsx`):**
   - **Anatomia 2D & Rangi (`physique`):** Interactive male/female 2D silhouette (`AnimatedBodySilhouette.tsx`) across 19 muscle sub-groups, rank ladder (`F`–`S+`), fullscreen zoom explorer with smooth enter/shrink transitions, muscle-switch animations, flip lock during muscle focus, and fast rank badge details.
   - **Ćwiczenia / PR (`exercises`):** Per-exercise PR progression charts & history.
   - **Statystyki & Dziennik (`journal`):** Atmospheric 30-day telemetry ring + tonnage, interactive tappable weight spline, past-day body weight logging + auto daily weigh-in prompt with "skip today", BMI spectrum needle bar, 7-week load chart, weekday-aligned 28-day heatmap, one-way animated daily supplement check-ins, and vertical session timeline.
5. **Znajomi & E2EE Czat (`src/components/FriendsTab.tsx`, `FriendProfileModal.tsx`, `FriendChatModal.tsx`):**
   - Unique `@nickname` discovery (30-day change cooldown), crew radar, avatar ring, 1v1 stat comparison, high-five streaks (without raw counter clutter), swipe-to-dismiss profile & Messenger-style swipe-right-to-exit chat.
   - End-to-End Encrypted chat (text, images, voice notes, workout shares, rank cards, reactions, pair themes) with instant persistent local cache + silent background sync (`markRead=0` prefetch) and media stripped from AsyncStorage disk cache (prevents Android 2MB SQLite crash).
   - In-app **Report & Block User** safety controls (`blocked_users`, `abuse_reports`).
6. **Ustawienia (`src/screens/SettingsScreen.tsx`) & Onboarding (`src/components/OnboardingScreen.tsx`):**
   - 6-step onboarding (language, gender, name + `@nick`, body stats, supplements, plan, optional cloud sign-in).
   - 4-tab Settings (*Profil*, *Trening*, *System*, *Dane*): native **Sign in with Apple** (iOS Face ID + Apple JWKS) & in-app **Google Sign-In** (`ASWebAuthenticationSession` / Chrome Custom Tabs), **Sign Out**, **Permanent Delete Account** (deletes PostgreSQL user, backups, friendships, chats, and Clerk user), E2EE fingerprint (`Curve25519 / NaCl`), JSON backup/import, calendar/reminders sync, and Privacy/Terms/Support links.
   - External donation links (`Buy Me a Coffee`) are strictly hidden on `Platform.OS === 'ios'`.

---

## 4. Security & Cryptography Invariants (NEVER Regress)

1. **Zero Unauthenticated Auth Flows:** `/api/cloud/auth` MUST cryptographically verify either:
   - Apple `identityToken` against official Apple JWKS (`https://appleid.apple.com/auth/keys`, `RS256`, `iss`, `aud === 'com.matique.ironroutine'`, `exp`), OR
   - Clerk session JWT via Clerk Backend API (`verifyClerkSessionJwt`) bound to a fresh (<10 min) single-use `oauth_attempts` record.
   - NEVER re-introduce `clerk_direct` or hardcoded fallback secrets.
2. **E2EE Downgrade Protection:** `src/utils/e2ee.ts` MUST reject plaintext downgrade attempts on encrypted threads; `clearE2eeMemoryCaches()` MUST run on sign-out, account deletion, and device reset.
3. **Social Authorization & Abuse Limits:** Every cheer, reaction, or chat message MUST verify accepted friendship + absence of blocks (`blocked_users`) server-side, with strict payload limits (`2.5 MB` ciphertext, `500 KB` wallpaper, `4.5 MB` cloud backup).
4. **Alexa / Public Endpoint Privacy:** `website/api/alexa.ts` MUST only query profiles with `show_activity_to_friends = TRUE`.
5. **Secrets Hygiene:** Private keys (`.p8`, `.p12`, `.jks`, `.env`, `seeds/`) MUST NEVER be committed to Git. Store local signing keys strictly in `~/Documents/Text Vaults/IronRoutine-Keys/`.

---

## 5. Architecture Decision Log (ADRs)

| # | Decision | Why (Context & Lessons Learned) |
| --- | --- | --- |
| **ADR-01** | **Custom 5-tab state navigation in `App.tsx` (NOT Expo Router)** | Iron Routine uses lazy keep-alive tabs (`TabActivityProvider`) for zero-stutter switching and deep links via `src/services/voiceCommands.ts`. Do NOT migrate to `src/app/` Expo Router without an explicit major-version plan. |
| **ADR-02** | **Local `Apple Distribution` certificate for iOS App Store uploads** | Apple's Cloud Managed Signing hits a Unicode NFC/NFD normalization bug on Polish `ó` in `Szymon Góral` (`ITMS-90035: Invalid Signature`). Local `Apple Distribution` cert in Keychain writes matching NFC bytes and passes `--deep --strict`. |
| **ADR-03** | **No `"Apple"` word in iOS `AppIntent` descriptions** | Apple's automated Siri validator rejects uploads with `ITMS-90626` if any `IntentDescription` contains `"apple"` (fixed in `ios/IronRoutine/AppDelegate.swift` build 6). |
| **ADR-04** | **Exclude China mainland (`CHN`) from App Store territories** | Apps with chat/UGC distributed in China mainland require government MIIT/CAC filing. Excluding `CHN` keeps 174 global territories live cleanly. |
| **ADR-05** | **Ignore `expo*` / `react-native*` in Dependabot** | Raw Dependabot bumps desync native Expo modules & `Podfile.lock`. Always upgrade Expo SDK via `npx expo install --fix` + `cd ios && pod install`. |
| **ADR-06** | **Android CNG (`plugins/withAndroidReleaseSigning.js`), iOS prebuilt (`ios/`)** | `ios/` is tracked because of custom Swift LiveActivity WidgetKit & AppIntents. `android/` is not committed — generated cleanly in CI via `expo prebuild --platform android --clean` + config plugin. |

---

## 6. Known Technical Debt, Security Gaps & Roadmap

### High-Priority Security & Architecture Hardening (Next Releases)
- **[P1 Security] Migrate Cloud Session Token & E2EE Private Key to `expo-secure-store`:** Currently stored in `AsyncStorage` (`@iron_routine:cloud_session_v2`, E2EE keypair). Implement seamless read-and-migrate to iOS Keychain / Android Keystore.
- **[P1 Security] Upgrade Clerk to Production Instance (`pk_live_` / `sk_live_`):** Replace `pk_test_...` fallback in `website/src/pages/MobileAuthPage.tsx` with production Clerk keys & custom domain in Vercel env vars.
- **[P1 Security] API Rate Limiting:** Add rate limiting (Upstash Redis or Vercel WAF) on `/api/cloud/auth` and `/api/social` to prevent brute-force & spam floods.
- **[P1 Architecture] Decompose Vibe-Coded Monoliths:** Refactor the largest files into clean feature folders (`src/features/<domain>/`) BEFORE adding major new features to them:
  - `src/components/ProgressTab.tsx` (5,663 lines) → split into `PhysiqueSection`, `RankLadderModal`, `ExercisesPRTab`, `StatsTelemetryTab`, `BodyJournalSection`
  - `src/i18n/translations.ts` (5,516 lines) → split per locale (`pl.ts`, `en.ts`, `de.ts`, `fr.ts`, `es.ts`)
  - `src/components/FriendChatModal.tsx` (4,027 lines) → split composer, voice recorder, message bubbles, theme picker
  - `src/components/OnboardingScreen.tsx` (3,284 lines) → split per step
  - `src/screens/SettingsScreen.tsx` (2,852 lines) → split into 4 tab modules
  - `src/components/ActiveWorkoutView.tsx` (2,683 lines) → split timer, set editor, exercise switcher
  - `src/services/storage.ts` (2,028 lines) → split into `profiles`, `plans`, `history`, `prs`, `backup`
- **[P1 Quality] Automated Unit Tests:** Add Vitest/Jest tests for `e2ee.ts`, `storage.ts` backup/import, `rankCalculator`, `nickname.ts`, and `website/api/_lib/cloudStore.ts`.

### Product Feature Roadmap (Preserved from Archived Backlog)
- **Double Progression Suggestions:** Smart weight & rep progression hints during active sets (formerly #34).
- **Write Completed Workouts to Apple HealthKit & Health Connect:** Two-way workout export, not just read (formerly #33).
- **Supersets & Drop-Sets:** Grouped exercise execution in Plan Editor and `ActiveWorkoutView` (formerly #35).
- **Barbell Plate Calculator:** Visual per-side plate breakdown inside active set editor (formerly #36).
- **Android Persistent Rest Timer Notification:** Foreground-service / ongoing notification equivalent to iOS Live Activity (formerly #11).
- **App Store Header & Search Results Activation:** Attach already-uploaded `Asset Library` creative assets (`3840×1646` & `3840×2560`) in `v3.1.2`, and publish iOS Accessibility Declarations once `3.1.1` is live on the App Store.

---

## 7. Mandatory Documentation Maintenance Protocol

Every AI agent or developer making changes MUST keep project memory synchronized:

| If You Change... | You MUST Update... |
| --- | --- |
| New feature, screen, or product rule | `docs/PROJECT_MEMORY.md` (Section 3 + Roadmap) and `CHANGELOG.md` |
| Directory structure, storage key, DB table, or API endpoint | `docs/ARCHITECTURE.md` |
| Security model, auth flow, or compliance rule | `docs/PROJECT_MEMORY.md` (Section 4 & 5) + `website/src/pages/PrivacyPage.tsx` if user data changes |
| Build script, signing, CI/CD, or store config | `docs/RELEASE_AND_STORES.md` |
| Version bump / release | Run `npm run version:patch\|minor\|major`, update `CHANGELOG.md`, update header date/version in `docs/PROJECT_MEMORY.md` |
| Agent rules or workflows | Update **`AGENTS.md` ONLY** (never duplicate rules into `CLAUDE.md`, `GEMINI.md`, or `.github/copilot-instructions.md`) |
