# KI-Anbieter: Abwägung

> **Stand: Entscheidung offen.** Dieses Dokument hält den Zwischenstand fest,
> nicht ein Ergebnis. Es wird fortgeschrieben, bis ein Anbieter feststeht.
>
> Anforderung: [architektur.md](architektur.md). KI-spezifische Risiken:
> [security.md](security.md), Kapitel G. Umsetzung im Schema:
> [datenmodell.md](datenmodell.md).

## Warum diese Abwägung überhaupt geführt wird

Für Datenbank und Anwendung ist die Souveränitätsfrage entschieden: self-hosted
auf EU-inkorporierter Infrastruktur, weil die Wahl einer EU-Region bei einem
US-Anbieter die Datenresidenz löst, nicht die Datensouveränität.

Beim Sprachmodell lässt sich dieselbe Strenge möglicherweise nicht durchhalten.
Wo eine vollständig souveräne Lösung nicht praktikabel ist, gilt für dieses
Projekt die Ersatzanforderung: **Die Verarbeitung ist dokumentiert, minimiert
und für Betreiber austauschbar.**

Genau das ist der Zweck dieses Dokuments. Wer die Datenschutzarchitektur prüft,
wird die KI-Anbindung als schwächste Stelle vermuten — zu Recht. Sie unbenannt
zu lassen, wäre der Fehler; eine offen dokumentierte Abwägung ist glaubwürdiger
als eine verschwiegene.

## Was die KI in Release 1 tut

Stufe 1: **Zusammenfassung und Kategorisierung beim
Anlegen eines Tickets.** Nichts weiter.

Übermittelt werden `title` und `description` eines einzelnen Tickets, begrenzt
auf `ai_config.max_input_chars` (Vorgabe 8000 Zeichen). Zurück kommen ein
Vorschlagstext und ein Kategoriewert.

Nicht übermittelt werden: Nutzernamen, E-Mail-Adressen, Zeitbuchungen,
Kommentare, Daten anderer Tickets. Die Beschreibung eines Tickets ist Freitext
und **kann** personenbezogene Angaben enthalten — das ist der Grund, warum diese
Abwägung nötig ist.

## Option A: lokales Modell — geprüft, für diesen Zweck nicht tragfähig

Der Schema-Entwurf sieht `ai_provider = 'openai_compatible'` ausdrücklich vor,
damit ein Betreiber ein selbst betriebenes Modell hinterlegen kann. Dann
verlässt kein Ticketinhalt die eigene Infrastruktur, und die Abwägung entfiele.

**Praktisch erprobt wurde das** auf einem gewöhnlichen Arbeitsplatzrechner —
Apple Silicon, 16 GB gemeinsamer Speicher — über eine
OpenAI-kompatible Schnittstelle. Ergebnis:

- **Die Anbindung funktioniert.** Der `openai_compatible`-Pfad ist damit belegt,
  nicht bloß behauptet — für die Entwicklung bleibt das der nützliche Teil.
- **Die Ergebnisqualität reicht nicht.** Für die Kategorisierung und
  Zusammenfassung realer Ticketinhalte lieferten die auf dieser Hardware
  betreibbaren Modelle keine brauchbaren Ergebnisse. Der begrenzende Faktor ist
  der Arbeitsspeicher: Was neben einer laufenden Entwicklungsumgebung in 16 GB
  passt, ist für diese Aufgabe zu klein.

**Was das heißt — und was nicht.** Widerlegt ist nicht der lokale Betrieb an
sich, sondern der lokale Betrieb _auf einem Arbeitsplatzrechner dieser Klasse_.
Ein Betreiber mit einem angemessen ausgestatteten Server kann diesen Weg gehen;
das Schema hält ihn offen. Für Release 1 scheidet er nach heutigem Stand aus.

> [!note] Warum dieser Negativbefund im Repository steht
> Ein gescheiterter Versuch ist ein Ergebnis. Ohne diesen Eintrag bliebe offen,
> ob der lokale Betrieb geprüft und verworfen oder nie ernsthaft erwogen wurde.
> Für einen Betreiber, der dieselbe Frage stellt, ist der Negativbefund die
> nützlichere Auskunft.

## Option B: externer Anbieter — der wahrscheinliche Weg

Damit trägt nicht mehr die Infrastruktur die Datenschutzlast, sondern die
Ausgestaltung. Zu klären ist je Anbieter:

| Frage                         | Warum sie zählt                                                                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sitz und Konzernzugehörigkeit | CLOUD-Act-Exposition. Dieselbe Prüfung wie bei Supabase Cloud — sie fällt hier nur möglicherweise anders aus, weil es keine gleichwertige Alternative gibt |
| Auftragsverarbeitungsvertrag  | Ohne AVV keine zulässige Verarbeitung. Muss vor dem Produktivbetrieb vorliegen                                                                             |
| Verarbeitungsort              | Verfügbare Regionen, und ob sie vertraglich zugesichert sind                                                                                               |
| Training mit Eingaben         | Muss vertraglich ausgeschlossen sein                                                                                                                       |
| Aufbewahrung beim Anbieter    | Speicherdauer der Anfragen, Löschzusagen                                                                                                                   |
| Unterauftragnehmer            | Gehört ins Unterauftragsverzeichnis des Betreibers                                                                                                         |

