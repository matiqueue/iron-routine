import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { FeaturesPage } from './pages/FeaturesPage';
import { HomePage } from './pages/HomePage';
import { InstallPage } from './pages/InstallPage';
import { InvitePage } from './pages/InvitePage';
import { MobileAuthPage } from './pages/MobileAuthPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { SupportPage } from './pages/SupportPage';
import { TermsPage } from './pages/TermsPage';
import { RouterProvider, useRouter } from './utils/router';

function AppShell() {
  const { route } = useRouter();

  if (
    typeof window !== 'undefined' &&
    window.location.pathname.startsWith('/mobile-auth')
  ) {
    return <MobileAuthPage />;
  }

  if (
    typeof window !== 'undefined' &&
    (window.location.pathname.startsWith('/invite') ||
      window.location.pathname.startsWith('/u/'))
  ) {
    return <InvitePage />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-black text-zinc-100">
      <Navbar />
      <main className="flex-1">
        {route === '/' && <HomePage />}
        {route === '/funkcje' && <FeaturesPage />}
        {route === '/analityka' && <AnalyticsPage />}
        {route === '/instalacja' && <InstallPage />}
        {route === '/privacy' && <PrivacyPage />}
        {route === '/terms' && <TermsPage />}
        {route === '/support' && <SupportPage />}
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
