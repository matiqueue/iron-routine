<div align="center">
  <h1>Iron Routine</h1>
  <p><b>Minimalistyczny, monochromatyczny dziennik treningowy i tracker progresu siłowego (iOS & Android, 100% offline)</b></p>

  <p>
    <a href="https://github.com/matiqueue/iron-routine/releases"><img src="https://img.shields.io/github/v/release/matiqueue/iron-routine?style=for-the-badge&color=111827" alt="Release" /></a>
    <a href="https://github.com/matiqueue/iron-routine/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/matiqueue/iron-routine/ci.yml?branch=main&style=for-the-badge&label=CI" alt="CI Status" /></a>
    <a href="https://github.com/matiqueue/iron-routine/issues"><img src="https://img.shields.io/github/issues/matiqueue/iron-routine?style=for-the-badge" alt="Issues" /></a>
    <a href="https://github.com/matiqueue/iron-routine/discussions"><img src="https://img.shields.io/github/discussions/matiqueue/iron-routine?style=for-the-badge" alt="Discussions" /></a>
  </p>
</div>

---

## Najważniejsze funkcje

- **Dual Monochromatic Theme**: Czysta, minimalistyczna paleta czerni i bieli (tryb jasny i ciemny) z szybkim przełącznikiem w nagłówku.
- **Tryb Aktywnego Treningu**: Prowadzenie krok po kroku przez ćwiczenia, logowanie powtórzeń i ciężaru, pływający timer przerwy (`RestTimerBar`) z gestem zamykania oraz wibracjami Haptics.
- **iOS Live Activities & Dynamic Island**: Podgląd aktualnego ćwiczenia, numeru serii i odliczania przerwy bezpośrednio na ekranie blokady i Dynamic Island (`expo-live-activity`).
- **Tactile Hold-to-Start**: Animowany przycisk przytrzymania zapobiegający przypadkowemu rozpoczęciu treningu.
- **Rekordy i Osiągi (1RM Epley & Wykresy SVG)**: Automatyczne wyliczanie szacowanego 1RM, wykresy trendów (`7d` / `30d` / `90d`), filtrowanie po partiach mięśniowych oraz dziennik masy ciała (`BodyStatsModal`).
- **Interaktywne przypomnienia o kreatynie i wadze**: Powiadomienia poranne i wieczorne z szybkimi przyciskami odpowiedzi bezpośrednio z powiadomienia.
- **Wiele profili i 100% Offline**: Niezależna historia rekordów dla wielu użytkowników zapisywana lokalnie w `AsyncStorage`, bez kont w chmurze i bez reklam.

---

## Stack technologiczny

