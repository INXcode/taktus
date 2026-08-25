"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { changedFields, logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guard";
import { siteUrl } from "@/lib/env";
import { mapDatabaseError } from "@/lib/errors";
import { paths } from "@/lib/paths";
import { fail, fieldFail, ok } from "@/lib/result";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  anonymizeMemberSchema,
  createMemberSchema,
  setDeactivatedSchema,
  updateMemberRoleSchema,
} from "@/lib/validation/profile";
import { type FormResult } from "@/types";

/**
 * Nutzerverwaltung -- Bildschirme 15 bis 17. Nur `admin`.
 *
 * Die riskanteste Datei des Projekts: Zwei Vorgänge brauchen den
 * Service-Role-Schlüssel, und der **umgeht sämtliche RLS-Policies**. Wo er
 * eingesetzt wird, steht die Mandantenprüfung ausgeschrieben daneben -- die
 * Datenbank hilft dort nicht mehr.
 */

/**
 * Prüft, dass ein Profil zum Mandanten des Aufrufers gehört.
 *
 * Läuft über den **normalen** Client, also unter RLS: Findet er die Zeile
 * nicht, gehört sie nicht zu diesem Mandanten (oder es gibt sie nicht) --
 * beides bedeutet „nicht anfassen". Diese Prüfung ist die Voraussetzung für
 * jeden nachfolgenden Aufruf mit dem Admin-Client.
 */
async function assertOwnTenant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
): Promise<{
  readonly displayName: string;
  readonly role: string;
  readonly customerId: string | null;
} | null> {
  const { data } = await supabase
    .from("profiles")
    .select("display_name, role, customer_id")
    .eq("id", profileId)
    .maybeSingle();

  return data === null
    ? null
    : {
        displayName: data.display_name,
        role: data.role,
        customerId: data.customer_id,
      };
}

export async function createMember(
  _previous: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  const viewer = await requireRole(["admin"]);

  const parsed = createMemberSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    role: formData.get("role"),
    customerId: formData.get("customerId") ?? "",
  });
  if (!parsed.success) return fieldFail(parsed.error);

  /*
   * Der Kunde wird VOR dem Admin-Client geprüft, und das ist keine Formsache.
   *
   * Das Profil entsteht unten mit `admin.from("profiles").insert(...)` -- also
   * unter Umgehung sämtlicher Policies. Der zusammengesetzte Fremdschlüssel
   * `(tenant_id, customer_id)` fängt eine fremde Kundenkennung zwar weiterhin
   * ab, aber mit einem Datenbankfehler statt einer Meldung am Feld. Die
   * Prüfung hier läuft über den **normalen** Client und damit unter RLS:
   * Findet er den Kunden nicht, gehört er nicht zu diesem Mandanten.
   */
  const supabaseGeprueft = await createClient();
  if (parsed.data.customerId !== null) {
    const { data: kunde } = await supabaseGeprueft
      .from("customers")
      .select("id")
      .eq("id", parsed.data.customerId)
      .maybeSingle();

    if (!kunde) {
      return {
        ok: false,
        error: "Dieser Kunde ist nicht erreichbar.",
        fields: { customerId: "Bitte einen Kunden dieses Mandanten wählen." },
      };
    }
  }

  // Selbstregistrierung ist abgeschaltet (`enable_signup = false`), Konten
  // entstehen also ausschliesslich hier -- und dafür braucht es die
  // Verwaltungsschnittstelle. Der Aufruf ist durch `requireRole(["admin"])`
  // oben gedeckt; die neue Zeile bekommt den Mandanten des Aufrufers, nicht
  // einen mitgeschickten.
  const admin = createAdminClient();

  /*
   * Vorhandene Adresse abfangen, BEVOR GoTrue sie zu sehen bekommt.
   *
   * `inviteUserByEmail` legt nicht immer ein neues Konto an: Ist die Adresse
   * bereits vergeben, aber noch nicht bestätigt -- also jemand, der in einem
   * ANDEREN Mandanten eingeladen wurde und den Link noch nicht angeklickt hat
   * --, antwortet GoTrue mit HTTP 200 und der Kennung des **bestehenden**
   * Kontos, verschickt die Einladung erneut und rotiert dabei den
   * Bestätigungstoken. Nur eine bestätigte Adresse erzeugt `email_exists`.
   *
   * Ohne diese Prüfung liefe der Vorgang weiter auf einem fremden Konto: Der
   * Profil-Insert unten scheitert dann am Primärschlüssel, und das Aufräumen
   * löschte ein Konto, das dieser Aufruf nie angelegt hat. Über
   * `ON DELETE CASCADE` risse das die Profilzeile des fremden Mandanten mit.
   *
   * Die Prüfung liegt in der Datenbank, weil sie nur dort hingehört:
   * `auth.users` ist über PostgREST bewusst nicht freigegeben, und auth-js
   * kann Nutzer nur seitenweise auflisten, nicht nach Adresse filtern. Die
   * Funktion ist ausschliesslich `service_role` zugänglich -- für eine
   * Anwendungsrolle wäre sie ein Orakel über den gesamten Instanzbestand.
   */
  const { data: adresseVergeben, error: pruefFehler } = await admin.rpc(
    "auth_email_vergeben",
    { p_email: parsed.data.email },
  );

  if (pruefFehler || adresseVergeben === null) {
    console.error("Adressprüfung fehlgeschlagen", { code: pruefFehler?.code });
    return fail("Die Einladung konnte nicht versendet werden.");
  }

  if (adresseVergeben) {
    // Dieselbe Meldung wie bei einem Fehlschlag der Einladung. Sie sagt nicht,
    // ob das Konto zu diesem Mandanten gehört -- das ginge den Aufrufer nichts
    // an, denn auth.users kennt keine Mandantengrenze.
    return {
      ok: false,
      error: "Die Einladung konnte nicht versendet werden.",
      fields: { email: "Diese Adresse ist bereits vergeben." },
    };
  }

  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      redirectTo: `${siteUrl()}${paths.authCallback}?weiter=${encodeURIComponent(paths.resetPassword)}`,
    });

  if (inviteError || !invited.user) {
    // Keine Adresse ins Protokoll -- sie ist personenbezogen.
    console.error("Einladung fehlgeschlagen", { code: inviteError?.code });
    return {
      ok: false,
      error:
        "Die Einladung konnte nicht versendet werden. Möglicherweise ist die Adresse bereits vergeben.",
      fields: { email: "Bitte eine andere Adresse verwenden." },
    };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: invited.user.id,
    tenant_id: viewer.tenantId,
    role: parsed.data.role,
    display_name: parsed.data.displayName,
    customer_id: parsed.data.customerId,
  });

  if (profileError) {
    // Das Anmeldekonto steht schon, das Profil nicht -- ohne Aufräumen bliebe
    // ein Konto ohne Mandanten zurück, das sich nirgends mehr zeigt.
    //
    // Aufgeräumt wird aber NUR, was dieser Aufruf angelegt hat. Ein
    // Schlüsselkonflikt (23505) bedeutet, dass zu dieser Kennung schon ein
    // Profil existiert -- das Konto gehört dann jemand anderem, und Löschen
    // wäre ein Eingriff in einen fremden Mandanten. Die Adressprüfung oben
    // fängt diesen Fall bereits ab; das hier ist die zweite Schranke für den
    // Fall, dass zwischen Prüfung und Insert ein Konto entsteht.
    if (profileError.code !== "23505") {
      await admin.auth.admin.deleteUser(invited.user.id);
    }
    console.error("Profil konnte nicht angelegt werden", {
      code: profileError.code,
    });
    return fail(mapDatabaseError(profileError));
  }

  await logAudit(
    supabaseGeprueft,
    "profile.create",
    "profile",
    invited.user.id,
  );

  revalidatePath(paths.members);
  redirect(paths.members);
}

