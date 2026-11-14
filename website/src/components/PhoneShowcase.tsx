import { useEffect, useState } from 'react';
import {
  Activity,
  Award,
  Check,
  Flame,
  Heart,
  Layers,
  Pause,
  Play,
  RotateCcw,
  Timer,
} from 'lucide-react';
import {
  formatRestTimer,
  PLAN_PREVIEW,
  ShowcaseScreen,
  SUPPLEMENTS_PREVIEW,
  WORKOUT_SETS,
} from '../data/websiteContent';
import { PlateMark } from './PlateMark';

export function PhoneShowcase() {
  const [screen, setScreen] = useState<ShowcaseScreen>('workout');
  const [completedRows, setCompletedRows] = useState<number[]>([0]);
  const [activePlanIdx, setActivePlanIdx] = useState(0);
  const [restSeconds, setRestSeconds] = useState(114);
  const [restPaused, setRestPaused] = useState(false);

  useEffect(() => {
    if (restPaused || restSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setRestSeconds((prev) => (prev > 1 ? prev - 1 : 120));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [restPaused, restSeconds]);

  const toggleRow = (idx: number) => {
    setCompletedRows((prev) =>
      prev.includes(idx) ? prev.filter((item) => item !== idx) : [...prev, idx]
    );
  };

  return (
    <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
      <div className="lg:col-span-6">
        <div className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          <span>INTERAKTYWNY SYMULATOR UI</span>
        </div>
        <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Przetestuj ekran treningu, rotację planów i Dynamic Island.
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
          Przełączaj zakładki po lewej stronie lub klikaj serie i pauzę przerwy bezpośrednio
          na makiecie telefonu, aby zobaczyć jak zachowuje się monochromatyczny interfejs.
        </p>

        <div className="mt-8 space-y-3">
          {[
            {
              id: 'workout' as ShowcaseScreen,
              icon: Timer,
              title: 'Aktywna sesja i synchronizacja Dynamic Island',
              desc: 'Odznaczaj serie, wstrzymuj timer jednym kliknięciem i sprawdzaj natychmiastowe zamrożenie czasu w pigułce Live Activity.',
            },
            {
              id: 'plans' as ShowcaseScreen,
              icon: Layers,
              title: 'Jeden profil, wiele planów i wspólne PR',
              desc: 'Przełącz się między FBEOD, Upper/Lower i PPL. Historia najlepszych ciężarów i rekordów 1RM pozostaje wspólna.',
            },
            {
              id: 'health' as ShowcaseScreen,
              icon: Heart,
              title: 'Apple HealthKit / Health Connect i suplementy',
              desc: 'Kontekstowe wskazówki regeneracji oparte na długości snu oraz krokach wraz z dawkami g/kg masy ciała.',
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
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-hairline bg-black text-white">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-sm font-bold text-white">{tab.title}</div>
                  <div className="mt-1 text-xs leading-relaxed text-zinc-400">{tab.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center lg:col-span-6 lg:justify-end">
        <div className="relative w-full max-w-[354px] rounded-[46px] border-[3px] border-zinc-800 bg-black p-3.5 shadow-device-frame">
          <div className="relative overflow-hidden rounded-[36px] border border-hairline bg-black px-4 pb-5 pt-3">
            {/* Live Interactive Dynamic Island */}
            <div className="mx-auto mb-4 flex items-center justify-between rounded-full border border-zinc-800 bg-[#0A0A0C] px-3.5 py-2 transition-all">
              <div className="flex items-center gap-2">
                <PlateMark size={14} mono={false} />
                <span className="font-mono text-[10px] font-bold tracking-wider text-white">
                  {restPaused ? 'PAUZA' : 'PRZERWA'}
                </span>
              </div>
              <span className="font-mono text-xs font-extrabold tabular-nums text-white">
                {formatRestTimer(restSeconds)}
              </span>
            </div>

            {screen === 'workout' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-[10px] tracking-[0.14em] text-zinc-500">
                      FBEOD • DZIEŃ 1
                    </div>
                    <h3 className="mt-0.5 font-display text-lg font-extrabold text-white">
                      Aktywny trening
                    </h3>
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-2.5 py-1 text-[11px] font-bold text-white">
                    <Flame className="h-3.5 w-3.5 animate-pulse-mono" aria-hidden="true" />
                    <span>14d</span>
                  </div>
                </div>

                {/* Synchronized Rest Bar */}
                <div className="mobile-card rounded-2xl p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        {restPaused ? 'LICZNIK WSTRZYMANY' : 'ODPOCZYNEK W TOKU'}
                      </div>
                      <div className="mt-0.5 font-mono text-xl font-extrabold tabular-nums text-white">
                        {formatRestTimer(restSeconds)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setRestPaused((p) => !p)}
                        aria-label={restPaused ? 'Wznów przerwę' : 'Wstrzymaj przerwę'}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white text-black transition-transform active:scale-95"
                      >
                        {restPaused ? <Play className="h-3.5 w-3.5 fill-current" /> : <Pause className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRestPaused(false);
                          setRestSeconds(120);
                        }}
                        aria-label="Resetuj przerwę"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-hairline bg-elevated text-zinc-300 hover:text-white"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-tertiary">
                    <div
                      className="h-full rounded-full bg-white transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.round((restSeconds / 180) * 100))}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  {WORKOUT_SETS.map((item, idx) => {
                    const isDone = completedRows.includes(idx);
                    return (
                      <button
                        key={item.exercise}
                        type="button"
                        onClick={() => toggleRow(idx)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-3.5 py-2.5 text-left transition-all ${
                          isDone
                            ? 'border-white/50 bg-elevated'
                            : 'border-hairline bg-surface hover:border-zinc-600'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="truncate text-xs font-bold text-white">
                            {item.exercise}
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] text-zinc-400">
                            {item.target} • {item.restSeconds}s przerwy
                          </div>
                        </div>
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                            isDone
                              ? 'border-white bg-white text-black'
                              : 'border-zinc-700 bg-black text-zinc-600'
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {screen === 'plans' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-[10px] tracking-[0.14em] text-zinc-500">
                      JEDEN PROFIL • MULTI-PLAN
                    </div>
                    <h3 className="mt-0.5 font-display text-lg font-extrabold text-white">
                      Aktywne plany
                    </h3>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-2.5 py-1 font-mono text-[10px] font-bold text-white">
                    <Award className="h-3 w-3" />
                    WSPÓLNE PR
                  </span>
                </div>

                <div className="space-y-2">
                  {PLAN_PREVIEW.map((plan, idx) => {
                    const selected = activePlanIdx === idx;
                    return (
                      <button
                        key={plan.name}
                        type="button"
                        onClick={() => setActivePlanIdx(idx)}
                        className={`flex w-full items-center justify-between rounded-2xl border p-3.5 text-left transition-all ${
                          selected
                            ? 'border-white bg-elevated'
                            : 'border-hairline bg-surface hover:border-zinc-600'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-white">{plan.name}</div>
                          <div className="mt-0.5 font-mono text-[10px] text-zinc-400">{plan.tag}</div>
                        </div>
                        <span
                          className={`rounded-lg px-2 py-1 font-mono text-[10px] font-bold ${
                            selected ? 'bg-white text-black' : 'border border-hairline text-zinc-400'
                          }`}
                        >
                          {selected ? 'AKTYWNY' : 'WYBIERZ'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mobile-card rounded-2xl p-3.5">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    ZSYNCHRONIZOWANA HISTORIA ĆWICZENIA
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between">
                    <span className="text-xs font-semibold text-white">JM Press • Est. 1RM</span>
                    <span className="font-mono text-sm font-extrabold text-white">59 kg</span>
                  </div>
                </div>
              </div>
            )}

            {screen === 'health' && (
              <div className="space-y-3">
                <div>
                  <div className="font-mono text-[10px] tracking-[0.14em] text-zinc-500">
                    APPLE HEALTH & HEALTH CONNECT
                  </div>
                  <h3 className="mt-0.5 font-display text-lg font-extrabold text-white">
                    Regeneracja i Suple
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="mobile-card rounded-2xl p-3">
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-400">
                      <Activity className="h-3.5 w-3.5 text-white" />
                      <span>KROKI DZIŚ</span>
                    </div>
                    <div className="mt-1 font-display text-xl font-extrabold tabular-nums text-white">
                      9 420
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-zinc-500">Cel: 8 000+</div>
                  </div>
                  <div className="mobile-card rounded-2xl p-3">
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-400">
                      <Heart className="h-3.5 w-3.5 text-white" />
                      <span>CZAS SNU</span>
                    </div>
                    <div className="mt-1 font-display text-xl font-extrabold tabular-nums text-white">
                      7h 50m
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-zinc-400">Gotowy na PR</div>
                  </div>
                </div>

                <div className="mobile-card rounded-2xl p-3">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    WSKAZÓWKA SYSTEMOWA
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-300">
                    Wysoka regeneracja po 7h 50m snu. Pamiętaj o nawodnieniu przed ciężkimi seriami.
                  </p>
                </div>

                <div className="space-y-1.5">
                  {SUPPLEMENTS_PREVIEW.map((supp) => (
                    <div
                      key={supp.name}
                      className="flex items-center justify-between rounded-xl border border-hairline bg-surface px-3 py-2.5 text-xs"
                    >
                      <span className="font-semibold text-white">{supp.name}</span>
                      <span className="font-mono text-[10px] font-bold text-zinc-300">
                        {supp.mode === 'perkg' ? '0.07 g/kg (~6.0 g)' : supp.fixed}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
