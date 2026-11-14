import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { FeaturesPage } from './pages/FeaturesPage';
import { HomePage } from './pages/HomePage';
import { InstallPage } from './pages/InstallPage';
import { RouterProvider, useRouter } from './utils/router';

function AppShell() {
  const { route } = useRouter();

  return (
    <div className="flex min-h-screen flex-col bg-black text-zinc-100">
      <Navbar />
      <main className="flex-1">
        {route === '/' && <HomePage />}
        {route === '/funkcje' && <FeaturesPage />}
        {route === '/analityka' && <AnalyticsPage />}
        {route === '/instalacja' && <InstallPage />}
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <AppShell />
    </RouterProvider>
  );
}
