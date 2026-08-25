/**
 * Reine Auswertungslogik der Lizenzpolitik.
 *
 * Bewusst getrennt vom Skript, das Prozesse startet und Dateien liest: Nur so
 * lässt sich die Klassifikation testen, ohne `pnpm licenses list` auszuführen.
 * Die Tests liegen in license-policy.test.mjs.
 *
 * Es gibt genau drei Ergebnisse, keinen vierten:
 *   allow    — zulässig
 *   deny     — unzulässig
 *   unknown  — nicht entscheidbar, behandelt wie deny
 *
 * `unknown` bricht den Build. Das ist Absicht: Die Lizenzregel des Projekts verlangt,
 * dass ein Mensch einmal entscheidet und die Entscheidung dokumentiert. Eine
 * Warnung an dieser Stelle würde nach kurzer Zeit niemand mehr lesen.
 */

import parse from "spdx-expression-parse";

/** @typedef {"allow" | "deny" | "unknown"} Status */

/**
 * Bewertet einen einzelnen SPDX-Bezeichner gegen die Positiv- und Negativliste.
 *
 * Die Negativliste hat Vorrang. Steht ein Bezeichner auf beiden Listen, ist das
 * ein Konfigurationsfehler — restriktiv aufzulösen ist die sichere Richtung.
 *
 * @param {string} id
 * @param {{ allow: Set<string>, deny: Set<string> }} policy
 * @returns {Status}
 */
function classifyIdentifier(id, policy) {
  if (policy.deny.has(id)) return "deny";
  if (policy.allow.has(id)) return "allow";
  return "unknown";
}

/**
 * Wertet den geparsten SPDX-Baum aus.
 *
 * ODER — eine Wahlmöglichkeit: Ein zulässiger Zweig genügt, denn dieser Zweig
 * darf gewählt werden. `(MIT OR GPL-2.0-only)` ist damit zulässig.
 *
 * UND — kumulative Pflichten: Alle Zweige müssen zulässig sein, weil alle
 * Bedingungen gleichzeitig gelten.
 *
 * @param {ReturnType<typeof parse>} node
 * @param {{ allow: Set<string>, deny: Set<string> }} policy
 * @returns {Status}
 */
function evaluateNode(node, policy) {
  if ("license" in node) {
    // `GPL-2.0+` ist die alte Schreibweise für `GPL-2.0-or-later`. Das
    // `plus`-Flag transportiert genau diesen Unterschied -- und der ist hier
    // der entscheidende: `only` ist mit AGPL-3.0 unvereinbar, `or-later` nicht.
    const id = node.plus === true ? `${node.license}-or-later` : node.license;

    // Eine Lizenzausnahme (`Apache-2.0 WITH LLVM-exception`) verändert die
    // Bedingungen. Automatisch bewertbar ist das nicht -- entweder steht die
    // vollständige Zeichenkette auf einer Liste, oder ein Mensch entscheidet.
    if (typeof node.exception === "string") {
      const withId = `${id} WITH ${node.exception}`;
      if (policy.deny.has(withId)) return "deny";
      if (policy.allow.has(withId)) return "allow";
      return "unknown";
    }

    return classifyIdentifier(id, policy);
  }

  const left = evaluateNode(node.left, policy);
  const right = evaluateNode(node.right, policy);

  if (node.conjunction === "or") {
    if (left === "allow" || right === "allow") return "allow";
    if (left === "unknown" || right === "unknown") return "unknown";
    return "deny";
  }

  // "and"
  if (left === "deny" || right === "deny") return "deny";
  if (left === "unknown" || right === "unknown") return "unknown";
  return "allow";
}

/**
 * Bewertet einen SPDX-Ausdruck, wie ihn `pnpm licenses list` als Schlüssel
 * liefert.
 *
 * Was hier ankommt, ist nicht zwangsläufig gültiges SPDX: Ältere Pakete
 * deklarieren `BSD`, `Apache` oder `SEE LICENSE IN README`. Solche Angaben
 * lassen sich nicht bewerten und führen deshalb zu `unknown`.
 *
 * @param {string | null | undefined} expression
 * @param {{ allow: Set<string>, deny: Set<string> }} policy
 * @returns {{ status: Status, grund: string }}
 */
export function classifyExpression(expression, policy) {
  if (typeof expression !== "string" || expression.trim() === "") {
    return { status: "unknown", grund: "keine Lizenzangabe" };
  }

  const expr = expression.trim();

  // Exakter Abgleich VOR dem Parsen.
  //
  // Notwendig, weil verbreitete Angaben gar kein gültiges SPDX sind:
  // `UNLICENSED` etwa lässt `parse()` werfen. Ohne diesen Schritt landete der
  // Ausdruck auf `unknown` -- was den Build zwar ebenfalls bricht, aber mit
  // der falschen Begründung. Eine ausdrücklich abgelehnte Lizenz soll als
  // abgelehnt gemeldet werden, nicht als unklar.
  if (policy.deny.has(expr)) {
    return { status: "deny", grund: "auf der Negativliste" };
  }
  if (policy.allow.has(expr)) {
    return { status: "allow", grund: "auf der Positivliste" };
  }

  // pnpm reicht diese Zeichenketten unverändert durch, wenn im Paket kein
  // auswertbares Feld steht.
  if (expr === "Unknown" || expr === "UNKNOWN" || expr.startsWith("SEE ")) {
    return { status: "unknown", grund: `nicht auswertbare Angabe: ${expr}` };
  }

  let parsed;
  try {
    parsed = parse(expr);
  } catch {
    return { status: "unknown", grund: `kein gültiger SPDX-Ausdruck: ${expr}` };
  }

  const status = evaluateNode(parsed, policy);
  const grund =
    status === "allow"
      ? "auf der Positivliste"
      : status === "deny"
        ? "auf der Negativliste"
        : "nicht auf der Positivliste — Mensch entscheidet";

  return { status, grund };
}

