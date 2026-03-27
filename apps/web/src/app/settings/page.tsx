import { Navigation } from "../../components/navigation";
import { SettingsAccountActions } from "../../components/settings-account-actions";

export default function SettingsPage() {
  return (
    <main>
      <div className="shell">
        <section className="card">
          <p className="eyebrow">Placeholder</p>
          <h1>Configuracoes</h1>
          <p>Area futura para preferencia de voz, notificacoes e conta.</p>
          <SettingsAccountActions />
          <Navigation />
        </section>
      </div>
    </main>
  );
}
