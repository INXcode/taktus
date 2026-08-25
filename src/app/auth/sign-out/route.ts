import { signOut } from "@/actions/auth";

/**
 * Abmelden.
 *
 * Nur `POST`, und das ist keine Förmlichkeit: Ein Abmelden per `GET` liesse
 * sich über ein fremdes `<img src="…/sign-out">` auslösen. Der Schaden wäre
 * gering, der Ärger für den Betroffenen nicht -- und ein zustandsändernder
 * `GET` ist ohnehin die Art von Detail, an der ein Prüfer die Sorgfalt des
 * Übrigen abliest.
 *
 * Die Rollenprüfung steht in der Action, nicht hier.
 */
export async function POST() {
  await signOut();
}
