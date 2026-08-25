import { SourceNotice } from "@/components/source-notice";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Taktus Kontor</h1>
        <p className="text-[var(--color-muted)] mt-2">
          Tickets, Zeiterfassung und KI-Unterstützung in einer Anwendung.
        </p>
      </div>

      <p className="text-[var(--color-muted)] text-sm">
        Diese Instanz befindet sich im Aufbau. Das Datenmodell und die
        Zugriffsregeln stehen; die Oberfläche folgt.
      </p>

      <SourceNotice />
    </main>
  );
}
