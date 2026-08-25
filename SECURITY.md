<!--
SPDX-FileCopyrightText: 2026 INX Systems
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Sicherheitslücken melden

Dieses Dokument beschreibt den **Meldeweg**. Die Sicherheitsarchitektur des
Projekts — Risikomatrix, Werkzeugkette und die Grenzen automatisierter Prüfung —
steht in [docs/security.md](docs/security.md).

## Bitte kein öffentliches Issue

Sicherheitslücken bitte **nicht** über GitHub Issues, Pull Requests oder
Diskussionen melden. Eine öffentliche Meldung setzt alle Betreiber dieser
Software dem Risiko aus, bevor eine Korrektur bereitsteht.

## Meldeweg

**Bevorzugt: GitHubs private Meldung.** Auf der Registerkarte _Security_ dieses
Repositories führt _Report a vulnerability_ zu einem nicht öffentlichen
Vorgang. Er bleibt bis zur Korrektur verborgen, und die Unterhaltung steht
gesammelt an einer Stelle statt in einem Postfach.

**Ohne GitHub-Konto: E-Mail an kontakt@inxsystems.de**, Betreff mit
`Sicherheit Taktus` beginnen.

Hilfreich ist auf beiden Wegen alles, was die Nachstellung erleichtert:

- Art der Schwachstelle und betroffene Komponente
- Schritte zur Reproduktion, gern mit Beispielaufruf
- Betroffene Version oder Commit
- Mögliche Auswirkung nach deiner Einschätzung

Wenn du eine verschlüsselte Übertragung bevorzugst, schreib uns kurz — auf
Anfrage stellen wir einen Schlüssel bereit.

## Was mit deiner Meldung geschieht

Der Ablauf ist immer derselbe: Eingang bestätigen, den Befund nachstellen,
Schweregrad und Reichweite einschätzen, korrigieren, dich über das Ergebnis
unterrichten. Auch dann, wenn wir einen Befund nicht als Schwachstelle bewerten
— mit Begründung.

> [!important] Feste Fristen stehen hier bewusst nicht
> Eine Frist, die sich nicht in jedem Fall halten lässt, ist keine Zusage,
> sondern eine Behauptung — und dieses Repository stellt seine Prüfbarkeit aus.
> Dann darf an keiner Stelle etwas stehen, was es nicht einlöst. Das gilt für
> die Werkzeugkette in [docs/security.md](docs/security.md) genauso wie hier.
>
> Was stattdessen gilt: Meldungen werden ernst genommen und bearbeitet. Bleibt
> dir der Stand zu lange unklar, frag nach — eine Rückfrage ist ausdrücklich
> willkommen und kein Drängeln.

Wenn du einen Zeitplan für deine eigene Veröffentlichung brauchst, sag das in
der Meldung dazu. Dann stimmen wir ihn ab, statt dich warten zu lassen.

## Offenlegung

Wir bitten um koordinierte Offenlegung: gib uns Gelegenheit, eine Korrektur
bereitzustellen, bevor Details veröffentlicht werden. Auf Wunsch nennen wir dich
in den Versionshinweisen; anonym ist ebenso in Ordnung.

## Geltungsbereich

**Im Geltungsbereich:** der Quellcode dieses Repositories, die
Datenbank-Migrationen und Row-Level-Security-Policies, die
Continuous-Integration-Konfiguration sowie die mitgelieferten
Betriebsanleitungen.

**Außerhalb:** Instanzen, die von Dritten betrieben werden — dort ist der
jeweilige Betreiber zuständig. Ebenso bereits öffentlich bekannte Schwachstellen
in Abhängigkeiten: Die laufen über die reguläre Aktualisierung und brauchen
keine gesonderte Meldung.

## Datenschutzrelevante Befunde ausdrücklich willkommen

Neben klassischen Sicherheitslücken interessieren uns besonders Befunde zu:

- Mandantentrennung — Zugriff auf Daten eines fremden Mandanten
- Datenminimierung — erhobene Felder ohne erkennbaren Zweck
- Protokollierung — personenbezogene Inhalte in Logs
- Löschung — Daten, die über ihre Frist hinaus erhalten bleiben

Diese Klasse von Fehlern findet kein Scanner. Hinweise darauf sind für dieses
Projekt besonders wertvoll.
