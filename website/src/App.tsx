import { useState } from 'react';
import { BentoArchitecture } from './components/BentoArchitecture';
import { EpleyLabSection } from './components/EpleyLabSection';
import { Footer } from './components/Footer';
import { HeroSection } from './components/HeroSection';
import { InstallSection } from './components/InstallSection';
import { Navbar } from './components/Navbar';
import type { PlatformTab } from './data/websiteContent';

export default function App() {
  const [platform, setPlatform] = useState<PlatformTab>('android');

  return (
    <div className="min-h-screen bg-[#050506] text-zinc-100">
      <Navbar />
      <main>
        <HeroSection onSelectPlatform={setPlatform} />
        <BentoArchitecture />
        <EpleyLabSection />
        <InstallSection platform={platform} onSelectPlatform={setPlatform} />
      </main>
      <Footer />
    </div>
  );
}
