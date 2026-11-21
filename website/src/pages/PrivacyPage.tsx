import { useState } from 'react';
import { Lock, ShieldCheck, Trash2, HeartPulse } from 'lucide-react';
import { RouteLink } from '../utils/router';

export function PrivacyPage() {
  const [lang, setLang] = useState<'pl' | 'en'>('pl');
  const isPl = lang === 'pl';

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="mb-10 flex flex-wrap items-start justify-between gap-4 border-b border-hairline pb-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{isPl ? 'Polityka Prywatności · RODO / App Store' : 'Privacy Policy · GDPR / App Store'}</span>
          </div>
          <h1 className="font-display text-3xl font-black tracking-tight text-white sm:text-4xl">
            {isPl ? 'Polityka Prywatności Iron Routine' : 'Iron Routine Privacy Policy'}
          </h1>
          <p className="font-mono text-xs text-zinc-400">
            {isPl
              ? 'Ostatnia aktualizacja: 21 listopada 2026 · Wersja dokumentu 1.0'
              : 'Last updated: November 21, 2026 · Document version 1.0'}
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-hairline bg-surface p-1">
          <button
            type="button"
            onClick={() => setLang('pl')}
            className={`rounded-lg px-3 py-1.5 font-mono text-xs font-bold transition ${
              isPl ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Polski
          </button>
          <button
            type="button"
            onClick={() => setLang('en')}
            className={`rounded-lg px-3 py-1.5 font-mono text-xs font-bold transition ${
              !isPl ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            English
          </button>
        </div>
      </div>

      {/* Quick Guarantees Strip */}
      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-hairline bg-surface p-4">
          <Lock className="mb-2 h-5 w-5 text-sky-400" />
          <p className="text-sm font-bold text-white">
            {isPl ? 'Szyfrowanie End-to-End' : 'End-to-End Encryption'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            {isPl
              ? 'Czat ze znajomymi używa Curve25519 + XSalsa20-Poly1305. Kopie w chmurze szyfrujemy AES-256-GCM.'
              : 'Friend chat uses Curve25519 + XSalsa20-Poly1305. Cloud backups are encrypted at rest with AES-256-GCM.'}
          </p>
        </div>
        <div className="rounded-2xl border border-hairline bg-surface p-4">
          <HeartPulse className="mb-2 h-5 w-5 text-emerald-400" />
          <p className="text-sm font-bold text-white">
            {isPl ? 'Dane HealthKit bez reklam' : 'Zero Ads on Health Data'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            {isPl
              ? 'Dane z Apple Health i Health Connect nigdy nie są sprzedawane ani używane do reklam i profilowania.'
              : 'Apple Health and Health Connect data are never sold, shared with data brokers, or used for advertising.'}
          </p>
        </div>
        <div className="rounded-2xl border border-hairline bg-surface p-4">
          <Trash2 className="mb-2 h-5 w-5 text-rose-400" />
          <p className="text-sm font-bold text-white">
            {isPl ? 'Pełne usunięcie konta' : 'Full Account Deletion'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            {isPl
              ? 'W każdej chwili możesz trwale usunąć konto i wszystkie dane w aplikacji (Ustawienia → Dane).'
              : 'Permanently delete your cloud account and all associated data anytime in-app (Settings → Data).'}
          </p>
        </div>
      </div>

      <article className="space-y-8 text-sm leading-7 text-zinc-300">
        {isPl ? (
          <>
            <section className="space-y-2.5">
              <h2 className="font-display text-lg font-extrabold text-white">1. Administrator danych i kontakt</h2>
              <p>
                Administratorem danych przetwarzanych w aplikacji mobilnej <strong>Iron Routine</strong> oraz w serwisie{' '}
                <span className="font-mono text-zinc-200">iron-routine-app.vercel.app</span> jest{' '}
                <strong>Szymon Góral (matique)</strong>. W sprawach dotyczących prywatności i realizacji praw RODO skontaktuj się pod adresem:{' '}
                <a href="mailto:szymon.goral@icloud.com" className="text-sky-400 underline underline-offset-4">
                  szymon.goral@icloud.com
                </a>
                .
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="font-display text-lg font-extrabold text-white">2. Jakie dane przetwarzamy i w jakim celu</h2>
              <ul className="list-disc space-y-2 pl-5 text-zinc-300">
                <li>
                  <strong>Dane treningowe i biometryczne zapisywane lokalnie:</strong> plany treningowe, wykonane serie, ciężary, rekordy 1RM, historia masy ciała, wzrost, płeć (dobór modelu sylwetki 2D) oraz dziennik suplementacji. Podstawowy tryb aplikacji działa w 100% lokalnie bez zakładania konta.
                </li>
                <li>
                  <strong>Opcjonalne konto w chmurze (Clerk + Neon PostgreSQL):</strong> jeśli zdecydujesz się zalogować przez Google lub Apple, przechowujemy Twój identyfikator konta, adres e-mail, nazwę wyświetlaną, wybrany @nick, opcjonalne zdjęcie profilowe oraz zaszyfrowaną (AES-256-GCM) kopię zapasową Twojego profilu treningowego w bazie Neon PostgreSQL.
                </li>
                <li>
                  <strong>Funkcje społecznościowe i szyfrowany czat (E2EE):</strong> lista znajomych, publiczny klucz Curve25519, statystyki rankingowe udostępniane znajomym (ranga, seria dni, aktywność) oraz wiadomości czatu (tekst, zdjęcia, notatki głosowe) szyfrowane na urządzeniu przed wysłaniem. Serwer przekazuje wyłącznie zaszyfrowany szyfrogram i nie ma dostępu do Twojego klucza prywatnego.
                </li>
                <li>
                  <strong>Tokeny powiadomień push:</strong> jeśli wyrazisz zgodę na powiadomienia, zapisujemy token urządzenia, aby dostarczać powiadomienia o wiadomościach od znajomych oraz lokalne alarmy przerw i suplementacji.
                </li>
              </ul>
            </section>

            <section className="space-y-2.5">
              <h2 className="font-display text-lg font-extrabold text-white">
                3. Apple HealthKit i Android Health Connect (Zasada 5.1.3 Apple)
              </h2>
              <p>
                Za Twoją wyraźną zgodą Iron Routine może odczytywać wybrane dane zdrowotne (kroki, czas snu, aktywne kalorie, dystans) z <strong>Apple Health (HealthKit)</strong> na iOS lub <strong>Health Connect</strong> na Androidzie wyłącznie w celu wyświetlania wskaźników regeneracji oraz automatycznego dopasowania godzin przypomnień o suplementacji.
              </p>
              <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5 text-zinc-200">
                <strong>Gwarancja prywatności danych zdrowotnych:</strong> Dane pozyskane z Apple HealthKit oraz Google Health Connect <strong>nigdy</strong> nie są wykorzystywane w celach reklamowych, marketingowych, analityki behawioralnej ani nie są udostępniane ani sprzedawane podmiotom trzecim (w tym brokerom danych). Pozostają na Twoim urządzeniu i możesz w dowolnym momencie cofnąć uprawnienia w ustawieniach systemu iOS/Android.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="font-display text-lg font-extrabold text-white">4. Uprawnienia urządzenia</h2>
              <ul className="list-disc space-y-1.5 pl-5">
                <li><strong>Biblioteka zdjęć:</strong> wybór avatara profilowego, wysyłanie zaszyfrowanych zdjęć w czacie oraz wybór własnego tła rozmowy.</li>
                <li><strong>Mikrofon:</strong> nagrywanie szyfrowanych wiadomości głosowych w czacie ze znajomymi.</li>
                <li><strong>Kalendarz i Przypomnienia:</strong> opcjonalna synchronizacja zaplanowanych dni treningowych z Apple Calendar / Reminders.</li>
                <li><strong>Powiadomienia i Live Activities:</strong> minutnik przerwy na Dynamic Island, alarmy końca przerwy, przypomnienia o ważeniu/suplementacji i wiadomościach.</li>
              </ul>
            </section>

            <section className="space-y-2.5">
              <h2 className="font-display text-lg font-extrabold text-white">5. Zewnętrzni dostawcy infrastruktury (Podmioty przetwarzające)</h2>
              <ul className="list-disc space-y-1.5 pl-5">
                <li><strong>Vercel Inc.</strong> — hosting strony internetowej i bezpiecznych endpointów API.</li>
                <li><strong>Neon (PostgreSQL)</strong> — szyfrowane przechowywanie kopii profilu i zaszyfrowanych wiadomości E2EE.</li>
                <li><strong>Clerk Inc.</strong> — bezpieczne uwierzytelnianie OAuth (Google / Apple).</li>
                <li><strong>Apple Push Notification service (APNs) / Expo Push</strong> — dostarczanie powiadomień push.</li>
              </ul>
              <p>Nie korzystamy z żadnych sieci reklamowych ani SDK śledzących (zero IDFA / zero śledzenia międzysieciowego).</p>
            </section>

            <section className="space-y-2.5">
              <h2 className="font-display text-lg font-extrabold text-white">6. Przechowywanie i trwałe usuwanie danych (Twoje prawa RODO)</h2>
              <p>
                Masz prawo dostępu do swoich danych, ich eksportu do pliku JSON (<strong>Ustawienia → Dane → Eksportuj JSON</strong>), sprostowania oraz całkowitego usunięcia. Aby natychmiastowo i nieodwracalnie usunąć swoje konto w chmurze wraz ze wszystkimi kopiami, znajomościami, tokenami i kontem Clerk:
              </p>
              <p className="font-mono text-xs text-sky-300">
                Otwórz Iron Routine → Ustawienia → zakładka Dane → „Usuń konto na stałe”
              </p>
              <p>
                Możesz także zgłosić żądanie usunięcia konta mailowo na{' '}
                <a href="mailto:szymon.goral@icloud.com" className="text-sky-400 underline underline-offset-4">
                  szymon.goral@icloud.com
                </a>{' '}
                — realizujemy takie żądania niezwłocznie (maksymalnie w ciągu 48 godzin).
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="font-display text-lg font-extrabold text-white">7. Ochrona dzieci</h2>
              <p>
                Aplikacja Iron Routine jest przeznaczona dla użytkowników w wieku co najmniej 13 lat (lub 16 lat w krajach UE wymagających wyższego progu zgody). Nie zbieramy świadomie danych dzieci poniżej tego wieku.
              </p>
            </section>
          </>
        ) : (
          <>
            <section className="space-y-2.5">
              <h2 className="font-display text-lg font-extrabold text-white">1. Data Controller & Contact</h2>
              <p>
                The data controller for the <strong>Iron Routine</strong> mobile application and website{' '}
                <span className="font-mono text-zinc-200">iron-routine-app.vercel.app</span> is{' '}
                <strong>Szymon Góral (matique)</strong>. For any privacy questions or GDPR requests, contact:{' '}
                <a href="mailto:szymon.goral@icloud.com" className="text-sky-400 underline underline-offset-4">
                  szymon.goral@icloud.com
                </a>
                .
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="font-display text-lg font-extrabold text-white">2. Data We Process & Purpose</h2>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <strong>Local Training & Biometric Data:</strong> workout plans, logged sets, weights, estimated 1RM PRs, body weight history, height, gender (for the 2D anatomical model), and supplement tracking. Core app functionality works 100% offline without creating an account.
                </li>
                <li>
                  <strong>Optional Cloud Account (Clerk + Neon PostgreSQL):</strong> if you sign in via Google or Apple, we store your account identifier, email address, display name, chosen @nickname, optional profile avatar, and an AES-256-GCM encrypted backup of your training profile.
                </li>
                <li>
                  <strong>Social & End-to-End Encrypted Chat:</strong> friend list, Curve25519 public key, friend-visible rank/streak summaries, and E2EE chat messages (text, photos, voice notes) encrypted on-device before upload. Our server never receives your private encryption key.
                </li>
                <li>
                  <strong>Push Notification Tokens:</strong> stored only when you grant notification permissions to deliver friend chat alerts and local rest/supplement reminders.
                </li>
              </ul>
            </section>

            <section className="space-y-2.5">
              <h2 className="font-display text-lg font-extrabold text-white">
                3. Apple HealthKit & Android Health Connect
              </h2>
              <p>
                With your explicit permission, Iron Routine reads selected health metrics (steps, sleep duration, active calories, distance) from <strong>Apple HealthKit</strong> or <strong>Android Health Connect</strong> strictly to display recovery insights and tailor daily supplement reminder windows.
              </p>
              <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5 text-zinc-200">
                <strong>Health Data Commitment:</strong> Data accessed via Apple HealthKit or Health Connect is <strong>never</strong> used for advertising, marketing, behavioral profiling, or sold/disclosed to third parties or data brokers. You can revoke permissions anytime in iOS/Android system settings.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="font-display text-lg font-extrabold text-white">4. Infrastructure Sub-processors</h2>
              <p>
                We use <strong>Vercel</strong> (hosting/API), <strong>Neon</strong> (PostgreSQL database),{' '}
                <strong>Clerk</strong> (OAuth identity), and <strong>APNs / Expo Push</strong> (notifications). We use zero third-party ad networks and zero cross-app tracking SDKs.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="font-display text-lg font-extrabold text-white">5. Your Rights & Permanent Account Deletion</h2>
              <p>
                You can export your complete data to JSON anytime or permanently erase your cloud account, backups, friendships, encrypted chats, and Clerk identity directly inside the app via{' '}
                <span className="font-mono text-sky-300">Settings → Data → Delete Account Permanently</span>, or by emailing{' '}
                <a href="mailto:szymon.goral@icloud.com" className="text-sky-400 underline underline-offset-4">
                  szymon.goral@icloud.com
                </a>
                .
              </p>
            </section>
          </>
        )}
      </article>

      <div className="mt-12 flex flex-wrap items-center gap-4 border-t border-hairline pt-6 text-xs text-zinc-400">
        <RouteLink to="/terms" className="text-sky-400 hover:underline">
          {isPl ? 'Regulamin usługi →' : 'Terms of Service →'}
        </RouteLink>
        <RouteLink to="/support" className="text-sky-400 hover:underline">
          {isPl ? 'Centrum wsparcia i kontakt →' : 'Support & Contact →'}
        </RouteLink>
      </div>
    </div>
  );
}
