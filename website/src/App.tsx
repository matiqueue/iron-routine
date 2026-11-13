import React, { useState } from 'react';
import {
  Activity,
  Apple,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  Dumbbell,
  Flame,
  GitBranch,
  Lock,
  Smartphone,
  Terminal,
  Timer,
  TrendingUp,
  Zap,
} from 'lucide-react';

const GITHUB_REPO = 'https://github.com/matiqueue/iron-routine';
const APK_DOWNLOAD_URL =
  'https://github.com/matiqueue/iron-routine/releases/latest/download/IronRoutine.apk';
const RELEASES_URL = 'https://github.com/matiqueue/iron-routine/releases';

type PlatformTab = 'android' | 'ios';

const FEATURES = [
  {
    code: '01',
    icon: Timer,
    title: 'Dynamic Island & Live Activity',
    desc: 'Bieżąca seria, ćwiczenie i odliczanie przerwy widoczne na ekranie blokady iPhone bez odblokowywania telefonu.',
  },
  {
    code: '02',
    icon: TrendingUp,
    title: 'Kalkulator 1RM Epleya & SVG',
    desc: 'Automatyczne wyliczanie rekordu maksymalnego, wykresy trendów 7d / 30d / 90d oraz historia pomiarów masy ciała.',
  },
  {
    code: '03',
    icon: Flame,
    title: 'Przypomnienia o Kreatynie',
    desc: 'Interaktywne powiadomienia o 09:00 i 22:00 z przyciskami akcji bezpośrednio z ekranu blokady.',
  },
  {
    code: '04',
    icon: Lock,
    title: '100% Offline & Zero Kont',
    desc: 'Wszystkie serie, rekordy i profile zapisywane lokalnie na urządzeniu. Zero reklam, subskrypcji i śledzenia.',
  },
  {
    code: '05',
    icon: Zap,
    title: 'Hold-to-Start & Haptics',
    desc: 'Przycisk przytrzymania zapobiega przypadkowemu startowi treningu, a wibracje sygnalizują koniec przerwy.',
  },
  {
    code: '06',
    icon: Activity,
    title: 'Wiele Profili Użytkowników',
    desc: 'Przełączaj profile z całkowicie niezależną historią rekordów PR, wagi i postępów treningowych.',
  },
];

