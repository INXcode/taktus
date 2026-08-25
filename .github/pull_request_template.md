## Was ändert sich und warum

<!-- Kurz und in ganzen Sätzen. Das Warum ist wichtiger als das Was — das Was
     steht im Diff. -->

Betrifft #

---

## Zweckprüfung

> Der Funktionsumfang von Release 1 ist bewusst eng geschnitten. Die Regel
> steht in [CONTRIBUTING.md](../CONTRIBUTING.md) und lautet: Tiefe in der
> Architektur, nicht Breite im Funktionsumfang.

- [ ] Diese Änderung trägt zu **Sicherheit, Datenschutz, Nachweisbarkeit oder
      Qualität** bei — oder behebt einen Fehler
- [ ] Sie fügt eine **neue Funktion** hinzu. Dann bitte die vorherige
      Abstimmung verlinken und begründen, warum sie nach Release 1 gehört:

## Definition of Done

Nicht Zutreffendes streichen, nicht stillschweigend überspringen.

- [ ] `requireRole()` steht als erste Anweisung in jeder neuen Server Action
      und jeder geschützten Seite
- [ ] Eingaben werden serverseitig mit Zod validiert, Meldungen auf Deutsch im
      Schema
- [ ] **Neue Tabelle → RLS aktiviert, Policy je Verb und Zielgruppe, pgTAP-Test
      im selben Pull Request.** RLS ohne Test ist eine Behauptung
- [ ] **Neues Feld → Zeile in `docs/datenmodell.md` mit Zweckangabe.** Ein Feld
      ohne begründbaren Zweck wird nicht aufgenommen
- [ ] Kein Personenbezug in Logs — keine E-Mail-Adressen, Namen, Freitexte,
      Token
- [ ] Neue Abhängigkeit: Lizenz geprüft, Notwendigkeit unten begründet
- [ ] `pnpm db:types` ausgeführt und das Ergebnis committet
- [ ] Deutsche Oberflächentexte, englischer Code und Commit

## Bei Änderungen an Zugriffsregeln

<!-- Nur ausfüllen, wenn Policies, Rollen oder tenant_id betroffen sind. -->

- [ ] `docs/rls-matrix.md` ist nachgezogen und deckungsgleich mit den Tests
- [ ] Ein Test deckt den Fall **fremder Mandant** ab
- [ ] Mandantenbezug läuft über `(SELECT public.current_tenant_id())` — nicht
      über einen direkten Subselect auf `profiles`
- [ ] Verweigerter Lesezugriff wird mit `is_empty()` geprüft, verweigertes
      Schreiben mit `throws_ok(..., '42501')`

## Neue Abhängigkeiten

<!-- Je Paket: wofür, und warum keine bestehende Lösung genügt. Leer lassen,
     wenn keine hinzukommen. -->

## Was ich geprüft habe

<!-- Wie wurde verifiziert, dass es tut, was es soll — und dass es fehlschlägt,
     wenn es das nicht tut? Ein Testlauf, der nie rot war, sagt wenig. -->
