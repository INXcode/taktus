import { HATCHING } from "@/components/ai/hatching";
import { formatDateTime } from "@/lib/format/datetime";

/**
 * Die gespeicherte Zusammenfassung am Ticket -- Zustand 1 und Zustand 3.
 *
 * > [!important] Der Eintrag in `ai_marked_fields` heisst nicht „von der KI",
 * > sondern „von der KI **und noch ungeprüft**".
 * > Deshalb verschwindet die Schraffur nach dem Prüfen restlos: Das Feld
 * > sieht dann aus wie jedes andere gespeicherte Feld. Was bleibt, ist die
 * > Herkunftszeile -- sie gehört zum Vorgang, nicht zur Kennzeichnung, und
 * > ohne sie liesse sich später nicht mehr sagen, worauf der Text beruhte.
 *
 * Eine **Server**-Komponente. Der geprüfte Normalfall -- Zustand 3 -- liefert
 * damit kein JavaScript aus; das ist der häufigste Zustand und der, der am
 * wenigsten kostet.
 *
 * Zustand 2 („im Prüfen") ist kein eigener Kasten hier: Er ist das
 * Bearbeitungsformular, und mit dessen Speichern gilt der Abschnitt als
 * geprüft.
 */
export function AiSummaryBlock({
  summary,
  model,
  generatedAt,
  unreviewed,
  reviewedBy,
}: {
  readonly summary: string;
  readonly model: string | null;
  readonly generatedAt: string | null;
  /** Steht `ai_summary` in `ai_marked_fields`? */
  readonly unreviewed: boolean;
  /**
   * Wer geprüft hat.
   *
   * > [!note] In der Anwendung steht hier nichts -- bewusst.
   * > Der Entwurf zeigt „Geprüft von Kim M."; die Angabe wird nicht
   * > geliefert, und dafür gibt es zwei Gründe. Erstens hat `tickets` keine
   * > Spalte dafür: Sie anzulegen hiesse, ein weiteres personenbezogenes Feld
   * > einzuführen, das über den bereits vorhandenen Nachweis hinaus nichts
   * > belegt. Zweitens steht der Name längst im Protokoll -- als
   * > `ticket.update` mit `ai_marked_fields` -- und `audit_log` darf nur die
   * > Verwaltung lesen. Hier nachzuschlagen liesse den Namen für
   * > Administratoren erscheinen und für Bearbeiter fehlen; eine Beschriftung,
   * > die je nach Rolle etwas anderes behauptet, ist schlechter als eine, die
   * > durchgehend weniger sagt.
   *
   * Der Musterkatalog setzt die Eigenschaft, um die Form des Entwurfs zu
   * zeigen.
   */
  readonly reviewedBy?: string;
}) {
  const provenance =
    model === null && generatedAt === null
      ? null
      : [model, generatedAt === null ? null : formatDateTime(generatedAt)]
          .filter((part) => part !== null)
          .join(" · ");

  if (unreviewed) {
    return (
      <section
        style={HATCHING}
        className="rounded-md border border-ai-border border-l-[3px] border-l-ai p-3.5"
      >
        <div className="mb-2.5 flex items-center gap-[7px]">
          <span aria-hidden="true" className="block size-[7px] bg-ai" />
          <h2 className="font-mono text-[10.5px] font-semibold tracking-[0.06em] text-ai-text uppercase">
            Von der KI, ungeprüft
          </h2>
        </div>

        <p className="rounded-[6px] border border-ai-line bg-card p-2.5 text-[13.5px] leading-[1.5] text-body">
          {summary}
        </p>

        {provenance === null ? null : (
          <p className="mt-2.5 font-mono text-[10.5px] text-ai-text">
            {provenance}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-md border border-border bg-card p-3.5">
      <div className="mb-2.5 flex items-center gap-[7px]">
        <span aria-hidden="true" className="text-xs font-bold text-success">
          ✓
        </span>
        <h2 className="font-mono text-[10.5px] font-semibold tracking-[0.06em] text-success-text uppercase">
          {reviewedBy === undefined ? "Geprüft" : `Geprüft von ${reviewedBy}`}
        </h2>
      </div>

      <p className="text-[13.5px] leading-[1.5] text-body">{summary}</p>

      {/*
        Die Herkunftszeile bleibt auch nach dem Prüfen stehen. Ein geprüfter
        Text ist kein selbst geschriebener -- wer das später beurteilen muss,
        braucht die Angabe, und die Rechenschaftspflicht aus Art. 5 Abs. 2
        DSGVO verlangt sie ohnehin.
      */}
      {provenance === null ? null : (
        <p className="mt-2.5 font-mono text-[10.5px] text-muted">
          KI-Entwurf · {provenance}
        </p>
      )}
    </section>
  );
}
