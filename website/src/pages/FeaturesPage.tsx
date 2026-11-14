import { useState } from 'react';
import {
  Activity,
  ArrowRight,
  Bell,
  Check,
  GripVertical,
  Layers,
  ListChecks,
  ShieldCheck,
  Smartphone,
  Timer,
} from 'lucide-react';
import { RouteLink } from '../utils/router';
import { PhoneShowcase } from '../components/PhoneShowcase';
import { Reveal } from '../components/Reveal';

const INITIAL_SESSION_ITEMS = [
  { id: '1', name: 'Pec Deck (Maszyna)', sets: '2 serie', active: true },
  { id: '2', name: 'Incline Chest Press (Maszyna)', sets: '1 seria', active: true },
  { id: '3', name: 'Wide Grip Lat Pulldown', sets: '1 seria', active: true },
  { id: '4', name: 'Cable Lateral Raise', sets: '2 serie', active: false },
];

export function FeaturesPage() {
  const [sessionItems, setSessionItems] = useState(INITIAL_SESSION_ITEMS);

  const toggleItem = (id: string) => {
    setSessionItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, active: !item.active } : item))
    );
  };

  return (
    <div className="animate-page-enter">
      {/* HEADER WITH STUDIO PLATES VISUAL */}
      <section className="relative overflow-hidden border-b border-hairline bg-black py-16 sm:py-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 opacity-30 lg:block"
        >
          <img
            src="/images/telemetry-plates-dark.jpg"
            alt=""
            className="h-full w-full object-cover grayscale contrast-125"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-transparent" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">
              ARCHITEKTURA FUNKCJI V2.0
            </span>
            <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              Każdy moduł pod jedną rękę i ciężką serię.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
              Zaprojektowane bez zbędnych ekranów i rozpraszających kolorów. Pure AMOLED `#000000`,
              karty `#121214`, zsynchronizowana pauza Dynamic Island oraz naturalne zamykanie modali gestem w dół.
            </p>
          </div>
        </div>
      </section>

      {/* INTERACTIVE PHONE SIMULATOR */}
      <section className="border-b border-hairline bg-black py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <PhoneShowcase />
        </div>
      </section>

      {/* ARCHITECTURAL BENTO GRID (PURE MONOCHROME) */}
      <section className="bg-black py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
              {/* Tile 1 */}
              <article className="mobile-card flex flex-col justify-between rounded-[24px] p-6 md:col-span-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                      <Timer className="h-3.5 w-3.5 text-white" />
                      <span>Dynamic Island + Alarm w Tle</span>
                    </span>
                    <span className="rounded-lg border border-hairline bg-elevated px-2.5 py-1 font-mono text-[10px] font-semibold text-zinc-300">
                      Synchronizacja pauzy
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-xl font-bold text-white">
                    Przerwy z dźwiękiem rest_alarm.wav i potrójną wibracją
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    Zablokuj telefon po serii, a Live Activity będzie odliczać czas w tle. Gdy
                    wciśniesz pauzę, natychmiast zamrozisz Dynamic Island i anulujesz alarmy.
                  </p>
                </div>
                <div className="mt-6 rounded-2xl border border-hairline bg-black p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-zinc-300">ODPOCZYNEK PO SERII</span>
                    <span className="font-mono text-xl font-bold tabular-nums text-white">01:36</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-tertiary">
                    <div className="animate-rest-bar h-full w-full rounded-full bg-white" />
                  </div>
                </div>
              </article>

              {/* Tile 2: Session Checklist Interactive */}
              <article className="mobile-card flex flex-col justify-between rounded-[24px] p-6 md:col-span-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                      <ListChecks className="h-3.5 w-3.5 text-white" />
                      <span>Konfigurator Sesji Przed Startem</span>
                    </span>
                    <span className="font-mono text-[10px] text-zinc-500">Kliknij, by pominąć</span>
                  </div>
                  <h3 className="mt-4 font-display text-xl font-bold text-white">
                    Drag-and-drop i selektywne ćwiczenia na dziś
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    Zanim włączysz główny stoper, zmień kolejność ćwiczeń przeciąganiem, odhacz zajętą
                    maszynę lub dorzuć dodatkowe ćwiczenie z kanonicznej bazy.
                  </p>
                </div>
                <div className="mt-5 space-y-1.5">
                  {sessionItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      className="flex w-full items-center justify-between rounded-xl border border-hairline bg-black px-3.5 py-2.5 text-left transition-colors hover:border-zinc-500"
                    >
                      <div className="flex items-center gap-2.5">
                        <GripVertical className="h-3.5 w-3.5 text-zinc-600" />
                        <span
                          className={`text-xs font-medium ${
                            item.active ? 'text-white' : 'text-zinc-500 line-through'
                          }`}
                        >
                          {item.name}
                        </span>
                      </div>
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded border ${
                          item.active
                            ? 'border-white bg-white text-black'
                            : 'border-zinc-600 text-transparent'
                        }`}
                      >
                        <Check className="h-3 w-3" />
                      </span>
                    </button>
                  ))}
                </div>
              </article>

              {/* Tile 3 */}
              <article className="mobile-card rounded-[24px] p-6 md:col-span-2">
                <Layers className="h-5 w-5 text-white" />
                <h3 className="mt-4 font-display text-lg font-bold text-white">
                  Kanoniczna baza + własne ćwiczenia
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                  Jeden profil zasila wszystkie plany treningowe. Historia rekordów i wykresy Epleya
                  są współdzielone przez aliasy ID ćwiczeń.
                </p>
              </article>

              {/* Tile 4 */}
              <article className="mobile-card rounded-[24px] p-6 md:col-span-2">
                <Smartphone className="h-5 w-5 text-white" />
                <h3 className="mt-4 font-display text-lg font-bold text-white">
                  Naturalne gesty bottom-sheet
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                  Każde okno zamykasz płynnym przeciągnięciem w dół również przy przewijanych listach,
                  bez nakładania się treści na ekranach od 375 pt.
                </p>
              </article>

              {/* Tile 5 */}
              <article className="mobile-card rounded-[24px] p-6 md:col-span-2">
                <div className="flex items-center justify-between">
                  <ShieldCheck className="h-5 w-5 text-white" />
                  <Bell className="h-4 w-4 text-zinc-500" />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold text-white">
                  100% prywatności i backup JSON
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                  Zero serwerów. Eksportuj lub wgrywaj plany jednym kliknięciem przez „Importuj JSON”
                  oraz systemowe udostępnianie plików.
                </p>
              </article>
            </div>
          </Reveal>

          <Reveal delayMs={120}>
            <div className="mobile-card mt-10 flex flex-col items-start justify-between gap-6 rounded-[24px] p-6 sm:flex-row sm:items-center sm:p-8">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-hairline bg-black text-white">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-white">
                    Chcesz zobaczyć matematykę stojącą za progresem?
                  </h3>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Przejdź do podstrony Analityka 1RM, wykresów objętości mięśni i przelicznika g/kg.
                  </p>
                </div>
              </div>
              <RouteLink
                to="/analityka"
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-black transition-colors hover:bg-zinc-200"
              >
                <span>Otwórz Analitykę 1RM</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </RouteLink>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
