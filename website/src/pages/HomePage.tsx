import { useEffect, useRef, useState } from 'react';
import {
  Apple,
  ArrowRight,
  CheckCircle2,
  Coffee,
  Download,
  GitBranch,
  Layers,
  Play,
  RotateCcw,
} from 'lucide-react';
import {
  APK_DOWNLOAD_URL,
  APP_VERSION,
  BUY_ME_COFFEE_URL,
  CONTRIBUTOR_URL,
  DAY_ART_OPTIONS,
  DayArtTag,
  HERO_METRICS,
  PILLAR_LINKS,
} from '../data/websiteContent';
import { RouteLink } from '../utils/router';
import { DayBannerVector } from '../components/DayBannerVector';
import { PlateMark } from '../components/PlateMark';
import { Reveal } from '../components/Reveal';

const ISLAND_MODES = [
  { tag: 'SERIA 2 Z 4', detail: 'Pec Deck • 134 kg', right: '00:48' },
  { tag: 'ODPOCZYNEK', detail: 'Alarm w tle gotowy', right: '01:52' },
  { tag: 'PAUZA PRZERWY', detail: 'Dynamic Island zamrożony', right: '01:52' },
] as const;

export function HomePage() {
  const [selectedTag, setSelectedTag] = useState<DayArtTag>('fbw');
  const [islandIdx, setIslandIdx] = useState(0);

  // Interactive Hold-to-Start hero demo state
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [sessionLaunched, setSessionLaunched] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startMsRef = useRef<number>(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIslandIdx((prev) => (prev + 1) % ISLAND_MODES.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isHolding || sessionLaunched) return;
    startMsRef.current = performance.now();
    const duration = 780;

    const tick = (now: number) => {
      const pct = Math.min(100, ((now - startMsRef.current) / duration) * 100);
      setHoldProgress(pct);
      if (pct >= 100) {
        setIsHolding(false);
        setSessionLaunched(true);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isHolding, sessionLaunched]);

  const stopHold = () => {
    if (!sessionLaunched && holdProgress < 100) {
      setIsHolding(false);
      setHoldProgress(0);
    }
  };

  const activeDayArt =
    DAY_ART_OPTIONS.find((item) => item.tag === selectedTag) || DAY_ART_OPTIONS[0];
  const currentIsland = ISLAND_MODES[islandIdx];

  const circleRadius = 40;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference * (1 - holdProgress / 100);

  return (
    <div className="animate-page-enter">
      {/* HERO SECTION WITH BESPOKE MONOCHROME STUDIO GRAPHIC */}
      <section className="relative overflow-hidden border-b border-hairline bg-black pb-20 pt-14 sm:pb-28 sm:pt-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-grid-mono opacity-45"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[780px] -translate-x-1/2 rounded-full bg-white/[0.045] blur-[140px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-full opacity-35 lg:block lg:w-[62%]"
        >
          <img
            src="/images/hero-barbell-dark.jpg"
            alt=""
            className="h-full w-full object-cover object-center grayscale contrast-125"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/35" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/70" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-hairline bg-surface/90 px-3.5 py-1.5 backdrop-blur">
                <PlateMark size={16} mono={false} />
                <span className="font-mono text-[11px] font-bold tracking-[0.14em] text-white">
                  IRON ROUTINE {APP_VERSION}
                </span>
                <span className="h-1 w-1 rounded-full bg-zinc-600" />
                <span className="font-mono text-[11px] text-zinc-400">PURE AMOLED • OFFLINE</span>
              </div>

              <h1 className="mt-7 font-display text-4xl font-extrabold leading-[1.04] tracking-tight text-white sm:text-6xl">
                Trenuj ciężko.
                <span className="mt-1 block text-zinc-400">Resztę oddaj rutynie.</span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
                Monochromatyczny dziennik siłowy na iOS i Androida stworzony pod prawdziwe
                serie na siłowni. Jeden profil, wiele planów ze wspólną historią rekordów 1RM,
                Apple HealthKit oraz alarm przerw zsynchronizowany z Dynamic Island.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href={APK_DOWNLOAD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center gap-2.5 rounded-2xl bg-white px-6 text-sm font-bold tracking-tight text-black transition-all hover:bg-zinc-200 active:scale-[0.98]"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span>Pobierz APK (Android)</span>
                </a>

                <RouteLink
                  to="/instalacja"
                  platform="ios"
                  className="inline-flex h-12 items-center gap-2.5 rounded-2xl border border-zinc-700 bg-surface/90 px-6 text-sm font-semibold text-white transition-all hover:border-white hover:bg-elevated active:scale-[0.98]"
                >
                  <Apple className="h-4 w-4" aria-hidden="true" />
                  <span>Poradnik iPhone (Xcode)</span>
                  <ArrowRight className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
                </RouteLink>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
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
                  className="inline-flex items-center gap-1.5 text-zinc-300 transition-colors hover:text-white"
                >
                  <Coffee className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Buy Me a Coffee</span>
                </a>
              </div>
            </div>

            {/* Interactive Kinetic Hero Module */}
            <div className="lg:col-span-5">
              <div className="mobile-card animate-float-subtle rounded-[28px] p-6 sm:p-7">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">
                    LIVE ACTIVITY SIMULATION
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-zinc-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse-mono" />
                    iOS & Android
                  </span>
                </div>

                {/* Animated Dynamic Island Pill */}
                <div className="mt-4 rounded-full border border-zinc-700/80 bg-black px-4 py-3 shadow-inner transition-all duration-300">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PlateMark size={18} mono={false} />
                      <div className="min-w-0">
                        <div className="truncate font-mono text-[11px] font-bold text-white">
                          {currentIsland.tag}
                        </div>
                        <div className="truncate text-[11px] text-zinc-400">
                          {currentIsland.detail}
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-sm font-extrabold tabular-nums text-white">
                      {currentIsland.right}
                    </span>
                  </div>
                </div>

                {/* Tactile Hold-to-Start Interactive Button */}
                <div className="mt-5 rounded-2xl border border-hairline bg-black p-5 text-center">
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                    {sessionLaunched
                      ? 'SESJA ROZPOCZĘTA • GOTOWY DO SERII'
                      : 'PRZYTRZYMAJ PRZYCISK ABY WYSTARTOWAĆ'}
                  </div>

                  <div className="mt-4 flex justify-center">
                    {sessionLaunched ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white bg-white text-black">
                          <CheckCircle2 className="h-8 w-8" />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSessionLaunched(false);
                            setHoldProgress(0);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-hairline bg-elevated px-3 py-1.5 font-mono text-[11px] text-zinc-300 transition-colors hover:text-white"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Resetuj demo</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onMouseDown={() => setIsHolding(true)}
                        onMouseUp={stopHold}
                        onMouseLeave={stopHold}
                        onTouchStart={() => setIsHolding(true)}
                        onTouchEnd={stopHold}
                        onTouchCancel={stopHold}
                        className="group relative flex h-24 w-24 select-none items-center justify-center rounded-full focus:outline-none"
                        aria-label="Przytrzymaj przycisk startu treningu"
                      >
                        <span
                          aria-hidden="true"
                          className="animate-ring-ripple absolute inset-0 rounded-full border border-white/25"
                        />
                        <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96">
                          <circle
                            cx="48"
                            cy="48"
                            r={circleRadius}
                            stroke="#27272A"
                            strokeWidth="4"
                            fill="#121214"
                          />
                          <circle
                            cx="48"
                            cy="48"
                            r={circleRadius}
                            stroke="#FFFFFF"
                            strokeWidth="4"
                            strokeLinecap="round"
                            fill="none"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                          />
                        </svg>
                        <span className="absolute flex flex-col items-center justify-center text-white transition-transform group-active:scale-95">
                          <Play className="h-5 w-5 fill-white" />
                          <span className="mt-1 font-mono text-[10px] font-bold tracking-wider">
                            {holdProgress > 0 ? `${Math.round(holdProgress)}%` : 'HOLD'}
                          </span>
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4-METRIC MONOCHROME STRIP */}
          <Reveal delayMs={80}>
            <div className="mt-14 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {HERO_METRICS.map((metric) => (
                <div
                  key={metric.label}
                  className="mobile-card rounded-2xl px-4 py-4 text-left transition-colors hover:border-zinc-600"
                >
                  <div className="font-display text-2xl font-extrabold tabular-nums text-white sm:text-3xl">
                    {metric.value}
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-zinc-400">{metric.label}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* PILLAR CARDS -> SUBPAGES */}
      <section className="border-b border-hairline bg-black py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">
                  PODZIAŁ ARCHITEKTURY
                </span>
                <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                  Wszystko uporządkowane pod konkretne zadania.
                </h2>
              </div>
              <RouteLink
                to="/funkcje"
                className="inline-flex items-center gap-2 font-mono text-xs font-semibold text-white transition-colors hover:text-zinc-300"
              >
                <span>Pełny przegląd modułów</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </RouteLink>
            </div>
          </Reveal>

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {PILLAR_LINKS.map((pillar, idx) => (
              <Reveal key={pillar.route} delayMs={idx * 90}>
                <RouteLink
                  to={pillar.route}
                  className="mobile-card group flex h-full flex-col justify-between rounded-[24px] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-zinc-500"
                >
                  <div>
                    <div className="font-mono text-[10px] font-bold tracking-[0.16em] text-zinc-500">
                      {pillar.kicker}
                    </div>
                    <h3 className="mt-3 font-display text-xl font-bold text-white">
                      {pillar.title}
                    </h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">
                      {pillar.desc}
                    </p>
                  </div>
                  <div className="mt-6 inline-flex items-center gap-2 font-mono text-xs font-bold text-white">
                    <span>{pillar.cta}</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </RouteLink>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* INTERACTIVE DAY BANNER ARTWORK SHOWCASE */}
      <section className="bg-black py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <div className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">
                  <Layers className="h-3.5 w-3.5 text-white" />
                  <span>WEKTOROWE GRAFIKI DNI</span>
                </div>
                <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                  Spójne banery SVG dopasowane do każdego planu.
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                  Niezależnie od tego, czy importujesz własny plan JSON czy tworzysz nowy schemat od zera,
                  każdy dzień przypinasz do tagu generującego ostrą, monochromatyczną grafikę wektorową.
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  {DAY_ART_OPTIONS.map((opt) => {
                    const active = opt.tag === selectedTag;
                    return (
                      <button
                        key={opt.tag}
                        type="button"
                        onClick={() => setSelectedTag(opt.tag)}
                        className={`rounded-xl border px-3.5 py-2 font-mono text-xs font-semibold transition-all ${
                          active
                            ? 'border-white bg-white text-black'
                            : 'border-hairline bg-surface text-zinc-300 hover:border-zinc-500 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-7">
                <div className="mobile-card overflow-hidden rounded-[28px]">
                  <div className="relative border-b border-hairline bg-[#08080A] p-4 sm:p-6">
                    <DayBannerVector tag={selectedTag} className="h-52 w-full sm:h-60" />
                  </div>
                  <div className="flex flex-col justify-between gap-3 p-6 sm:flex-row sm:items-center">
                    <div>
                      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                        AKTYWNY TAG: #{activeDayArt.tag.toUpperCase()}
                      </div>
                      <h3 className="mt-1 font-display text-lg font-bold text-white">
                        {activeDayArt.subtitle}
                      </h3>
                    </div>
                    <div className="rounded-xl border border-hairline bg-black px-3.5 py-2 font-mono text-[11px] text-zinc-300">
                      {activeDayArt.setsNote}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
