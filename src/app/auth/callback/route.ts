import { NextResponse, type NextRequest } from "next/server";
import { paths, safeRedirectTarget } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";

/**
 * Rückkehr aus einem Link in einer E-Mail.
 *
 * Der Auth-Server hängt je nach Ablauf entweder `code` (PKCE, der Normalfall
 * bei `@supabase/ssr`) oder `token_hash` samt `type` an. Beide Wege werden
 * bedient, weil ein Wechsel der Vorlage sonst still die Passwortvergabe
 * bräche.
 *
 * Das Ziel läuft durch `safeRedirectTarget`. Der Parameter kommt aus einer
 * URL, die in einer E-Mail steht -- also aus der am leichtesten fälschbaren
 * Quelle, die diese Anwendung hat.
 *
 * ---------------------------------------------------------------------------
 * Zu den `codeql`-Ausnahmen weiter unten
 *
 * CodeQL meldet beide Verzweigungen als `js/user-controlled-bypass`: Eine
 * Bedingung, die ein Nutzerwert steuert, steht vor etwas Sicherheitsrelevantem.
 * Formal stimmt das -- inhaltlich ist es hier keine Prüfung.
 *
 * Die Abfragen entscheiden, **welcher** Rückkehrweg vorliegt, nicht **ob**
 * jemand darf. Geprüft wird eine Zeile später, und zwar vom Auth-Server:
 * `exchangeCodeForSession` und `verifyOtp` nehmen den Wert entgegen und geben
 * einen Fehler zurück, wenn er nicht stimmt. Beide Fehlerpfade landen auf
 * `?link=ungueltig` -- ein erfundener `code` kommt also nicht weiter als ein
 * fehlender.
 *
 * Ein Angreifer gewönne durch die Bedingung nichts, was ihm der Auth-Server
 * nicht ohnehin verweigert. Fiele sie weg, liefe jede Anfrage in denselben
 * `verifyOtp`-Aufruf mit leerem Token.
 *
 * Die Befunde stehen deshalb als begründete Ausnahme in
 * `scripts/sarif.mjs`, `BEGRUENDETE_AUSNAHMEN` -- samt erwarteter Anzahl, die
 * einen vierten Befund an dieser Stelle auffallen liesse. Ein
 * `// codeql[...]`-Kommentar an der Fundstelle wäre der naheliegendere Weg
 * und wurde erprobt: Er wirkt hier nicht.
 * ---------------------------------------------------------------------------
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const target = safeRedirectTarget(
    searchParams.get("weiter"),
    paths.resetPassword,
  );

  const supabase = await createClient();

  const code = searchParams.get("code");
  // Weichenstellung, keine Autorisierung -- geprüft wird eine Zeile tiefer.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`${paths.login}?link=ungueltig`, request.url),
      );
    }
    return NextResponse.redirect(new URL(target, request.url));
  }

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  // Ebenso: Der Typ wählt das Verfahren, `verifyOtp` prüft das Token.
  if (tokenHash && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: tokenHash,
    });
    if (error) {
      return NextResponse.redirect(
        new URL(`${paths.login}?link=ungueltig`, request.url),
      );
    }
    return NextResponse.redirect(new URL(target, request.url));
  }

  return NextResponse.redirect(
    new URL(`${paths.login}?link=ungueltig`, request.url),
  );
}
