import { Coffee, GitBranch } from 'lucide-react';
import {
  APK_DOWNLOAD_URL,
  APP_VERSION,
  BUY_ME_COFFEE_URL,
  CONTRIBUTOR_URL,
  EXPO_VERSION_LABEL,
  GITHUB_REPO,
  NAV_ITEMS,
  RN_VERSION_LABEL,
} from '../data/websiteContent';
import { RouteLink } from '../utils/router';
import { PlateMark } from './PlateMark';

export function Footer() {
  return (
    <footer className="border-t border-hairline bg-black py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-8 border-b border-hairline pb-8 md:flex-row md:items-center">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline bg-surface text-white">
                <PlateMark size={18} mono={false} />
              </div>
              <span className="font-display text-sm font-extrabold tracking-[0.14em] text-white">
                IRON ROUTINE
              </span>
              <span className="rounded-md border border-hairline bg-elevated px-2 py-0.5 font-mono text-[11px] font-semibold text-zinc-300">
                {APP_VERSION}
              </span>
            </div>
            <p className="font-mono text-xs text-zinc-500">
              Open-source dziennik siłowy. Zbudowane na {EXPO_VERSION_LABEL} / {RN_VERSION_LABEL} (iOS + Android).
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

          <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold">
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
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-elevated px-3.5 py-2 text-zinc-200 transition-colors hover:border-white hover:text-white"
            >
              <Coffee className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Buy Me a Coffee</span>
            </a>
            <a
              href={APK_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-white px-3.5 py-2 font-bold text-black transition-colors hover:bg-zinc-200"
            >
              Pobierz .APK
            </a>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex flex-wrap items-center gap-5">
            {NAV_ITEMS.map((item) => (
              <RouteLink
                key={item.path}
                to={item.path}
                className="font-mono uppercase tracking-[0.12em] text-zinc-400 transition-colors hover:text-white"
              >
                {item.label}
              </RouteLink>
            ))}
          </div>
          <span className="font-mono text-[11px] text-zinc-600">
            100% OFFLINE • MONOCHROME EDITION
          </span>
        </div>
      </div>
    </footer>
  );
}
