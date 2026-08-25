#!/usr/bin/env node
/**
 * Setzt für alle Konten einer Instanz ein gemeinsames Kennwort.
 *
 *   SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/demo-kennwoerter.mjs
 *
 * ---------------------------------------------------------------------------
 * Wofür das gebraucht wird
 *
 * `supabase/seed.sql` vergibt allen Konten dasselbe Kennwort, und es steht im
 * öffentlichen Repository -- als Entwicklungswert für einen Container auf dem
 * eigenen Rechner ist das richtig so.
 *
 * Auf einer ERREICHBAREN Instanz ist es das nicht. Am 24.08.2026 lief genau
 * dieser Seed auf der Demo, und mit der Veröffentlichung war das Kennwort samt
 * aller Kontonamen öffentlich lesbar -- darunter zwei Administratoren. Die
 * Demo wurde deshalb abgeschaltet.
 *
 * Dieses Skript ist der Schritt, der zwischen Seed und Erreichbarkeit gehört.
 *
 * ---------------------------------------------------------------------------
 * Warum ein Kennwort für alle
 *
 * Es ist ein Vorführsystem mit durchweg synthetischen Daten unter `.invalid`.
 * Ein Kennwort je Rolle wäre umständlicher vorzuführen und schützte nichts,
 * was hier zu schützen wäre. Bewusst entschieden -- mit der Folge, dass wer
 * das Kennwort kennt, auch in die Verwaltung kommt.
 *
 * ---------------------------------------------------------------------------
 * Warum die Eingabe verdeckt kommt und nicht als Argument
 *
 * Ein Argument steht in der Shell-Historie und für die Dauer des Laufs in der
 * Prozessliste, wo jeder Nutzer der Maschine es lesen kann. Eine
 * Umgebungsvariable ebenso. Das Kennwort wird deshalb abgefragt und
 * nirgendwo abgelegt.
 * ---------------------------------------------------------------------------
 */

import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline";

/** Dieselbe Richtlinie, die `supabase/config.toml` serverseitig durchsetzt. */
const MINDESTLAENGE = 12;

/** Das Kennwort aus dem Seed. Nach diesem Lauf darf es nirgends mehr gelten. */
const SEED_KENNWORT = "Entwicklung-2026!";

function pruefeKennwort(wert) {
  const fehler = [];
  if (wert.length < MINDESTLAENGE)
    fehler.push(`mindestens ${MINDESTLAENGE} Zeichen`);
  if (!/\p{Ll}/u.test(wert)) fehler.push("ein Kleinbuchstabe");
  if (!/\p{Lu}/u.test(wert)) fehler.push("ein Grossbuchstabe");
  if (!/\d/u.test(wert)) fehler.push("eine Ziffer");
  return fehler;
}

/**
 * Fragt verdeckt ab.
 *
 * `_writeToOutput` zu ersetzen ist der uebliche Weg dafuer: readline schreibt
 * jedes Zeichen selbst zurueck, und nur dort laesst sich das unterbinden. Die
 * Frage selbst muss durch, sonst steht der Cursor vor einer leeren Zeile.
 */
function frageVerdeckt(frage) {
  return new Promise((fertig) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    let frageGeschrieben = false;
    rl._writeToOutput = (text) => {
      if (!frageGeschrieben && text.includes(frage.slice(0, 10))) {
        rl.output.write(text);
        frageGeschrieben = true;
      }
    };

    rl.question(frage, (antwort) => {
      rl.output.write("\n");
      rl.close();
      fertig(antwort);
    });
  });
}

function umgebung(name, ...weitere) {
  for (const schluessel of [name, ...weitere]) {
    const wert = process.env[schluessel];
    if (wert) return wert;
  }
  throw new Error(
    `${[name, ...weitere].join(" oder ")} ist nicht gesetzt.\n\n` +
      "Beides gehoert zur Zielinstanz, nicht zur eigenen Maschine. Der\n" +
      "Service-Role-Schluessel umgeht saemtliche RLS-Policies -- er gehoert in\n" +
      "keine Datei und in keine Shell-Historie.",
  );
}

