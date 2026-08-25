import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { isPublicPath, paths } from "@/lib/paths";
import { type Database } from "@/types/database";

/**
 * Frischt die Sitzung auf und leitet Unangemeldete zur Anmeldung.
 *
 * Aufgerufen ausschließlich aus `src/proxy.ts`. Was diese Funktion
 * **nicht** tut, steht dort begründet: Sie prüft keine Rolle.
 */
export async function updateSession(
  request: NextRequest,
  /**
   * Die Anfrage-Header, die an die Anwendung weitergereicht werden.
   *
   * Sie tragen `Content-Security-Policy` und `x-nonce`. Next liest die Nonce
   * beim Rendern von dort -- gingen sie hier verloren, bekämen die
   * eingebetteten Skripte des App Routers keine Nonce, würden blockiert, und
   * die Seite bliebe weiss. Deshalb muss **jedes** `NextResponse.next()` in
   * dieser Funktion sie mitgeben, auch das nach dem Cookie-Schreiben.
   */
  requestHeaders: Headers,
) {
  // Die Antwort wird vor dem Client erzeugt, weil `setAll` in sie hinein
  // schreibt. Sie später neu zu bauen, verwürfe die aufgefrischten Cookies --
  // ein Fehler, der sich als sporadisches Abmelden zeigt und deshalb schwer
  // zu finden ist.
  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient<Database>(
    supabaseUrl(),
    supabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // Cache-Control und Verwandte, die die Bibliothek mitgibt. Ohne sie
          // darf ein CDN eine Antwort mit Set-Cookie zwischenspeichern und
          // liefert die Sitzung des einen Nutzers an den nächsten aus.
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // `getUser()` und nicht `getSession()`: getSession liest das Cookie, ohne
  // es zu prüfen. Für eine Anzeige mag das genügen, für eine Entscheidung nie
  // -- ein Cookie ist Nutzereingabe. getUser fragt den Auth-Server und ist
  // damit die einzige belastbare Auskunft darüber, wer da ist.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const target = request.nextUrl.clone();
    target.pathname = paths.login;
    target.search = "";
    // Der gewünschte Pfad wandert mit, damit die Anmeldung dorthin
    // zurückführt statt auf eine Startseite.
    if (pathname !== "/") {
      target.searchParams.set("weiter", pathname);
    }
    return NextResponse.redirect(target);
  }

  return response;
}
