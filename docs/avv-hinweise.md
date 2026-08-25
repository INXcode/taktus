# Hinweise zur Auftragsverarbeitung

> Für Betreiber einer Taktus-Kontor-Instanz. Verarbeitungstätigkeiten:
> [verarbeitungsverzeichnis.md](verarbeitungsverzeichnis.md) · Maßnahmen:
> [tom.md](tom.md) · Löschung: [loeschkonzept.md](loeschkonzept.md)

## Was dieses Dokument ist

**Kein Vertragsmuster.** Ein Auftragsverarbeitungsvertrag nach Art. 28 DSGVO ist
zwischen zwei konkreten Parteien zu schließen, und die Vorlage dafür stellt
regelmäßig die Rechtsabteilung oder der Anbieter. Ein weiteres Muster in einem
Software-Repository hülfe niemandem.

**Sondern:** die Angaben, die ein Betreiber für seinen eigenen AVV braucht und
die sich aus der Software ergeben — welche Rollen entstehen, welche
Unterauftragsverhältnisse die Architektur erzeugt, was die Anwendung für
Betroffenenrechte bereitstellt, und wo sie nichts leisten kann.

**Keine Rechtsberatung.**

---

## 1. Wer ist hier eigentlich wer

Die Software kennt zwei Ebenen, und beide werden regelmäßig mit den
datenschutzrechtlichen Rollen verwechselt.

| Begriff im Code         | Bedeutung                                     | Datenschutzrechtlich                                                                                                 |
| ----------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Instanzbetreiber**    | Wer die Software installiert hat und betreibt | Je nach Konstellation Verantwortlicher **oder** Auftragsverarbeiter                                                  |
| `tenants` — **Mandant** | Wer das Ticketsystem nutzt                    | Regelmäßig der Verantwortliche für die darin verarbeiteten Daten                                                     |
| `customers` — **Kunde** | Für wen ein Vorgang geführt wird              | **Eine Organisation, keine natürliche Person.** Keine eigene datenschutzrechtliche Rolle allein aus dieser Zuordnung |

> [!important] Die Zuordnung der Rollen folgt nicht aus dem Schema
> Wer Verantwortlicher ist, entscheidet sich danach, **wer über Zwecke und
> Mittel der Verarbeitung entscheidet** — nicht danach, wie die Tabellen heißen.
> Zwei typische Fälle:
>
> **Eigenbetrieb.** Ein Unternehmen betreibt die Instanz für sich selbst, mit
> einem einzigen Mandanten. Es ist Verantwortlicher. Auftragsverarbeiter sind
> nur die technischen Dienstleister aus Abschnitt 2.
>
> **Betrieb für Dritte.** Jemand betreibt die Instanz und stellt Mandanten für
> andere Unternehmen bereit. Dann ist regelmäßig jeder Mandant Verantwortlicher
> und der Instanzbetreiber Auftragsverarbeiter — mit einem AVV je Mandant, und
> mit den Dienstleistern aus Abschnitt 2 als **Unterauftragsverarbeitern**, für
> die Art. 28 Abs. 2 und 4 gilt.

## 2. Unterauftragsverhältnisse, die die Architektur erzeugt

Vier, von denen zwei zwingend und zwei abhängig von der Einrichtung sind.

| Verhältnis                | Zwingend?                                                     | Was dort verarbeitet wird                                                         |
| ------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Hosting der Anwendung** | ja                                                            | Sämtliche Vorgangs- und Nutzerdaten im Arbeitsspeicher; Protokolle des Webservers |
| **Hosting der Datenbank** | ja                                                            | Sämtliche personenbezogenen Daten dauerhaft                                       |
| **E-Mail-Versand**        | ja, sobald Anmeldung und Passwortzurücksetzung genutzt werden | E-Mail-Adressen der Nutzer, Anmeldelinks                                          |
| **KI-Anbieter**           | **nein** — nur bei aktivierter KI                             | Titel und Beschreibung von Vorgängen, begrenzt auf `ai_config.max_input_chars`    |

**Anwendung und Datenbank können bei demselben Anbieter liegen**, müssen aber
nicht. Für die Architektur ist entscheidend, dass der Anbieter EU-inkorporiert
ist — nicht nur, dass er eine EU-Region anbietet. Die Begründung steht in
[architektur.md](architektur.md) und betrifft den Unterschied zwischen
Datenresidenz und Datensouveränität.

