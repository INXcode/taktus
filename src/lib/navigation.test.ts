import { describe, expect, it } from "vitest";
import { navigationForRole, tabsForRole } from "@/lib/navigation";
import { paths } from "@/lib/paths";
import { type AppRole } from "@/types";

const ROLES: readonly AppRole[] = ["admin", "agent", "requester"];

function allHrefs(role: AppRole): readonly string[] {
  return navigationForRole(role).flatMap((group) =>
    group.items.map((item) => item.href),
  );
}

/**
 * Diese Datei ist die maschinelle Fassung einer Entwurfsregel:
 *
 * > Was eine Rolle nicht darf, steht nicht da — auch nicht ausgegraut.
 *
 * Sie ersetzt keine Zugriffskontrolle. Die leistet `requireRole()` in jeder
 * Seite und darunter die RLS. Was sie verhindert, ist das stille Abrutschen
 * der Oberfläche in ein „zeigen und beim Klick ablehnen" -- ein Muster, das
 * niemandem auffällt, weil es sich richtig anfühlt.
 */
describe("navigationForRole", () => {
  it("gibt dem Melder keinen Zugang zur Zeiterfassung", () => {
    const hrefs = allHrefs("requester");
    expect(hrefs).not.toContain(paths.myTime);
    expect(hrefs).not.toContain(paths.tenantTime);
    expect(hrefs).not.toContain(paths.customerTime);
  });

  it("gibt dem Melder keinen Zugang zur Verwaltung", () => {
    const hrefs = allHrefs("requester");
    for (const guarded of [
      paths.customers,
      paths.members,
      paths.tenantSettings,
      paths.auditLog,
    ]) {
      expect(hrefs).not.toContain(guarded);
    }
  });

  /*
   * Der Kundenstamm gehört der Verwaltung. Ein Bearbeiter darf den Kunden
   * eines Tickets setzen, aber keinen anlegen -- die Policy
   * `customers_insert_admin` sagt das, und die Navigation darf nichts anderes
   * versprechen.
   */
  it("zeigt den Kundenstamm nur der Verwaltung", () => {
    expect(allHrefs("admin")).toContain(paths.customers);
    expect(allHrefs("agent")).not.toContain(paths.customers);
    expect(allHrefs("requester")).not.toContain(paths.customers);
  });

  it("zeigt dem Melder genau zwei Punkte, ohne Abschnittsüberschrift", () => {
    const groups = navigationForRole("requester");
    expect(groups).toHaveLength(1);
    expect(groups[0]?.title).toBeUndefined();
    expect(groups[0]?.items).toHaveLength(2);
  });

  it("gibt dem Bearbeiter keinen Abschnitt „Verwaltung“", () => {
    const groups = navigationForRole("agent");
    expect(groups.map((group) => group.title)).toEqual(["Arbeit"]);
    const hrefs = allHrefs("agent");
    for (const guarded of [
      paths.customers,
      paths.members,
      paths.tenantSettings,
      paths.auditLog,
    ]) {
      expect(hrefs).not.toContain(guarded);
    }
  });

  it("gibt der Verwaltung beide Abschnitte", () => {
    const groups = navigationForRole("admin");
    expect(groups.map((group) => group.title)).toEqual([
      "Arbeit",
      "Verwaltung",
    ]);
    expect(allHrefs("admin")).toContain(paths.auditLog);
  });

  it.each(ROLES)("führt für %s keinen Punkt doppelt", (role) => {
    const hrefs = allHrefs(role);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it.each(ROLES)("beschriftet für %s jeden Punkt", (role) => {
    for (const group of navigationForRole(role)) {
      for (const item of group.items) {
        expect(item.label.trim()).not.toBe("");
        expect(item.href.startsWith("/")).toBe(true);
      }
    }
  });
});

describe("tabsForRole", () => {
  it("gibt dem Melder zwei Ziele, keines davon Zeiten", () => {
    const tabs = tabsForRole("requester");
    expect(tabs).toHaveLength(2);
    expect(tabs.map((tab) => tab.href)).not.toContain(paths.myTime);
  });

  it.each(["admin", "agent"] as const)(
    "gibt %s drei Ziele, davon „Mehr“ ohne Adresse",
    (role) => {
      const tabs = tabsForRole(role);
      expect(tabs).toHaveLength(3);
      expect(tabs.at(-1)?.href).toBeNull();
    },
  );
});
