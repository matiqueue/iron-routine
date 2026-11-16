import { useEffect, useMemo } from 'react';

export function InvitePage() {
  const nick = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    const fromQuery = (params.get('nick') || params.get('nickname') || '')
      .trim()
      .replace(/^@+/, '');
    if (fromQuery) return fromQuery;

    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && (parts[0] === 'invite' || parts[0] === 'u')) {
      return decodeURIComponent(parts[1]).trim().replace(/^@+/, '');
    }
    return '';
  }, []);

  const deepLink = nick
    ? `ironroutine://add-friend?nick=${encodeURIComponent(nick)}`
    : 'ironroutine://add-friend';

  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = deepLink;
    }, 180);
    return () => clearTimeout(timer);
  }, [deepLink]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
      <div className="w-full max-w-sm space-y-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/70">
          <span className="text-xl font-black tracking-tighter text-white">IR</span>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-purple-400">
            IRON ROUTINE · CREW INVITE
          </p>
          <h1 className="text-2xl font-black tracking-tight text-white">
            {nick ? `Dodaj @${nick} do Znajomych` : 'Dodaj znajomego w Iron Routine'}
          </h1>
          <p className="text-sm text-zinc-400">
            Otwieramy aplikację Iron Routine prosto na ekranie dodawania znajomych...
          </p>
        </div>

        {nick && (
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/35 bg-purple-500/15 px-4 py-2 text-sm font-extrabold text-purple-300">
            @{nick}
          </div>
        )}

        <div className="space-y-3 pt-2">
          <a
            href={deepLink}
            className="block w-full rounded-xl bg-white py-3.5 text-sm font-extrabold text-black transition hover:bg-zinc-200"
          >
            Otwórz Iron Routine (Dodaj znajomego)
          </a>
          <a
            href="/instalacja"
            className="block w-full rounded-xl border border-zinc-800 bg-zinc-900/70 py-3 text-xs font-bold text-zinc-300 transition hover:bg-zinc-900"
          >
            Nie masz jeszcze aplikacji? Pobierz tutaj
          </a>
        </div>
      </div>
    </div>
  );
}