> [!warning] Supabase self-hosted heißt nicht Supabase als Dienstleister
> Taktus Kontor setzt Supabase im Selbstbetrieb voraus. Die Supabase-Komponenten
> sind quelloffen und laufen auf der Infrastruktur des Betreibers — **Supabase
> Inc. ist damit kein Auftragsverarbeiter.** Wer stattdessen Supabase Cloud
> einsetzt, ändert genau das und braucht einen AVV mit Supabase Inc. samt
> Prüfung der Drittlandübermittlung.

### Der KI-Anbieter ist der Sonderfall

Er ist der einzige Unterauftragnehmer, der **Inhalte** von Vorgängen sieht — und
damit Freitext, in dem Menschen Namen und Sachverhalte über Dritte schreiben.

Drei Punkte für den AVV mit ihm:

1. **Keine Verwendung zum Training.** Ausdrücklich ausschließen; die Zusage
   gehört in den Vertrag, nicht in die Produktbeschreibung des Anbieters.
2. **Aufbewahrungsdauer der Eingaben.** Viele Anbieter speichern Anfragen zur
   Missbrauchserkennung für einen begrenzten Zeitraum. Diese Dauer gehört ins
   Verarbeitungsverzeichnis.
3. **Verarbeitungsort und Drittlandbezug.** Bei einem Anbieter außerhalb der EU
   sind Art. 44 ff. zu prüfen — Standardvertragsklauseln allein heilen die
   Zugriffsmöglichkeit ausländischer Behörden nicht.

**Zum Stand dieses Dokuments ist kein Anbieter gewählt.** Die Abwägung steht
offen in [ki-abwaegung.md](ki-abwaegung.md). Ohne konfigurierten Anbieter ist
die Anwendung voll funktionsfähig — die KI-Freigabe steht je Mandant auf `false`,
und ohne Anbieter verlässt kein Vorgangsinhalt die Instanz.

`ai_config.provider = 'openai_compatible'` erlaubt ein selbst betriebenes
Modell. Dann entsteht dieses Unterauftragsverhältnis gar nicht.

## 3. Was die Anwendung für Betroffenenrechte bereitstellt

Ein AVV verpflichtet den Auftragsverarbeiter, den Verantwortlichen bei der
Erfüllung der Betroffenenrechte zu unterstützen (Art. 28 Abs. 3 lit. e). Was
die Software dazu beiträgt:

| Recht                                        | Unterstützung durch die Anwendung                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Auskunft (Art. 15)**                       | `export_person_data()` stellt alle Bereiche mit Personenbezug maschinell zusammen                             |
| **Datenübertragbarkeit (Art. 20)**           | Derselbe Export als Datei, strukturiert und maschinenlesbar                                                   |
| **Berichtigung (Art. 16)**                   | Profil und Vorgangsinhalte sind über die Oberfläche änderbar; die Verwaltung darf fremde Beiträge berichtigen |
| **Löschung (Art. 17)**                       | Anonymisierung des Profils in der Anwendung; die Löschung in `auth.users` **organisatorisch beim Betreiber**  |
| **Einschränkung der Verarbeitung (Art. 18)** | `tenants.is_active` und `profiles.deactivated_at` — Sperrung ohne Datenverlust                                |
| **Meldung von Verletzungen (Art. 33)**       | `audit_log` macht Zugriffe und Änderungen nachvollziehbar. **Alarmierung ist Betreiberaufgabe**               |

## 4. Wo die Anwendung nichts leisten kann

Diese Punkte gehören in den AVV als Pflicht des Verantwortlichen oder als
organisatorische Maßnahme — nicht als Zusage der Software.

**Löschung in `auth.users`.** Dort liegt die E-Mail-Adresse. Die Anwendung führt
diesen Schritt bewusst nicht aus: Er braucht den Service-Role-Schlüssel und
umginge damit sämtliche Zugriffsregeln. Der Betreiber führt ihn über die
Verwaltungsschnittstelle seiner Supabase-Installation aus und hält fest, dass er
ihn ausgeführt hat.

