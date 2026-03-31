"use client";

import type { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";
import { useAuth } from "./auth-provider";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12.24 10.285v3.821h5.445c-.24 1.229-.96 2.27-2.04 2.965l3.3 2.56c1.92-1.77 3.024-4.37 3.024-7.445 0-.705-.063-1.38-.18-2.04z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.965-.894 6.62-2.43l-3.3-2.56c-.915.615-2.085.99-3.32.99-2.55 0-4.71-1.725-5.48-4.05H3.11v2.625A9.995 9.995 0 0 0 12 22"
      />
      <path
        fill="#4A90E2"
        d="M6.52 13.95A5.996 5.996 0 0 1 6.2 12c0-.675.115-1.335.32-1.95V7.425H3.11A9.994 9.994 0 0 0 2 12c0 1.61.385 3.135 1.11 4.575z"
      />
      <path
        fill="#FBBC05"
        d="M12 6c1.47 0 2.79.505 3.825 1.5l2.865-2.865C16.965 3.03 14.7 2 12 2A9.995 9.995 0 0 0 3.11 7.425L6.52 10.05C7.29 7.725 9.45 6 12 6"
      />
    </svg>
  );
}

function AuthSplash() {
  return (
    <main className="app-main app-main--home auth-shell-loading">
      <div className="shell shell--narrow">
        <section className="auth-panel auth-panel--loading">
          <div className="auth-mark" aria-hidden="true" />
          <p className="eyebrow">Acessando</p>
          <h1>Preparando sua área financeira</h1>
        </section>
      </div>
    </main>
  );
}

function LoginScreen() {
  const { signInWithGoogle, authError, signingIn } = useAuth();

  return (
    <main className="app-main app-main--home auth-shell">
      <div className="shell shell--narrow">
        <section className="auth-panel">
          <div className="auth-mark" aria-hidden="true" />
          <p className="eyebrow">Acesso protegido</p>
          <h1>Entre para abrir sua planilha por voz</h1>
          <p className="auth-copy">
            Seus lançamentos, fixos e lembretes ficam disponíveis só depois do login.
          </p>
          <button
            type="button"
            className="auth-google-button"
            onClick={() => void signInWithGoogle()}
            disabled={signingIn}
          >
            <span className="auth-google-button__icon">
              <GoogleIcon />
            </span>
            <span>{signingIn ? "Abrindo Google..." : "Continuar com Google"}</span>
          </button>
          {authError ? <p className="auth-error">{authError}</p> : null}
        </section>
      </div>
    </main>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { loading, session } = useAuth();

  if (loading) {
    return <AuthSplash />;
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <div className="app-shell">
      {children}
      <BottomNav />
    </div>
  );
}
