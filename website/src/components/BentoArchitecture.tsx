import {
  Activity,
  Award,
  Bell,
  Flame,
  GripVertical,
  Heart,
  Layers,
  ListChecks,
  Timer,
  TrendingUp,
} from 'lucide-react';
import {
  PLAN_PREVIEW,
  SPLINE_SERIES,
  SUPPLEMENTS_PREVIEW,
} from '../data/websiteContent';
import { buildSplineGeometry } from '../utils/splinePath';

const CHART_POINTS = SPLINE_SERIES['30d'];
const BENTO_GEOMETRY = buildSplineGeometry(CHART_POINTS, 280, 96, {
  top: 10,
  right: 12,
  bottom: 12,
  left: 12,
});

export function BentoArchitecture() {
  return (
    <section id="bento" className="border-b border-hairline bg-black py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300">
            <Flame className="h-3.5 w-3.5 animate-flame" aria-hidden="true" />
            <span>ARCHITEKTURA APLIKACJI MOBILNEJ</span>
          </div>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Kazdy kafelek projektu pod prawdziwa serie na silowni.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
            Identyczna typografia, karty #121214 i zero rozpraszaczy jak bezposrednio
            na Twoim telefonie. Stworzone z mysla o pracy miedzy seriami i poza aplikacja.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-6">
          {/* Kafelek 1: Live Activities & Alarm w tle */}
          <article className="mobile-card flex flex-col justify-between rounded-[24px] p-6 md:col-span-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                  <Timer className="h-3.5 w-3.5 text-amberforge" aria-hidden="true" />
                  <span>Przerwy & Alarm w Tle</span>
                </span>
                <span className="rounded-lg border border-hairline bg-elevated px-2.5 py-1 font-mono text-[10px] font-semibold text-zinc-300">
                  Live Activity + Dzwiek
                </span>
              </div>
              <h3 className="mt-4 font-display text-xl font-bold text-white">
                Odliczanie na Dynamic Island i alarm poza aplikacja
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Gdy zablokujesz ekran po serii, stoper idzie dalej na ekranie blokady.
                Po zakonczeniu przerwy iOS odpala powiadomienie z dzwiekiem alarmu i wibracja
                tylko wtedy, gdy faktycznie nie patrzysz w aplikacje.
              </p>
            </div>

            <div className="mt-6 rounded-2xl border border-hairline bg-black p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amberforge" />
                  <div>
                    <div className="text-xs font-bold text-white">PRZERWA PO SERII 2</div>
                    <div className="font-mono text-[10px] text-zinc-400">
                      Nastepnie: Wyciskanie 102.5 kg
                    </div>
                  </div>
                </div>
                <span className="font-mono text-2xl font-bold tabular-nums text-white">
                  01:48
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-tertiary">
                <div className="animate-rest-bar h-full w-full rounded-full bg-amberforge" />
              </div>
            </div>
          </article>

          {/* Kafelek 2: Jeden profil, wiele planow, wspolne PR */}
          <article className="mobile-card flex flex-col justify-between rounded-[24px] p-6 md:col-span-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                  <Layers className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                  <span>Jeden Profil • Wiele Planow</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg border border-hairline bg-elevated px-2.5 py-1 font-mono text-[10px] font-semibold text-zinc-300">
                  <Award className="h-3 w-3 text-amberforge" aria-hidden="true" />
                  <span>Wspolne PR</span>
                </span>
              </div>
              <h3 className="mt-4 font-display text-xl font-bold text-white">
                Zmieniaj plany bez utraty historii i rekordow 1RM
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Jedna baza cwiczen zasila wszystkie Twoje plany. Mozesz przejsc z PPL
                na FBEOD lub dodac dzien biegowy, a kazde powtorzenie i rekord 1RM dalej buduja ten sam wykres.
              </p>
            </div>

            <div className="mt-5 space-y-2">
              {PLAN_PREVIEW.map((plan) => (
                <div
                  key={plan.name}
                  className={`flex items-center justify-between rounded-2xl border px-3.5 py-2.5 text-xs ${
                    plan.active
                      ? 'border-white bg-elevated text-white'
                      : 'border-hairline bg-black/70 text-zinc-400'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-white">{plan.name}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-zinc-500">{plan.tag}</div>
                  </div>
                  <span
                    className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold ${
                      plan.active ? 'bg-white text-black' : 'border border-hairline text-zinc-500'
                    }`}
                  >
                    {plan.active ? 'AKTYWNY' : 'GOTOWY'}
                  </span>
                </div>
              ))}
            </div>
          </article>

          {/* Kafelek 3: Progres Epley & czyste filtry */}
          <article className="mobile-card flex flex-col justify-between rounded-[24px] p-6 md:col-span-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                  <TrendingUp className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                  <span>Progres 1RM</span>
                </span>
                <span className="font-mono text-xs font-bold text-emerald-400">+15 kg</span>
              </div>
              <h3 className="mt-3 font-display text-lg font-bold text-white">
                Wykresy 7d / 30d / All
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                Plynna krzywa Epley 1RM z czytelnymi filtrami dopasowanymi do waskich ekranow iPhone.
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-hairline bg-black p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[10px] text-zinc-500">EST. MAX</span>
                <div className="flex gap-1 rounded-lg border border-hairline bg-surface p-0.5 font-mono text-[9px]">
                  <span className="px-1.5 py-0.5 text-zinc-500">7d</span>
                  <span className="rounded-md bg-white px-1.5 py-0.5 font-bold text-black">30d</span>
                  <span className="px-1.5 py-0.5 text-zinc-500">All</span>
                </div>
              </div>
              <svg viewBox="0 0 280 96" className="h-24 w-full overflow-visible">
                <defs>
                  <linearGradient id="bentoSplineFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={BENTO_GEOMETRY.areaPath} fill="url(#bentoSplineFill)" />
                <path
                  d={BENTO_GEOMETRY.linePath}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                {BENTO_GEOMETRY.points.map((pt, i) => (
                  <circle
                    key={pt.label}
                    cx={pt.x}
                    cy={pt.y}
                    r={i === BENTO_GEOMETRY.points.length - 1 ? 3.8 : 2.2}
                    fill={i === BENTO_GEOMETRY.points.length - 1 ? '#F59E0B' : '#FFFFFF'}
                  />
                ))}
              </svg>
            </div>
          </article>

          {/* Kafelek 4: Konfiguracja sesji drag & drop + dodatki z bazy */}
          <article className="mobile-card flex flex-col justify-between rounded-[24px] p-6 md:col-span-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                  <ListChecks className="h-3.5 w-3.5 text-amberforge" aria-hidden="true" />
                  <span>Konfigurator Sesji</span>
                </span>
              </div>
              <h3 className="mt-3 font-display text-lg font-bold text-white">
                Odznacz, przeciagnij i dorzuc z bazy
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                Przed startem zmien kolejnosc gestem przeciagania, pomin zajeta maszyne albo dopnij cwiczenie z bazy.
              </p>
            </div>

            <div className="mt-4 space-y-1.5">
              {[
                { name: 'Wyciskanie Sztangi', active: true },
                { name: 'Rozpietki Maszyna', active: true },
                { name: 'Wyciskanie Skos (Dodane)', active: false },
              ].map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between rounded-xl border border-hairline bg-black px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-3.5 w-3.5 text-zinc-600" aria-hidden="true" />
                    <span className={`text-[11px] font-medium ${item.active ? 'text-white' : 'text-zinc-500'}`}>
                      {item.name}
                    </span>
                  </div>
                  <span
                    className={`h-3.5 w-3.5 rounded border ${
                      item.active ? 'border-white bg-white' : 'border-zinc-600 bg-transparent'
                    }`}
                  />
                </div>
              ))}
            </div>
          </article>

          {/* Kafelek 5: Apple Health & elastyczna suplementacja */}
          <article className="mobile-card flex flex-col justify-between rounded-[24px] p-6 md:col-span-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                  <Heart className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                  <span>Zdrowie & Suple</span>
                </span>
                <Bell className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
              </div>
              <h3 className="mt-3 font-display text-lg font-bold text-white">
                Sen, kroki i dawki g/kg
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                Odczyt z Apple Health / Health Connect oraz wlasna lista suplementow obliczana pod wage ciala.
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px]">
                <span className="flex items-center gap-1.5 font-semibold text-emerald-300">
                  <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                  8 420 krokow • 7h 45m snu
                </span>
              </div>
              {SUPPLEMENTS_PREVIEW.slice(0, 2).map((supp) => (
                <div
                  key={supp.name}
                  className="flex items-center justify-between rounded-xl border border-hairline bg-black px-3 py-2 text-[11px]"
                >
                  <span className="font-medium text-white">{supp.name}</span>
                  <span className="font-mono text-[10px] text-amber-300">{supp.dose}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
