/**
 * Reine Logik der CLA-Zustimmungen.
 *
 * Getrennt vom Workflow, der GitHub anruft und Dateien schreibt -- nach dem
 * Vorbild von license-policy.mjs und aus demselben Grund: Nur so laesst sich
 * die Entscheidung "darf dieser Pull Request zusammengefuehrt werden" testen,
 * ohne einen Pull Request zu eroeffnen. Die Tests liegen in
 * cla-signatures.test.mjs.
 *
 * Warum ueberhaupt selbst gebaut und nicht die uebliche fremde Action: Ein
 * CLA-Bot laeuft zwangslaeufig mit Schreibrechten auf einem Ereignis, das ein
 * Fremder ausloest (`pull_request_target`, `issue_comment`). Diese Kombination
 * ist die meistgenutzte Angriffsflaeche in GitHub Actions ueberhaupt. Die
 * verbreitete Action dafuer ist seit Maerz 2026 archiviert und erhaelt keine
 * Sicherheitsaktualisierungen mehr. In einem Repository, dessen Argument die
 * Pruefkette ist, waere sie die schwaechste Stelle -- und zwar an genau der
 * Stelle, an der ein Pruefer zuerst hinsieht.
 *
 * Die Rechtefrage ist binaer und kennt keinen dritten Ausgang: Entweder liegt
 * fuer diesen Beitragenden eine Zustimmung zur geltenden Fassung vor, oder der
 * Pull Request wird nicht zusammengefuehrt. Eine Warnung waere hier wertlos --
 * ein einziger versehentlich zusammengefuehrter Beitrag ohne Zustimmung kostet
 * dauerhaft die Moeglichkeit der abweichenden kommerziellen Lizenzierung.
 */

/**
 * @typedef {object} Signatur
 * @property {string} login       GitHub-Konto zum Zeitpunkt der Zustimmung
 * @property {number} user_id     Numerische Konto-ID -- ueberlebt eine Umbenennung
 * @property {string} cla_version Fassung, der zugestimmt wurde
 * @property {number} pull_request
 * @property {number} comment_id  Der Kommentar, der die Zustimmung traegt
 * @property {string} cla_sha256  Pruefsumme der CLA.md zum Zeitpunkt der Zustimmung
 * @property {string} signed_at   ISO-8601, UTC
 */

/**
 * @typedef {object} Zustimmungsbestand
 * @property {string} cla_version
 * @property {string[]} allowlist           In der Datei erklaerte Ausnahmen
 * @property {string[]} wirksameAllowlist   Erklaerte plus eingebaute Ausnahmen
 * @property {Signatur[]} signatures
 */

/**
 * Die beiden Saetze, die als Zustimmung gelten -- deutsch und englisch, weil
 * die Beitragsregeln deutsch sind und der CLA-Text englisch ist.
 *
 * Bewusst ein vollstaendiger Satz und kein Schlagwort wie "agree": Ein Wort,
 * das sich versehentlich in einem Satz ueber etwas anderes findet, waere keine
 * belastbare Willenserklaerung.
 */
export const ZUSTIMMUNGSSAETZE = Object.freeze([
  "ich habe den cla gelesen und stimme ihm zu.",
  "i have read the cla and i hereby accept it.",
]);

/**
 * Konten, die nicht zustimmen koennen oder muessen.
 *
 * Bots koennen nicht unterschreiben -- ohne diesen Ausnahmeweg blockierte der
 * erste Aktualisierungs-Pull-Request von Dependabot sofort alles. Und der
 * Rechteinhaber raeumt sich selbst keine Rechte ein.
 */
export const STANDARD_ALLOWLIST = Object.freeze([
  "dependabot[bot]",
  "renovate[bot]",
  "github-actions[bot]",
]);

/**
 * Normalisiert Kommentartext fuer den Vergleich.
 *
 * Zitierte Zeilen werden verworfen, nicht bereinigt -- und das ist die
 * wichtigste Zeile dieser Funktion. GitHubs "Quote reply" stellt jeder Zeile
 * des zitierten Beitrags ein `>` voran. Die Anleitung, die dieses Projekt bei
 * fehlender Zustimmung hinterlaesst, fuehrt den Zustimmungssatz als Beispiel
 * auf. Wuerde das Zitatzeichen nur abgestreift, genuegte ein "Was bedeutet
 * das?" mit zitierter Anleitung, um als Zustimmung zu gelten.
 *
 * Genau davor sollte der vollstaendige Satz schuetzen. Eine Willenserklaerung,
 * die jemandem versehentlich unterlaeuft, ist keine.
 */