export async function updateMemberRole(
  _previous: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  const viewer = await requireRole(["admin"]);

  const parsed = updateMemberRoleSchema.safeParse({
    profileId: formData.get("profileId"),
    role: formData.get("role"),
    // Der Kunde gehört zur Rolle: Ein Melder braucht einen, Bearbeitung und
    // Verwaltung dürfen keinen haben. Das Schema prüft beide Richtungen, der
    // `CHECK` in der Datenbank ebenfalls -- ein Rollenwechsel ohne den Kunden
    // im selben Zug scheiterte sonst mit einer PostgREST-Meldung.
    customerId: formData.get("customerId") ?? "",
  });
  if (!parsed.success) return fieldFail(parsed.error);

  const supabase = await createClient();
  const target = await assertOwnTenant(supabase, parsed.data.profileId);
  if (!target) return fail("Dieser Nutzer ist nicht erreichbar.");

  /*
   * Die letzte Verwaltung darf nicht verschwinden.
   *
   * Die Datenbank erzwingt das NICHT -- eine Bedingung über mehrere Zeilen
   * hinweg lässt sich als CHECK nicht formulieren, und ein Trigger dafür wäre
   * eine Regel an einem Ort, an dem sie niemand vermutet. Sie steht deshalb
   * hier, ausgeschrieben.
   *
   * Ein Mandant ohne Administrator ist aus der Anwendung heraus nicht mehr zu
   * reparieren: Niemand könnte mehr Rollen vergeben, Nutzer anlegen oder
   * die Einstellungen ändern. Nur der Instanzbetreiber käme noch heran.
   */
  if (target.role === "admin" && parsed.data.role !== "admin") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .is("deactivated_at", null);

    if ((count ?? 0) <= 1) {
      return fail(
        "Das ist die letzte Verwaltung dieses Mandanten. Bitte zuerst jemand anderem die Verwaltung geben.",
      );
    }
  }

  const patch = {
    role: parsed.data.role,
    customer_id: parsed.data.customerId,
  };

  // Ein Kunde aus einem fremden Mandanten kommt hier nicht durch: Das UPDATE
  // läuft über den normalen Client, und der zusammengesetzte Fremdschlüssel
  // `(tenant_id, customer_id)` weist ihn ab.
  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", parsed.data.profileId);

  if (error) {
    console.error("Rolle konnte nicht geändert werden", { code: error.code });
    return fail(mapDatabaseError(error));
  }

  await logAudit(
    supabase,
    "profile.update",
    "profile",
    parsed.data.profileId,
    changedFields({ role: target.role, customer_id: target.customerId }, patch),
  );

  revalidatePath(paths.members);
  revalidatePath(paths.member(parsed.data.profileId));
  void viewer;
  return ok(undefined);
}

