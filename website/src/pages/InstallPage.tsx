import { useState } from 'react';
import {
  Apple,
  Check,
  CheckSquare,
  Copy,
  Download,
  GitBranch,
  Laptop,
  ShieldCheck,
  Smartphone,
  Square,
  Terminal,
} from 'lucide-react';
import {
  ANDROID_STEPS,
  APK_DOWNLOAD_URL,
  GITHUB_REPO,
  IOS_CHECKLIST,
  IOS_COMMANDS,
  PlatformTab,
  RELEASES_URL,
} from '../data/websiteContent';
import { useRouter } from '../utils/router';
import { Reveal } from '../components/Reveal';

export function InstallPage() {
  const { platformHint } = useRouter();
  const [platform, setPlatform] = useState<PlatformTab>(platformHint);
  const [copiedAll, setCopiedAll] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState<string[]>(['mac']);

  const toggleChecklist = (id: string) => {
    setCheckedSteps((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(IOS_COMMANDS.join('\n'));
      setCopiedAll(true);
      window.setTimeout(() => setCopiedAll(false), 1800);
    } catch {
      // Clipboard blocked on non-HTTPS origins
    }
  };

  return (
    <div className="animate-page-enter">
      <section className="border-b border-hairline bg-black py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
            <div className="max-w-2xl">
              <div className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">
                WDROŻENIE NA TELEFON
              </div>
              <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                Jak zainstalować Iron Routine na iPhone lub Androidzie.
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
                Na Androidzie pobierasz gotowy plik `.apk`. Na iPhonie ze względu na natywne Live
                Activities (Dynamic Island) i HealthKit aplikację kompilujesz przez Xcode z Maca z włączonym Trybem Dewelopera.
              </p>
            </div>

            <div
              role="tablist"
              aria-label="Wybór systemu operacyjnego"
              className="inline-flex rounded-2xl border border-hairline bg-surface p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={platform === 'ios'}
                onClick={() => setPlatform('ios')}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  platform === 'ios' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Apple className="h-3.5 w-3.5" aria-hidden="true" />
                <span>iPhone (iOS)</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={platform === 'android'}
                onClick={() => setPlatform('android')}
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
        </div>
      </section>

      <section className="bg-black py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="mobile-card rounded-[28px] p-6 sm:p-10">
              {platform === 'android' ? (
                <div className="space-y-8">
                  <div className="flex flex-col items-start justify-between gap-6 border-b border-hairline pb-8 sm:flex-row sm:items-center">
                    <div>
                      <h2 className="font-display text-2xl font-bold text-white">
                        Sideload gotowego pliku .APK z GitHub Releases
                      </h2>
                      <p className="mt-1.5 text-sm text-zinc-400">
                        Bez sklepu Google Play, bez konta Google i z pełną obsługą Health Connect oraz alarmów.
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
                      <div key={item.step} className="rounded-2xl border border-hairline bg-black p-5">
                        <span className="font-mono text-xs font-bold text-zinc-400">KROK {item.step}</span>
                        <h3 className="mt-2 font-display text-base font-bold text-white">
                          {item.title}
                        </h3>
                        <p className="mt-2 text-xs leading-relaxed text-zinc-400">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="flex flex-col items-start justify-between gap-4 border-b border-hairline pb-6 sm:flex-row sm:items-center">
                    <div>
                      <div className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-300">
                        <Laptop className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                        <span>WYMAGANY MAC + XCODE + TRYB DEWELOPERA NA IPHONE</span>
                      </div>
                      <h2 className="mt-2 font-display text-2xl font-bold text-white">
                        Interaktywna checklista wgrania na iOS (Personal Team)
                      </h2>
                      <p className="mt-1.5 text-sm text-zinc-400">
                        Aplikacja nie jest w App Store. Odznaczaj kroki niżej podczas pierwszego podpinania iPhone’a po USB.
                      </p>
                    </div>
                    <a
                      href={GITHUB_REPO}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-hairline bg-elevated px-4 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
                    >
                      <GitBranch className="h-3.5 w-3.5" />
                      <span>Kod na GitHubie</span>
                    </a>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {IOS_CHECKLIST.map((item) => {
                      const done = checkedSteps.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleChecklist(item.id)}
                          className={`flex items-start gap-3.5 rounded-2xl border p-5 text-left transition-all ${
                            done
                              ? 'border-white/70 bg-elevated'
                              : 'border-hairline bg-black hover:border-zinc-600'
                          }`}
                        >
                          <div className="mt-0.5 shrink-0 text-white">
                            {done ? (
                              <CheckSquare className="h-4 w-4" />
                            ) : (
                              <Square className="h-4 w-4 text-zinc-600" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="h-3.5 w-3.5 text-zinc-400" />
                              <h3 className="font-display text-sm font-bold text-white">
                                {item.title}
                              </h3>
                            </div>
                            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                              {item.detail}
                            </p>
                          </div>
                        </button>
                      );
                    })}
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
                            <Check className="h-3 w-3 text-white" aria-hidden="true" />
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
                          <span className="select-none text-zinc-500">0{idx + 1}$</span>
                          <code className="break-all text-zinc-200">{cmd}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
