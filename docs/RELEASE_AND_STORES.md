# Iron Routine — Release, CI/CD & Store Publishing Runbook

> Part of the Iron Routine Central Documentation System. Start with [AGENTS.md](../AGENTS.md) and [PROJECT_MEMORY.md](./PROJECT_MEMORY.md).

---

## 1. Git Branching & Semantic Versioning (`MAJOR.MINOR.PATCH`)

- **`dev`**: Active integration branch. All feature/fix work and PRs target `dev`.
- **`main`**: Production branch. Merging `dev` → `main` automatically deploys the website & Vercel Serverless API (`website/vercel.json`).
- **SemVer Tags (`vX.Y.Z`):** Pushing an annotated tag `vX.Y.Z` on `main` triggers GitHub Actions to build and publish signed Android `.aab` + `.apk` artifacts to GitHub Releases.

### Version Bump Procedure (NEVER edit version numbers manually!)
```bash
npm run version:patch   # 3.1.1 -> 3.1.2 (bug fixes, UI polish)
npm run version:minor   # 3.1.1 -> 3.2.0 (new features)
npm run version:major   # 3.1.1 -> 4.0.0 (major redesign / breaking change)
```
`scripts/bump-version.mjs` atomically synchronizes:
1. `package.json` (`version`)
2. `app.json` (`expo.version`, `expo.ios.buildNumber`, `expo.android.versionCode`)
3. `ios/IronRoutine/Info.plist` (`CFBundleShortVersionString`, `CFBundleVersion`)
4. `ios/IronRoutine.xcodeproj/project.pbxproj` (`MARKETING_VERSION`, `CURRENT_PROJECT_VERSION` across all 4 targets including `LiveActivity`)
5. `website/src/data/websiteContent.ts`

Always update `CHANGELOG.md` with a `## [X.Y.Z] - YYYY-MM-DD` section before tagging (GitHub Actions automatically extracts it for Release Notes).

---

## 2. Pre-Release Verification Gate (Mandatory)

```bash
npx tsc --noEmit
npx expo config --type public > /dev/null
(cd website && npx tsc --noEmit && npm run build)
```
If native iOS dependencies changed (`package.json` / `app.json`):
```bash
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
cd ios && pod install && cd ..
```

---

## 3. iOS App Store & TestFlight Publishing

### Key Vault Location
- Apple App Store Connect API Key: `~/Documents/Text Vaults/IronRoutine-Keys/AuthKey_WT2G4S7Z3U.p8` (details in `APPLE_ASC_API_INFO.txt`).
- Signing Certificate: Local `Apple Distribution: Szymon Góral (3X24W8AX3N)` in macOS Keychain (**MUST remain local** — never rely solely on Cloud Managed Signing due to Apple's UTF-8 NFC/NFD bug on `ó`, `ITMS-90035`).

### Build & Upload to TestFlight / App Store Connect (1 Command)
```bash
./scripts/release-ios-appstore.sh
```
- Archives `ios/IronRoutine.xcworkspace` (`Release`, `generic/platform=iOS`) and uploads via `scripts/ExportOptions-AppStore.plist`.
- Optional: Run `scripts/asc-configure.mjs` with `ASC_ISSUER_ID`, `ASC_KEY_ID`, `ASC_PRIVATE_KEY_PATH` to sync store metadata, attach the processed build, and upload screenshots from `assets/appstore-screenshots/`.
- Local physical iPhone Release install: `./scripts/deploy.sh`.

### iOS App Review Pitfalls (Already Solved — Do Not Reintroduce)
- Never put the word `"Apple"` or `"Siri"` inside Swift `IntentDescription` (`ios/IronRoutine/AppDelegate.swift` — causes `ITMS-90626`).
- Never show external donation/payment links (`Buy Me a Coffee`) on `Platform.OS === 'ios'` (Guideline 3.1.1).
- Keep Sign in with Apple buttons labeled `"Apple"` / `"Continue with Apple"` (not `"iCloud"`).
- Keep `ITSAppUsesNonExemptEncryption: false` in `app.json` & `Info.plist`.
- Keep China mainland (`CHN`) excluded in App Store Connect territories while chat/UGC is present.

---

## 4. Android Google Play Store & GitHub Releases

### Key Vault & GitHub Secrets
- Upload Keystore (PKCS#12, RSA 4096-bit): `~/Documents/Text Vaults/IronRoutine-Keys/iron-routine-upload.p12` (details & SHA-1/SHA-256 in `KEYSTORE_INFO.txt`).
- GitHub Repository Secrets (`matiqueue/iron-routine`):
  - `ANDROID_KEYSTORE_BASE64`
  - `ANDROID_KEYSTORE_PASSWORD`
  - `ANDROID_KEY_ALIAS`
  - `ANDROID_KEY_PASSWORD`
  - *(Optional for auto-upload)* `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

### Automated Build Pipeline (`.github/workflows/android-release.yml`)
- Runs on every SemVer tag push `vX.Y.Z` (or manual `workflow_dispatch`).
- Uses `plugins/withAndroidReleaseSigning.js` + `gradle/actions/setup-gradle@v4` to compile BOTH:
  - `IronRoutine-vX.Y.Z.aab` — production-signed **Google Play Android App Bundle**
  - `IronRoutine.apk` + `IronRoutine-vX.Y.Z.apk` — production-signed universal APK
- Publishes both to **GitHub Releases** and (if `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` is set) automatically uploads `.aab` to Google Play Internal Track.
- Store graphic assets live in `assets/playstore-assets/` (`icon-512x512.png`, `feature-graphic-1024x500.png`, 5x `1440x2880` 1:2 screenshots).

---

## 5. GitHub Repository Hygiene Rules

- Only two permanent branches: `main` and `dev` (`delete_branch_on_merge: true` is enabled).
- Dependabot (`.github/dependabot.yml`) updates `github-actions` and `website/` deps weekly, and intentionally **ignores** `expo*` / `react-native*` / `react*` so Expo SDK upgrades are always performed atomically via `npx expo install --fix`.
- CI (`.github/workflows/ci.yml`) gates every push and PR on `main` and `dev` with `concurrency` cancellation enabled.
