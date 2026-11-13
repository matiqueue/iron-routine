# Polityka Bezpieczeństwa (Security Policy)

## Prywatność danych w Iron Routine

Iron Routine działa **w 100% lokalnie i offline**:
- Wszystkie dane treningowe, rekordy 1RM, waga ciała oraz historia suplementacji kreatyną są zapisywane wyłącznie lokalnie w `@react-native-async-storage/async-storage` na Twoim urządzeniu.
- Aplikacja nie wysyła żadnych danych treningowych ani pomiarów na zewnętrzne serwery.
- Twój prywatny plan `src/data/myPlan.ts` jest automatycznie ignorowany przez `.gitignore`.

## Zgłaszanie podatności

Jeśli znalazłeś błąd bezpieczeństwa lub problem z prywatnością danych:
1. **Nie** otwieraj publicznego zgłoszenia (Issue) ze szczegółami podatności.
2. Skontaktuj się bezpośrednio z autorem (`@matiqueue`) lub użyj **Security -> Advisories** na GitHubie.
