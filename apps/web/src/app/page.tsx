import { VoiceDemo } from "../components/voice-demo";

export default function HomePage() {
  return (
    <main className="app-main app-main--home">
      <div className="shell shell--narrow">
        <VoiceDemo />
      </div>
    </main>
  );
}
