import { useEffect, useRef, useState } from 'react';
import {
  Apple,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  Smartphone,
  Terminal,
} from 'lucide-react';
import {
  ANDROID_STEPS,
  APK_DOWNLOAD_URL,
  IOS_COMMANDS,
  RELEASES_URL,
  type PlatformTab,
} from '../data/websiteContent';

interface InstallSectionProps {
  platform: PlatformTab;
  onSelectPlatform: (platform: PlatformTab) => void;
}

export function InstallSection({ platform, onSelectPlatform }: InstallSectionProps) {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => setCopiedCmd(null), 1800);
  };

  return (
    <section id="install" className="border-b border-white/[0.06] py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="font-mono text-[11px] tracking-[0.18em] text-zinc-500 uppercase">
              03 // INSTALACJA NA TELEFONIE
            </div>
            <h2 className="mt-2.5 font-display text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">
              Gotowy w mniej niż minutę
            </h2>
          </div>

          <div className="inline-flex self-start rounded-full border border-white/10 bg-[#0B0B0E] p-1">
            <button
              type="button"
              onClick={() => onSelectPlatform('android')}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2 font-mono text-xs font-bold transition ${
                platform === 'android' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>ANDROID (.APK)</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectPlatform('ios')}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2 font-mono text-xs font-bold transition ${
                platform === 'ios' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Apple className="h-3.5 w-3.5" />
              <span>IPHONE (IOS)</span>
            </button>
          </div>
        </div>

        {platform === 'android' ? (
          <div className="grid gap-8 rounded-3xl border border-white/[0.08] bg-[#0B0B0E] p-6 shadow-glass-card sm:p-10 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[10px] tracking-wider text-zinc-300 uppercase">
                AUTOMATYCZNY BUILD Z GITHUB ACTIONS
              </div>
              <h3 className="mt-4 font-display text-2xl font-bold tracking-tight text-white">
                Pobierz i zainstaluj IronRoutine.apk
              </h3>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {ANDROID_STEPS.map((item) => (
                  <div
                    key={item.step}
                    className="rounded-2xl border border-white/[0.06] bg-[#121216] p-4"
                  >
                    <div className="font-mono text-xs font-bold text-zinc-500">{item.step}</div>
                    <div className="mt-2 text-sm font-semibold text-white">{item.title}</div>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-400">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#050506] p-6 lg:col-span-5">
              <div className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">
                NAJNOWSZE WYDANIE PRODUKCYJNE
              </div>
              <div className="font-display text-lg font-bold text-white">IronRoutine.apk</div>
              <p className="text-xs text-zinc-400">
                Podpisana paczka Release wygenerowana automatycznie z otwartego kodu źródłowego.
              </p>
              <a
                href={APK_DOWNLOAD_URL}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 font-mono text-xs font-bold text-black transition hover:bg-zinc-200"
              >
                <Download className="h-4 w-4 stroke-[2.25]" />
                <span>POBIERZ IRONROUTINE.APK</span>
              </a>
              <a
                href={RELEASES_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/10 px-6 py-3 font-mono text-xs text-zinc-300 transition hover:border-white/25 hover:text-white"
              >
                <span>Historia wydań i sumy</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-white/[0.08] bg-[#0B0B0E] p-6 shadow-glass-card sm:p-10">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <div className="font-mono text-[10px] tracking-[0.16em] text-zinc-500 uppercase">
                  IPHONE / XCODE SIDELOADING (BEZ PŁATNEGO KONTA DEVELOPER)
                </div>
                <h3 className="mt-2 font-display text-2xl font-bold tracking-tight text-white">
                  Skompiluj własny build Release przez kabel USB
                </h3>
                <p className="mt-1.5 text-sm text-zinc-400">
                  Wymaga komputera Mac z Xcode oraz iPhone z włączonym Trybem Dewelopera.
                </p>
              </div>

              <button
                type="button"
                onClick={() => copyCommand(IOS_COMMANDS.join(' && '))}
                className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 font-mono text-xs text-white transition hover:border-white/30 hover:bg-white/[0.08]"
              >
                {copiedCmd === IOS_COMMANDS.join(' && ') ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Skopiowano całość</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Kopiuj wszystko</span>
                  </>
                )}
              </button>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#050506]">
              <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <span className="ml-2 font-mono text-[10px] text-zinc-500">zsh — iron-routine</span>
              </div>

              <div className="divide-y divide-white/[0.06]">
                {IOS_COMMANDS.map((cmd) => (
                  <div
                    key={cmd}
                    className="flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-3 overflow-x-auto font-mono text-xs text-zinc-200">
                      <Terminal className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                      <code>{cmd}</code>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyCommand(cmd)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 font-mono text-[11px] text-zinc-400 transition hover:border-white/25 hover:text-white"
                    >
                      {copiedCmd === cmd ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span>Skopiowano</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Kopiuj</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
