import { useState } from 'react';
import { calculate1RM, TRAINING_ZONES } from '../data/websiteContent';

const PRESETS = [
  { label: 'Ławka 85×6', weight: 85, reps: 6 },
  { label: 'Przysiad 110×5', weight: 110, reps: 5 },
  { label: 'Martwy ciąg 140×4', weight: 140, reps: 4 },
  { label: 'OHP 60×8', weight: 60, reps: 8 },
] as const;

export function EpleyLabSection() {
  const [weight, setWeight] = useState(90);
  const [reps, setReps] = useState(6);

  const estimated1RM = calculate1RM(weight, reps);

  return (
    <section id="kalkulator" className="border-b border-white/[0.06] py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 rounded-3xl border border-white/[0.08] bg-[#0B0B0E] p-6 shadow-glass-card sm:p-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-6">
            <div className="font-mono text-[11px] tracking-[0.18em] text-zinc-500 uppercase">
              02 // KALKULATOR 1RM EPLEYA
            </div>
            <h2 className="mt-2.5 font-display text-3xl font-bold tracking-[-0.03em] text-white">
              Przetestuj silnik progresu
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Dokładnie ten sam algorytm <code className="font-mono text-zinc-200">w × (1 + r / 30)</code>{' '}
              automatycznie wylicza rekordy w aplikacji po każdej zapisanej serii.
            </p>

            {/* Quick Presets */}
            <div className="mt-5 flex flex-wrap gap-2">
              {PRESETS.map((preset) => {
                const isActive = weight === preset.weight && reps === preset.reps;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setWeight(preset.weight);
                      setReps(preset.reps);
                    }}
                    className={`rounded-full border px-3 py-1 font-mono text-[11px] transition ${
                      isActive
                        ? 'border-white bg-white font-bold text-black'
                        : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/25 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Sliders */}
            <div className="mt-7 space-y-6">
              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <label htmlFor="weight-range" className="font-mono text-xs text-zinc-400">
                    CIĘŻAR ROBOCZY
                  </label>
                  <span className="font-mono text-sm font-bold tabular-nums text-white">
                    {weight} kg
                  </span>
                </div>
                <input
                  id="weight-range"
                  type="range"
                  min={20}
                  max={220}
                  step={2.5}
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="mono-slider w-full"
                />
              </div>

              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <label htmlFor="reps-range" className="font-mono text-xs text-zinc-400">
                    LICZBA POWTÓRZEŃ
                  </label>
                  <span className="font-mono text-sm font-bold tabular-nums text-white">
                    {reps} {reps === 1 ? 'powt.' : 'powt.'}
                  </span>
                </div>
                <input
                  id="reps-range"
                  type="range"
                  min={1}
                  max={15}
                  step={1}
                  value={reps}
                  onChange={(e) => setReps(Number(e.target.value))}
                  className="mono-slider w-full"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-2xl border border-white/[0.08] bg-[#050506] p-6">
              <div className="flex items-baseline justify-between border-b border-white/[0.08] pb-5">
                <div>
                  <div className="font-mono text-[10px] tracking-[0.16em] text-zinc-500 uppercase">
                    SZACOWANY REKORD 1RM
                  </div>
                  <div className="mt-1.5 font-display text-5xl font-extrabold tracking-tight tabular-nums text-white sm:text-6xl">
                    {estimated1RM.toFixed(1)}
                    <span className="ml-2 font-mono text-xl font-medium text-zinc-500">kg</span>
                  </div>
                </div>
                <div className="text-right font-mono text-xs text-zinc-500">
                  <div>{weight} kg</div>
                  <div>× {reps} reps</div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                {TRAINING_ZONES.map((zone) => {
                  const zoneKg = (Math.round(estimated1RM * zone.pct * 2) / 2).toFixed(1);
                  return (
                    <div
                      key={zone.label}
                      className="rounded-xl border border-white/[0.06] bg-[#0B0B0E] p-3.5"
                    >
                      <div className="flex items-center justify-between font-mono text-[10px] text-zinc-500">
                        <span>{Math.round(zone.pct * 100)}% 1RM</span>
                        <span>{zone.reps}</span>
                      </div>
                      <div className="mt-1.5 font-mono text-lg font-bold tabular-nums text-white">
                        {zoneKg} kg
                      </div>
                      <div className="text-[11px] text-zinc-500">{zone.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