function normalisieren(text) {
  return (
    String(text ?? "")
      .replace(/\r\n/gu, "\n")
      .split("\n")
      .filter((zeile) => !/^\s*>/u.test(zeile))
      .join("\n")
      // Aufzaehlungspunkte am Zeilenanfang stoeren nicht: Wer den Satz als
      // Listenpunkt schreibt, schreibt ihn selbst.
      .replace(/^[\s*_-]+/gmu, "")
      .replace(/[*_`]/gu, "")
      .replace(/\s+/gu, " ")
      .trim()
      .toLowerCase()
  );
}

/**
 * Traegt ein Kommentartext eine Zustimmung?
 *
 * @param {string} text
 * @returns {boolean}
 */
export function istZustimmung(text) {
  const normal = normalisieren(text);
  return ZUSTIMMUNGSSAETZE.some((satz) => normal.includes(satz));
}

/**
 * Liest den Zustimmungsbestand und prueft ihn auf Form.
 *
 * Ein unlesbarer oder unvollstaendiger Bestand ist kein Grund, grosszuegig zu
 * sein: Die Funktion wirft, statt einen leeren Bestand zurueckzugeben. Ein
 * leerer Bestand wuerde stillschweigend alle bisherigen Zustimmungen
 * entwerten -- und damit den Nachweis, der der einzige Zweck der Datei ist.
 *
 * @param {unknown} roh
 * @returns {Zustimmungsbestand}
 */
export function bestandLesen(roh) {
  if (roh === null || typeof roh !== "object" || Array.isArray(roh)) {
    throw new Error("Zustimmungsbestand ist kein Objekt.");
  }

  const {
    cla_version: version,
    allowlist,
    signatures,
  } = /** @type {any} */ (roh);

  if (typeof version !== "string" || version.trim() === "") {
    throw new Error("Feld `cla_version` fehlt oder ist leer.");
  }
  if (!Array.isArray(signatures)) {
    throw new Error("Feld `signatures` fehlt oder ist keine Liste.");
  }
  if (allowlist !== undefined && !Array.isArray(allowlist)) {
    throw new Error("Feld `allowlist` ist keine Liste.");
  }

  for (const [i, eintrag] of signatures.entries()) {
    for (const feld of ["login", "cla_version", "signed_at"]) {
      if (typeof eintrag?.[feld] !== "string" || eintrag[feld].trim() === "") {
        throw new Error(`Signatur ${i}: Feld \`${feld}\` fehlt oder ist leer.`);
      }
    }
    if (!Number.isInteger(eintrag.user_id)) {
      throw new Error(`Signatur ${i}: Feld \`user_id\` ist keine ganze Zahl.`);
    }
  }

  // Die eingebauten Ausnahmen stehen bewusst nicht in der Datei: Sonst
  // wanderten sie bei jedem Schreibvorgang erneut hinein und die Liste
  // verdoppelte sich. Was in der Datei steht, ist eine Entscheidung; was hier
  // steht, ist eine Bauart.
  return {
    cla_version: version,
    allowlist: allowlist ?? [],
    wirksameAllowlist: [...STANDARD_ALLOWLIST, ...(allowlist ?? [])],
    signatures,
  };
}

/**
 * Liegt fuer dieses Konto eine Zustimmung zur geltenden Fassung vor?
 *
 * Verglichen wird ueber `user_id`, nicht ueber den Anmeldenamen: Ein Konto darf
 * umbenannt werden, und der alte Name kann anschliessend von jemand anderem
 * belegt werden. Ein Namensvergleich raeumte diesem Jemand die Zustimmung des
 * Vorgaengers ein. Der Anmeldename steht trotzdem mit in der Datei, weil ein
 * Nachweis, den niemand lesen kann, keiner ist.
 *
 * Die Allowlist wird ueber den Namen geprueft, weil Bots keine stabile ID
 * haben, die vorab bekannt waere.
 *
 * @param {{ login: string, user_id: number }} konto
 * @param {Zustimmungsbestand} bestand
 * @returns {boolean}
 */
export function istGezeichnet(konto, bestand) {
  const login = String(konto.login ?? "").toLowerCase();

  if (
    bestand.wirksameAllowlist.some((eintrag) => eintrag.toLowerCase() === login)
  ) {
    return true;
  }

  return bestand.signatures.some(
    (signatur) =>
      signatur.user_id === konto.user_id &&
      signatur.cla_version === bestand.cla_version,
  );
}

/**
 * Ergaenzt eine Zustimmung und gibt den neuen Bestand zurueck.
 *
 * Aendert den uebergebenen Bestand nicht. Eine bereits vorhandene Zustimmung
 * derselben Person zur selben Fassung wird nicht verdoppelt -- ein zweiter
 * Kommentar ist kein zweiter Vertrag.
 *
 * @param {Zustimmungsbestand} bestand
 * @param {Signatur} signatur
 * @returns {{ bestand: Zustimmungsbestand, ergaenzt: boolean }}
 */
export function signaturErgaenzen(bestand, signatur) {
  if (istGezeichnet(signatur, bestand)) {
    return { bestand, ergaenzt: false };
  }

  return {
    bestand: { ...bestand, signatures: [...bestand.signatures, signatur] },
    ergaenzt: true,
  };
}
