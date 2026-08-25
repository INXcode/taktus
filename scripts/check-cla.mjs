#!/usr/bin/env node
/**
 * Prueft, ob fuer einen Pull Request eine CLA-Zustimmung vorliegt.
 *
 * Aufgerufen von .github/workflows/cla.yml. Die reine Logik steht in
 * cla-signatures.mjs und ist dort getestet; hier stehen nur Ein- und Ausgabe.
 *
 * Zwei Wege fuehren zu einer gueltigen Zustimmung, und beide sind gleichwertig:
 *
 *   1. Ein Kommentar des Pull-Request-Autors mit dem Zustimmungssatz. Der
 *      Kommentar traegt Konto und Zeitstempel und liegt dauerhaft am Vorgang.
 *   2. Ein Eintrag in .github/cla-signatures.json. Den traegt die Verwaltung
 *      ueber einen gewoehnlichen Pull Request nach -- fuer Beitragende, die
 *      nicht bei jedem Mal erneut zustimmen sollen.
 *
 * Was dieses Skript ausdruecklich NICHT tut: schreiben. Weder in das
 * Repository noch in einen Zweig. Der Workflow laeuft auf `pull_request_target`
 * und `issue_comment`, also auf Ereignissen, die ein Fremder ausloest; ein Job
 * mit `contents: write` auf einem solchen Ereignis ist die meistgenutzte
 * Angriffsflaeche in GitHub Actions. Der Preis dafuer ist, dass die Verwaltung
 * den Bestand von Hand pflegt -- und das ist der richtige Handel: Der Nachweis
 * bleibt auch ohne Eintrag vollstaendig, weil der Kommentar am Vorgang steht.
 */

import { appendFileSync, readFileSync } from "node:fs";

import {
  bestandLesen,
  istGezeichnet,
  istZustimmung,
} from "./cla-signatures.mjs";

function lesen(pfad) {
  return JSON.parse(readFileSync(pfad, "utf8"));
}

function ausgeben(name, wert) {
  const datei = process.env.GITHUB_OUTPUT;
  if (datei) appendFileSync(datei, `${name}=${wert}\n`);
}

function main() {
  const pr = lesen(process.env.CLA_PR_JSON);
  const kommentare = lesen(process.env.CLA_COMMENTS_JSON);
  const bestand = bestandLesen(lesen(process.env.CLA_STORE));

  const autor = { login: pr.user.login, user_id: pr.user.id };

  // Weg 2 zuerst, weil er ohne jede Auswertung von Fremdtext auskommt.
  if (istGezeichnet(autor, bestand)) {
    console.log(
      `Zustimmung liegt vor: ${autor.login} steht im Bestand oder auf der Allowlist.`,
    );
    ausgeben("gezeichnet", "true");
    ausgeben("grund", "Zustimmung im Bestand hinterlegt.");
    return 0;
  }

  // Weg 1. Nur Kommentare des Pull-Request-Autors zaehlen -- niemand stimmt
  // fuer jemand anderen zu. Verglichen wird ueber die Konto-ID, nicht ueber
  // den Anmeldenamen; die Begruendung steht in cla-signatures.mjs.
  const zustimmung = kommentare.find(
    (kommentar) =>
      kommentar.user?.id === pr.user.id && istZustimmung(kommentar.body),
  );

  if (zustimmung) {
    console.log(
      `Zustimmung liegt vor: Kommentar ${zustimmung.id} von ${autor.login} ` +
        `vom ${zustimmung.created_at}.`,
    );
    ausgeben("gezeichnet", "true");
    ausgeben("grund", `Zustimmung als Kommentar vom ${zustimmung.created_at}.`);
    // Als Vorlage fuer den Nachtrag in .github/cla-signatures.json.
    console.log(
      "\nEintrag fuer den Bestand, falls dauerhaft vermerkt werden soll:\n" +
        JSON.stringify(
          {
            login: autor.login,
            user_id: autor.user_id,
            cla_version: bestand.cla_version,
            pull_request: pr.number,
            comment_id: zustimmung.id,
            signed_at: zustimmung.created_at,
          },
          null,
          2,
        ),
    );
    return 0;
  }

  console.error(`Keine CLA-Zustimmung von ${autor.login} gefunden.`);
  ausgeben("gezeichnet", "false");
  ausgeben("grund", "Zustimmung zum Contributor License Agreement fehlt.");
  return 1;
}

process.exit(main());