export default function App() {
  const [platform, setPlatform] = useState<PlatformTab>('android');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 1800);
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 grid-blueprint">
      {/* Top Industrial Bar */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-[#09090B]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center bg-[#CCFF00] text-black">
              <Dumbbell className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="font-mono text-xs font-bold tracking-[0.2em] text-zinc-100 uppercase">
                IRON ROUTINE
              </div>
              <div className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">
                OFFLINE STRENGTH OS // v1.0.1
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-2 sm:gap-3">
            <a
              href="#install"
              className="hidden border border-zinc-800 px-3 py-1.5 font-mono text-xs text-zinc-300 transition hover:border-zinc-600 hover:text-white sm:inline-flex"
            >
              INSTALACJA
            </a>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 border border-zinc-800 px-3 py-1.5 font-mono text-xs text-zinc-300 transition hover:border-[#CCFF00] hover:text-[#CCFF00]"
            >
              <GitBranch className="h-3.5 w-3.5" />
              GITHUB
            </a>
            <a
              href={APK_DOWNLOAD_URL}
              className="inline-flex items-center gap-1.5 bg-[#CCFF00] px-3.5 py-1.5 font-mono text-xs font-bold text-black transition hover:bg-[#d9ff33]"
            >
              <Download className="h-3.5 w-3.5" />
              APK
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Hero Section - Brutalist Split */}
        <section className="grid gap-10 border-b border-zinc-800 py-14 lg:grid-cols-12 lg:items-center lg:py-20">
          <div className="lg:col-span-7">
            <div className="mb-5 inline-flex items-center gap-2 border border-zinc-800 bg-zinc-950 px-3 py-1 font-mono text-[11px] tracking-widest text-[#CCFF00] uppercase">
              <span className="h-2 w-2 bg-[#CCFF00]" />
              EXPO SDK 58 • 100% OFFLINE • OPEN SOURCE
            </div>

            <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl lg:leading-[1.02]">
              TRENING SIŁOWY.
              <br />
              <span className="text-[#CCFF00]">ZERO ROZPRASZACZY.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
              Monochromatyczny dziennik treningowy na iOS i Androida. Zaprojektowany do pracy na
              siłowni bez internetu, z pływającym timerem przerwy, Live Activities na iPhonie oraz
              automatycznym licznikiem 1RM.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={APK_DOWNLOAD_URL}
                className="inline-flex items-center gap-2.5 bg-[#CCFF00] px-6 py-3.5 font-mono text-sm font-bold text-black transition hover:bg-[#d9ff33]"
              >
                <Download className="h-4 w-4 stroke-[2.5]" />
                POBIERZ ANDROID (.APK)
              </a>
              <a
                href="#install"
                onClick={() => setPlatform('ios')}
                className="inline-flex items-center gap-2.5 border border-zinc-700 bg-zinc-950 px-6 py-3.5 font-mono text-sm font-bold text-white transition hover:border-white"
              >
                <Apple className="h-4 w-4" />
                INSTRUKCJA NA IPHONE
              </a>
            </div>

            <div className="mt-8 grid grid-cols-3 border border-zinc-800 bg-zinc-950/70">
              <div className="border-r border-zinc-800 p-3.5">
                <div className="font-mono text-[10px] tracking-widest text-zinc-500">CHMURA</div>
                <div className="mt-1 font-mono text-sm font-bold text-white">0 SERWERÓW</div>
              </div>
              <div className="border-r border-zinc-800 p-3.5">
                <div className="font-mono text-[10px] tracking-widest text-zinc-500">ALGORYTM</div>
                <div className="mt-1 font-mono text-sm font-bold text-white">1RM EPLEY</div>
              </div>
              <div className="p-3.5">
                <div className="font-mono text-[10px] tracking-widest text-zinc-500">KOSZT</div>
                <div className="mt-1 font-mono text-sm font-bold text-[#CCFF00]">100% FREE</div>
              </div>
            </div>
          </div>

          {/* Right Live Telemetry Mockup */}
          <div className="lg:col-span-5">
            <div className="border border-zinc-800 bg-[#0D0D10] p-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <span className="font-mono text-[11px] tracking-widest text-zinc-400">
                  LIVE ACTIVITY // DYNAMIC ISLAND
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#CCFF00]">
                  <span className="h-1.5 w-1.5 animate-pulse bg-[#CCFF00]" />
                  PRZERWA
                </span>
              </div>

              <div className="mt-5">
                <div className="font-mono text-xs text-zinc-500">FBW A • SERIA 3 / 4</div>
                <div className="mt-1 text-xl font-black tracking-tight text-white">
                  Wyciskanie sztangi na ławce
                </div>
                <div className="mt-4 flex items-baseline justify-between border border-zinc-800 bg-black p-4">
                  <div>
                    <div className="font-mono text-[10px] tracking-widest text-zinc-500">
                      ODLICZANIE
                    </div>
                    <div className="font-mono text-4xl font-black text-[#CCFF00]">01:42</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[10px] tracking-widest text-zinc-500">
                      EST. 1RM
                    </div>
                    <div className="font-mono text-2xl font-bold text-white">108.5 KG</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 h-2 w-full bg-zinc-900">
                <div className="h-2 w-3/4 bg-[#CCFF00]" />
              </div>
              <div className="mt-2 flex justify-between font-mono text-[10px] text-zinc-500">
                <span>POSTĘP TRENINGU: 75%</span>
                <span>NASTĘPNE: WIOSŁOWANIE</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="border-b border-zinc-800 py-14">
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="font-mono text-xs tracking-widest text-[#CCFF00] uppercase">
                ARCHITEKTURA FUNKCJI
              </div>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Zbudowane pod prawdziwy trening na siłowni
              </h2>
            </div>
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs text-zinc-400 hover:text-white"
            >
              WSZYSTKIE WYDANIA <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="grid gap-px bg-zinc-800 sm:grid-cols-2 lg:grid-cols-3 border border-zinc-800">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.code} className="bg-[#09090B] p-6 transition hover:bg-[#0F0F13]">
                  <div className="flex items-center justify-between">
                    <Icon className="h-5 w-5 text-[#CCFF00]" />
                    <span className="font-mono text-xs text-zinc-600">{f.code}</span>
                  </div>
                  <h3 className="mt-4 text-base font-bold text-white">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Installation Guide */}
        <section id="install" className="border-b border-zinc-800 py-14">
          <div className="mb-8">
            <div className="font-mono text-xs tracking-widest text-[#CCFF00] uppercase">
              INSTALACJA NA TELEFONIE
            </div>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Wybierz swoją platformę
            </h2>
          </div>

          <div className="mb-6 inline-flex border border-zinc-800 bg-zinc-950 p-1">
            <button
              type="button"
              onClick={() => setPlatform('android')}
              className={`inline-flex items-center gap-2 px-5 py-2.5 font-mono text-xs font-bold transition ${
                platform === 'android'
                  ? 'bg-[#CCFF00] text-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Smartphone className="h-4 w-4" />
              ANDROID (.APK)
            </button>
            <button
              type="button"
              onClick={() => setPlatform('ios')}
              className={`inline-flex items-center gap-2 px-5 py-2.5 font-mono text-xs font-bold transition ${
                platform === 'ios' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Apple className="h-4 w-4" />
              IPHONE (IOS)
            </button>
          </div>

          {platform === 'android' ? (
            <div className="grid gap-6 border border-zinc-800 bg-zinc-950/80 p-6 lg:grid-cols-12 lg:items-center">
              <div className="space-y-4 lg:col-span-7">
                <div className="font-mono text-xs text-[#CCFF00]">
                  AUTOMATYCZNY BUILD Z GITHUB ACTIONS
                </div>
                <h3 className="text-xl font-bold text-white">
                  Pobierz i zainstaluj IronRoutine.apk w 30 sekund
                </h3>
                <ol className="space-y-2.5 text-sm text-zinc-300">
                  <li>
                    <span className="font-mono font-bold text-[#CCFF00]">01.</span> Pobierz
                    najnowszy plik instalacyjny przyciskiem obok.
                  </li>
                  <li>
                    <span className="font-mono font-bold text-[#CCFF00]">02.</span> Otwórz plik w
                    folderze <b>Pobrane</b> i zezwól przeglądarce na instalację aplikacji.
                  </li>
                  <li>
                    <span className="font-mono font-bold text-[#CCFF00]">03.</span> Uruchom{' '}
                    <b>Iron Routine</b> — aplikacja działa w pełni offline bez konta.
                  </li>
                </ol>
              </div>
              <div className="flex flex-col gap-3 lg:col-span-5">
                <a
                  href={APK_DOWNLOAD_URL}
                  className="inline-flex items-center justify-center gap-2 bg-[#CCFF00] px-6 py-4 font-mono text-sm font-bold text-black transition hover:bg-[#d9ff33]"
                >
                  <Download className="h-4 w-4 stroke-[2.5]" />
                  POBIERZ IRONROUTINE.APK
                </a>
                <a
                  href={RELEASES_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 border border-zinc-700 px-6 py-3 font-mono text-xs text-zinc-300 hover:border-zinc-500 hover:text-white"
                >
                  ZOBACZ HISTORIĘ WYDAŃ
                </a>
              </div>
            </div>
          ) : (
            <div className="border border-zinc-800 bg-zinc-950/80 p-6">
              <div className="font-mono text-xs text-[#CCFF00]">
                IPHONE / XCODE SIDELOADING (BEZ PŁATNEGO KONTA DEVELOPER)
              </div>
              <h3 className="mt-2 text-xl font-bold text-white">
                Zbuduj samodzielną wersję Release przez kabel USB
              </h3>
              <p className="mt-2 text-sm text-zinc-400">
                Wymaga komputera Mac z zainstalowanym Xcode oraz podłączonego iPhone z włączonym
                Trybem Dewelopera.
              </p>

              <div className="mt-5 space-y-3">
                {[
                  'git clone https://github.com/matiqueue/iron-routine.git && cd iron-routine',
                  'npm install',
                  'npm run deploy',
                ].map((cmd) => (
                  <div
                    key={cmd}
                    className="flex items-center justify-between gap-3 border border-zinc-800 bg-black px-4 py-3"
                  >
                    <div className="flex items-center gap-2.5 overflow-x-auto font-mono text-xs text-zinc-200">
                      <Terminal className="h-3.5 w-3.5 shrink-0 text-[#CCFF00]" />
                      <code>{cmd}</code>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyCommand(cmd)}
                      className="inline-flex shrink-0 items-center gap-1 border border-zinc-800 px-2.5 py-1 font-mono text-[11px] text-zinc-400 hover:border-zinc-600 hover:text-white"
                    >
                      {copiedCmd === cmd ? (
                        <>
                          <Check className="h-3 w-3 text-[#CCFF00]" /> SKOPIOWANO
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" /> KOPIUJ
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-8 font-mono text-xs text-zinc-500 sm:flex-row sm:items-center sm:px-6">
        <div>IRON ROUTINE // OPEN SOURCE WORKOUT TRACKER</div>
        <div className="flex flex-wrap gap-4">
          <a href={GITHUB_REPO} target="_blank" rel="noreferrer" className="hover:text-white">
            REPOZYTORIUM
          </a>
          <a
            href={`${GITHUB_REPO}/issues`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-white"
          >
            ISSUES
          </a>
          <a
            href={`${GITHUB_REPO}/discussions`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-white"
          >
            DISCUSSIONS
          </a>
        </div>
      </footer>
    </div>
  );
}
