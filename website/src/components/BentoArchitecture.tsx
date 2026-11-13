import { useMemo } from 'react';
import {
  ArrowUpRight,
  Bell,
  Fingerprint,
  Layers,
  Lock,
  Smartphone,
  TrendingUp,
} from 'lucide-react';
import {
  PROFILE_PREVIEW,
  RELEASES_URL,
  SPLINE_SERIES,
} from '../data/websiteContent';
import { buildSplineGeometry } from '../utils/splinePath';

export function BentoArchitecture() {
  const { points, linePath, areaPath } = useMemo(
    () => buildSplineGeometry(SPLINE_SERIES.all, 260, 92, { top: 10, right: 10, bottom: 14, left: 10 }),
    []
  );

  return (
    <section id="architektura" className="border-b border-white/[0.06] py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-12 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="font-mono text-[11px] tracking-[0.18em] text-zinc-500 uppercase">
              01 // ARCHITEKTURA SYSTEMU
            </div>
            <h2 className="mt-2.5 font-display text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">
              Zaprojektowane pod prawdziwy trening
            </h2>
          </div>

          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-400 transition hover:text-white"
          >
            <span>Wszystkie wydania</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          {/* Tile 1: Dynamic Island & Live Activity */}
          <article className="group flex flex-col justify-between rounded-3xl border border-white/[0.08] bg-[#0B0B0E] p-6 shadow-glass-card transition hover:border-white/[0.16] md:col-span-7">
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                  <Smartphone className="h-4 w-4 text-white" />
                </span>
                <span className="font-mono text-[11px] text-zinc-600">01</span>
              </div>
              <h3 className="mt-5 font-display text-xl font-bold tracking-tight text-white">
                Dynamic Island & Live Activities
              </h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
                Bieżąca seria, nazwa ćwiczenia i odliczanie przerwy działają bezpośrednio na
                ekranie blokady i Dynamic Island iPhone — bez odblokowywania telefonu między seriami.
              </p>
            </div>

            <div className="mt-7 grid gap-2.5 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/[0.07] bg-[#121216] p-3.5">
                <div className="font-mono text-[10px] text-zinc-500 uppercase">Seria</div>
                <div className="mt-1 font-mono text-sm font-bold text-white">3 / 4 • Ławka</div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/[0.06] p-3.5">
                <div className="font-mono text-[10px] text-zinc-400 uppercase">Odpoczynek</div>
                <div className="mt-1 font-mono text-sm font-bold tabular-nums text-white">
                  01:42 ↓
                </div>
              </div>
              <div className="rounded-2xl border border-white/[0.07] bg-[#121216] p-3.5">
                <div className="font-mono text-[10px] text-zinc-500 uppercase">Następne</div>
                <div className="mt-1 font-mono text-sm font-bold text-zinc-300">Wiosłowanie</div>
              </div>
            </div>
          </article>

          {/* Tile 2: 100% Offline & Multi-Profile */}
          <article className="group flex flex-col justify-between rounded-3xl border border-white/[0.08] bg-[#0B0B0E] p-6 shadow-glass-card transition hover:border-white/[0.16] md:col-span-5">
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                  <Lock className="h-4 w-4 text-white" />
                </span>
                <span className="font-mono text-[11px] text-zinc-600">02</span>
              </div>
              <h3 className="mt-5 font-display text-xl font-bold tracking-tight text-white">
                100% Offline & Wiele Profili
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Wszystkie serie, rekordy PR i pomiary masy ciała zapisywane lokalnie w AsyncStorage
                z pełną izolacją między profilami.
              </p>
            </div>

            <div className="mt-6 space-y-2">
              {PROFILE_PREVIEW.map((prof) => (
                <div
                  key={prof.name}
                  className={`flex items-center justify-between rounded-2xl border px-3.5 py-2.5 text-xs ${
                    prof.active
                      ? 'border-white/20 bg-white/[0.06] text-white'
                      : 'border-white/[0.06] bg-[#121216] text-zinc-400'
                  }`}
                >
                  <span className="font-medium">{prof.name}</span>
                  <span className="font-mono text-[11px] tabular-nums">
                    {prof.prs} • {prof.weight}
                  </span>
                </div>
              ))}
            </div>
          </article>

          {/* Tile 3: 1RM Epley & SVG Spline */}
          <article className="group flex flex-col justify-between rounded-3xl border border-white/[0.08] bg-[#0B0B0E] p-6 shadow-glass-card transition hover:border-white/[0.16] md:col-span-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                  <TrendingUp className="h-4 w-4 text-white" />
                </span>
                <span className="font-mono text-[11px] text-zinc-600">03</span>
              </div>
              <h3 className="mt-5 font-display text-lg font-bold tracking-tight text-white">
                Kalkulator 1RM & Wykresy SVG
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Automatyczna estymacja rekordu maksymalnego Epleya, trendy 7d / 30d / All oraz
                dziennik wagi ciała.
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-white/[0.06] bg-[#121216] p-3">
              <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-zinc-400">
                <span>TREND 1RM</span>
                <span className="text-white">108.5 kg</span>
              </div>
              <svg viewBox="0 0 260 92" className="h-20 w-full overflow-visible">
                <defs>
                  <linearGradient id="bentoSplineFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={areaPath} fill="url(#bentoSplineFill)" />
                <path d={linePath} fill="none" stroke="#FAFAFA" strokeWidth="2" strokeLinecap="round" />
                {points.map((pt) => (
                  <circle
                    key={pt.label}
                    cx={pt.x}
                    cy={pt.y}
                    r="2.5"
                    fill="#FAFAFA"
                    stroke="#0B0B0E"
                    strokeWidth="1.2"
                  />
                ))}
              </svg>
            </div>
          </article>

          {/* Tile 4: Creatine Reminders */}
          <article className="group flex flex-col justify-between rounded-3xl border border-white/[0.08] bg-[#0B0B0E] p-6 shadow-glass-card transition hover:border-white/[0.16] md:col-span-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                  <Bell className="h-4 w-4 text-white" />
                </span>
                <span className="font-mono text-[11px] text-zinc-600">04</span>
              </div>
              <h3 className="mt-5 font-display text-lg font-bold tracking-tight text-white">
                Przypomnienia o Kreatynie
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Interaktywne alerty o 09:00 i 22:00 z przyciskami odpowiedzi bezpośrednio z ekranu
                blokady.
              </p>
            </div>

            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-[#121216] px-3.5 py-2.5 font-mono text-xs">
                <span className="text-zinc-300">09:00 • Poranna</span>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold text-black">
                  Wziąłem 5g
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-[#121216] px-3.5 py-2.5 font-mono text-xs">
                <span className="text-zinc-400">22:00 • Wieczorna</span>
                <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-[10px] text-zinc-400">
                  Dziś pomijam
                </span>
              </div>
            </div>
          </article>

          {/* Tile 5: Tactile Hold-to-Start & Haptics */}
          <article className="group flex flex-col justify-between rounded-3xl border border-white/[0.08] bg-[#0B0B0E] p-6 shadow-glass-card transition hover:border-white/[0.16] md:col-span-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                  <Fingerprint className="h-4 w-4 text-white" />
                </span>
                <span className="font-mono text-[11px] text-zinc-600">05</span>
              </div>
              <h3 className="mt-5 font-display text-lg font-bold tracking-tight text-white">
                Hold-to-Start & Haptics
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Przytrzymanie 1.1s z haptycznym sprzężeniem eliminuje przypadkowy start w kieszeni,
                a wibracje sygnalizują koniec przerwy.
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-white/[0.06] bg-[#121216] p-3.5">
              <div className="flex items-center justify-between font-mono text-[10px] text-zinc-400">
                <span>HOLD DURATION</span>
                <span className="text-white">1100 ms</span>
              </div>
              <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-zinc-400 to-white" />
              </div>
              <div className="mt-2 font-mono text-[10px] text-zinc-500">
                expo-haptics • ImpactFeedbackStyle
              </div>
            </div>
          </article>

          {/* Tile 6: Dual Monochrome Theme Specimen */}
          <article className="flex flex-col justify-between gap-6 rounded-3xl border border-white/[0.08] bg-[#0B0B0E] p-6 shadow-glass-card md:col-span-12 lg:flex-row lg:items-center">
            <div className="max-w-xl">
              <div className="flex items-center gap-2.5 font-mono text-[11px] text-zinc-400">
                <Layers className="h-4 w-4 text-white" />
                <span>DUAL MONOCHROMATIC THEME</span>
              </div>
              <h3 className="mt-2 font-display text-xl font-bold tracking-tight text-white">
                Natychmiastowe przełączanie między czystym trybem Light i Obsidian Dark
              </h3>
              <p className="mt-1.5 text-sm text-zinc-400">
                Maksymalny kontrast na jasnej sali treningowej i zerowe zmęczenie wzroku wieczorem.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:w-80 shrink-0">
              <div className="rounded-2xl border border-white/15 bg-black p-4 text-white">
                <div className="font-mono text-[10px] text-zinc-500">DARK_THEME</div>
                <div className="mt-2 font-mono text-xs font-bold">#000000</div>
                <div className="mt-0.5 font-mono text-[10px] text-zinc-400">Card #121214</div>
              </div>
              <div className="rounded-2xl border border-zinc-300 bg-white p-4 text-black">
                <div className="font-mono text-[10px] text-zinc-500">LIGHT_THEME</div>
                <div className="mt-2 font-mono text-xs font-bold">#FFFFFF</div>
                <div className="mt-0.5 font-mono text-[10px] text-zinc-600">Card #F5F5F7</div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
