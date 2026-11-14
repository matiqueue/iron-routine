import { useMemo, useState } from 'react';
import { Award, Sliders, TrendingUp } from 'lucide-react';
import {
  calculate1RM,
  ChartTimeframe,
  MUSCLE_VOLUME_SAMPLE,
  SPLINE_SERIES,
  SUPPLEMENTS_PREVIEW,
  TRAINING_ZONES,
} from '../data/websiteContent';
import { buildSplineGeometry } from '../utils/splinePath';
import { Reveal } from '../components/Reveal';

export function AnalyticsPage() {
  const [weight, setWeight] = useState(100);
  const [reps, setReps] = useState(5);
  const [bodyweight, setBodyweight] = useState(82);
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('30d');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const estimated1RM = calculate1RM(weight, reps);
  const activeZoneIndex = reps <= 5 ? 0 : reps <= 12 ? 1 : 2;
  const weightPercentages = [100, 92, 85, 78, 70] as const;

  const series = SPLINE_SERIES[timeframe];
  const chartGeo = useMemo(
    () => buildSplineGeometry(series, 460, 170, { top: 18, right: 20, bottom: 20, left: 20 }),
    [series]
  );

  const activePoint =
    hoveredIdx !== null && chartGeo.points[hoveredIdx]
      ? chartGeo.points[hoveredIdx]
      : chartGeo.points[chartGeo.points.length - 1];

  return (
    <div className="animate-page-enter">
      {/* HEADER + MONOCHROME HEX COLLAR ARTWORK */}
      <section className="relative overflow-hidden border-b border-hairline bg-black py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">
              <Sliders className="h-3.5 w-3.5 text-white" />
              <span>TELEMETRIA SIŁY I REGENERACJI</span>
            </div>
            <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              Analityka oparta na wzorze Epley i HealthKit.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
              Niezależnie od tego, ile planów treningowych rotujesz na swoim profilu, historia ćwiczeń,
              krzywe 1RM oraz tygodniowa objętość partii mięśniowych budują jedną wspólną bazę postępu.
            </p>
          </div>

          <div className="lg:col-span-6">
            <div className="relative overflow-hidden rounded-[28px] border border-hairline bg-black">
              <img
                src="/images/telemetry-plates-dark.jpg"
                alt="Monochromatyczna wizualizacja precyzyjnych krążków i nakrętek heksagonalnych"
                className="h-64 w-full object-cover grayscale contrast-115 sm:h-72"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-transparent" />
              <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between font-mono text-[11px] text-zinc-300">
                <span>MODEL EPLEY 1RM • W × (1 + R / 30)</span>
                <span>0 BŁĘDU ZAOKRĄGLEŃ</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE EPLEY LAB */}
      <section className="border-b border-hairline bg-black py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
              <div className="space-y-3 lg:col-span-5">
                <h2 className="font-display text-2xl font-extrabold text-white sm:text-3xl">
                  Kalkulator szacowanego 1RM na żywo
                </h2>
                <p className="text-sm leading-relaxed text-zinc-400">
                  Przesuwaj suwaki ciężaru i liczby powtórzeń, aby zobaczyć strefę treningową oraz
                  gotową piramidę obciążeń dla kolejnych serii.
                </p>

                <div className="space-y-2.5 pt-3">
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
                        <span className="font-mono text-[11px] text-zinc-300">{zone.formula}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mobile-card rounded-[28px] p-6 sm:p-8 lg:col-span-7">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-6">
                  <div>
                    <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                      SZACOWANY MAKS (1RM)
                    </span>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="font-display text-5xl font-extrabold tabular-nums text-white">
                        {estimated1RM}
                      </span>
                      <span className="font-mono text-lg font-bold text-zinc-400">kg</span>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-xl border border-hairline bg-black px-3.5 py-2 text-xs font-semibold text-white">
                    <Award className="h-4 w-4 text-white" />
                    <span>{TRAINING_ZONES[activeZoneIndex].label}</span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-300">Ciężar serii</span>
                      <span className="font-mono font-bold tabular-nums text-white">{weight} kg</span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={240}
                      step={2.5}
                      value={weight}
                      onChange={(e) => setWeight(Number(e.target.value))}
                      aria-label="Ciężar serii w kilogramach"
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-tertiary accent-white"
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-300">Powtórzenia</span>
                      <span className="font-mono font-bold tabular-nums text-white">{reps} powt.</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      step={1}
                      value={reps}
                      onChange={(e) => setReps(Number(e.target.value))}
                      aria-label="Liczba powtórzeń"
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
          </Reveal>
        </div>
      </section>

      {/* INTERACTIVE SPLINE CHART + MUSCLE VOLUME + G/KG SUPPS */}
      <section className="bg-black py-20">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
          <Reveal className="lg:col-span-7">
            <div className="mobile-card h-full rounded-[28px] p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 font-mono text-[11px] font-bold text-zinc-400">
                    <TrendingUp className="h-3.5 w-3.5 text-white" />
                    <span>TREND PROGRESU 1RM</span>
                  </div>
                  <div className="mt-1 font-display text-2xl font-extrabold text-white">
                    {activePoint.value} kg{' '}
                    <span className="font-mono text-xs font-medium text-zinc-400">
                      ({activePoint.weight} kg × {activePoint.reps} | {activePoint.label})
                    </span>
                  </div>
                </div>

                <div className="flex gap-1 rounded-xl border border-hairline bg-black p-1 font-mono text-[11px]">
                  {(['7d', '30d', 'all'] as ChartTimeframe[]).map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => {
                        setTimeframe(tf);
                        setHoveredIdx(null);
                      }}
                      className={`rounded-lg px-2.5 py-1 font-bold transition-colors ${
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

              <div className="mt-6 rounded-2xl border border-hairline bg-black p-4">
                <svg viewBox="0 0 460 170" className="h-44 w-full overflow-visible">
                  <defs>
                    <linearGradient id="analyticsArea" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={chartGeo.areaPath} fill="url(#analyticsArea)" />
                  <path
                    key={timeframe}
                    d={chartGeo.linePath}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    className="animate-stroke-draw"
                  />
                  {chartGeo.points.map((pt, i) => {
                    const isFocused =
                      hoveredIdx !== null ? i === hoveredIdx : i === chartGeo.points.length - 1;
                    return (
                      <g
                        key={pt.label}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredIdx(i)}
                        onMouseLeave={() => setHoveredIdx(null)}
                      >
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isFocused ? 6 : 4}
                          fill={isFocused ? '#FFFFFF' : '#18181A'}
                          stroke="#FFFFFF"
                          strokeWidth="2"
                        />
                        <text
                          x={pt.x}
                          y={166}
                          textAnchor="middle"
                          fill="#71717A"
                          fontSize="10"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {pt.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          </Reveal>

          <Reveal delayMs={100} className="lg:col-span-5">
            <div className="mobile-card flex h-full flex-col justify-between rounded-[28px] p-6 sm:p-8">
              <div>
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">
                  OBJĘTOŚĆ & SUPLEMENTY G/KG
                </span>
                <h3 className="mt-2 font-display text-xl font-bold text-white">
                  Serie tygodniowe i dawki wg masy ciała
                </h3>

                <div className="mt-5 space-y-2.5">
                  {MUSCLE_VOLUME_SAMPLE.map((m) => (
                    <div key={m.group}>
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span className="text-zinc-300">{m.group}</span>
                        <span className="text-zinc-400">
                          {m.sets} / {m.target} serii
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black">
                        <div
                          className="h-full rounded-full bg-white transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.round((m.sets / m.target) * 100))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-hairline bg-black p-4">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-300">Twoja waga (przelicznik supli)</span>
                  <span className="font-mono font-bold text-white">{bodyweight} kg</span>
                </div>
                <input
                  type="range"
                  min={55}
                  max={120}
                  step={1}
                  value={bodyweight}
                  onChange={(e) => setBodyweight(Number(e.target.value))}
                  aria-label="Masa ciała w kilogramach"
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-tertiary accent-white"
                />
                <div className="mt-3 space-y-1.5">
                  {SUPPLEMENTS_PREVIEW.map((s) => (
                    <div key={s.name} className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-zinc-400">{s.name}</span>
                      <span className="font-bold text-white">
                        {s.mode === 'perkg' ? `${(bodyweight * s.perKg).toFixed(1)} g` : s.fixed}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
