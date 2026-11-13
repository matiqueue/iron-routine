# Changelog

Wszystkie istotne zmiany w aplikacji **Iron Routine**.

## [v1.0.1] - 2026-11-13

### Dodano
- Dedykowana strona internetowa pobierania (`website/`) w stylu Industrial Monochrome Athletic z bezpośrednim pobieraniem APK oraz instrukcją instalacji iOS, wdrożona na Vercel.
- Rozszerzenie CI (`ci.yml`) o automatyczną weryfikację buildu strony WWW.

## [v1.0.0] - 2026-11-13

### Dodano
- Pierwsze publiczne wydanie **Iron Routine** (iOS & Android, offline-first).
- Tryb aktywnego treningu z przyciskiem *Hold-to-Start*, logowaniem serii, pływającym timerem przerwy (`RestTimerBar`) oraz podsumowaniem sesji.
- **iOS Live Activities & Dynamic Island** (`expo-live-activity`) prezentujące bieżącą serię i odliczanie przerwy na ekranie blokady.
- Interaktywne powiadomienia o kreatynie (09:00 / 22:00 z przyciskami akcji z ekranu blokady) oraz przypomnienia o ważeniu.
- Zakładka **Osiągi** (`ProgressTab`): kalkulator 1RM (wzór Epleya), wykresy trendów SVG (`ModernSplineChart`), historia wagi i statystyki ciała (`BodyStatsModal`).
- Obsługa wielu profili użytkowników oraz motyw jasny i ciemny.
- Pełna konfiguracja GitHub: CI, auto-release Android APK, szablony Issues/PR, `CONTRIBUTING.md`, `SECURITY.md` i `CODE_OF_CONDUCT.md`.
