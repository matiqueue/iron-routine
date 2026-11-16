<div align="center">
  <img src="./assets/banner-mono.svg" alt="Iron Routine Monochrome Banner" width="100%" />
  <br /><br />
  <p><b>Minimalistyczny, monochromatyczny dziennik treningowy, analityka mięśniowa F–S+ oraz szyfrowany E2EE komunikator ekipy (iOS, Android i Web · 5 języków · Neon PostgreSQL)</b></p>

  <p>
    <a href="https://iron-routine-app.vercel.app"><img src="https://img.shields.io/badge/Strona_WWW-Portal_Pobierania-FFFFFF?style=for-the-badge&labelColor=09090B" alt="Strona WWW" /></a>
    <a href="https://github.com/matiqueue/iron-routine/releases"><img src="https://img.shields.io/github/v/release/matiqueue/iron-routine?style=for-the-badge&color=18181A" alt="Release" /></a>
    <a href="https://github.com/matiqueue/iron-routine/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/matiqueue/iron-routine/ci.yml?branch=main&style=for-the-badge&label=CI" alt="CI Status" /></a>
    <a href="https://github.com/matiqueue/iron-routine/issues"><img src="https://img.shields.io/github/issues/matiqueue/iron-routine?style=for-the-badge&color=27272A" alt="Issues" /></a>
    <a href="https://matiqueue-portfolio.vercel.app"><img src="https://img.shields.io/badge/Support-Buy_Me_a_Coffee-121214?style=for-the-badge&labelColor=000000" alt="Buy Me a Coffee" /></a>
  </p>
</div>

