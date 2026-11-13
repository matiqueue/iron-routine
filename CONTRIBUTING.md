# Współtworzenie projektu Iron Routine

Dziękujemy za zainteresowanie rozwojem **Iron Routine**! Każde zgłoszenie błędu, propozycja funkcji lub Pull Request pomaga ulepszać aplikację.

## Wymagania lokalne

- Node.js 20+
- npm
- Expo CLI (`npx expo`)
- Do budowania natywnego iOS: macOS + Xcode + CocoaPods

## Uruchomienie projektu

```bash
git clone https://github.com/matiqueue/iron-routine.git
cd iron-routine
npm install
npx expo start
```

> **Ważne**: `npm install` automatycznie tworzy lokalny, ignorowany przez Git plik `src/data/myPlan.ts` na podstawie `src/data/myPlan.template.ts`. Nie commituj swojego prywatnego planu treningowego.

## Przepływ pracy (Git Flow: `dev` -> `main`)

- **`dev`** to główna gałąź developerska (chroniona CI). Wszystkie nowe funkcje, poprawki i Pull Requesty kierujemy **do gałęzi `dev`**.
- **`main`** to chroniona gałąź produkcyjna. Scalenie zmian z `dev` do `main` z podbitą wersją w `package.json` / `app.json` automatycznie uruchamia workflow publikujący nowy Release (`IronRoutine.apk`).

## Sprawdzanie kodu przed Pull Requestem

1. Upewnij się, że TypeScript kompiluje się bez błędów:
   ```bash
   npx tsc --noEmit
   ```
2. Powiąż PR z odpowiednim Issue (`Closes #...`), wybierz typ (`Bug`, `Feature`, `Task`) oraz uzupełnij pola w projekcie **Iron Routine Roadmap**.

## Zgłaszanie błędów i pomysłów

- Błędy i propozycje funkcji zgłaszaj w zakładce **Issues** za pomocą przygotowanych formularzy.
- Pytania ogólne oraz dyskusje prowadzimy w zakładce **Discussions**.
