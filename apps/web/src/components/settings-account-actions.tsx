"use client";

import { useAuth } from "./auth-provider";

export function SettingsAccountActions() {
  const { signOut } = useAuth();

  return (
    <div className="settings-actions">
      <button type="button" className="settings-actions__button" onClick={() => void signOut()}>
        Sair da conta
      </button>
    </div>
  );
}
