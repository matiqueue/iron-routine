import { Apple, ArrowRight, Coffee, Download, GitBranch } from 'lucide-react';
import {
  APK_DOWNLOAD_URL,
  APP_VERSION,
  BUY_ME_COFFEE_URL,
  CONTRIBUTOR_URL,
  HERO_SPECS,
  PlatformTab,
} from '../data/websiteContent';
import { PlateMark } from './PlateMark';

interface HeroSectionProps {
  onSelectPlatform: (platform: PlatformTab) => void;
}

export function HeroSection({ onSelectPlatform }: HeroSectionProps) {
  return (
    <section
      id="top"
      className="relative overflow-hidden border-b border-hairline bg-black pb-20 pt-14 sm:pb-24 sm:pt-20"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[360px] w-[640px] -translate-x-1/2 rounded-full bg-amberforge/[0.045] blur-[120px]"
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-hairline bg-surface px-3.5 py-1.5 shadow-sm">
            <PlateMark size={16} className="text-white" />
            <span className="font-mono text-[11px] font-bold tracking-[0.14em] text-zinc-200">
              IRON ROUTINE {APP_VERSION}
            </span>
            <span className="h-1 w-1 rounded-full bg-zinc-600" />
            <span className="font-mono text-[11px] text-amber-300">
              100% OFFLINE
            </span>
          </div>

          <h1 className="mt-8 max-w-4xl font-display text-4xl font-extrabold leading-[1.06] tracking-tight text-white sm:text-6xl lg:text-[66px]">
            Trenuj ciezko.
            <span className="mt-1 block text-zinc-400">
              Reszte oddaj rutynowi.
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            Dziennik silowy na iOS i Androida w stylu czystego AMOLED. Jeden profil z
            wieloma planami i wspolnymi rekordami PR, integracja z Apple Health,
            Live Activities oraz niezawodny alarm konca przerwy poza aplikacja.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a
              href={APK_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onSelectPlatform('android')}
              className="inline-flex h-12 items-center gap-2.5 rounded-2xl bg-white px-6 text-sm font-bold tracking-tight text-black transition-all hover:bg-zinc-200 active:scale-[0.98]"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Pobierz APK (Android)</span>
            </a>

            <a
              href="#install"
              onClick={() => onSelectPlatform('ios')}
              className="inline-flex h-12 items-center gap-2.5 rounded-2xl border border-hairline bg-surface px-6 text-sm font-semibold text-white transition-all hover:border-zinc-500 hover:bg-elevated active:scale-[0.98]"
            >
              <Apple className="h-4 w-4" aria-hidden="true" />
              <span>Wgraj na iPhone (Xcode)</span>
              <ArrowRight className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
            </a>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-xs text-zinc-500">
            <a
              href={CONTRIBUTOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-white"
            >
              <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Main Contributor: @matiqueue</span>
            </a>
            <span className="text-zinc-700">|</span>
            <a
              href={BUY_ME_COFFEE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-amber-300/90 transition-colors hover:text-amber-200"
            >
              <Coffee className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Buy Me a Coffee</span>
            </a>
          </div>

          <div className="mt-11 grid w-full max-w-4xl grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {HERO_SPECS.map((spec) => (
              <div
                key={spec}
                className="mobile-card flex items-center justify-center gap-2 rounded-2xl px-3.5 py-2.5 text-center"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amberforge" aria-hidden="true" />
                <span className="font-mono text-[11px] font-medium text-zinc-300">{spec}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