export async function setMemberDeactivated(
  _previous: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  const viewer = await requireRole(["admin"]);

  const parsed = setDeactivatedSchema.safeParse({
    profileId: formData.get("profileId"),
    deactivated: formData.get("deactivated"),
  });
  if (!parsed.success) return fieldFail(parsed.error);

  if (parsed.data.profileId === viewer.userId) {
    return fail(
      "Sie können sich nicht selbst deaktivieren — damit verlören Sie sofort den Zugang.",
    );
  }

  const supabase = await createClient();
  const target = await assertOwnTenant(supabase, parsed.data.profileId);
  if (!target) return fail("Dieser Nutzer ist nicht erreichbar.");

  const deaktivieren = parsed.data.deactivated === "ja";

  // Dieselbe Überlegung wie beim Rollenwechsel: Eine deaktivierte Verwaltung
  // ist keine -- `current_app_role()` liefert für sie NULL.
  if (deaktivieren && target.role === "admin") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .is("deactivated_at", null);

    if ((count ?? 0) <= 1) {
      return fail(
        "Das ist die letzte aktive Verwaltung dieses Mandanten. Bitte zuerst jemand anderem die Verwaltung geben.",
      );
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ deactivated_at: deaktivieren ? new Date().toISOString() : null })
    .eq("id", parsed.data.profileId);

  if (error) {
    console.error("Zustand konnte nicht geändert werden", { code: error.code });
    return fail(mapDatabaseError(error));
  }

  await logAudit(supabase, "profile.update", "profile", parsed.data.profileId, [
    "deactivated_at",
  ]);

  revalidatePath(paths.members);
  revalidatePath(paths.member(parsed.data.profileId));
  return ok(undefined);
}

/**
 * Anonymisieren -- dauerhaft.
 *
 * > [!danger] Hier hilft die Datenbank nicht.
 * >
 * > `anonymize_profile` ist `SECURITY DEFINER` und **ausschliesslich an
 * > `service_role` vergeben**. Der Aufruf läuft also über den Admin-Client,
 * > der sämtliche RLS-Policies umgeht -- und die Funktion selbst prüft
 * > keinen Mandanten, sie ändert das Profil mit der übergebenen Kennung.
 * >
 * > Ohne die Prüfung unten könnte die Verwaltung eines Mandanten ein Profil
 * > eines **fremden** Mandanten anonymisieren, sofern sie dessen Kennung
 * > kennt oder errät. Die Prüfung läuft deshalb vorher über den normalen
 * > Client, also unter RLS: Findet der die Zeile nicht, gehört sie nicht
 * > hierher.
 */
export async function anonymizeMember(
  _previous: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  const viewer = await requireRole(["admin"]);

  const parsed = anonymizeMemberSchema.safeParse({
    profileId: formData.get("profileId"),
    confirmation: formData.get("confirmation") ?? "",
  });
  if (!parsed.success) return fieldFail(parsed.error);

  if (parsed.data.confirmation !== "anonymisieren") {
    return {
      ok: false,
      error: "Es wurde nichts geändert.",
      fields: { confirmation: "Bitte „anonymisieren“ eintippen." },
    };
  }

  if (parsed.data.profileId === viewer.userId) {
    return fail("Sie können sich nicht selbst anonymisieren.");
  }

  const supabase = await createClient();

  // DIE Prüfung. Sie steht vor jedem Aufruf mit dem Admin-Client und ist der
  // einzige Grund, warum dieser Vorgang die Mandantengrenze nicht überschreiten
  // kann.
  const target = await assertOwnTenant(supabase, parsed.data.profileId);
  if (!target) return fail("Dieser Nutzer ist nicht erreichbar.");

  if (target.role === "admin") {
    return fail(
      "Eine Verwaltung lässt sich nicht anonymisieren. Bitte zuerst die Rolle ändern.",
    );
  }

  // Vorher protokollieren: Danach ist der Bezug zur Person gelöst, und ein
  // Eintrag mit `actor_id` würde beim Anonymisieren gleich mit entwertet.
  await logAudit(
    supabase,
    "profile.anonymize",
    "profile",
    parsed.data.profileId,
    ["display_name", "deactivated_at"],
  );

  const admin = createAdminClient();
  const { error } = await admin.rpc("anonymize_profile", {
    p_profile_id: parsed.data.profileId,
  });

  if (error) {
    console.error("Anonymisierung fehlgeschlagen", { code: error.code });
    return fail(mapDatabaseError(error));
  }

  revalidatePath(paths.members);
  revalidatePath(paths.member(parsed.data.profileId));
  return ok(undefined);
}
