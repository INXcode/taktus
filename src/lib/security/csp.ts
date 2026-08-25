/**
 * Die Content-Security-Policy.
 *
 * Sie steht hier als reine Funktion und nicht in `next.config.ts`, weil sie
 * eine **Nonce je Anfrage** trägt -- ein statischer Header kann das nicht.
 * `src/proxy.ts` ruft sie auf; die übrigen fünf Sicherheits-Header bleiben in
 * `next.config.ts`, und beide Dateien verweisen aufeinander.
 *
 * Als Funktion, weil sie damit prüfbar ist: Eine Richtlinie, die niemand
 * gegenlesen kann, ohne den Browser zu öffnen, ist eine Behauptung.
 */

export type CspOptions = {
  /** Zufallswert je Anfrage. Ohne ihn bliebe die Seite weiss. */
  readonly nonce: string;
  /** Basisadresse der Supabase-API -- der einzige fremde Ursprung. */
  readonly supabaseOrigin: string;
  readonly isDevelopment: boolean;
};

/**
 * > [!important] Warum Skripte eine Nonce brauchen und nicht `'unsafe-inline'`
 * > genügt -- und warum ohne sie die Seite weiss bleibt.
 * > Der App Router streamt seine Nutzlast über eingebettete
 * > `<script>self.__next_f.push(…)</script>`. Mit `script-src 'self'` allein
 * > werden sie blockiert, und es erscheint nichts. Next liest die Nonce aus
 * > dem `Content-Security-Policy`-Header der **eingehenden** Anfrage und
 * > stempelt sie auf die eigenen Skripte -- deshalb setzt der Proxy den
 * > Header auf Anfrage **und** Antwort.
 * >
 * > `'strict-dynamic'` ist nötig, damit der genoncte Bootstrap die gehashten
 * > Bündel nachladen darf. Es hebt `'self'` in modernen Browsern auf; die
 * > Angabe bleibt trotzdem stehen, weil ältere Browser `'strict-dynamic'`
 * > nicht kennen und dann auf `'self'` zurückfallen.
 */
