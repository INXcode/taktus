# syntax=docker/dockerfile:1.7

# ============================================================
# Taktus Kontor -- Abbild fuer den Containerbetrieb
# ============================================================
# Next.js laeuft als Node-Standalone-Server. Kein Vercel, keine Edge
# Runtime -- die Begruendung steht in docs/architektur.md.
#
# Gebaut wird in vier Stufen. Das Laufzeit-Abbild enthaelt am Ende weder
# den Quelltext noch die Entwicklungsabhaengigkeiten, sondern nur, was
# `next build` unter `.next/standalone` zusammengestellt hat.
# ============================================================

# Node 24 ist in `.nvmrc` und in `engines` festgelegt (>=24.0.0).
# `-slim` statt `-alpine`: Alpine bringt musl statt glibc mit, und die
# vorkompilierten Binaerdateien einiger Abhaengigkeiten setzen glibc
# voraus. Der Groessenvorteil von Alpine ist den Klassen von Fehlern
# nicht wert, die erst zur Laufzeit auftreten.
FROM node:24-bookworm-slim AS base
# Corepack liest die Version aus `packageManager` in package.json und
# benutzt genau sie. Ein global installiertes pnpm waere eine zweite,
# stillschweigend abweichende Quelle.
RUN corepack enable
WORKDIR /app


# ---------- Abhaengigkeiten ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# `--frozen-lockfile` bricht ab, wenn die Sperrdatei nicht zum Manifest
# passt, statt sie stillschweigend zu aktualisieren. Ein Build, der die
# Abhaengigkeiten selbst neu aufloest, baut nicht mehr das, was geprueft
# wurde.
#
# pnpm-workspace.yaml wird mitkopiert, obwohl dies kein Monorepo ist:
# Darin steht, welche Installationsskripte laufen duerfen
# (docs/security.md, Kapitel D). Fehlt die Datei, faellt die Entscheidung
# anders aus als lokal und in der CI.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile


# ---------- Bau ----------
FROM base AS builder

# Alles mit `NEXT_PUBLIC_`-Praefix wird beim Bauen ins Client-Buendel
# eingebacken und ist zur Laufzeit nicht mehr aenderbar. Diese Werte
# muessen deshalb hier stehen und nicht erst im laufenden Container.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL

# AGPL Paragraph 13: Die Fusszeile nennt Version und Commit, damit
# erkennbar ist, welcher Stand laeuft. next.config.ts bildet `GIT_SHA` auf
# `NEXT_PUBLIC_GIT_SHA` ab und kuerzt auf sieben Zeichen -- die Variable
# heisst hier also bewusst ohne Praefix.
#
# Fehlt sie, liest die Fusszeile `0.1.0 (dev)` und verfehlt genau die
# Anforderung, wegen der sie existiert. In Coolify: `GIT_SHA=${SOURCE_COMMIT}`
# als Build-Variable.
ARG GIT_SHA

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV GIT_SHA=$GIT_SHA
ENV NEXT_TELEMETRY_DISABLED=1

# Der V8-Heap fuer den TypeScript-Schritt in `next build`. Die Vorgabe ist
# 4 GB; auf einem Server, der zugleich einen vollstaendigen Supabase-Stack
# traegt, hat das zu stillen OOM-Abbruechen gefuehrt -- Exit 255 ohne eine
# einzige Zeile Ausgabe von tsc. Wer Anwendung und Datenbank auf derselben
# Maschine betreibt, trifft dieselbe Konstellation.
ENV NODE_OPTIONS=--max-old-space-size=6144

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `pnpm build`, nicht `next build` direkt: next.config.ts liest
# `npm_package_version` fuer die Versionsangabe der Paragraph-13-Fusszeile,
# und diese Variable setzt der Paketmanager. Ein direkter Aufruf laesst
# dort `0.0.0` stehen.
RUN pnpm build


# ---------- Laufzeit ----------
FROM node:24-bookworm-slim AS runner
WORKDIR /app