- **Framework**: [Expo SDK 58](https://expo.dev) / [React Native 0.88](https://reactnative.dev)
- **Język**: TypeScript
- **Pamięć lokalna**: `@react-native-async-storage/async-storage`
- **Funkcje natywne**: `expo-live-activity`, `expo-notifications`, `expo-haptics`, `expo-keep-awake`, `react-native-svg`

---

## Instalacja i uruchomienie

### Wymagania

- [Node.js](https://nodejs.org/) (v20+)
- macOS z Xcode + CocoaPods (dla wersji iOS) lub JDK 17 (dla Androida)

### Krok po kroku

1. **Sklonuj repozytorium**:
   ```bash
   git clone https://github.com/matiqueue/iron-routine.git
   cd iron-routine
   ```

2. **Zainstaluj zależności**:
   ```bash
   npm install
   ```
   *(Skrypt `prepare` automatycznie wygeneruje startowy plan w `src/data/myPlan.ts` z pliku `src/data/myPlan.template.ts`. Plik `myPlan.ts` jest ignorowany przez Git).*

3. **Uruchom aplikację**:
   - **iOS (Release na podłączonym iPhonie)**:
     ```bash
     npm run deploy
     ```
   - **Tryb deweloperski (Expo)**:
     ```bash
     npx expo start
     ```
   - **Android APK**: Gotowe pliki `.apk` budowane są automatycznie przez GitHub Actions w zakładce **[Releases](https://github.com/matiqueue/iron-routine/releases)**.

---

## Struktura projektu

```text
iron-routine/
├── assets/                          # Ikony i splash screen
├── scripts/
│   └── deploy.sh                    # Skrypt kompilacji i instalacji Release na iOS
├── src/
│   ├── components/
│   │   ├── ActiveWorkoutView.tsx    # Ekran aktywnego treningu
│   │   ├── BodyStatsModal.tsx       # Pomiary masy ciała i statystyki
│   │   ├── ExerciseDetailModal.tsx  # Szczegóły ćwiczenia i technika
│   │   ├── HoldToStartButton.tsx    # Przycisk przytrzymania Hold-to-Start
│   │   ├── ModernSplineChart.tsx    # Wykresy trendów SVG
│   │   ├── PlanTab.tsx              # Tygodniowy plan treningowy
│   │   ├── ProfileSelectorModal.tsx # Zarządzanie profilami
│   │   ├── ProgressTab.tsx          # Rekordy, 1RM i historia
│   │   ├── RestDayView.tsx          # Widok dnia regeneracji
│   │   ├── RestTimerBar.tsx         # Pływający timer przerwy
│   │   ├── SplashScreen.tsx         # Animacja startowa
│   │   └── WorkoutSummaryModal.tsx  # Podsumowanie ukończonego treningu
│   ├── constants/theme.ts           # Palety Light & Dark
│   ├── context/ThemeContext.tsx     # Provider motywu
│   ├── data/
│   │   ├── myPlan.template.ts       # Publiczny szablon planu
│   │   └── planData.ts              # Loader planu treningowego
│   ├── services/
│   │   ├── liveActivity.ts          # Obsługa Live Activities / Dynamic Island
│   │   ├── notifications.ts         # Powiadomienia kreatyny i wagi
│   │   └── storage.ts               # Zapis lokalny i kalkulacje 1RM
│   └── types/workout.ts             # Definicje typów TypeScript
├── App.tsx                          # Główny punkt wejścia
└── package.json
```

---

## Automatyczne CI/CD (GitHub Actions)

- **CI (`ci.yml`)**: Uruchamia się na każdym pushu i Pull Requeście do gałęzi `dev` i `main` (sprawdza TypeScript `npx tsc --noEmit` oraz konfigurację Expo).
- **Release (`android-release.yml`)**: Po scaleniu zmian na `main` (z nową wersją w `package.json`) lub wypchnięciu taga `v*` automatycznie kompiluje `IronRoutine.apk` i publikuje GitHub Release.

---

## Współtworzenie (Contributing & Git Flow)

Przed rozpoczęciem pracy zapoznaj się z [CONTRIBUTING.md](./CONTRIBUTING.md), [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) oraz [SECURITY.md](./SECURITY.md).

### Przepływ gałęzi (`dev` -> `main`)
- **`dev`** to główna gałąź developerska (chroniona CI). Wszystkie nowe funkcje, poprawki i **Pull Requesty kierujemy do `dev`**.
- **`main`** to chroniona gałąź produkcyjna (wymaga Code Review + zielonego CI). Scalenie `dev` -> `main` z podbitą wersją w `package.json` automatycznie buduje i publikuje nowe wydanie.

### Jak dodać zmianę krok po kroku
1. Zrób **Fork** lub utwórz gałąź z `dev` (`git checkout dev && git checkout -b feat/nowa-funkcja`).
2. Wprowadź zmiany i sprawdź typy: `npx tsc --noEmit`.
3. Otwórz **Pull Request do gałęzi `dev`**, powiąż go z odpowiednim Issue (`Closes #...`) i uzupełnij pola projektu.
4. Masz pomysł lub pytanie? Odwiedź **[GitHub Discussions](https://github.com/matiqueue/iron-routine/discussions)** lub utwórz zgłoszenie z gotowego szablonu w zakładce **Issues**.