> **Portal projektu, dokumentacja i pobieranie APK:** [iron-routine-app.vercel.app](https://iron-routine-app.vercel.app)

---

## Najważniejsze funkcje (v3.0.0)

- **Monochrome AMOLED UI & Minimalistyczne Tła**: Czysta paleta czerni `#000000` i ciemnych kart `#121214` (plus tryb jasny), subtelne tła architektoniczne (`MinimalistBackdrop`), płynny dock nawigacyjny liquid-glass oraz zamykanie okien gestem przesunięcia w dół (`InteractiveBottomSheet`).
- **6-krokowy Animowany Konfigurator & Konta (`@nick`)**: Wybór języka z flagami (`PL`, `EN`, `DE`, `FR`, `ES`), płci modelu, imienia i nazwiska oraz unikalnego `@nicku` (z generatorem i blokadą zmiany co 30 dni), parametrów ciała, suplementacji (`Zalecane` / `g/kg` / `Własna`), trybu planu z wymianą ćwiczeń oraz logowania **Clerk (Apple iCloud / Google)** lub pracy 100% lokalnej.
- **Neon PostgreSQL (`AES-256-GCM`) & Relacyjny Schemat Chmury**: Opcjonalne logowanie przez **Apple iCloud** lub **Google** bezpiecznie synchronizuje kopię profilu i rekordy w bazie **Neon PostgreSQL** do wygodnego przenoszenia konta między urządzeniami.
- **Zakładka Znajomi & Szyfrowany Czat E2EE (`Curve25519`)**: Dodawanie znajomych po `@nicku`, radar ekipy (`CrewRadarOrb`), karuzela awatarów (`SquadAvatarRing`), profile 1 na 1 (`VsComparisonArc`), tablica aktywności z kudosami, ranking podium (`CrewPodiumStage`) oraz komunikator tekstowy szyfrowany End-to-End **X25519 + XSalsa20-Poly1305** (`tweetnacl` + `expo-crypto`), w którym serwer widzi wyłącznie zaszyfrowany szyfrogram.
- **Osiągi: Model Anatomiczny (Męski / Kobiecy) & Spektrum Rang F–S+**: Interaktywna sylwetka obracana w osi pionowej, żywe kolory stymulacji partii, spektrum rang **F–S+** dla 19 grup mięśniowych oraz baza **136 ćwiczeń** (z ulubionymi i własnymi) w 5 językach.
- **Jeden Profil, Wiele Planów i Wspólne Rekordy PR**: Przełączaj schematy treningowe (`FBW`, `Upper/Lower`, `PPL`, `Split 4D`) bez utraty historii serii, szacowanego 1RM ani wykresów postępu.
- **Uporządkowane 4-zakładkowe Ustawienia**: Podział na **Profil**, **Trening**, **System** i **Dane** (z odciskiem klucza E2EE, kopiami JSON, bazą ćwiczeń i resetem).
- **iOS Live Activities, Dynamic Island i Alarm Przerw w Tle**: Podgląd bieżącej serii i stopera na ekranie blokady wraz z 3-falowym alarmem `rest_alarm.wav`.
- **Apple HealthKit & Google Health Connect**: Odczyt kroków, snu, aktywnych kalorii i dystansu na ekranie **Trening**.

---

## Stack technologiczny

- **Aplikacja mobilna i Web**: [Expo SDK 58](https://expo.dev) / [React Native 0.88](https://reactnative.dev) / TypeScript / `react-native-web`
- **Pamięć lokalna & Szyfrowanie E2EE**: `@react-native-async-storage/async-storage`, `expo-crypto`, `tweetnacl` (`Curve25519`)
- **Backend & Chmura**: **Vercel Serverless Functions** + **Clerk** + **Neon PostgreSQL** (`@neondatabase/serverless`, szyfrowanie backupów `AES-256-GCM`)
- **Moduły natywne**: `expo-live-activity`, `@kingstinct/react-native-healthkit`, `react-native-health-connect`, `expo-notifications`, `expo-haptics`, `expo-keep-awake`, `react-native-svg`
- **Portal WWW (`website/`)**: React 19 + Vite + TypeScript + Tailwind CSS (hostowany na Vercel z gałęzi `main`)

---

## Uruchomienie i instalacja

### Testowanie wielu kont na Macu w przeglądarce (`Expo Web`)

```bash
git clone https://github.com/matiqueue/iron-routine.git
cd iron-routine
npm install
npm run web   # Uruchamia aplikację mobilną lokalnie pod http://localhost:8081
```

### iPhone (iOS) — wymagany Mac + Xcode + Tryb Dewelopera

Ze względu na natywne **Live Activities (WidgetKit)** oraz **Apple HealthKit**, build iOS wymaga macOS:

1. Zainstaluj **Xcode** i włącz **Tryb dewelopera** na iPhonie (**Ustawienia > Prywatność i ochrona**).
2. Zaloguj Apple ID w **Xcode > Settings > Accounts** (darmowy Personal Team).
3. Zbuduj i zainstaluj Release na telefon:
   ```bash
   cd ios && pod install && cd ..
   npm run deploy
   ```

### Android (.APK)

Pobierz gotową paczkę instalacyjną `.apk` bezpośrednio ze strony **[iron-routine-app.vercel.app/instalacja](https://iron-routine-app.vercel.app/instalacja)** lub z zakładki **[GitHub Releases](https://github.com/matiqueue/iron-routine/releases/latest)**.

---

## Struktura projektu

```text
iron-routine/
├── assets/                          # Ikona hex+talon, splash screen i rest_alarm.wav
├── ios/                             # Projekt natywny iOS + WidgetKit (LiveActivity)
├── scripts/
│   ├── deploy.sh                    # Build Release + podpis + instalacja na fizyczny iPhone
│   └── use-seed.mjs                 # Generator i czyszczenie prywatnych seedów z seeds/
├── src/
│   ├── components/                  # Ekran Planu, Osiągów, Znajomych (E2EE, Podium, Radar), Modale i BottomSheet
│   ├── context/                     # ThemeContext & LanguageContext
│   ├── data/                        # Kanoniczna baza 136 ćwiczeń, mapa 19 partii, suplementy i szablony
│   ├── i18n/                        # Tłumaczenia UI, ćwiczeń, rang i szablonów (pl/en/de/fr/es)
│   ├── screens/                     # TodayScreen i 4-zakładkowy SettingsScreen
│   ├── services/                    # Storage, CloudSync (PostgreSQL), Social (E2EE), Health, LiveActivity, Notifications
│   ├── types/workout.ts             # Definicje typów TypeScript
│   └── utils/                       # E2EE (Curve25519), Nicknames (cooldown 30 dni), SessionExercises
├── website/
│   ├── api/                         # Funkcje Vercel API (cloud/auth, cloud/sync, social/index) + Neon PostgreSQL
│   ├── src/pages/                   # Portal WWW: Home, Funkcje, Analityka 1RM, Instalacja, MobileAuth
│   └── vercel.json                  # Deploy Vercel ograniczony do gałęzi main
└── App.tsx
```

---

## Automatyczne CI/CD i Publikacja

- **CI (`ci.yml`)**: Weryfikuje TypeScript (`npx tsc --noEmit`), konfigurację Expo (`npx expo config --type public`) oraz build produkcyjny portalu (`website/`).
- **Android Release (`android-release.yml`)**: Na pushu do `main` lub wypchnięciu taga `v*` automatycznie kompiluje `IronRoutine.apk` i publikuje GitHub Release.
- **Vercel (`website/vercel.json`)**: Automatyczne wdrożenia wyłącznie z gałęzi produkcyjnej `main`.

---

## Współtworzenie & Wsparcie

- **Main Contributor**: [matique (@matiqueue)](https://github.com/matiqueue)
- **Buy Me a Coffee**: [matiqueue-portfolio.vercel.app](https://matiqueue-portfolio.vercel.app)

Przed otwarciem Pull Requesta zapoznaj się z [CONTRIBUTING.md](./CONTRIBUTING.md), [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) oraz [SECURITY.md](./SECURITY.md). Pull Requesty kierujemy zawsze na gałąź **`dev`**, a wydania produkcyjne publikowane są przez scalenie `dev` -> `main`.
