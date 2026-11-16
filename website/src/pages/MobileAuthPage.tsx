import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AuthenticateWithRedirectCallback,
  ClerkProvider,
  useClerk,
  useUser,
} from '@clerk/react';
import { useSignIn, useSignUp } from '@clerk/react/legacy';

const CLERK_PUBLISHABLE_KEY =
  (import.meta as any).env?.VITE_CLERK_PUBLISHABLE_KEY ||
  (import.meta as any).env?.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  'pk_test_dGhhbmtmdWwtbGFicmFkb3ItNjU0LmNsZXJrLmFjY291bnRzLmRldiQ';

function MobileAuthContent() {
  const { isLoaded: userLoaded, isSignedIn, user } = useUser();
  const { isLoaded: signInLoaded, signIn, setActive } = useSignIn();
  const { isLoaded: signUpLoaded, signUp } = useSignUp();
  const { signOut } = useClerk();

  const [statusText, setStatusText] = useState('Inicjalizacja autoryzacji Clerk Core 3...');
  const [completedDeepLink, setCompletedDeepLink] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const triggeredRef = useRef(false);
  const completedRef = useRef(false);

  const searchParams = new URLSearchParams(window.location.search);
  const urlAttemptId = searchParams.get('attemptId');
  const urlProvider = searchParams.get('provider') as 'google' | 'apple' | null;
  const urlDeviceId = searchParams.get('deviceId');
  const urlName = searchParams.get('name');
  const isContinueSignUp = searchParams.get('continue') === '1';

  useEffect(() => {
    if (urlAttemptId) sessionStorage.setItem('ir_oauth_attempt_id', urlAttemptId);
    if (urlProvider) sessionStorage.setItem('ir_oauth_provider', urlProvider);
    if (urlDeviceId) sessionStorage.setItem('ir_oauth_device_id', urlDeviceId);
    if (urlName) sessionStorage.setItem('ir_oauth_name', urlName);
  }, [urlAttemptId, urlProvider, urlDeviceId, urlName]);

  const attemptId =
    urlAttemptId || sessionStorage.getItem('ir_oauth_attempt_id') || '';
  const provider: 'google' | 'apple' =
    (urlProvider ||
      (sessionStorage.getItem('ir_oauth_provider') as 'google' | 'apple')) ===
    'apple'
      ? 'apple'
      : 'google';
  const deviceId =
    urlDeviceId || sessionStorage.getItem('ir_oauth_device_id') || 'icloud_default';
  const initialName =
    urlName || sessionStorage.getItem('ir_oauth_name') || '';

  // IMPORTANT: Only /sso-callback is the OAuth redirect callback!
  const isCallback = window.location.pathname.includes('/sso-callback');

  const completeHandoff = useCallback(
    async (params: {
      clerkUserId?: string;
      email: string;
      displayName: string;
      avatarUrl?: string | null;
      overrideProvider?: 'google' | 'apple';
    }) => {
      if (completedRef.current) return;
      completedRef.current = true;
      setErrorMsg(null);
      setStatusText('Zapisywanie sesji Clerk i łączenie z bazą PostgreSQL...');

      try {
        const res = await fetch('/api/cloud/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'complete_clerk_attempt',
            attemptId,
            provider: params.overrideProvider || provider,
            clerkUserId: params.clerkUserId || '',
            email: params.email,
            displayName: params.displayName,
            avatarUrl: params.avatarUrl || null,
          }),
        });
        const data = await res.json();
        if (data?.ok) {
          const link =
            data.deepLink ||
            `ironroutine://auth?attemptId=${encodeURIComponent(attemptId)}`;
          setCompletedDeepLink(link);
          setStatusText('Połączono pomyślnie! Powrót do aplikacji Iron Routine...');
          setTimeout(() => {
            window.location.href = link;
          }, 220);
        } else {
          completedRef.current = false;
          setErrorMsg(data?.error || 'Nie udało się zapisać sesji w chmurze.');
        }
      } catch {
        completedRef.current = false;
        setErrorMsg('Błąd połączenia z serwerem autoryzacji Iron Routine.');
      }
    },
    [attemptId, provider]
  );

  // 1. Complete handoff when Clerk user is signed in (for Google OAuth or Apple OAuth)
  useEffect(() => {
    if (!userLoaded || !isSignedIn || !user || completedRef.current || isCallback) {
      return;
    }

    const email =
      user.primaryEmailAddress?.emailAddress ||
      user.emailAddresses?.[0]?.emailAddress ||
      '';

    // If user requested Google, ensure we don't reuse a cached Apple ticket session
    if (provider === 'google' && email.endsWith('@icloud.ironroutine.app')) {
      return;
    }

    const displayName =
      user.fullName ||
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      initialName ||
      email.split('@')[0] ||
      'Użytkownik';

    completeHandoff({
      clerkUserId: user.id,
      email,
      displayName,
      avatarUrl: (user as any)?.hasImage ? user.imageUrl : user.imageUrl || null,
    });
  }, [userLoaded, isSignedIn, user, isCallback, provider, initialName, completeHandoff]);

  // 2. Auto-complete new Google OAuth sign-ups when Clerk instance requires a password field
  useEffect(() => {
    if (
      !signUpLoaded ||
      !signUp ||
      isSignedIn ||
      completedRef.current ||
      isCallback
    ) {
      return;
    }

    if (signUp.status === 'missing_requirements') {
      const fullName =
        [signUp.firstName, signUp.lastName].filter(Boolean).join(' ') ||
        initialName ||
        (signUp.emailAddress ? signUp.emailAddress.split('@')[0] : 'Użytkownik Google');

      const finishNewGoogleUser = async () => {
        try {
          setStatusText('Tworzenie konta Google w Clerk Core 3...');
          const generatedPassword = `IrClerk!${Math.random()
            .toString(36)
            .slice(2, 10)}_${Date.now().toString(36)}#A9`;
          const updated = await signUp.update({
            password: generatedPassword,
          });
          if (updated.status === 'complete' && updated.createdSessionId && setActive) {
            await setActive({ session: updated.createdSessionId });
            return;
          }
        } catch {}

        if (signUp.emailAddress) {
          await completeHandoff({
            clerkUserId: signUp.createdUserId || '',
            email: signUp.emailAddress,
            displayName: fullName,
            overrideProvider: 'google',
          });
        }
      };

      finishNewGoogleUser();
    }
  }, [signUpLoaded, signUp, isSignedIn, isCallback, initialName, setActive, completeHandoff]);

  const startGoogleOAuth = useCallback(async () => {
    if (!signInLoaded || !signIn) return;
    setErrorMsg(null);
    setIsBusy(true);
    setStatusText('Przekierowanie do logowania Google / Gmail (Clerk OAuth)...');
    try {
      const currentEmail =
        user?.primaryEmailAddress?.emailAddress ||
        user?.emailAddresses?.[0]?.emailAddress ||
        '';
      if (isSignedIn && currentEmail.endsWith('@icloud.ironroutine.app')) {
        await signOut();
      }

      const origin = window.location.origin;
      const completeTarget = `${origin}/mobile-auth?attemptId=${encodeURIComponent(
        attemptId
      )}&provider=google`;
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: `${origin}/mobile-auth/sso-callback`,
        redirectUrlComplete: completeTarget,
      });
    } catch (err: any) {
      setIsBusy(false);
      setErrorMsg(
        err?.errors?.[0]?.longMessage ||
          err?.message ||
          'Nie udało się rozpocząć logowania Google OAuth.'
      );
    }
  }, [signInLoaded, signIn, user, isSignedIn, signOut, attemptId]);

  const startAppleCloudAuth = useCallback(async () => {
    if (!signInLoaded || !signIn) return;
    setErrorMsg(null);
    setIsBusy(true);
    setStatusText('Autoryzacja Apple iCloud przez Clerk Core 3...');

    try {
      // Check if native oauth_apple is enabled in Clerk Dashboard
      const clerkEnv = (window as any).Clerk?.__unstable__environment;
      const appleOAuthEnabled = Boolean(
        clerkEnv?.userSettings?.social?.oauth_apple?.enabled
      );

      if (appleOAuthEnabled) {
        const origin = window.location.origin;
        const completeTarget = `${origin}/mobile-auth?attemptId=${encodeURIComponent(
          attemptId
        )}&provider=apple`;
        await signIn.authenticateWithRedirect({
          strategy: 'oauth_apple',
          redirectUrl: `${origin}/mobile-auth/sso-callback`,
          redirectUrlComplete: completeTarget,
        });
        return;
      }

      // Otherwise authenticate via Clerk Sign-In Token (ticket strategy)
      const res = await fetch('/api/cloud/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mint_clerk_ticket',
          provider: 'apple',
          deviceIdentityId: deviceId,
          displayName: initialName || 'Apple iCloud',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setErrorMsg(data?.error || 'Nie udało się utworzyć sesji Apple iCloud w Clerk.');
        setIsBusy(false);
        return;
      }

      if (data.ticket && setActive) {
        try {
          if (isSignedIn) {
            await signOut();
          }
          const signInAttempt = await signIn.create({
            strategy: 'ticket',
            ticket: data.ticket,
          });
          if (signInAttempt.status === 'complete' && signInAttempt.createdSessionId) {
            await setActive({ session: signInAttempt.createdSessionId });
          }
        } catch {}
      }

      await completeHandoff({
        clerkUserId: data.clerkUserId || '',
        email: data.email,
        displayName: data.displayName || initialName || 'Apple iCloud',
        overrideProvider: 'apple',
      });
    } catch {
      setIsBusy(false);
      setErrorMsg('Błąd połączenia podczas autoryzacji Apple iCloud w Clerk.');
    }
  }, [
    signInLoaded,
    signIn,
    attemptId,
    deviceId,
    initialName,
    isSignedIn,
    signOut,
    setActive,
    completeHandoff,
  ]);

  // Auto-trigger OAuth / Clerk Ticket on initial page load
  useEffect(() => {
    if (
      !userLoaded ||
      !signInLoaded ||
      isCallback ||
      isContinueSignUp ||
      triggeredRef.current
    ) {
      return;
    }
    triggeredRef.current = true;
    if (provider === 'apple') {
      startAppleCloudAuth();
    } else if (!isSignedIn) {
      startGoogleOAuth();
    }
  }, [
    userLoaded,
    signInLoaded,
    isSignedIn,
    isCallback,
    isContinueSignUp,
    provider,
    startAppleCloudAuth,
    startGoogleOAuth,
  ]);

  if (isCallback) {
    const completeTarget = `/mobile-auth?attemptId=${encodeURIComponent(
      attemptId
    )}&provider=${encodeURIComponent(provider)}`;
    const continueTarget = `/mobile-auth?attemptId=${encodeURIComponent(
      attemptId
    )}&provider=${encodeURIComponent(provider)}&continue=1`;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
        <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
        <p className="text-sm font-bold tracking-wide text-zinc-300">
          Finalizowanie autoryzacji Clerk Core 3...
        </p>
        <AuthenticateWithRedirectCallback
          signInForceRedirectUrl={completeTarget}
          signUpForceRedirectUrl={completeTarget}
          continueSignUpUrl={continueTarget}
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
              ? 'Logowanie Apple iCloud'
              : 'Logowanie Google / Gmail'}
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
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {provider === 'apple' ? (
              <button
                onClick={startAppleCloudAuth}
                disabled={isBusy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-extrabold text-black transition hover:bg-zinc-200 disabled:opacity-60"
              >
                Kontynuuj z iCloud (Clerk)
              </button>
            ) : (
              <button
                onClick={startGoogleOAuth}
                disabled={isBusy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-extrabold text-black transition hover:bg-zinc-200 disabled:opacity-60"
              >
                Kontynuuj z Gmail / Google (Clerk)
              </button>
            )}
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
