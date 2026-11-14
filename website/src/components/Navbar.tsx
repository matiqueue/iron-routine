import { useState } from 'react';
import { ArrowUpRight, Coffee, Download, GitBranch, Menu, X } from 'lucide-react';
import {
  APK_DOWNLOAD_URL,
  BUY_ME_COFFEE_URL,
  GITHUB_REPO,
  NAV_ITEMS,
} from '../data/websiteContent';
import { RouteLink, useRouter } from '../utils/router';
import { PlateMark } from './PlateMark';

export function Navbar() {
  const { route } = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-hairline bg-black/88 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <RouteLink
          to="/"
          onClick={() => setMobileMenuOpen(false)}
          className="group flex items-center gap-3 focus:outline-none"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-hairline bg-surface text-white transition-all duration-200 group-hover:scale-[1.03] group-hover:border-zinc-500">
            <PlateMark size={24} mono={false} />
          </div>
          <div className="flex flex-col leading-none">
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-extrabold tracking-[0.14em] text-white">
                IRON ROUTINE
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-white/80" aria-hidden="true" />
            </div>
            <span className="mt-1 font-mono text-[10px] tracking-[0.14em] text-zinc-400">
              ATHLETIC JOURNAL • OFFLINE
            </span>
          </div>
        </RouteLink>

        <nav
          aria-label="Nawigacja główna"
          className="hidden items-center gap-1 rounded-2xl border border-hairline bg-surface/80 p-1 md:flex"
        >
          {NAV_ITEMS.map((item) => {
            const active = route === item.path;
            return (
              <RouteLink
                key={item.path}
                to={item.path}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-all ${
                  active
                    ? 'bg-white text-black shadow-sm'
                    : 'text-zinc-400 hover:bg-elevated hover:text-white'
                }`}
              >
                {item.label}
              </RouteLink>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={BUY_ME_COFFEE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 rounded-xl border border-hairline bg-surface px-3 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-400 hover:text-white lg:inline-flex"
          >
            <Coffee className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Buy Me a Coffee</span>
          </a>

          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 rounded-xl border border-hairline bg-surface px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-400 hover:text-white sm:inline-flex"
          >
            <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
            <span>GitHub</span>
            <ArrowUpRight className="h-3 w-3 text-zinc-500" aria-hidden="true" />
          </a>

          <a
            href={APK_DOWNLOAD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold tracking-tight text-black transition-all hover:bg-zinc-200 active:scale-[0.98]"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Pobierz APK</span>
          </a>

          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Zamknij menu' : 'Otwórz menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-hairline bg-surface text-zinc-200 md:hidden"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-hairline bg-surface px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1.5">
            {NAV_ITEMS.map((item) => {
              const active = route === item.path;
              return (
                <RouteLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold ${
                    active ? 'bg-white text-black' : 'bg-black/50 text-zinc-300 hover:text-white'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="font-mono text-[10px] opacity-60">{item.path}</span>
                </RouteLink>
              );
            })}
            <div className="mt-1 flex gap-2 border-t border-hairline pt-2.5">
              <a
                href={BUY_ME_COFFEE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-hairline bg-black py-2 text-xs font-semibold text-zinc-300"
              >
                <Coffee className="h-3.5 w-3.5" />
                <span>Buy Me a Coffee</span>
              </a>
              <a
                href={GITHUB_REPO}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-hairline bg-black py-2 text-xs font-semibold text-zinc-300"
              >
                <GitBranch className="h-3.5 w-3.5" />
                <span>GitHub</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
