# Changelog

Wszystkie istotne zmiany w aplikacji **Iron Routine**.

## [v3.0.0] - 2026-11-16

### Dodano
- **Relacyjna baza danych Neon PostgreSQL**: pełna migracja z tymczasowych plików Blob na relacyjny schemat PostgreSQL (`users`, `oauth_attempts`, `cloud_backups`, `athlete_profiles`, `friendships`, `friend_requests`, `social_activities`, `chat_messages`, `chat_read_state`) oraz wycofanie `@vercel/blob`.
- **Zakładka Znajomi + Szyfrowany Czat E2EE (Curve25519)**: wyszukiwanie po unikalnym `@nicku` (zmiana możliwa co 30 dni), zaproszenia dwukierunkowe, profile znajomych z porównaniem 1 na 1 (`VsComparisonArc`), tablica aktywności z kudosami, podium ekipy (`CrewPodiumStage`), karuzela awatarów (`SquadAvatarRing`), radar orbitalny (`CrewRadarOrb`) i komunikator z szyfrowaniem End-to-End `X25519 + XSalsa20-Poly1305` (`tweetnacl` + `expo-crypto`).
- **Uporządkowane zakładki w Ustawieniach**: płynnie animowany przełącznik 4 zakładek (**Profil**, **Trening**, **System**, **Dane**) z podglądem odcisku klucza E2EE.
- **Pełna lokalizacja na 5 języków**: tłumaczenie interfejsu, rang, partii mięśniowych, suplementów i 136 ćwiczeń na Polski (`pl`), Angielski (`en`), Niemiecki (`de`), Francuski (`fr`) i Hiszpański (`es`).
- **6-krokowy konfigurator startowy + Wsparcie Expo Web**: osobne pola Imię i nazwisko + `@Nick` (z generatorem), tryby planów z wymianą ćwiczeń podobnych oraz tryb przeglądarkowy (`npm run web`) do testowania wielu kont.

### Poprawiono
- Wyraźniejsze, bardziej nasycone kolory partii mięśniowych na sylwetce (w tym wyrazisty jasny żółty) oraz minimalistyczne tła architektoniczne (`MinimalistBackdrop`) w głównych zakładkach.
- Leniwe ładowanie modułów natywnych HealthKit / Health Connect i okno OAuth dla pełnej kompatybilności z Expo Web.

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
