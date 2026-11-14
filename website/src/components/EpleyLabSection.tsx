import { useState } from 'react';
import { Award, Sliders } from 'lucide-react';
import { calculate1RM, TRAINING_ZONES } from '../data/websiteContent';

export function EpleyLabSection() {
  const [weight, setWeight] = useState(100);
  const [reps, setReps] = useState(5);

  const estimated1RM = calculate1RM(weight, reps);
  const activeZoneIndex = reps <= 5 ? 0 : reps <= 12 ? 1 : 2;
  const weightPercentages = [100, 92, 85, 78, 70] as const;

  return (
    <section id="epley" className="border-b border-hairline bg-black py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300">
              <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
              <span>SILNIK EPLEY 1RM</span>
            </div>
            <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Kazda seria przeliczana automatycznie w czasie rzeczywistym.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
              Nie musisz robic maxow co tydzien, zeby wiedziec, czy stajesz sie silniejszy.
              Kalkulator Epley wyznacza szacowany 1RM po kazdym zalogowanym cwiczeniu i laczy go ze wspolna historia konta.
            </p>

            <div className="mt-8 space-y-2.5">
              {TRAINING_ZONES.map((zone, idx) => {
                const isActive = idx === activeZoneIndex;
                return (
                  <div
                    key={zone.label}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-xs transition-colors ${
                      isActive
                        ? 'border-white bg-elevated text-white'
                        : 'border-hairline bg-surface text-zinc-400'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-white">{zone.label}</span>
                      <span className="ml-2 font-mono text-[11px] text-zinc-500">
                        ({zone.range})
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-amber-300">{zone.formula}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mobile-card rounded-[24px] p-6 sm:p-8 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-6">
              <div>
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                  SZACOWANY MAKS (1RM)
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-display text-5xl font-extrabold tabular-nums text-white">
                    {estimated1RM}
                  </span>
                  <span className="font-mono text-lg font-bold text-amberforge">kg</span>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl border border-hairline bg-black px-3.5 py-2 text-xs font-semibold text-white">
                <Award className="h-4 w-4 text-amberforge" aria-hidden="true" />
                <span>Strefa: {TRAINING_ZONES[activeZoneIndex].label}</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-300">Ciezar serii</span>
                  <span className="font-mono font-bold tabular-nums text-white">{weight} kg</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={240}
                  step={2.5}
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  aria-label="Ciezar serii w kg"
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-tertiary accent-white"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-300">Powtorzenia</span>
                  <span className="font-mono font-bold tabular-nums text-white">{reps} powt.</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={reps}
                  onChange={(e) => setReps(Number(e.target.value))}
                  aria-label="Liczba powtorzen"
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-tertiary accent-white"
                />
              </div>
            </div>

            <div className="mt-7 grid grid-cols-5 gap-2">
              {weightPercentages.map((pct) => {
                const load = Math.round((estimated1RM * pct) / 100 / 2.5) * 2.5;
                return (
                  <div
                    key={pct}
                    className="rounded-xl border border-hairline bg-black p-2.5 text-center"
                  >
                    <div className="font-mono text-[10px] text-zinc-500">{pct}%</div>
                    <div className="mt-1 font-mono text-xs font-bold tabular-nums text-white">
                      {load} kg
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
