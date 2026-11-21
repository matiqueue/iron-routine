import { LifeBuoy, Mail, GitBranch, ShieldCheck } from 'lucide-react';
import { GITHUB_REPO } from '../data/websiteContent';
import { RouteLink } from '../utils/router';

const FAQ_ITEMS = [
  {
    q: 'Jak trwale usunąć swoje konto i dane z chmury?',
    a: 'Otwórz aplikację Iron Routine → Ustawienia → zakładka Dane → wybierz „Usuń konto na stałe”. Spowoduje to natychmiastowe usunięcie profilu, zaszyfrowanych kopii w Neon PostgreSQL, znajomości oraz konta Clerk. Możesz również napisać na szymon.goral@icloud.com.',
  },
  {
    q: 'Czy dane z Apple Health lub Health Connect trafiają na serwer?',
    a: 'Nie. Kroki, czas snu i aktywność odczytywane z Apple HealthKit / Health Connect są przetwarzane lokalnie na urządzeniu wyłącznie na potrzeby widoku regeneracji i dopasowania godzin przypomnień o suplementacji.',
  },
  {
    q: 'Jak działa szyfrowanie wiadomości ze znajomymi (E2EE)?',
    a: 'Każda wiadomość, zdjęcie i notatka głosowa jest szyfrowana na Twoim urządzeniu algorytmem Curve25519 + XSalsa20-Poly1305 (TweetNaCl) zanim trafi na serwer. W Ustawieniach możesz zweryfikować swój odcisk klucza publicznego.',
  },
  {
    q: 'Jak zgłosić lub zablokować użytkownika?',
    a: 'Otwórz profil znajomego w zakładce Znajomi i użyj przycisku „Zgłoś lub zablokuj”. Zablokowanie natychmiast usuwa znajomość i blokuje dalszy kontakt.',
  },
];

export function SupportPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="mb-10 space-y-3 border-b border-hairline pb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-sky-400">
          <LifeBuoy className="h-3.5 w-3.5" />
          <span>Support · Pomoc techniczna</span>
        </div>
        <h1 className="font-display text-3xl font-black tracking-tight text-white sm:text-4xl">
          Wsparcie Iron Routine
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-400">
          Masz problem z aplikacją na iOS lub Androidzie, chcesz zgłosić błąd, nadużycie lub poprosić o pomoc z kontem? Skontaktuj się z nami bezpośrednio — odpowiadamy zazwyczaj w ciągu 24 godzin.
        </p>
      </div>

      <div className="mb-12 grid gap-4 sm:grid-cols-2">
        <a
          href="mailto:szymon.goral@icloud.com?subject=Iron%20Routine%20Support"
          className="group flex items-start gap-4 rounded-2xl border border-hairline bg-surface p-5 transition hover:border-sky-500/50"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-base font-bold text-white group-hover:text-sky-400">
              Kontakt e-mail
            </p>
            <p className="mt-1 font-mono text-xs text-zinc-400">szymon.goral@icloud.com</p>
            <p className="mt-1.5 text-xs text-zinc-500">
              Pomoc techniczna, prywatność (RODO), zgłoszenia nadużyć i usunięcie konta.
            </p>
          </div>
        </a>

        <a
          href={`${GITHUB_REPO}/issues`}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-start gap-4 rounded-2xl border border-hairline bg-surface p-5 transition hover:border-emerald-500/50"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <GitBranch className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-base font-bold text-white group-hover:text-emerald-400">
              GitHub Issues
            </p>
            <p className="mt-1 font-mono text-xs text-zinc-400">matiqueue/iron-routine</p>
            <p className="mt-1.5 text-xs text-zinc-500">
              Zgłaszanie błędów, propozycje nowych funkcji i historia wydań.
            </p>
          </div>
        </a>
      </div>

      <div className="space-y-4">
        <h2 className="font-display text-xl font-extrabold text-white">Najczęstsze pytania (FAQ)</h2>
        {FAQ_ITEMS.map((item) => (
          <div key={item.q} className="rounded-2xl border border-hairline bg-surface p-5">
            <h3 className="text-sm font-bold text-white">{item.q}</h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">{item.a}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-5 border-t border-hairline pt-6 text-xs text-zinc-400">
        <RouteLink to="/privacy" className="inline-flex items-center gap-1.5 text-sky-400 hover:underline">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Polityka Prywatności</span>
        </RouteLink>
        <RouteLink to="/terms" className="text-sky-400 hover:underline">
          Regulamin usługi
        </RouteLink>
      </div>
    </div>
  );
}
