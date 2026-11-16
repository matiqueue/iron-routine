# Współtworzenie projektu Iron Routine

Dziękujemy za zainteresowanie rozwojem **Iron Routine**! Każde zgłoszenie błędu, propozycja funkcji lub Pull Request pomaga ulepszać aplikację.

## Wymagania lokalne

- Node.js 20+
- npm
- Expo CLI (`npx expo`)
- Do budowania natywnego iOS: macOS + Xcode + CocoaPods
- Do testów w przeglądarce: `npm run web` (`http://localhost:8081`)

## Uruchomienie projektu

```bash
git clone https://github.com/matiqueue/iron-routine.git
cd iron-routine
npm install
npx expo start          # iOS / Android
npm run web             # Expo Web na http://localhost:8081
```

> **Ważne**: `npm install` automatycznie tworzy lokalne, ignorowane przez Git pliki `src/data/myPlan.ts` oraz `src/data/localSeed.ts` na podstawie szablonów. Nie commituj prywatnych planów ani plików `.env.local`.

## Przepływ pracy (Git Flow: `dev` -> `main`)

- **`dev`** to główna gałąź developerska (chroniona CI). Wszystkie nowe funkcje, poprawki i Pull Requesty kierujemy **do gałęzi `dev`**.
- **`main`** to chroniona gałąź produkcyjna. Scalenie zmian z `dev` do `main` z podbitą wersją w `package.json` i `app.json` automatycznie uruchamia workflow publikujący nowy Release (`IronRoutine.apk`) oraz deploy portalu i API Vercel (`website/`).

## Sprawdzanie kodu przed Pull Requestem

1. Upewnij się, że TypeScript oraz konfiguracja Expo przechodzą bez błędów:
   ```bash
   npx tsc --noEmit
   npx expo config --type public > /dev/null
   (cd website && npm run build)
   ```
2. Powiąż PR z odpowiednim Issue (`Closes #...`), wybierz typ (`Bug`, `Feature`, `Task`) oraz uzupełnij pola w projekcie **Iron Routine Roadmap**.

## Zgłaszanie błędów i pomysłów

- Błędy i propozycje funkcji zgłaszaj w zakładce **Issues** za pomocą przygotowanych formularzy.
- Pytania ogólne oraz dyskusje prowadzimy w zakładce **Discussions**.
