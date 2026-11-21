import { useState } from 'react';
import { FileText } from 'lucide-react';
import { RouteLink } from '../utils/router';

export function TermsPage() {
  const [lang, setLang] = useState<'pl' | 'en'>('pl');
  const isPl = lang === 'pl';

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="mb-10 flex flex-wrap items-start justify-between gap-4 border-b border-hairline pb-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-sky-400">
            <FileText className="h-3.5 w-3.5" />
            <span>{isPl ? 'Regulamin & Zasady Społeczności' : 'Terms of Service & Community Rules'}</span>
          </div>
          <h1 className="font-display text-3xl font-black tracking-tight text-white sm:text-4xl">
            {isPl ? 'Regulamin Iron Routine' : 'Iron Routine Terms of Service'}
          </h1>
          <p className="font-mono text-xs text-zinc-400">
            {isPl
              ? 'Ostatnia aktualizacja: 21 listopada 2026'
              : 'Last updated: November 21, 2026'}
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

      <article className="space-y-8 text-sm leading-7 text-zinc-300">
        {isPl ? (
          <>
            <section className="space-y-2.5">
              <h2 className="font-display text-lg font-extrabold text-white">1. Akceptacja regulaminu</h2>
              <p>
                Korzystając z aplikacji mobilnej <strong>Iron Routine</strong>, akceptujesz niniejszy Regulamin oraz naszą{' '}
                <RouteLink to="/privacy" className="text-sky-400 underline underline-offset-4">
                  Politykę Prywatności
                </RouteLink>
                . Aplikacja jest rozwijana jako darmowy, otwartoźródłowy dziennik treningu siłowego.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="font-display text-lg font-extrabold text-white">2. Zastrzeżenie medyczne i sportowe</h2>
              <p className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3.5 text-zinc-200">
                Iron Routine służy wyłącznie celom informacyjnym i wspomaganiu rejestracji treningów. Aplikacja <strong>nie stanowi porady medycznej, fizjoterapeutycznej ani dietetycznej</strong>. Przed rozpoczęciem intensywnych ćwiczeń siłowych lub suplementacji skonsultuj się z lekarzem. Ćwiczysz na własną odpowiedzialność.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="font-display text-lg font-extrabold text-white">
                3. Zasady społeczności i zero tolerancji dla nadużyć (UGC)
              </h2>
              <p>
                W funkcjach społecznościowych (nicki, statusy, zdjęcia profilowe oraz szyfrowany czat ze znajomymi) obowiązuje polityka <strong>zerowej tolerancji</strong> dla treści nielegalnych, obraźliwych, nękania, mowy nienawiści, spamu oraz podszywania się pod inne osoby.
              </p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Czat jest dostępny wyłącznie między użytkownikami, którzy wzajemnie zaakceptowali zaproszenie do znajomych.</li>
                <li>Każdy użytkownik może natychmiast <strong>zablokować</strong> lub <strong>zgłosić</strong> innego użytkownika z poziomu jego profilu w aplikacji.</li>
                <li>Zgłoszenia nadużyć są rozpatrywane w ciągu maksymalnie 24 godzin, a konta łamiące regulamin mogą zostać trwale zablokowane lub usunięte.</li>
              </ul>
            </section>

            <section className="space-y-2.5">
              <h2 className="font-display text-lg font-extrabold text-white">4. Konto, kopie zapasowe i usunięcie</h2>
              <p>
                Użytkownik odpowiada za bezpieczeństwo swojego urządzenia i powiązanego konta Google/Apple. Możesz w każdej chwili wyeksportować swoje dane lub trwale usunąć konto w zakładce{' '}
                <strong>Ustawienia → Dane → Usuń konto na stałe</strong>.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="font-display text-lg font-extrabold text-white">5. Kontakt</h2>
              <p>
                Pytania dotyczące regulaminu oraz zgłoszenia naruszeń prosimy kierować na:{' '}
                <a href="mailto:szymon.goral@icloud.com" className="text-sky-400 underline underline-offset-4">
                  szymon.goral@icloud.com
                </a>
                .
              </p>
            </section>
          </>
        ) : (
          <>
            <section className="space-y-2.5">
              <h2 className="font-display text-lg font-extrabold text-white">1. Acceptance of Terms</h2>
              <p>
                By using <strong>Iron Routine</strong>, you agree to these Terms of Service and our{' '}
                <RouteLink to="/privacy" className="text-sky-400 underline underline-offset-4">
                  Privacy Policy
                </RouteLink>
                .
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="font-display text-lg font-extrabold text-white">2. Health & Fitness Disclaimer</h2>
              <p className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3.5 text-zinc-200">
                Iron Routine is an informational strength-training tracker and does <strong>not</strong> provide medical, diagnostic, or clinical advice. Consult a qualified physician before starting any strength or supplementation program. You exercise at your own risk.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="font-display text-lg font-extrabold text-white">
                3. Community Standards & Zero-Tolerance Policy
              </h2>
              <p>
                We enforce <strong>zero tolerance</strong> for objectionable content, harassment, hate speech, illegal material, or abusive users across nicknames, avatars, status notes, and friend chats. Users can immediately <strong>block</strong> or <strong>report</strong> any account directly from their profile card; reports are reviewed within 24 hours and offending accounts are permanently removed.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="font-display text-lg font-extrabold text-white">4. Account Termination</h2>
              <p>
                You may export your data or permanently delete your account anytime inside the app under{' '}
                <strong>Settings → Data → Delete Account Permanently</strong>.
              </p>
            </section>
          </>
        )}
      </article>

      <div className="mt-12 flex flex-wrap items-center gap-4 border-t border-hairline pt-6 text-xs text-zinc-400">
        <RouteLink to="/privacy" className="text-sky-400 hover:underline">
          {isPl ? 'Polityka Prywatności →' : 'Privacy Policy →'}
        </RouteLink>
        <RouteLink to="/support" className="text-sky-400 hover:underline">
          {isPl ? 'Centrum wsparcia →' : 'Support Center →'}
        </RouteLink>
      </div>
    </div>
  );
}
