import { useMemo, useState } from 'react';
import {
  Activity,
  Award,
  Bell,
  Check,
  ChevronRight,
  Flame,
  Heart,
  Layers,
  Lock,
  Moon,
  Plus,
  Smartphone,
  Timer,
  TrendingUp,
} from 'lucide-react';
import {
  ChartTimeframe,
  formatRestTimer,
  ShowcaseScreen,
  SPLINE_SERIES,
  SUPPLEMENTS_PREVIEW,
  WORKOUT_SETS,
} from '../data/websiteContent';
import { buildSplineGeometry } from '../utils/splinePath';
import { PlateMark } from './PlateMark';

export function PhoneShowcase() {
  const [screen, setScreen] = useState<ShowcaseScreen>('workout');
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('30d');
  const [completedRows, setCompletedRows] = useState<number[]>([0]);

  const series = SPLINE_SERIES[timeframe];
  const chartGeo = useMemo(
    () => buildSplineGeometry(series, 240, 108, { top: 12, right: 10, bottom: 16, left: 10 }),
    [series]
  );

  const toggleRow = (idx: number) => {
    setCompletedRows((prev) =>
      prev.includes(idx) ? prev.filter((item) => item !== idx) : [...prev, idx]
    );
  };

  return (
    <section id="showcase" className="border-b border-hairline bg-black py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300">
              <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
              <span>INTERAKTYWNY PODGLAD UI</span>
            </div>
            <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Czysty styl mobilny, zaprojektowany pod obsluge jedna reka.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
              Zero ciezkich ramek czy przeladowanych formularzy. Karty #121214 z wyraznymi
              granicami, bezpieczne marginesy na kazdym iPhone i interaktywne paski odpoczynku.
            </p>

            <div className="mt-8 space-y-3">
              {[
                {
                  id: 'workout' as ShowcaseScreen,
                  icon: Flame,
                  iconColor: 'text-amberforge',
                  title: 'Ekran Dzis & Aktywna Sesja',
                  desc: 'Animowany streak, status regeneracji z Apple Health, konfigurator sesji i stoper przerw.',
                },
                {
                  id: 'progress' as ShowcaseScreen,
                  icon: TrendingUp,
                  iconColor: 'text-white',
                  title: 'Progres 1RM & Wspolne Rekordy',
                  desc: 'Statystyki cwiczen zachowane niezaleznie od tego, ile planow aktualnie rotujesz.',
                },
                {
                  id: 'health' as ShowcaseScreen,
                  icon: Heart,
                  iconColor: 'text-rose-400',
                  title: 'Apple Health & Elastyczne Suplementy',
                  desc: 'Kroki, sen, porady regeneracyjne oraz wlasne dawkowanie g/kg na ekranie blokady.',
                },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = screen === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setScreen(tab.id)}
                    className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-all ${
                      active
                        ? 'border-white bg-elevated shadow-sm'
                        : 'border-hairline bg-surface hover:border-zinc-600'
                    }`}
                  >
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-hairline bg-black">
                      <Icon className={`h-4 w-4 ${tab.iconColor}`} aria-hidden="true" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-display text-sm font-bold text-white">{tab.title}</span>
                        <ChevronRight
                          className={`h-4 w-4 ${active ? 'text-white' : 'text-zinc-600'}`}
                          aria-hidden="true"
                        />
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-400">{tab.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-center lg:col-span-6">
            <div className="w-full max-w-[348px] rounded-[46px] border border-zinc-700/80 bg-[#08080A] p-3 shadow-device-frame">
              <div className="overflow-hidden rounded-[36px] border border-hairline bg-black">
                {/* Status bar + Dynamic Island */}
                <div className="flex items-center justify-between px-6 pt-3 pb-2">
                  <span className="font-mono text-[11px] font-bold text-white">09:41</span>
                  <div className="flex h-6 w-28 items-center justify-between rounded-full border border-hairline bg-[#0C0C0E] px-2.5">
                    <PlateMark size={12} className="text-white" />
                    <span className="font-mono text-[10px] font-bold text-amber-300">01:48</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-3 rounded-sm bg-white/80" />
                  </div>
                </div>

                {/* Screen body */}
                <div className="min-h-[470px] space-y-3 p-4">
                  {screen === 'workout' && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1.5">
                          <span className="text-[11px] font-bold text-white">FBEOD v2</span>
                          <Layers className="h-3 w-3 text-zinc-400" aria-hidden="true" />
                        </div>
                        <div className="flex items-center gap-1.5 rounded-full border border-amberforge/40 bg-amberforge/10 px-3 py-1">
                          <Flame className="h-3.5 w-3.5 animate-flame text-amberforge" aria-hidden="true" />
                          <span className="font-mono text-[11px] font-bold text-amber-300">12 dni</span>
                        </div>
                      </div>

                      {/* Health insight card matching mobile */}
                      <div className="mobile-card flex items-center justify-between rounded-2xl p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                            <Moon className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <div>
                            <div className="text-[11px] font-bold text-white">7h 45m snu • Apple Health</div>
                            <div className="text-[10px] text-zinc-400">Regeneracja na wysokim poziomie</div>
                          </div>
                        </div>
                      </div>

                      {/* Sets list */}
                      <div className="mobile-card rounded-2xl p-3.5">
                        <div className="mb-2.5 flex items-center justify-between">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400">
                            DZISIEJSZA SESJA
                          </span>
                          <span className="font-mono text-[10px] text-amber-300">Dotknij serie</span>
                        </div>
                        <div className="space-y-2">
                          {WORKOUT_SETS.map((row, idx) => {
                            const checked = completedRows.includes(idx);
                            return (
                              <button
                                key={`${row.exercise}-${row.series}`}
                                type="button"
                                onClick={() => toggleRow(idx)}
                                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition-all ${
                                  checked
                                    ? 'border-white/70 bg-elevated'
                                    : 'border-hairline bg-black hover:border-zinc-600'
                                }`}
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="truncate text-[11px] font-semibold text-white">
                                    {row.exercise}
                                  </div>
                                  <div className="font-mono text-[10px] text-zinc-500">
                                    Seria {row.series} • {row.target}
                                  </div>
                                </div>
                                <div
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                                    checked
                                      ? 'border-white bg-white text-black'
                                      : 'border-zinc-600 bg-transparent'
                                  }`}
                                >
                                  {checked && <Check className="h-3 w-3" aria-hidden="true" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Rest Bar */}
                      <div className="rounded-2xl border border-amberforge/40 bg-elevated p-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 font-semibold text-white">
                            <Timer className="h-3.5 w-3.5 text-amberforge" aria-hidden="true" />
                            Przerwa aktywna
                          </span>
                          <span className="font-mono font-bold tabular-nums text-amber-300">
                            {formatRestTimer(108)}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black">
                          <div className="animate-rest-bar h-full w-full rounded-full bg-amberforge" />
                        </div>
                      </div>
                    </>
                  )}

                  {screen === 'progress' && (
                    <>
                      <div className="mobile-card rounded-2xl p-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-bold text-white">Wyciskanie Sztangi</div>
                            <div className="font-mono text-[10px] text-zinc-400">
                              Szacowany 1RM (Epley)
                            </div>
                          </div>
                          <div className="flex items-center gap-1 rounded-lg border border-hairline bg-black p-0.5 font-mono text-[10px]">
                            {(['7d', '30d', 'all'] as ChartTimeframe[]).map((tf) => (
                              <button
                                key={tf}
                                type="button"
                                onClick={() => setTimeframe(tf)}
                                className={`rounded-md px-2 py-1 font-bold transition-colors ${
                                  timeframe === tf
                                    ? 'bg-white text-black'
                                    : 'text-zinc-400 hover:text-white'
                                }`}
                              >
                                {tf === 'all' ? 'All' : tf}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="mt-4">
                          <svg viewBox="0 0 240 108" className="h-28 w-full overflow-visible">
                            <defs>
                              <linearGradient id="phoneChartGrad" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.22" />
                                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                              </linearGradient>
                            </defs>
                            <path d={chartGeo.areaPath} fill="url(#phoneChartGrad)" />
                            <path
                              d={chartGeo.linePath}
                              fill="none"
                              stroke="#FFFFFF"
                              strokeWidth="2.4"
                              strokeLinecap="round"
                            />
                            {chartGeo.points.map((pt, idx) => (
                              <circle
                                key={pt.label}
                                cx={pt.x}
                                cy={pt.y}
                                r={idx === chartGeo.points.length - 1 ? 4 : 2.5}
                                fill={idx === chartGeo.points.length - 1 ? '#F59E0B' : '#FFFFFF'}
                              />
                            ))}
                          </svg>
                        </div>

                        <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-zinc-500">
                          <span>Start: {series[0].value} kg</span>
                          <span className="font-bold text-white">
                            Aktualnie: {series[series.length - 1].value} kg
                          </span>
                        </div>
                      </div>

                      <div className="mobile-card flex items-center justify-between rounded-2xl p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amberforge/15 text-amberforge">
                            <Award className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">Rekordy wspolne dla planow</div>
                            <div className="text-[10px] text-zinc-400">
                              FBEOD + Upper/Lower lacza historie cwiczen
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {screen === 'health' && (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="mobile-card rounded-2xl p-3">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
                            <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>KROKI DZIS</span>
                          </div>
                          <div className="mt-1.5 font-mono text-xl font-bold text-white">8 420</div>
                          <div className="text-[10px] text-zinc-500">Apple Health</div>
                        </div>
                        <div className="mobile-card rounded-2xl p-3">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-sky-400">
                            <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>SEN</span>
                          </div>
                          <div className="mt-1.5 font-mono text-xl font-bold text-white">7h 45m</div>
                          <div className="text-[10px] text-zinc-500">Cel: 7h 30m</div>
                        </div>
                      </div>

                      <div className="mobile-card rounded-2xl p-3.5">
                        <div className="mb-2.5 flex items-center justify-between">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400">
                            TWOJE SUPLEMENTY
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-white">
                            <Plus className="h-3 w-3" aria-hidden="true" />
                            Wlasny
                          </span>
                        </div>
                        <div className="space-y-2">
                          {SUPPLEMENTS_PREVIEW.map((supp) => (
                            <div
                              key={supp.name}
                              className="flex items-center justify-between rounded-xl border border-hairline bg-black px-3 py-2"
                            >
                              <div>
                                <div className="text-[11px] font-semibold text-white">{supp.name}</div>
                                <div className="font-mono text-[10px] text-amber-300">{supp.dose}</div>
                              </div>
                              <div
                                className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                                  supp.active ? 'border-white bg-white text-black' : 'border-zinc-700'
                                }`}
                              >
                                {supp.active && <Check className="h-3 w-3" aria-hidden="true" />}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mobile-card rounded-2xl p-3">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-white">
                          <Lock className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
                          <span>Ekran Blokady iOS</span>
                          <Bell className="ml-auto h-3.5 w-3.5 text-amberforge" aria-hidden="true" />
                        </div>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">
                          Czas na dzienne suplementy (dawkowanie g/kg). Potwierdz jednym tapnieciem na ekranie blokady bez otwierania aplikacji.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
