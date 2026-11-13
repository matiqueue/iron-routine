import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Check,
  Flame,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Sun,
  TrendingUp,
} from 'lucide-react';
import {
  formatRestTimer,
  SPLINE_SERIES,
  WORKOUT_SETS,
  type ChartTimeframe,
  type ShowcaseScreen,
} from '../data/websiteContent';
import { buildSplineGeometry } from '../utils/splinePath';

const INITIAL_REST_SECONDS = 102;

const SCREEN_TABS: readonly { id: ShowcaseScreen; label: string }[] = [
  { id: 'workout', label: 'Live Activity' },
  { id: 'progress', label: 'Progres 1RM' },
  { id: 'creatine', label: 'Kreatyna' },
];

const TIMEFRAMES: readonly { id: ChartTimeframe; label: string }[] = [
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: 'all', label: 'ALL' },
];

export function PhoneShowcase() {
  const [screen, setScreen] = useState<ShowcaseScreen>('workout');
  const [phoneDark, setPhoneDark] = useState(true);
  const [timerRunning, setTimerRunning] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(INITIAL_REST_SECONDS);
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('30d');
  const [selectedPointIdx, setSelectedPointIdx] = useState<number | null>(null);
  const [creatineStatus, setCreatineStatus] = useState<'pending' | 'taken' | 'snoozed'>('pending');

  // Hold-to-start interactive state inside the simulator
  const [holdProgress, setHoldProgress] = useState(0);
  const [workoutStarted, setWorkoutStarted] = useState(true);
  const holdTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!timerRunning || screen !== 'workout') return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? INITIAL_REST_SECONDS : prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning, screen]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current !== null) {
        window.clearInterval(holdTimerRef.current);
      }
    };
  }, []);

  const splineData = SPLINE_SERIES[timeframe];
  const { points, linePath, areaPath } = useMemo(
    () => buildSplineGeometry(splineData, 272, 118),
    [splineData]
  );

  const activePoint =
    selectedPointIdx !== null && points[selectedPointIdx]
      ? points[selectedPointIdx]
      : points[points.length - 1];

  const startHold = () => {
    if (holdTimerRef.current !== null) return;
    const startedAt = Date.now();
    const duration = 900;
    holdTimerRef.current = window.setInterval(() => {
      const pct = Math.min(100, ((Date.now() - startedAt) / duration) * 100);
      setHoldProgress(pct);
      if (pct >= 100) {
        if (holdTimerRef.current !== null) {
          window.clearInterval(holdTimerRef.current);
          holdTimerRef.current = null;
        }
        const nextStarted = !workoutStarted;
        setWorkoutStarted(nextStarted);
        setHoldProgress(0);
        if (nextStarted) {
          setSecondsLeft(INITIAL_REST_SECONDS);
          setTimerRunning(true);
        } else {
          setTimerRunning(false);
        }
      }
    }, 24);
  };

  const cancelHold = () => {
    if (holdTimerRef.current !== null) {
      window.clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setHoldProgress(0);
  };

  const shellBg = phoneDark ? 'bg-[#000000] text-white' : 'bg-[#FFFFFF] text-black';
  const cardBg = phoneDark
    ? 'bg-[#121214] border-zinc-800/90'
    : 'bg-[#F5F5F7] border-zinc-200';
  const subCardBg = phoneDark ? 'bg-[#1C1C1E]' : 'bg-white border border-zinc-200/80';
  const mutedText = phoneDark ? 'text-zinc-400' : 'text-zinc-500';
  const primaryBtn = phoneDark
    ? 'bg-white text-black hover:bg-zinc-200'
    : 'bg-black text-white hover:bg-zinc-800';

  return (
    <div className="relative mx-auto w-full max-w-[360px]">
      {/* Soft monochrome ambient glow behind hardware */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-8 rounded-full bg-white/[0.045] blur-3xl"
      />

      {/* Interactive control bar above phone */}
      <div className="relative mb-4 flex items-center justify-between gap-2 rounded-full border border-white/10 bg-[#0B0B0E]/90 p-1.5 backdrop-blur-md">
        <div className="flex items-center gap-1">
          {SCREEN_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setScreen(tab.id)}
              className={`rounded-full px-3 py-1.5 font-mono text-[11px] font-medium transition ${
                screen === tab.id
                  ? 'bg-white text-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setPhoneDark((d) => !d)}
          aria-label={phoneDark ? 'Przełącz symulator na jasny motyw' : 'Przełącz symulator na ciemny motyw'}
          title="Przełącz motyw aplikacji (Light / Dark)"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:border-white/25 hover:text-white"
        >
          {phoneDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Titanium iPhone Frame */}
      <div className="relative rounded-[44px] border border-white/15 bg-[#0C0C0F] p-2.5 shadow-device-frame">
        <div
          className={`relative overflow-hidden rounded-[36px] border transition-colors duration-300 ${
            phoneDark ? 'border-zinc-800/80' : 'border-zinc-300'
          } ${shellBg}`}
        >
          {/* Status bar + Dynamic Island */}
          <div className="px-5 pt-3 pb-2">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="font-mono tabular-nums">18:42</span>
              {/* Dynamic Island Pill */}
              <div className="flex items-center gap-2 rounded-full bg-[#121214] px-3 py-1 text-white ring-1 ring-white/15">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    timerRunning ? 'animate-pulse bg-emerald-400' : 'bg-zinc-500'
                  }`}
                />
                <span className="font-mono text-[10px] tracking-tight text-zinc-300">
                  {screen === 'creatine' ? '5g KREATYNA' : 'PRZERWA'}
                </span>
                <span className="font-mono text-[10px] font-bold tabular-nums text-white">
                  {screen === 'creatine' ? '09:00' : formatRestTimer(secondsLeft)}
                </span>
              </div>
              <span className="font-mono text-[10px] text-zinc-500">OFFLINE</span>
            </div>
          </div>

          {/* Screen Content */}
          <div className="min-h-[418px] px-4 pb-5 pt-2">
            {screen === 'workout' ? (
              <div className="space-y-3">
                {/* Live Activity Lockscreen Card */}
                <div className={`rounded-2xl border p-3.5 ${cardBg}`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-mono text-[10px] tracking-wider uppercase ${mutedText}`}>
                      LIVE ACTIVITY • FBW A
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      AKTYWNA
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-baseline justify-between">
                    <div>
                      <div className={`text-[11px] ${mutedText}`}>Seria 3 z 4 • Ławka pozioma</div>
                      <div className="mt-0.5 font-mono text-3xl font-bold tracking-tight tabular-nums">
                        {formatRestTimer(secondsLeft)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setTimerRunning((r) => !r)}
                        aria-label={timerRunning ? 'Wstrzymaj timer' : 'Wznów timer'}
                        className={`flex h-8 w-8 items-center justify-center rounded-full transition ${primaryBtn}`}
                      >
                        {timerRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSecondsLeft(INITIAL_REST_SECONDS);
                          setTimerRunning(true);
                        }}
                        aria-label="Resetuj timer przerwy"
                        className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
                          phoneDark
                            ? 'border-zinc-700 text-zinc-300 hover:border-zinc-500'
                            : 'border-zinc-300 text-zinc-700 hover:border-zinc-500'
                        }`}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div
                    className={`mt-3 h-1.5 w-full overflow-hidden rounded-full ${
                      phoneDark ? 'bg-zinc-800' : 'bg-zinc-200'
                    }`}
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        phoneDark ? 'bg-white' : 'bg-black'
                      }`}
                      style={{
                        width: `${Math.round(((INITIAL_REST_SECONDS - secondsLeft) / INITIAL_REST_SECONDS) * 100) || 12}%`,
                      }}
                    />
                  </div>
                  <div className={`mt-2 flex justify-between font-mono text-[10px] ${mutedText}`}>
                    <span>POSTĘP: 68%</span>
                    <span>NASTĘPNE: WIOSŁOWANIE</span>
                  </div>
                </div>

                {/* Active Exercise Sets */}
                <div className={`rounded-2xl border p-3.5 ${cardBg}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold">Wyciskanie sztangi poziomo</div>
                      <div className={`text-[11px] ${mutedText}`}>Cel: 4 × 6–8 • Przerwa 120s</div>
                    </div>
                    <span className={`font-mono text-[11px] font-bold ${mutedText}`}>108.5 kg 1RM</span>
                  </div>

                  <div className="mt-3 grid grid-cols-4 gap-1.5">
                    {WORKOUT_SETS.map((s) => (
                      <div
                        key={s.id}
                        className={`rounded-xl px-2 py-2 text-center font-mono text-[10px] transition ${
                          s.done
                            ? phoneDark
                              ? 'bg-white text-black font-bold'
                              : 'bg-black text-white font-bold'
                            : s.active
                              ? phoneDark
                                ? 'border border-white/40 bg-white/10 text-white'
                                : 'border border-black/40 bg-black/5 text-black'
                              : subCardBg
                        }`}
                      >
                        <div>{s.label}</div>
                        <div className="mt-0.5 text-[9px] opacity-80">{s.reps}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Interactive Hold-to-Start simulation */}
                <button
                  type="button"
                  onPointerDown={startHold}
                  onPointerUp={cancelHold}
                  onPointerLeave={cancelHold}
                  onPointerCancel={cancelHold}
                  className={`relative w-full overflow-hidden rounded-2xl border px-4 py-3 text-left transition select-none ${
                    phoneDark
                      ? 'border-zinc-800 bg-[#121214] hover:border-zinc-700'
                      : 'border-zinc-200 bg-[#F5F5F7] hover:border-zinc-300'
                  }`}
                >
                  <div
                    className={`absolute inset-y-0 left-0 transition-none ${
                      phoneDark ? 'bg-white/15' : 'bg-black/10'
                    }`}
                    style={{ width: `${holdProgress}%` }}
                  />
                  <div className="relative flex items-center justify-between">
                    <div>
                      <div className="font-mono text-[11px] font-bold tracking-wide">
                        {workoutStarted
                          ? 'TRENING AKTYWNY • PRZYTRZYMAJ BY ZAKOŃCZYĆ'
                          : 'PRZYTRZYMAJ (1s), ABY ROZPOCZĄĆ'}
                      </div>
                      <div className={`text-[10px] ${mutedText}`}>
                        Tactile Hold-to-Start z Haptics
                      </div>
                    </div>
                    <Activity className="h-4 w-4 opacity-70" />
                  </div>
                </button>
              </div>
            ) : null}

            {screen === 'progress' ? (
              <div className="space-y-3">
                <div className={`rounded-2xl border p-3.5 ${cardBg}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`font-mono text-[10px] tracking-wider uppercase ${mutedText}`}>
                        SZACOWANY 1RM (EPLEY)
                      </div>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="font-mono text-3xl font-bold tabular-nums">
                          {activePoint ? activePoint.value.toFixed(1) : '108.5'} kg
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-emerald-400">
                          +6.0 kg
                        </span>
                      </div>
                    </div>
                    <TrendingUp className="h-4 w-4 opacity-60" />
                  </div>

                  {/* Timeframe Selector */}
                  <div className="mt-3 flex gap-1">
                    {TIMEFRAMES.map((tf) => (
                      <button
                        key={tf.id}
                        type="button"
                        onClick={() => {
                          setTimeframe(tf.id);
                          setSelectedPointIdx(null);
                        }}
                        className={`rounded-lg px-2.5 py-1 font-mono text-[10px] font-bold transition ${
                          timeframe === tf.id
                            ? phoneDark
                              ? 'bg-white text-black'
                              : 'bg-black text-white'
                            : `${mutedText} hover:opacity-80`
                        }`}
                      >
                        {tf.label}
                      </button>
                    ))}
                  </div>

                  {/* Smooth Cubic Bezier SVG Chart */}
                  <div className="mt-3">
                    <svg viewBox="0 0 272 118" className="h-32 w-full overflow-visible">
                      <defs>
                        <linearGradient id="phoneSplineFill" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="0%"
                            stopColor={phoneDark ? '#FFFFFF' : '#000000'}
                            stopOpacity="0.24"
                          />
                          <stop
                            offset="100%"
                            stopColor={phoneDark ? '#FFFFFF' : '#000000'}
                            stopOpacity="0"
                          />
                        </linearGradient>
                      </defs>

                      <path d={areaPath} fill="url(#phoneSplineFill)" />
                      <path
                        d={linePath}
                        fill="none"
                        stroke={phoneDark ? '#FFFFFF' : '#000000'}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />

                      {points.map((pt, idx) => {
                        const isSelected = activePoint?.label === pt.label;
                        return (
                          <g
                            key={pt.label}
                            className="cursor-pointer"
                            onMouseEnter={() => setSelectedPointIdx(idx)}
                            onClick={() => setSelectedPointIdx(idx)}
                          >
                            <circle cx={pt.x} cy={pt.y} r="10" fill="transparent" />
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={isSelected ? 4.5 : 3}
                              fill={phoneDark ? '#FFFFFF' : '#000000'}
                              stroke={phoneDark ? '#000000' : '#FFFFFF'}
                              strokeWidth="1.5"
                            />
                            <text
                              x={pt.x}
                              y={114}
                              textAnchor="middle"
                              fill={phoneDark ? '#71717A' : '#71717A'}
                              fontSize="9"
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

                <div className={`rounded-2xl border p-3.5 ${cardBg}`}>
                  <div className={`font-mono text-[10px] uppercase ${mutedText}`}>
                    REKORDY PROFILU • SZYMON
                  </div>
                  <div className="mt-2.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span>Przysiad ze sztangą</span>
                      <span className="font-mono font-bold tabular-nums">124.0 kg</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Rumuński martwy ciąg</span>
                      <span className="font-mono font-bold tabular-nums">136.5 kg</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Wyciskanie żołnierskie</span>
                      <span className="font-mono font-bold tabular-nums">68.0 kg</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {screen === 'creatine' ? (
              <div className="space-y-3">
                <div className={`rounded-2xl border p-4 ${cardBg}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                          phoneDark ? 'bg-white text-black' : 'bg-black text-white'
                        }`}
                      >
                        <Flame className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold">Iron Routine • 09:00</div>
                        <div className={`text-[10px] ${mutedText}`}>
                          Interaktywne powiadomienie iOS
                        </div>
                      </div>
                    </div>
                    <span className={`font-mono text-[10px] ${mutedText}`}>TERAZ</span>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed">
                    Czas na poranną porcję kreatyny (5g). Odpowiedz prosto z ekranu blokady — bez
                    otwierania aplikacji.
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCreatineStatus('taken')}
                      className={`flex items-center justify-center gap-1.5 rounded-xl py-2 font-mono text-[11px] font-bold transition ${
                        creatineStatus === 'taken' ? primaryBtn : subCardBg
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Wziąłem (5g)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreatineStatus('snoozed')}
                      className={`rounded-xl py-2 font-mono text-[11px] font-medium transition ${
                        creatineStatus === 'snoozed' ? primaryBtn : subCardBg
                      }`}
                    >
                      Nie jeszcze
                    </button>
                  </div>
                </div>

                <div className={`rounded-2xl border p-3.5 ${cardBg}`}>
                  <div className={`font-mono text-[10px] uppercase ${mutedText}`}>
                    STATUS DZIENNY
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span>Poranna dawka (09:00)</span>
                    <span className="font-mono text-[11px] font-bold">
                      {creatineStatus === 'taken'
                        ? 'ZAPISANO ✓'
                        : creatineStatus === 'snoozed'
                          ? 'PRZYPOMNIJ 22:00'
                          : 'OCZEKUJE'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span>Pomiar wagi ciała</span>
                    <span className="font-mono text-[11px] font-bold tabular-nums">74.2 kg</span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
