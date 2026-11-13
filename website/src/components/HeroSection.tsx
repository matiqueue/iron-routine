import { Apple, ArrowRight, Download } from 'lucide-react';
import {
  APK_DOWNLOAD_URL,
  APP_VERSION,
  HERO_SPECS,
  type PlatformTab,
} from '../data/websiteContent';
import { PhoneShowcase } from './PhoneShowcase';

interface HeroSectionProps {
  onSelectPlatform: (platform: PlatformTab) => void;
}

export function HeroSection({ onSelectPlatform }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden border-b border-white/[0.06]">
      {/* Architectural backdrop layers */}
      <div aria-hidden="true" className="hero-spotlight pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="architectural-grid pointer-events-none absolute inset-0" />

      <div className="relative mx-auto grid max-w-6xl gap-14 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:items-center lg:gap-10 lg:py-24">
        <div className="lg:col-span-7">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="font-mono text-[11px] tracking-[0.14em] text-zinc-300 uppercase">
              Expo SDK 58 • 100% Offline • {APP_VERSION}
            </span>
          </div>

          <h1 className="mt-7 font-display text-4xl font-extrabold tracking-[-0.04em] text-white sm:text-6xl lg:text-[4.25rem] lg:leading-[1.02]">
            Trening siłowy.
            <br />
            <span className="bg-gradient-to-b from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
              Zero szumu.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            Monochromatyczny dziennik treningowy na iOS i Androida stworzony do pracy na siłowni bez
            internetu. Dynamic Island Live Activities, estymacja 1RM Epleya, wykresy SVG i
            przypomnienia o kreatynie — bez kont, reklam i chmury.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3.5">
            <a
              href={APK_DOWNLOAD_URL}
              className="group inline-flex items-center gap-2.5 rounded-full bg-white px-6 py-3.5 font-mono text-xs font-bold tracking-wide text-black transition hover:bg-zinc-200"
            >
              <Download className="h-4 w-4 stroke-[2.25]" />
              <span>POBIERZ ANDROID (.APK)</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </a>

            <a
              href="#install"
              onClick={() => onSelectPlatform('ios')}
              className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.03] px-6 py-3.5 font-mono text-xs font-bold tracking-wide text-white backdrop-blur-md transition hover:border-white/35 hover:bg-white/[0.07]"
            >
              <Apple className="h-4 w-4" />
              <span>INSTALACJA IPHONE</span>
            </a>
          </div>

          <div className="mt-12 grid grid-cols-1 divide-y divide-white/[0.08] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0B0B0E]/80 backdrop-blur-md sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {HERO_SPECS.map((spec) => (
              <div key={spec.label} className="px-5 py-4">
                <div className="font-mono text-[10px] tracking-[0.16em] text-zinc-500 uppercase">
                  {spec.label}
                </div>
                <div className="mt-1 font-display text-base font-bold tracking-tight text-white">
                  {spec.value}
                </div>
                <div className="mt-0.5 text-xs text-zinc-500">{spec.sub}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5">
          <PhoneShowcase />
        </div>
      </div>
    </section>
  );
}
