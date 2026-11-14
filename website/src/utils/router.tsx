import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppRoute, NAV_ITEMS, PlatformTab } from '../data/websiteContent';

interface RouterContextValue {
  route: AppRoute;
  platformHint: PlatformTab;
  navigate: (to: AppRoute, options?: { platform?: PlatformTab }) => void;
}

const VALID_ROUTES = new Set<AppRoute>(['/', '/funkcje', '/analityka', '/instalacja']);

function normalizePathname(pathname: string): AppRoute {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (VALID_ROUTES.has(clean as AppRoute)) {
    return clean as AppRoute;
  }
  return '/';
}

const RouterContext = createContext<RouterContextValue>({
  route: '/',
  platformHint: 'android',
  navigate: () => {},
});

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [route, setRoute] = useState<AppRoute>(() =>
    typeof window !== 'undefined' ? normalizePathname(window.location.pathname) : '/'
  );
  const [platformHint, setPlatformHint] = useState<PlatformTab>('android');

  useEffect(() => {
    const onPopState = () => {
      setRoute(normalizePathname(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const matched = NAV_ITEMS.find((item) => item.path === route);
    if (matched) {
      document.title = matched.pageTitle;
    }
  }, [route]);

  const navigate = useCallback((to: AppRoute, options?: { platform?: PlatformTab }) => {
    if (options?.platform) {
      setPlatformHint(options.platform);
    }
    const target = normalizePathname(to);
    if (window.location.pathname !== target) {
      window.history.pushState({}, '', target);
    }
    setRoute(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <RouterContext.Provider value={{ route, platformHint, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  return useContext(RouterContext);
}

interface RouteLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: AppRoute;
  platform?: PlatformTab;
}

export function RouteLink({ to, platform, onClick, children, ...rest }: RouteLinkProps) {
  const { navigate } = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    onClick?.(e);
    navigate(to, platform ? { platform } : undefined);
  };

  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
