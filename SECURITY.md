# Polityka Bezpieczeństwa (Security Policy)

## Prywatność danych i szyfrowanie w Iron Routine

Iron Routine działa w architekturze **offline-first z opcjonalną, szyfrowaną chmurą Neon PostgreSQL**:

- **Tryb lokalny (bez konta):** wszystkie plany treningowe, historie serii, rekordy 1RM, waga ciała oraz suplementacja zapisywane są lokalnie na urządzeniu w `@react-native-async-storage/async-storage`. Aplikacja nie wymaga logowania ani dostępu do internetu.
- **Opcjonalna synchronizacja konta (Clerk + Neon PostgreSQL):** logowanie za pomocą **Apple iCloud** lub **Google** (poprzez Clerk) zapisuje w relacyjnej bazie **Neon PostgreSQL** wyłącznie zaszyfrowaną (`AES-256-GCM`) kopię zapasową profilu do wygodnego przenoszenia danych między urządzeniami (iOS / Android / Web).
- **Szyfrowanie End-to-End (E2EE) komunikatora Znajomi:** wiadomości i karty treningowe w czatach zakładki **Znajomi** szyfrowane są lokalnie na urządzeniu przed wysyłką za pomocą kryptografii **Curve25519 (X25519 ECDH + XSalsa20-Poly1305)** (`src/utils/e2ee.ts`, `expo-crypto`, `tweetnacl`). Klucz prywatny nigdy nie opuszcza urządzenia użytkownika, a serwer bazodanowy przechowuje wyłącznie zaszyfrowany szyfrogram (`ciphertext` + `nonce`).
- **Sekrety i pliki prywatne:** zmienne serwerowe (`DATABASE_URL`, `CLERK_SECRET_KEY`, `CLOUD_AUTH_SECRET`), własny plan `src/data/myPlan.ts`, seed `src/data/localSeed.ts` oraz folder `seeds/` są ignorowane przez Git (`.gitignore`, `website/.gitignore`) i nigdy nie trafiają do paczki klienckiej.

## Zgłaszanie podatności

Jeśli znalazłeś błąd bezpieczeństwa lub problem z prywatnością danych:
1. **Nie** otwieraj publicznego zgłoszenia (Issue) ze szczegółami podatności.
2. Skontaktuj się bezpośrednio z autorem (`@matiqueue`) lub użyj **Security -> Advisories** na GitHubie.