export function contentSecurityPolicy(options: CspOptions): string {
  const { nonce, supabaseOrigin, isDevelopment } = options;

  const directives: readonly (readonly [string, readonly string[]])[] = [
    ["default-src", ["'self'"]],

    [
      "script-src",
      [
        "'self'",
        `'nonce-${nonce}'`,
        "'strict-dynamic'",
        // React baut in der Entwicklung Server-Fehlerspuren im Browser nach
        // und benutzt dafür `eval`. In der Produktion tut das weder React
        // noch Next -- die Ausnahme bleibt deshalb auf die Entwicklung
        // beschränkt.
        ...(isDevelopment ? ["'unsafe-eval'"] : []),
      ],
    ],

    /*
     * Stilelemente bekommen die Nonce, Stil-**Attribute** bleiben offen.
     *
     * Die Trennung ist der eigentliche Punkt: Ein eingeschleustes
     * `<style>`-Element wird blockiert, denn es trägt keine Nonce. Offen
     * bleibt nur `style="…"` am Element -- und darauf ist die Anwendung
     * angewiesen: Die Spaltenvorlage jeder Liste, die Schraffur der
     * KI-Kennzeichnung und der Pfeil des Auswahlfelds stehen als Attribut.
     *
     * Ohne die zweite Zeile wäre die erste **strenger als gedacht**: Sobald
     * `style-src` eine Nonce trägt, entfällt der stillschweigende Rückfall
     * für Attribute, und die Anwendung sähe kaputt aus. Die Zeile ist also
     * keine Aufweichung, sondern die Wiederherstellung dessen, was ohne
     * Nonce ohnehin gälte -- bei gleichzeitig strengerer Regel für Elemente.
     *
     * In der Entwicklung fügt Next die Stile über JavaScript ein, ohne
     * Nonce. Dort bleibt es bei `'unsafe-inline'`; die Produktion ist der
     * Fall, der zählt.
     */
    [
      "style-src",
      isDevelopment
        ? ["'self'", "'unsafe-inline'"]
        : ["'self'", `'nonce-${nonce}'`],
    ],
    ["style-src-attr", ["'unsafe-inline'"]],

    // `data:` trägt den Pfeil des Auswahlfelds -- ein Data-URI statt eines
    // externen Bildes, genau damit diese Zeile kurz bleiben kann.
    ["img-src", ["'self'", "data:"]],

    // Die Schriften liegen unter `public/fonts/` und werden selbst
    // ausgeliefert. Kein Google Fonts, keine fremde Herkunft.
    ["font-src", ["'self'"]],

    /*
     * Der einzige fremde Ursprung im ganzen Dokument.
     *
     * Er steht hier, weil der Browser-Client von Supabase Anmeldung und
     * Abfragen direkt gegen die API richtet. Dass es genau ein Eintrag ist,
     * ist die Aussage: Wohin diese Anwendung Daten schickt, steht in einer
     * Zeile und lässt sich in einer Zeile prüfen.
     */
    ["connect-src", ["'self'", supabaseOrigin]],

    /*
     * Kein Einbetten, kein Eingebettetwerden, keine Plug-ins.
     *
     * > [!note] `frame-src 'none'` sperrt **keine** Browsererweiterung aus.
     * > Die Vermutung stand hier einmal: Ein Passwortmanager füllte nichts
     * > mehr aus, und die Richtlinie schien der naheliegende Grund -- ein
     * > Auswahlmenü ist ein Iframe. Sie war falsch. Erweiterungen bauen ihre
     * > Oberfläche aus einer isolierten Welt, und die ist von der Seiten-CSP
     * > nicht betroffen; das Menü erschien unverändert. Die Ursache lag
     * > ausserhalb der Anwendung.
     * >
     * > Der Hinweis steht hier, damit nicht der nächste Mensch dieselbe
     * > plausible Fährte aufnimmt und die Richtlinie dafür öffnet.
     */
    ["frame-ancestors", ["'none'"]],
    ["frame-src", ["'none'"]],
    ["object-src", ["'none'"]],

    // `base-uri 'none'` und nicht `'self'`: Ein eingeschleustes `<base>`
    // könnte jeden relativen Verweis umlenken, und die Anwendung braucht
    // das Element nirgends.
    ["base-uri", ["'none'"]],

    // Formulare gehen ausschliesslich an die eigene Herkunft. Ohne diese
    // Zeile liesse sich ein Formular auf einen fremden Empfänger umbiegen --
    // mitsamt dem, was jemand hineingeschrieben hat.
    ["form-action", ["'self'"]],

    ["manifest-src", ["'self'"]],
    ["worker-src", ["'self'", "blob:"]],
  ];

  const policy = directives
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");

  /*
   * `upgrade-insecure-requests` -- in der Produktion, und nur dort.
   *
   * > [!warning] Die frühere Annahme „lokal folgenlos" war falsch, und zwar
   * > nachweislich.
   * > Die Richtlinie weist den Browser an, jede unsichere Unteranfrage auf
   * > `https` anzuheben. Die Spezifikation nimmt vertrauenswürdige Ursprünge
   * > davon aus, und `localhost` ist einer -- Chromium hält sich daran.
   * >
   * > **WebKit tut das nicht.** In Safari werden auf einem lokalen
   * > Entwicklungsserver sämtliche Unteranfragen auf `https://localhost:3100`
   * > angehoben, wo kein TLS lauscht: Stylesheet, Schriften und jedes
   * > JavaScript-Bündel scheitern mit einem TLS-Fehler. Die Seite kommt
   * > ungestaltet und ohne Interaktion -- und in der Serverausgabe steht
   * > nichts, weil die Anfragen den Server nie erreichen.
   *
   * Über HTTPS ist die Zeile sinnvoll und bleibt. Auf einem HTTP-Server hat
   * sie ohnehin nichts anzuheben, wogegen sie sich anheben liesse -- der
   * Verzicht kostet also keine Sicherheit, sondern nur einen ganzen
   * Nachmittag Fehlersuche weniger.
   */
  return isDevelopment ? policy : `${policy}; upgrade-insecure-requests`;
}

/**
 * Der Ursprung der Supabase-Adresse, ohne Pfad.
 *
 * `connect-src` will Schema, Host und Port -- ein mitgeschleppter Pfad macht
 * die Angabe enger als gemeint und wirft die Abfragen still heraus. Bei einer
 * unbrauchbaren Adresse bleibt die Richtlinie lieber ohne diesen Eintrag:
 * Dann scheitern die Abfragen sichtbar, statt dass ein `*` durchrutscht.
 */
export function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
