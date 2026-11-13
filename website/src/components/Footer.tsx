import { APP_VERSION, GITHUB_REPO, RELEASES_URL } from '../data/websiteContent';

export function Footer() {
  return (
    <footer className="bg-[#050506] py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 sm:flex-row sm:items-center sm:px-6">
        <div>
          <div className="font-display text-sm font-bold text-white">Iron Routine</div>
          <div className="mt-1 font-mono text-[11px] text-zinc-500">
            Expo SDK 58 • React Native 0.88 • TypeScript • {APP_VERSION}
          </div>
        </div>

        <div className="flex flex-wrap gap-5 font-mono text-xs text-zinc-400">
          <a href={GITHUB_REPO} target="_blank" rel="noreferrer" className="transition hover:text-white">
            Repozytorium
          </a>
          <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="transition hover:text-white">
            Wydania
          </a>
          <a
            href={`${GITHUB_REPO}/issues`}
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-white"
          >
            Issues
          </a>
          <a
            href={`${GITHUB_REPO}/discussions`}
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-white"
          >
            Discussions
          </a>
        </div>
      </div>
    </footer>
  );
}