**Noch keine Anbieterentscheidung getroffen.** Sie gehört vor den
Produktivbetrieb, nicht vor die Veröffentlichung des Quelltextes — die
Anwendung ist ohne konfigurierte KI voll funktionsfähig.

## Was unabhängig vom Anbieter bereits im Schema steht

Diese Vorkehrungen wirken auch dann, wenn die Anbieterwahl ungünstig ausfällt.
Sie sind der Teil, der nicht von einem Vertrag abhängt.

| Vorkehrung              | Umsetzung                                                                                                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Austauschbarkeit**    | Anbieter, Modell und Adresse stehen in `ai_config`, nicht im Code. Ein Betreiber wechselt ohne neuen Build                                                                                   |
| **Opt-in je Mandant**   | `tenants.ai_enabled`, Vorgabe `false`. Eine Übermittlung an einen Dritten entsteht nicht durch Untätigkeit                                                                                   |
| **Doppelter Schalter**  | Betreiber (`ai_config.enabled`) und Mandant (`tenants.ai_enabled`) müssen beide zustimmen                                                                                                    |
| **Mengenbegrenzung**    | `ai_config.max_input_chars` begrenzt, wie viel Text überhaupt das Haus verlässt — Datenminimierung und Kostenbremse zugleich                                                                 |
| **Schlüsseltrennung**   | `ai_config` hat RLS aktiv und keine Policy. Auch ein Mandanten-Administrator kommt an den Zugangsschlüssel des Betreibers nicht heran (geprüft in `160_ai_config_rls.test.sql`)              |
| **Herkunftsnachweis**   | `tickets.ai_model` und `ai_generated_at` halten fest, worauf ein Vorschlag beruhte — Rechenschaftspflicht, Art. 5 Abs. 2 DSGVO. Erzwungen durch den CHECK `tickets_ai_herkunft_vollstaendig` |
| **Kennzeichnung**       | `tickets.ai_marked_fields` markiert Modellausgaben in der Oberfläche. Speichern durch einen Menschen entfernt die Markierung = geprüft                                                       |
| **Signierte Herkunft**  | Der Vorschlag wird beim Ausliefern unterschrieben und beim Anlegen geprüft. Ohne gültigen Nachweis wird er abgewiesen, nicht ungekennzeichnet gespeichert (`lib/ai/provenance.ts`)           |
| **Kein Auto-Commit**    | Modellausgaben sind Vorschläge. Nichts wird ohne menschliche Bestätigung übernommen                                                                                                          |
| **Schema als Rückhalt** | Die Kategorie ist ein Aufzählungstyp. Was das Modell auch antwortet — die Datenbank nimmt nur einen von fünf Werten an                                                                       |

Das Schema als Rückhalt ist zugleich die wirksamste Maßnahme gegen **Prompt
Injection** (security.md, Kapitel G): Ein Ticketinhalt, der versucht, das Modell
zu steuern, kann bestenfalls einen gültigen Kategoriewert erzwingen. Ein Schaden
entsteht daraus nicht. Die Prüfung gegen dieses Schema läuft seit derselben
Änderung **zweimal** — einmal in der Provider-Datei, einmal zentral in
`suggestTicketFields`. Der zweite Lauf ist der verbindliche: Sonst hinge die
Zusicherung daran, dass jede künftige Datei unter `providers/` daran denkt.

> [!note] Warum der Vorschlag unterschrieben wird
> Zwischen dem Vorschlag und dem Anlegen des Tickets liegt der Rechner des
> Nutzers: Das Formular schickt die Zusammenfassung in einem versteckten Feld
> zurück. Ohne Nachweis wäre „von der KI, ungeprüft" damit eine **Behauptung
> des Absenders** — selbst getippter Text ließe sich so kennzeichnen, und die
> beiden Herkunftsspalten blieben leer, obwohl das Datenmodell sie für die
> Rechenschaftspflicht führt.
>
> Der Nachweis bindet Text, Kategorie, Modell, Zeitpunkt und Nutzerkennung
> aneinander und läuft nach 30 Minuten ab. Modell und Zeitpunkt werden aus der
> Unterschrift übernommen, nicht aus dem Formular. Die Ableitung des
> Schlüssels, die vier Bindungen und ihre jeweilige Begründung stehen in
> `src/lib/ai/provenance.ts`; die Bindungen sind einzeln getestet.

## Offen

- [ ] Anbieter auswählen und die Tabelle unter Option B ausfüllen
- [ ] AVV abschließen, vor dem Produktivbetrieb
- [ ] Anbieter ins Unterauftragsverzeichnis und ins Verarbeitungsverzeichnis
- [ ] Prüfen, ob sich der Freitext vor der Übermittlung weiter minimieren lässt
      (Pseudonymisierung erkennbarer Namen)
- [ ] Testfälle mit Angriffsmustern für die Prompt-Injection-Abwehr
- [ ] Delimitierung des Nutzerfreitextes im Prompt festlegen

## Was diese Abwägung nicht leistet

[security.md](security.md), Kapitel 3 gilt auch hier: Kein Werkzeug bewertet, ob
ein Anbieter CLOUD-Act-Exposition mitbringt, und keines beurteilt die
Angemessenheit der Maßnahmen nach Art. 32 DSGVO. Beides bleibt eine fachliche
Bewertung durch einen Menschen — und ist der Grund, warum dieses Dokument
existiert.
