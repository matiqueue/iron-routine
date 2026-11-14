# Changelog

Wszystkie istotne zmiany w aplikacji **Iron Routine**.

## [v2.0.0] - 2026-11-14

### Dodano
- **Architektura jednego profilu i wielu planów**: Przełączanie pomiędzy planami (`PlanManagerModal`) przy zachowaniu wspólnej historii rekordów 1RM oraz znormalizowanej kanonicznej bazy ćwiczeń wraz z opcją tworzenia własnych ćwiczeń.
- **Konfigurator sesji przed startem (Drag & Drop)**: Przeciąganie kolejności ćwiczeń, tymczasowe pomijanie ćwiczeń i dopinanie dodatkowych pozycji z bazy przed startem stopera.
- **4-krokowy animowany Onboarding i Ustawienia**: Konfiguracja profilu, elastycznej suplementacji (`Zalecane`, `g/kg` masy ciała, własne dawki), integracji zdrowotnych oraz haptyki i powiadomień.
- **Apple HealthKit & Google Health Connect**: Odczyt dzisiejszych kroków, snu, kalorii i dystansu wraz z podpowiedziami regeneracyjnymi na ekranie **Dziś**.
- **Wektorowe banery dni & nowa identyfikacja**: Autorskie banery SVG (`DayBannerArtwork`), nowa minimalistyczna ikona sześciokątnego kołnierza z pazurem oraz animacje ikon (`AnimatedIcon`).
- **Wielostronicowy monochromatyczny portal WWW (`website/`)**: Podział na podstrony (`/` • `/funkcje` • `/analityka` • `/instalacja`), grafiki studyjne, interaktywne symulatory Hold-to-Start, Dynamic Island, kalkulatora Epley 1RM oraz konfiguracja `vercel.json` wyłącznie pod gałąź produkcyjną `main`.

### Poprawiono
- Pełna synchronizacja pauzy, regulacji `-15s`/`+15s` i zakończenia przerwy pomiędzy `RestTimerBar`, alarmami lokalnymi `rest_alarm.wav` w tle a iOS Dynamic Island / Live Activity.
- Płynne zamykanie okien modalnych i przewijanych list gestem przesunięcia w dół (`InteractiveBottomSheet` + `BottomSheetScrollView`) oraz responsywność od `375 pt`.
- Stabilizacja wpisywania ciężaru i powtórzeń w `ActiveWorkoutView` oraz mieszczące się w obramowaniu filtry wykresu postępów.

## [v1.0.1] - 2026-11-13 (wydanie historyczne — zastąpione przez v2.0.0)

### Dodano
- Pierwsza wersja strony internetowej pobierania (`website/`).

## [v1.0.0] - 2026-11-13 (wydanie historyczne — zastąpione przez v2.0.0)

### Dodano
- Pierwsze publiczne wydanie offline-first dziennika treningowego z Live Activities oraz kalkulatorem Epleya.
