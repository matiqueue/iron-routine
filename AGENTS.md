# Iron Routine — Canonical AI Agent Instructions (Single Hub)

> **This file (`AGENTS.md`) is the ONE authoritative instruction hub for all AI coding agents** — including **ChatGPT / Codex / GitHub Copilot**, **Claude / Claude Code**, and **Gemini / Antigravity**.
> `CLAUDE.md`, `GEMINI.md`, and `.github/copilot-instructions.md` are thin entrypoints that point here. **NEVER duplicate rules across agent files — always edit `AGENTS.md` only.**

---

## 1. Mandatory Startup Reading Order (Do This First)

Before writing code or proposing architectural changes, read:
1. **`AGENTS.md`** (this file) — operating rules, verification gates, and doc-sync contract.
2. **[docs/PROJECT_MEMORY.md](./docs/PROJECT_MEMORY.md)** — product vision, non-negotiable principles, security invariants, ADRs, technical debt, and roadmap.
3. **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** — real directory map, AsyncStorage keys, PostgreSQL tables, Vercel API endpoints, and thermal/performance rules.
4. **[docs/RELEASE_AND_STORES.md](./docs/RELEASE_AND_STORES.md)** — only when touching versioning, signing, CI/CD, App Store, or Google Play.

---

## 2. Expo SDK & React Native Rules (Do Not Trust Training Data)

This is an **Expo SDK 58 / React Native 0.88 / TypeScript** mobile app with a **Vite + React 19 + Vercel Serverless (`website/`)** companion portal and **Neon PostgreSQL** backend.

1. Before using any Expo, EAS, or React Native API, verify the installed version in `package.json` and check `https://docs.expo.dev/versions/v<major>.0.0/` or `https://docs.expo.dev/llms.txt` (or inspect `node_modules/<pkg>/build/*.d.ts`).
2. **ALWAYS** install Expo/RN packages with `npx expo install <package>` (never raw `npm install <pkg>`).
3. **Navigation (CRITICAL CORRECTION):** Iron Routine does **NOT** use Expo Router (`src/app/` does NOT exist). Navigation lives in `App.tsx` via a custom lazy keep-alive 5-tab architecture (`today`, `plan`, `progress`, `friends`, `settings`) with `<TabActivityProvider>` and `ironroutine://` deep links in `src/services/voiceCommands.ts`. Do NOT introduce Expo Router files unless explicitly planned as a major migration.
4. **Native Directories:**
   - `ios/` IS tracked in Git (custom Swift LiveActivity WidgetKit + AppIntents). After adding native packages, run `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 && cd ios && pod install`.
   - `android/` is **NOT** tracked (CNG — Continuous Native Generation). Never commit `android/`; configure Android native behavior via `app.json` and config plugins (`plugins/`).

---

## 3. Anti-Vibe-Code Discipline (Prevent Monolith Growth)

Parts of this codebase grew organically into large files (`ProgressTab.tsx` ~5.6k lines, `translations.ts` ~5.5k lines, `FriendChatModal.tsx` ~4k lines, `OnboardingScreen.tsx` ~3.2k lines, `SettingsScreen.tsx` ~2.8k lines, `ActiveWorkoutView.tsx` ~2.6k lines).

Follow these strict rules when editing:
1. **Do NOT bloat giant monoliths further:** When adding a new feature or redesigning a section inside any file >800 lines, extract the new UI/logic into a clean, focused module under `src/components/<domain>/`, `src/hooks/`, or `src/utils/` and import it.
2. **Single Source of Truth for Types & Translations:** Domain types live in `src/types/workout.ts`. Any new user-facing string MUST be added across all 5 locales (`pl`, `en`, `de`, `fr`, `es`) in `src/i18n/translations.ts`.
3. **Zero Thermal/Battery Leaks:** Gate all `Animated.loop`, timers, and polling with `useIsScreenActive()` (`TabActivityContext`) and `AppState === 'active'`. Always prefer `useNativeDriver: true`.
4. **Guard Async State:** Protect async loads (e.g., switching friends, plans, profiles) with active-ID refs so stale network responses never overwrite newer UI state.
5. **Android Storage Safety:** Never store raw base64 images/audio in AsyncStorage caches (2 MB Android SQLite CursorWindow limit).

---

## 4. Security & Store Compliance Guardrails

- **Auth:** Never trust client-supplied email/userId in `website/api/cloud/auth.ts`. Always verify Apple `identityToken` against Apple JWKS or Clerk session JWT via Clerk Backend API. Never reintroduce fallback secrets.
- **E2EE:** Never allow silent plaintext downgrade in `src/utils/e2ee.ts`. Clear memory caches (`clearE2eeMemoryCaches()`) on sign-out, account deletion, and reset.
- **App Store / Play Store:**
  - Hide external donation/payment links (`Buy Me a Coffee`) on `Platform.OS === 'ios'`.
  - Keep permanent in-app account deletion in `SettingsScreen.tsx` and Report/Block controls in `FriendProfileModal.tsx`.
  - Never include `"Apple"` or `"Siri"` inside Swift `IntentDescription` strings (`ios/IronRoutine/AppDelegate.swift` — causes `ITMS-90626`).
  - Never commit private keys, `.p8`, `.p12`, `.jks`, `.env`, or `seeds/`. Local keys belong strictly in `~/Documents/Text Vaults/IronRoutine-Keys/`.

---

## 5. Verification Commands (Mandatory Before Declaring Any Task Done)

```bash
# 1. Mobile TypeScript check
./node_modules/.bin/tsc --noEmit

# 2. Expo config & plugins check
npx expo config --type public > /dev/null

# 3. Website & API TypeScript + production build (whenever website/ is touched)
cd website && ./node_modules/.bin/tsc --noEmit && npm run build

# 4. Version bump (NEVER edit version numbers manually across files)
npm run version:patch   # or version:minor / version:major
```

---

## 6. Mandatory Documentation & Memory Update Contract

**Before finishing ANY meaningful task, you MUST update the corresponding memory file(s):**

| Change Made | Required Documentation Update |
| --- | --- |
| New user-facing feature, UI overhaul, or product rule | `docs/PROJECT_MEMORY.md` (Feature Inventory / Roadmap) + `CHANGELOG.md` |
| New folder, storage key, DB table, or API endpoint | `docs/ARCHITECTURE.md` |
| New architectural decision or store/signing gotcha | `docs/PROJECT_MEMORY.md` (Section 5: ADRs) |
| Change to security, auth, or collected user data | `docs/PROJECT_MEMORY.md` (Section 4) + `website/src/pages/PrivacyPage.tsx` |
| Change to CI/CD, GitHub workflows, or store release flow | `docs/RELEASE_AND_STORES.md` |
| Version bump / release | `CHANGELOG.md` + header date/version in `docs/PROJECT_MEMORY.md` |
| New agent workflow rule | **`AGENTS.md` ONLY** (never fork rules into `CLAUDE.md` / `GEMINI.md` / Copilot) |

Keep commits clean on `dev`, merge `dev` → `main` for production releases, and tag SemVer releases `vX.Y.Z` on `main`.