async function main() {
  const url = umgebung("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  const schluessel = umgebung("SUPABASE_SERVICE_ROLE_KEY");

  console.log(`Zielinstanz: ${url}\n`);

  // `DEMO_KENNWORT` ist die zweite Wahl und bleibt es.
  //
  // Die verdeckte Abfrage ist der Normalfall. Es gibt aber einen Anlass, bei
  // dem sie nicht taugt: wenn das Kennwort in einer Datei liegt, die derjenige
  // NICHT lesen soll, der das Skript ausfuehrt. Dann laedt Node die Datei
  // selbst und niemand bekommt den Wert zu Gesicht:
  //
  //     node --env-file=.env.local scripts/demo-kennwoerter.mjs
  //
  // Der Preis: Der Wert steht fuer die Dauer des Laufs im Prozessumfeld, wo
  // ein anderer Nutzer derselben Maschine ihn lesen kann. Vertretbar fuer
  // einen einzelnen Lauf auf dem eigenen Rechner -- kein Grund, die Abfrage
  // dauerhaft zu ersetzen.
  const ausUmgebung = process.env.DEMO_KENNWORT;

  if (ausUmgebung) {
    console.log("Kennwort aus DEMO_KENNWORT uebernommen, nicht abgefragt.\n");
  }

  const kennwort =
    ausUmgebung ?? (await frageVerdeckt("Neues Kennwort fuer alle Konten: "));
  const fehler = pruefeKennwort(kennwort);

  if (fehler.length > 0) {
    throw new Error(
      `Das Kennwort erfuellt die Richtlinie nicht. Es fehlt: ${fehler.join(", ")}.\n\n` +
        "Der Auth-Server lehnte es ohnehin ab; hier faellt es auf, bevor die\n" +
        "Haelfte der Konten schon umgestellt ist.",
    );
  }

  if (kennwort === SEED_KENNWORT) {
    throw new Error(
      "Das ist das Kennwort aus dem Seed. Es steht im oeffentlichen\n" +
        "Repository -- genau deshalb gibt es dieses Skript.",
    );
  }

  const admin = createClient(url, schluessel, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`Konten nicht lesbar: ${error.message}`);

  const konten = data.users;
  if (konten.length === 0) {
    throw new Error(
      "Kein einziges Konto gefunden. Entweder zeigt die URL auf die falsche\n" +
        "Instanz, oder der Seed ist nie gelaufen.",
    );
  }

  console.log(`${konten.length} Konto/Konten gefunden.\n`);

  for (const konto of konten) {
    const { error: setzFehler } = await admin.auth.admin.updateUserById(
      konto.id,
      { password: kennwort },
    );

    if (setzFehler) {
      throw new Error(
        `${konto.email}: ${setzFehler.message}\n\n` +
          "Abgebrochen. Ein Teil der Konten traegt jetzt das neue Kennwort und\n" +
          "der Rest das alte -- den Lauf wiederholen, nicht weitermachen.",
      );
    }

    console.log(`  gesetzt  ${konto.email}`);
  }

  return gegenprobe(url, konten[0].email, kennwort);
}

/**
 * Nachweis statt Behauptung.
 *
 * Dass `updateUserById` keinen Fehler zurueckgegeben hat, heisst noch nicht,
 * dass eine Anmeldung damit gelingt -- und erst recht nicht, dass die alte
 * nicht mehr gilt. Beides wird deshalb an einem Konto durchgespielt.
 *
 * Und zwar mit dem ANONYMEN Schluessel: Das ist der Weg, den die Anmeldemaske
 * nimmt. Mit dem Service-Role-Schluessel liefe die Probe an genau der Schicht
 * vorbei, die sie pruefen soll.
 */
async function gegenprobe(url, email, kennwort) {
  console.log("\nGegenprobe an einem Konto:");

  const anon = umgebung("NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY");

  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const alt = await client.auth.signInWithPassword({
    email,
    password: SEED_KENNWORT,
  });

  if (!alt.error) {
    throw new Error(
      `Die Anmeldung mit dem Seed-Kennwort gelingt weiterhin (${email}).\n\n` +
        "Die Instanz ist damit NICHT sicher. Nicht erreichbar machen.",
    );
  }
  console.log(`  abgewiesen  ${email} mit dem Seed-Kennwort`);

  const neu = await client.auth.signInWithPassword({
    email,
    password: kennwort,
  });

  if (neu.error) {
    throw new Error(
      `Die Anmeldung mit dem neuen Kennwort scheitert (${email}): ${neu.error.message}\n\n` +
        "Die Konten sind jetzt womoeglich mit keinem bekannten Kennwort mehr\n" +
        "erreichbar. Vor dem naechsten Versuch nachsehen, woran es lag.",
    );
  }
  console.log(`  angenommen  ${email} mit dem neuen Kennwort`);

  await client.auth.signOut();

  console.log(
    "\nOK -- alle Konten umgestellt, beide Richtungen nachgewiesen.\n",
  );
  return 0;
}

try {
  process.exit(await main());
} catch (fehler) {
  console.error(
    "\n" + String(fehler instanceof Error ? fehler.message : fehler) + "\n",
  );
  process.exit(1);
}
