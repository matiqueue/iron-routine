import { ArrowUpRight, Coffee, Download, GitBranch } from 'lucide-react';
import {
  APK_DOWNLOAD_URL,
  BUY_ME_COFFEE_URL,
  GITHUB_REPO,
} from '../data/websiteContent';
import { PlateMark } from './PlateMark';

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-hairline bg-black/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="#top" className="group flex items-center gap-3 focus:outline-none">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-hairline bg-surface text-white transition-transform duration-200 group-hover:scale-[1.03] group-hover:border-zinc-600">
            <PlateMark size={24} />
          </div>
          <div className="flex flex-col leading-none">
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-extrabold tracking-[0.14em] text-white">
                IRON ROUTINE
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-amberforge" aria-hidden="true" />
            </div>
            <span className="mt-1 font-mono text-[10px] tracking-[0.14em] text-zinc-400">
              ATHLETIC JOURNAL • OFFLINE
            </span>
          </div>
        </a>

        <nav
          aria-label="Nawigacja glowna"
          className="hidden items-center gap-7 text-xs font-semibold uppercase tracking-[0.1em] text-zinc-400 md:flex"
        >
          <a href="#bento" className="transition-colors hover:text-white">
            Funkcje
          </a>
          <a href="#showcase" className="transition-colors hover:text-white">
            Interfejs
          </a>
          <a href="#epley" className="transition-colors hover:text-white">
            Silnik 1RM
          </a>
          <a href="#install" className="transition-colors hover:text-white">
            Instalacja iOS
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={BUY_ME_COFFEE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 rounded-xl border border-amberforge/40 bg-amberforge/10 px-3 py-2 text-xs font-semibold text-amber-300 transition-colors hover:border-amberforge hover:bg-amberforge/20 lg:inline-flex"
          >
            <Coffee className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Buy Me a Coffee</span>
          </a>

          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 rounded-xl border border-hairline bg-surface px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white sm:inline-flex"
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
        </div>
      </div>
    </header>
  );
}