**Freitexte bei der Anonymisierung.** `anonymize_profile` ersetzt den
Anzeigenamen und löst den Protokollbezug. **Ticketbeschreibungen und Kommentare
bleiben unverändert** und können weiterhin Namen enthalten — auch die von
Personen, die nie Nutzer der Instanz waren. Ein Auskunfts- oder Löschersuchen
einer solchen Person lässt sich maschinell nicht vollständig beantworten.
Einzelheiten in [loeschkonzept.md](loeschkonzept.md).

**Ausführung des Löschlaufs.** `purge_expired_data()` existiert und ist geprüft.
Ob sie regelmäßig läuft, entscheidet der Betrieb. Eine Löschfrist ohne
eingeplanten Lauf ist eine Absichtserklärung.

**Sicherungen.** Eine gelöschte Zeile bleibt in einer Sicherung erhalten, bis
diese abläuft. Das Löschkonzept der Anwendung erfasst Sicherungen nicht; das
Sicherungskonzept des Betreibers muss es tun.

**Bereits ausgelieferte Auskünfte.** Eine als Datei ausgehändigte Auskunft liegt
außerhalb der Anwendung. Was danach mit ihr geschieht, kann sie nicht steuern.

**Angemessenheit der Fristen.** 730 Tage für Vorgänge und 365 Tage für
Protokolleinträge sind Vorgabewerte, je Mandant einstellbar — keine
Rechtsauskunft. Für Zeitbuchungen können handels- oder steuerrechtliche
Aufbewahrungspflichten dagegenstehen; sie hängen als `ON DELETE CASCADE` am
Vorgang und verschwinden mit ihm.

## 5. Kontrollrechte des Verantwortlichen

Ein AVV räumt dem Verantwortlichen Kontrollrechte ein (Art. 28 Abs. 3 lit. h).
Was sich an dieser Software ohne Vor-Ort-Termin prüfen lässt:

- **Der Quelltext.** Die Anwendung steht unter AGPL-3.0; jede Zugriffsregel,
  jede Löschfunktion und jede Übermittlung ist nachlesbar
- **Die Zugriffsmatrix** in [rls-matrix.md](rls-matrix.md), deckungsgleich mit
  dem pgTAP-Testsatz — und der Testsatz ist ausführbar
- **Die Stückliste.** Zu jedem Release entsteht ein SPDX-SBOM über die
  vollständige transitive Abhängigkeitskette
- **Die Prüfkette** in [security.md](security.md), Kapitel 2 — mit dem Verweis,
  wo jede Prüfung läuft, und einer eigenen Tabelle für das, was **nicht**
  eingerichtet ist

Nicht ersetzbar bleibt, was den Betrieb betrifft: Rechenzentrum, Netzwerk,
Sicherungen, Zugriff des Betriebspersonals auf die Datenbank.

> [!note] Das Betriebspersonal sieht alles
> Wer Zugriff auf die Datenbank oder den Service-Role-Schlüssel hat, umgeht
> sämtliche Zugriffsregeln der Anwendung — das ist keine Lücke, sondern die
> Bauart jeder Datenbank. Ein AVV muss diesen Personenkreis benennen und auf
> Vertraulichkeit verpflichten (Art. 28 Abs. 3 lit. b). Die Anwendung kann dazu
> nichts beitragen.

---

## Was der Betreiber klären muss — Kurzliste

- [ ] Eigene Rolle bestimmen: Verantwortlicher oder Auftragsverarbeiter (1)
- [ ] AVV mit dem Hosting-Anbieter (2)
- [ ] AVV mit dem E-Mail-Dienst (2)
- [ ] Bei aktivierter KI: Anbieter wählen, AVV schließen, Trainingsausschluss und Aufbewahrungsdauer festhalten (2)
- [ ] Bei Betrieb für Dritte: AVV je Mandant, Unterauftragnehmer offenlegen (1, 2)
- [ ] Zuständigkeit für die Löschung in `auth.users` benennen (4)
- [ ] Löschlauf einplanen und überwachen (4)
- [ ] Sicherungskonzept mit dem Löschkonzept in Einklang bringen (4)
- [ ] Betriebspersonal mit Datenbankzugriff benennen und verpflichten (5)