# > [!warning] Die `NEXT_PUBLIC_`-Werte werden **zusaetzlich zur Laufzeit**
# > gebraucht, nicht nur beim Bauen.
# >
# > Der naheliegende Schluss -- eingebacken ist eingebacken -- trifft nicht
# > zu. Next ersetzt `process.env.NEXT_PUBLIC_X` nur bei **statischem**
# > Zugriff. `src/lib/env.ts` liest ueber `process.env[name]`, also mit einer
# > Variablen indiziert; das kann Next nicht ersetzen, und es bleibt ein
# > echter Laufzeitzugriff.
# >
# > Fehlen sie im laufenden Container, antwortet **jede** Seite mit 500:
# >
# >   Error: Umgebungsvariable NEXT_PUBLIC_SUPABASE_URL fehlt.
# >
# > Sie sind hier bewusst nicht als ENV gesetzt: ein Abbild mit
# > einkompilierter Adresse laesst sich nicht zwischen Umgebungen bewegen,
# > und der Anon-Key gehoerte damit ins Abbild. In Coolify werden sie als
# > Build- **und** Laufzeitvariable eingetragen.
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Port 3100 durchgehend, wie in package.json und docs/betrieb.md.
ENV PORT=3100
# 0.0.0.0 statt localhost -- sonst ist der Dienst ausserhalb des
# Containers nicht erreichbar, und der Fehler sieht aus wie ein
# Netzwerkproblem.
ENV HOSTNAME=0.0.0.0

# Ein eigener, rechtloser Benutzer. Der Standard waere root, und ein
# Ausbruch aus dem Prozess traefe dann auf root im Container.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs --no-create-home nextjs

# Nur diese drei Pfade. `.next/standalone` enthaelt den Server samt der
# tatsaechlich erreichbaren Abhaengigkeiten -- Quelltext und
# Entwicklungswerkzeuge bleiben draussen.
#
# > [!warning] Dateien, die zur LAUFZEIT aus dem Dateisystem gelesen
# > werden, muessen in `outputFileTracingIncludes` stehen.
# > Sonst fehlen sie ausschliesslich hier, nicht im Entwicklungsserver.
# > Derzeit braucht die Anwendung keine -- kommt eine hinzu, ist
# > next.config.ts der Ort, nicht dieses Dockerfile.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3100

# Ein gelungener Bau sagt nichts ueber einen lauffaehigen Container. Am
# 20.08.2026 lief die Demo drei Tage und zwanzig Stunden auf 503, weil eine
# Datei im getracten Ergebnis fehlte: Coolify meldete den Rollout als
# `finished`, und der Container starb erst danach in einer Neustartschleife.
#
# Mit diesem HEALTHCHECK faellt derselbe Fall beim Ausrollen auf. Coolify
# wartet auf das Ergebnis und rollt bei `unhealthy` auf den vorherigen
# Container zurueck, statt die Domain auf 503 laufen zu lassen -- aus
# `ApplicationDeploymentJob.php`:
#
#   'New container is not healthy, rolling back to the old container.'
#   $this->failDeployment();
#
# > [!warning] Die Optionen sind nicht kosmetisch
# > Coolify uebernimmt einen eigenen HEALTHCHECK nur, wenn mindestens eine der
# > Optionen `--interval`, `--timeout`, `--start-period` oder `--retries`
# > danebensteht -- sonst bleibt `custom_healthcheck_found` falsch und die
# > Pruefung existiert nur scheinbar. Ebenso muss Coolifys EIGENER Health-Check
# > in der Oberflaeche abgeschaltet bleiben: Er ruft `curl` beziehungsweise
# > `wget` auf, und beides fehlt in `node:24-bookworm-slim` bewusst. Waere er
# > eingeschaltet, schluege er immer fehl und kippte jedes Deployment.
#
# Deshalb `node` statt `curl`: Es ist ohnehin im Abbild, und ein Paketmanager
# im Laufzeit-Abbild waere Angriffsflaeche fuer eine einzige HTTP-Anfrage.
#
# Geprueft wird `/login`, weil die Seite ohne erreichbare Datenbank rendert --
# nachgestellt mit einer ins Leere zeigenden Supabase-Adresse. Ein Health-Check,
# der bei einer Stoerung der Datenbank mitfaellt, wuerde einen laufenden
# Container abraeumen, der nur nichts anzuzeigen hat.
#
# Toleranz: 15 s Anlaufzeit plus dreimal 10 s. Die Anwendung meldet
# `Ready` in unter einer Sekunde -- reichlich Luft, und im Fehlerfall steht
# das Ergebnis nach einer Minute fest statt nach vier Tagen.
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3100)+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
