import { useState } from 'react';
import {
  Apple,
  Check,
  Copy,
  Download,
  Laptop,
  ShieldCheck,
  Smartphone,
  Terminal,
} from 'lucide-react';
import {
  ANDROID_STEPS,
  APK_DOWNLOAD_URL,
  GITHUB_REPO,
  IOS_COMMANDS,
  IOS_PREREQUISITES,
  PlatformTab,
  RELEASES_URL,
} from '../data/websiteContent';

interface InstallSectionProps {
  platform: PlatformTab;
  onSelectPlatform: (platform: PlatformTab) => void;
}

export function InstallSection({ platform, onSelectPlatform }: InstallSectionProps) {
  const [copiedAll, setCopiedAll] = useState(false);

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(IOS_COMMANDS.join('\n'));
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1800);
    } catch {
      // Clipboard might be blocked on insecure origins
    }
  };

  return (
    <section id="install" className="bg-black py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <div className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300">
              INSTALACJA NA TELEFONIE
            </div>
            <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Dwie sciezki: gotowe APK na Androida lub bezposredni build Xcode na iPhone.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Poniewaz Iron Routine korzysta z natywnego Apple HealthKit i WidgetKit (Live Activities),
              wersja na iOS wymaga kompilacji z komputera Mac oraz wlaczenia Trybu Dewelopera na iPhone.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Wybor systemu operacyjnego"
            className="inline-flex rounded-2xl border border-hairline bg-surface p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={platform === 'ios'}
              onClick={() => onSelectPlatform('ios')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                platform === 'ios'
                  ? 'bg-white text-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Apple className="h-3.5 w-3.5" aria-hidden="true" />
              <span>iPhone (iOS)</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={platform === 'android'}
              onClick={() => onSelectPlatform('android')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                platform === 'android'
                  ? 'bg-white text-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Android (.APK)</span>
            </button>
          </div>
        </div>

        <div className="mt-10 mobile-card rounded-[28px] p-6 sm:p-10">
          {platform === 'android' ? (
            <div className="space-y-8">
              <div className="flex flex-col items-start justify-between gap-6 border-b border-hairline pb-8 sm:flex-row sm:items-center">
                <div>
                  <h3 className="font-display text-xl font-bold text-white">
                    Sideload bezposredniego pliku APK z GitHub Releases
                  </h3>
                  <p className="mt-1.5 text-sm text-zinc-400">
                    Bez sklepu Google Play, bez konta i z pelna obsluga Health Connect oraz powiadomien.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <a
                    href={APK_DOWNLOAD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-xs font-bold text-black transition-all hover:bg-zinc-200 active:scale-[0.98]"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    <span>Pobierz IronRoutine.apk</span>
                  </a>
                  <a
                    href={RELEASES_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center rounded-xl border border-hairline bg-elevated px-4 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
                  >
                    Wszystkie wydania
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {ANDROID_STEPS.map((item) => (
                  <div
                    key={item.step}
                    className="rounded-2xl border border-hairline bg-black p-5"
                  >
                    <span className="font-mono text-xs font-bold text-amberforge">{item.step}</span>
                    <h4 className="mt-2 font-display text-base font-bold text-white">
                      {item.title}
                    </h4>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-400">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex flex-col items-start justify-between gap-4 border-b border-hairline pb-6 sm:flex-row sm:items-center">
                <div>
                  <div className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-amber-300">
                    <Laptop className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>WYMAGANY MAC + XCODE + TRYB DEWELOPERA</span>
                  </div>
                  <h3 className="mt-2 font-display text-xl font-bold text-white">
                    Jak odpalic aplikacje krok po kroku na swoim iPhone
                  </h3>
                  <p className="mt-1.5 text-sm text-zinc-400">
                    Aplikacja nie jest w App Store. Wgrywasz ja prosto z Maca przez kabel USB na darmowym koncie Apple ID.
                  </p>
                </div>
                <a
                  href={GITHUB_REPO}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 shrink-0 items-center rounded-xl border border-hairline bg-elevated px-4 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
                >
                  Zobacz kod na GitHubie
                </a>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {IOS_PREREQUISITES.map((req, idx) => (
                  <div
                    key={req.title}
                    className="rounded-2xl border border-hairline bg-black p-5"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-amberforge" aria-hidden="true" />
                      <span className="font-mono text-[11px] font-bold text-zinc-400">
                        WYMAGANIE 0{idx + 1}
                      </span>
                    </div>
                    <h4 className="mt-2.5 font-display text-sm font-bold text-white">
                      {req.title}
                    </h4>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-400">{req.detail}</p>
                  </div>
                ))}
              </div>

              <div className="overflow-hidden rounded-2xl border border-hairline bg-black">
                <div className="flex items-center justify-between border-b border-hairline bg-elevated px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                    <span className="ml-2 inline-flex items-center gap-1.5 font-mono text-[10px] text-zinc-400">
                      <Terminal className="h-3 w-3" aria-hidden="true" />
                      zsh : iron-routine
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyAll}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-2.5 py-1 font-mono text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
                  >
                    {copiedAll ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                        <span>Skopiowano</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" aria-hidden="true" />
                        <span>Kopiuj komendy</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-2.5 p-5 font-mono text-xs leading-relaxed text-zinc-200">
                  {IOS_COMMANDS.map((cmd, idx) => (
                    <div key={cmd} className="flex items-start gap-3">
                      <span className="select-none text-amberforge">0{idx + 1}$</span>
                      <code className="break-all text-zinc-200">{cmd}</code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
