import { ArrowUpRight, Download, GitBranch } from 'lucide-react';
import { APK_DOWNLOAD_URL, APP_VERSION, GITHUB_REPO } from '../data/websiteContent';

const BARBELL_MARK = (
  <svg
    viewBox="0 0 28 28"
    fill="none"
    aria-hidden="true"
    className="h-5 w-5 text-white"
  >
    <rect x="2" y="9" width="2.5" height="10" rx="1" fill="currentColor" fillOpacity="0.45" />
    <rect x="5.5" y="6" width="3.5" height="16" rx="1" fill="currentColor" />
    <rect x="9" y="12.5" width="10" height="3" fill="currentColor" />
    <rect x="19" y="6" width="3.5" height="16" rx="1" fill="currentColor" />
    <rect x="23.5" y="9" width="2.5" height="10" rx="1" fill="currentColor" fillOpacity="0.45" />
  </svg>
);

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#050506]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#" className="group flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] transition group-hover:border-white/30 group-hover:bg-white/[0.08]">
            {BARBELL_MARK}
          </div>
          <div className="flex flex-col">
            <span className="font-display text-sm font-bold tracking-tight text-white">
              Iron Routine
            </span>
            <span className="font-mono text-[10px] tracking-[0.16em] text-zinc-500 uppercase">
              Offline Strength OS • {APP_VERSION}
            </span>
          </div>
        </a>

        <nav
          aria-label="Główna nawigacja"
          className="hidden items-center gap-7 text-xs font-medium text-zinc-400 md:flex"
        >
          <a href="#architektura" className="transition hover:text-white">
            Architektura
          </a>
          <a href="#kalkulator" className="transition hover:text-white">
            Kalkulator 1RM
          </a>
          <a href="#install" className="transition hover:text-white">
            Instalacja
          </a>
        </nav>

        <div className="flex items-center gap-2.5">
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 font-mono text-[11px] text-zinc-300 transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white"
          >
            <GitBranch className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">GitHub</span>
            <ArrowUpRight className="h-3 w-3 text-zinc-500" />
          </a>
          <a
            href={APK_DOWNLOAD_URL}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 font-mono text-[11px] font-bold text-black transition hover:bg-zinc-200"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Pobierz APK</span>
          </a>
        </div>
      </div>
    </header>
  );
}