/**
 * Baut die Mengen aus der Konfigurationsdatei.
 *
 * `allowMitBegruendung` ist ein Objekt statt eines Feldes in `allow`, damit die
 * Begründung nicht verlorengehen kann: Wer den Eintrag entfernt, entfernt
 * zwangsläufig auch die Erklärung, warum er einmal vertretbar war.
 *
 * @param {Record<string, unknown>} raw
 */
export function buildPolicy(raw) {
  const allow = new Set(
    /** @type {string[]} */ (Array.isArray(raw["allow"]) ? raw["allow"] : []),
  );

  const begruendet = raw["allowMitBegruendung"];
  if (begruendet !== null && typeof begruendet === "object") {
    for (const id of Object.keys(begruendet)) allow.add(id);
  }

  const deny = new Set(
    /** @type {string[]} */ (Array.isArray(raw["deny"]) ? raw["deny"] : []),
  );

  const ueberschneidung = [...allow].filter((id) => deny.has(id));
  if (ueberschneidung.length > 0) {
    throw new Error(
      `license-policy.json widersprüchlich — auf beiden Listen: ${ueberschneidung.join(", ")}`,
    );
  }

  return { allow, deny };
}

const PFLICHTFELDER = ["spdx", "grund", "beleg", "geprueft_von", "geprueft_am"];

/**
 * Liest die Einzelfreigaben und weist unvollständige Einträge ab.
 *
 * Eine Ausnahme ohne Beleg und ohne Prüfer ist keine Prüfung, sondern eine
 * Umgehung. Der Build bricht dann an der Ausnahme selbst — nicht an dem Paket,
 * das sie verdecken sollte.
 *
 * @param {Record<string, unknown>} raw
 * @returns {Map<string, Record<string, string>>} Schlüssel: "name@version"
 */
export function buildExceptions(raw) {
  const freigaben = raw["freigaben"];
  const map = new Map();
  if (freigaben === null || typeof freigaben !== "object") return map;

  for (const [schluessel, eintrag] of Object.entries(freigaben)) {
    if (eintrag === null || typeof eintrag !== "object") {
      throw new Error(`license-exceptions.json: ${schluessel} ist kein Objekt`);
    }
    if (!schluessel.includes("@") || schluessel.lastIndexOf("@") === 0) {
      throw new Error(
        `license-exceptions.json: "${schluessel}" muss die Form "name@version" haben — ` +
          `eine an den Paketnamen gebundene Ausnahme würde bei jedem Update blind weitergelten`,
      );
    }
    const fehlend = PFLICHTFELDER.filter(
      (f) => typeof (/** @type {any} */ (eintrag)[f]) !== "string",
    );
    if (fehlend.length > 0) {
      throw new Error(
        `license-exceptions.json: "${schluessel}" fehlt: ${fehlend.join(", ")}`,
      );
    }
    map.set(schluessel, /** @type {Record<string, string>} */ (eintrag));
  }

  return map;
}

/**
 * Wertet die Ausgabe von `pnpm licenses list --json` vollständig aus.
 *
 * @param {Record<string, Array<{ name: string, versions: string[] }>>} bericht
 * @param {{ allow: Set<string>, deny: Set<string> }} policy
 * @param {Map<string, Record<string, string>>} exceptions
 */
export function auswerten(bericht, policy, exceptions) {
  /** @type {Array<{ lizenz: string, paket: string, version: string, status: Status, grund: string }>} */
  const befunde = [];

  for (const [lizenz, pakete] of Object.entries(bericht)) {
    const { status, grund } = classifyExpression(lizenz, policy);

    for (const paket of pakete) {
      const versionen = paket.versions.length > 0 ? paket.versions : ["?"];

      for (const version of versionen) {
        if (status === "allow") {
          befunde.push({
            lizenz,
            paket: paket.name,
            version,
            status,
            grund,
          });
          continue;
        }

        // Eine Freigabe gilt nur für genau diese Version.
        const freigabe = exceptions.get(`${paket.name}@${version}`);
        if (freigabe !== undefined) {
          befunde.push({
            lizenz,
            paket: paket.name,
            version,
            status: "allow",
            grund: `Einzelfreigabe (${freigabe["geprueft_von"]}, ${freigabe["geprueft_am"]})`,
          });
          continue;
        }

        befunde.push({ lizenz, paket: paket.name, version, status, grund });
      }
    }
  }

  befunde.sort(
    (a, b) =>
      a.lizenz.localeCompare(b.lizenz) || a.paket.localeCompare(b.paket),
  );

  return {
    befunde,
    verletzungen: befunde.filter((b) => b.status !== "allow"),
  };
}
