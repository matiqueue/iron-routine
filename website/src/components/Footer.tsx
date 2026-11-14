import { Coffee, GitBranch } from 'lucide-react';
import {
  APK_DOWNLOAD_URL,
  APP_VERSION,
  BUY_ME_COFFEE_URL,
  CONTRIBUTOR_URL,
  EXPO_VERSION_LABEL,
  GITHUB_REPO,
  RN_VERSION_LABEL,
} from '../data/websiteContent';
import { PlateMark } from './PlateMark';

export function Footer() {
  return (
    <footer className="border-t border-hairline bg-black py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline bg-surface text-white">
              <PlateMark size={18} />
            </div>
            <span className="font-display text-sm font-extrabold tracking-[0.14em] text-white">
              IRON ROUTINE
            </span>
            <span className="rounded-md border border-hairline bg-elevated px-2 py-0.5 font-mono text-[11px] font-semibold text-zinc-300">
              {APP_VERSION}
            </span>
          </div>
          <p className="font-mono text-xs text-zinc-500">
            Open-source dziennik silowy. Zbudowane na {EXPO_VERSION_LABEL} / {RN_VERSION_LABEL} (iOS + Android).
          </p>
          <p className="text-xs text-zinc-400">
            Main Contributor:{' '}
            <a
              href={CONTRIBUTOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-white underline decoration-zinc-600 underline-offset-4 transition-colors hover:decoration-white"
            >
              Matique (@matiqueue)
            </a>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-hairline bg-surface px-3.5 py-2 text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
          >
            <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Repozytorium</span>
          </a>
          <a
            href={BUY_ME_COFFEE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-amberforge/50 bg-amberforge/10 px-3.5 py-2 text-amber-300 transition-colors hover:bg-amberforge/20"
          >
            <Coffee className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Buy Me a Coffee</span>
          </a>
          <a
            href={APK_DOWNLOAD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-hairline bg-elevated px-3.5 py-2 text-white transition-colors hover:border-zinc-500"
          >
            Pobierz .APK
          </a>
          <a
            href="#install"
            className="rounded-xl border border-hairline bg-surface px-3.5 py-2 text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
          >
            Instrukcja iOS (Xcode)
          </a>
        </div>
      </div>
    </footer>
  );
}
