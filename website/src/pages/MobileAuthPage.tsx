import React, { useEffect, useRef, useState } from 'react';
import {
  AuthenticateWithRedirectCallback,
  ClerkProvider,
  useClerk,
  useSignIn,
  useUser,
} from '@clerk/clerk-react';

const CLERK_PUBLISHABLE_KEY =
  (import.meta as any).env?.VITE_CLERK_PUBLISHABLE_KEY ||
  'pk_test_dGhhbmtmdWwtbGFicmFkb3ItNjU0LmNsZXJrLmFjY291bnRzLmRldiQ';

function MobileAuthContent() {
  const { isLoaded: userLoaded, isSignedIn, user } = useUser();
  const { isLoaded: signInLoaded, signIn } = useSignIn();
  const { signOut } = useClerk();

  const [statusText, setStatusText] = useState('Inicjalizacja autoryzacji Clerk...');
  const [completedDeepLink, setCompletedDeepLink] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const triggeredRef = useRef(false);
  const completedRef = useRef(false);

  const searchParams = new URLSearchParams(window.location.search);
  const urlAttemptId = searchParams.get('attemptId');
  const urlProvider = searchParams.get('provider') as 'google' | 'apple' | null;
  const forceSwitch = searchParams.get('switch') === '1';

  useEffect(() => {
    if (urlAttemptId) {
      sessionStorage.setItem('ir_oauth_attempt_id', urlAttemptId);
    }
    if (urlProvider) {
      sessionStorage.setItem('ir_oauth_provider', urlProvider);
    }
  }, [urlAttemptId, urlProvider]);

  const attemptId =
    urlAttemptId || sessionStorage.getItem('ir_oauth_attempt_id') || '';
  const provider: 'google' | 'apple' =
    (urlProvider ||
      (sessionStorage.getItem('ir_oauth_provider') as 'google' | 'apple')) ===
    'apple'
      ? 'apple'
      : 'google';

  const isCallback =
    window.location.pathname.includes('/sso-callback') ||
    window.location.search.includes('__clerk') ||
    window.location.hash.includes('__clerk');

  // Complete handoff when Clerk user is signed in
  useEffect(() => {
    if (!userLoaded || !isSignedIn || !user || completedRef.current) return;

    completedRef.current = true;
    const email =
      user.primaryEmailAddress?.emailAddress ||
      user.emailAddresses?.[0]?.emailAddress ||
      '';
    const displayName =
      user.fullName ||
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      email.split('@')[0] ||
      'Użytkownik';

    setStatusText(`Łączenie konta ${email || displayName} z bazą NoSQL Iron Routine...`);

    fetch('/api/cloud/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'complete_clerk_attempt',
        attemptId,
        provider,
        clerkUserId: user.id,
        email,
        displayName,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok) {
          const link =
            data.deepLink ||
            `ironroutine://auth?attemptId=${encodeURIComponent(attemptId)}`;
          setCompletedDeepLink(link);
          setStatusText('Autoryzacja zakończona! Przekierowanie do aplikacji Iron Routine...');
          setTimeout(() => {
            window.location.href = link;
          }, 300);
        } else {
          setErrorMsg(data?.error || 'Nie udało się zapisać sesji w chmurze.');
        }
      })
      .catch(() => {
        setErrorMsg('Błąd połączenia z serwerem autoryzacji Iron Routine.');
      });
  }, [userLoaded, isSignedIn, user, attemptId, provider]);

  const startGoogleOAuth = async () => {
    if (!signInLoaded || !signIn) return;
    setErrorMsg(null);
    setStatusText('Przekierowanie do logowania Google (Clerk OAuth)...');
    try {
      const origin = window.location.origin;
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: `${origin}/mobile-auth/sso-callback`,
        redirectUrlComplete: `${origin}/mobile-auth?attemptId=${encodeURIComponent(
          attemptId
        )}&provider=${encodeURIComponent(provider)}`,
      });
    } catch (err: any) {
      setErrorMsg(
        err?.errors?.[0]?.longMessage ||
          err?.message ||
          'Nie udało się rozpocząć logowania OAuth.'
      );
    }
  };

  // Auto-trigger OAuth redirect when landing on /mobile-auth
  useEffect(() => {
    if (
      !userLoaded ||
      !signInLoaded ||
      isSignedIn ||
      isCallback ||
      triggeredRef.current
    ) {
      return;
    }
    triggeredRef.current = true;
    if (forceSwitch) {
      signOut().finally(() => {
        startGoogleOAuth();
      });
    } else {
      startGoogleOAuth();
    }
  }, [userLoaded, signInLoaded, isSignedIn, isCallback, forceSwitch]);

  if (isCallback) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
        <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
        <p className="text-sm font-bold tracking-wide text-zinc-300">
          Finalizowanie autoryzacji Clerk OAuth...
        </p>
        <AuthenticateWithRedirectCallback
          signInForceRedirectUrl={`/mobile-auth?attemptId=${encodeURIComponent(
            attemptId
          )}&provider=${encodeURIComponent(provider)}`}
          signUpForceRedirectUrl={`/mobile-auth?attemptId=${encodeURIComponent(
            attemptId
          )}&provider=${encodeURIComponent(provider)}`}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
      <div className="w-full max-w-sm space-y-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/70">
          <span className="text-xl font-black tracking-tighter text-white">IR</span>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-400">
            IRON ROUTINE · CLERK CLOUD AUTH
          </p>
          <h1 className="text-2xl font-black tracking-tight text-white">
            {completedDeepLink
              ? 'Połączono konto!'
              : provider === 'apple'
              ? 'Logowanie Apple / iCloud'
              : 'Logowanie Google'}
          </h1>
          <p className="text-sm text-zinc-400">{statusText}</p>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            {errorMsg}
          </div>
        )}

        {completedDeepLink ? (
          <div className="space-y-3 pt-2">
            <a
              href={completedDeepLink}
              className="block w-full rounded-xl bg-white py-3.5 text-sm font-extrabold text-black transition hover:bg-zinc-200"
            >
              Wróć do aplikacji Iron Routine
            </a>
            <button
              onClick={() => {
                completedRef.current = false;
                setCompletedDeepLink(null);
                signOut().then(() => startGoogleOAuth());
              }}
              className="block w-full rounded-xl border border-zinc-800 py-3 text-xs font-bold text-zinc-400 hover:text-white"
            >
              Przełącz na inne konto
            </button>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <button
              onClick={startGoogleOAuth}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-extrabold text-black transition hover:bg-zinc-200"
            >
              Kontynuuj z Google (Clerk)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function MobileAuthPage() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <MobileAuthContent />
    </ClerkProvider>
  );
}
