# Betrieb und lokale Entwicklung

> Portbelegung, Container-Laufzeit und die Befehle, die auf einer Maschine mit
> mehreren Supabase-Projekten Schaden anrichten.

## Voraussetzungen

| Werkzeug           | Version              | Anmerkung                                                                          |
| ------------------ | -------------------- | ---------------------------------------------------------------------------------- |
| Node               | **24** (aktives LTS) | Festgelegt in `.nvmrc` und `engines`. Begründung: [architektur.md](architektur.md) |
| pnpm               | über Corepack        | Version ist in `package.json` unter `packageManager` festgelegt                    |
| Container-Laufzeit | Docker oder OrbStack | Die Supabase-CLI findet den Socket über den aktiven Docker-Context                 |
| Supabase CLI       | 2.84.2               | dieselbe Version ist in der CI gepinnt                                             |
| gitleaks           | aktuell              | für den Pre-Commit-Hook                                                            |

```bash
corepack enable
brew install gitleaks     # falls noch nicht vorhanden
pnpm install
```

### Node je Verzeichnis

Auf einem Rechner, der mehrere Projekte trägt, ist eine systemweite
Node-Installation der falsche Zuschnitt: Jede Anhebung trifft alle Projekte
zugleich. Eine Versionsverwaltung liest stattdessen die `.nvmrc` beim
Verzeichniswechsel.

```bash
brew install fnm
# in ~/.zshrc:
eval "$(fnm env --use-on-cd --corepack-enabled --shell zsh)"
fnm install 24
```

`--corepack-enabled` ist nicht optional: Ohne diesen Schalter fällt `pnpm` unter
einer frisch installierten Node-Version auf einen Shim einer anderen
Installation zurück. Das funktioniert — bis jene entfernt wird.

Nennt eine `.nvmrc` eine nicht installierte Version, meldet fnm das beim
Betreten des Verzeichnisses und behält die zuletzt aktive Version bei. Abhilfe:
`fnm install <version>`.

## Portbelegung

Taktus verwendet einen eigenen Portblock. Zwei Bedingungen mussten erfüllt sein:

**Erstens: kein Zusammenstoß mit anderen Supabase-Projekten.** Die Supabase-CLI
vergibt standardmäßig 54320–54329. Wer ein zweites Supabase-Projekt auf
derselben Maschine hält, hat diese Ports bereits belegt — und dann scheitert
`supabase start` oder, schlimmer, greift auf den falschen Stack zu.

**Zweitens: außerhalb der Ephemeral-Port-Range von macOS.** Diese reicht von
49152 bis 65535 (`sysctl net.inet.ip.portrange.first`). Ein Block darin — etwa
das naheliegende 544xx — kann jederzeit von einem beliebigen ausgehenden Socket
transient belegt werden; `supabase start` scheitert dann sporadisch mit „port is
already allocated". Deshalb **444xx**, unterhalb der Range.

| Dienst                 | Port          | Status            |
| ---------------------- | ------------- | ----------------- |
| Anwendung (`next dev`) | **3100**      |                   |
| Supabase API (Kong)    | **44421**     |                   |
| Postgres               | **44422**     |                   |
| Postgres Shadow        | 44420         | nur für `db diff` |
| Studio                 | 44423         |                   |
| Inbucket (Web / SMTP)  | 44424 / 44425 | Testpostfach      |
| Analytics              | 44427         | abgeschaltet      |
| Pooler                 | 44429         | abgeschaltet      |
| Edge-Runtime-Inspector | 8093          | abgeschaltet      |

Abgeschaltet in Release 1, weil nicht gebraucht:

| Dienst         | Warum aus                                               |
| -------------- | ------------------------------------------------------- |
| `realtime`     | Keine Live-Aktualisierung im Funktionsumfang            |
| `storage`      | Keine Ticket-Anhänge — bewusste Scope-Disziplin         |
| `analytics`    | Spart spürbar Arbeitsspeicher neben einem zweiten Stack |
| `edge_runtime` | Die gesamte Logik liegt in Next.js Server Actions       |

Jeder abgeschaltete Dienst ist zugleich eine Angriffsfläche weniger. Die Ports
bleiben in `supabase/config.toml` deklariert, damit eine spätere Aktivierung
nicht kollidiert.

`project_id = "taktus"` ist nicht kosmetisch: Die Kennung prägt Container-,
Netz- und Volume-Namen. Sie ist der Grund, warum die Stacks nebeneinander
laufen, ohne sich zu überschreiben.

## Tägliche Arbeit

```bash
pnpm db:start        # lokaler Supabase-Stack
pnpm dev             # http://localhost:3100

pnpm db:test         # pgTAP: Row-Level-Security
pnpm test            # Vitest
pnpm typecheck
pnpm lint
pnpm licenses:check

pnpm db:types        # Typen nach jeder Migration neu erzeugen
pnpm db:reset        # Datenbank zurücksetzen, Migrationen + Seed neu einspielen
pnpm db:stop
```

Nach `pnpm db:start` gibt die CLI die lokalen Schlüssel aus. Diese gehören in
`.env.local` — **niemals** in eine versionierte Datei.

## Schriften

Die Anwendung lädt **keine Fremdressourcen zur Laufzeit** — keine Schrift von
einem CDN, kein Icon-Paket, kein externes Bild. Das ist keine Stilfrage: Die
Souveränitätsentscheidung des Projekts schließt US-Dienste im Betrieb aus, und
die Content-Security-Policy kommt dadurch mit `font-src 'self'` aus.

Beide Familien stehen unter der **SIL Open Font License 1.1** und sind damit
mit AGPL-3.0 vereinbar. Die Lizenztexte liegen neben den Dateien in
`public/fonts/` und werden mit ausgeliefert, wie die OFL es verlangt; die
SPDX-Zuordnung steht in `REUSE.toml`.

| Datei                                    | Herkunft                                                | Verwendung                               |
| ---------------------------------------- | ------------------------------------------------------- | ---------------------------------------- |
| `public/fonts/InterVariable.woff2`       | Inter **v4.1**, Release-Zip, Ordner `web/`              | Oberfläche und Fließtext                 |
| `public/fonts/JetBrainsMono[wght].woff2` | JetBrains Mono **v2.304**, `fonts/variable/`, umgepackt | Nummern, Minuten, Aktions- und Feldnamen |

**Prüfsummen** (SHA-256), damit die Herkunft ohne Vertrauensvorschuss
nachvollziehbar bleibt:

```
9883fdd4a49d4fb66bd8177ba6625ef9a64aa45899767dde3d36aa425756b11e  Inter-4.1.zip
693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3  web/InterVariable.woff2   (unverändert übernommen)

6f6376c6ed2960ea8a963cd7387ec9d76e3f629125bc33d1fdcd7eb7012f7bbf  JetBrainsMono-2.304.zip
662a196d58f1183bf2d77428b6d5283fe3f45161ab021bea4036bc98e5cac016  fonts/variable/JetBrainsMono[wght].ttf   (Quelle)
1e728a7dd7f14f12daf2b37e35be12d1733429cec9c85c7e592e37b5c643d396  public/fonts/JetBrainsMono[wght].woff2   (umgepackt)
```

### Warum eine der beiden Dateien umgepackt ist

Inter liefert im Release ein fertiges variables `woff2` — es wird
**unverändert** übernommen, die Prüfsumme oben lässt sich direkt gegen das
Release halten.

JetBrains Mono liefert im Release **kein** variables `woff2`, nur das variable
`ttf` und sechzehn statische `woff2`. Der Entwurf braucht die Schnitte 400, 500,
600 und 700; als statische Dateien wären das vier Abrufe und rund 375 KB. Das
variable `ttf` in `woff2` umzupacken kostet nichts an Genauigkeit — es ändert
weder Glyphen noch Metriken, nur den Container — und ergibt **eine** Datei mit
113 KB über die Achse `wght 100–800`.

Reproduktion, falls die Datei je neu erzeugt werden muss:

```bash
python3 -m venv .venv && ./.venv/bin/pip install fonttools brotli
./.venv/bin/python -c "
from fontTools.ttLib import TTFont
f = TTFont('fonts/variable/JetBrainsMono[wght].ttf')
f.flavor = 'woff2'
f.save('JetBrainsMono[wght].woff2')"
```

Die Werkzeuge sind **keine** Projektabhängigkeit — sie werden einmal gebraucht,
nicht bei jedem Build.

### Was bewusst nicht geschieht

Inter wird **nicht** auf einen Latin-Ausschnitt untergesetzt, obwohl das die
352 KB etwa halbieren würde. Eine untergesetzte Datei lässt sich nicht mehr
gegen das Release prüfen — und Prüfbarkeit ist in diesem Repository das
teurere Gut. Falls sich das ändert, gehört es in einen eigenen Commit mit
Begründung, nicht nebenbei.

## Ein zweites Supabase-Projekt auf derselben Maschine

> [!danger] Diese Befehle wirken maschinenweit, nicht projektbezogen
> Wer neben Taktus einen weiteren Supabase-Stack betreibt, muss sie kennen:
> Mehrere CLI- und Docker-Befehle greifen über Projektgrenzen hinweg und
> stoppen fremde Stacks oder löschen deren Datenvolumes. Der Verlust ist
> endgültig — ein Datenvolume, das `docker volume prune` erwischt hat, ist weg.

| Befehl                                                        | Wirkung                                                                                                   |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `supabase stop --all`                                         | Laut CLI-Hilfe: „Stop all local Supabase instances **from all projects across the machine**"              |
| `supabase stop --no-backup`                                   | „Deletes all data volumes after stopping". Aus dem falschen Verzeichnis: **Datenverlust im Fremdprojekt** |
| `supabase start`, `supabase db reset` aus fremdem Verzeichnis | Die CLI liest die dortige `config.toml` und arbeitet auf der **fremden** Datenbank                        |
| `docker system prune -a --volumes`, `docker volume prune`     | Löscht fremde Datenvolumes                                                                                |
| `docker stop $(docker ps -q)`, „Stop All" in der Oberfläche   | Stoppt alles, auch fremde Stacks                                                                          |

### Drei Ebenen der Absicherung

1. **Gekapselte Scripts.** Alle Supabase-Aufrufe laufen über `package.json` und
   tragen `--workdir .` beziehungsweise `--project-id taktus` fest eingebaut.
   Das Arbeitsverzeichnis spielt damit keine Rolle mehr. `supabase` wird nicht
   direkt in die Shell getippt.
2. **`.claude/settings.json`** sperrt die genannten Muster über
   `permissions.deny`. Diese Ebene wirkt auch dann, wenn ein Werkzeug den Befehl
   vorschlägt, statt dass ein Mensch ihn tippt.
3. **`project_id = "taktus"`** in `supabase/config.toml`. Die Kennung prägt
   Container-, Netz- und Volume-Namen — nur dadurch sind die eigenen Container
   von fremden überhaupt unterscheidbar.

### Gegenprobe nach jedem Start

```bash
docker ps --format '{{.Names}}' | grep taktus     # der eigene Stack
docker ps --format '{{.Names}}' | grep -v taktus  # alles andere, unveraendert?
```

Fehlt in der zweiten Ausgabe etwas, das vorher lief, wurde ein fremder Stack
angefasst. Dann sofort anhalten und ihn aus seinem eigenen Verzeichnis wieder
starten, statt weiterzuarbeiten.

## Bindung an alle Netzwerkschnittstellen

Die Supabase-CLI veröffentlicht Ports standardmäßig auf `0.0.0.0`, nicht auf
`127.0.0.1`. Die lokale Entwicklungsdatenbank ist damit im gesamten Netzwerk
erreichbar — nachweisbar an der Ausgabe von `docker ps`:

```
0.0.0.0:44422->5432/tcp
```

In einem vertrauenswürdigen Netz ist das hinnehmbar. **Bei Arbeit in einem
fremden oder öffentlichen Netz** sollte die Bindung auf Loopback beschränkt oder
der Stack angehalten werden. Die lokale Datenbank enthält zwar nur synthetische
Daten, aber ein offen erreichbarer Postgres ist unabhängig davon nichts, was man
mitbringen möchte.

## Wenn `supabase start` fehlschlägt

| Symptom                                   | Ursache                            | Abhilfe                                                                |
| ----------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| „port is already allocated"               | Ein Port des Blocks ist belegt     | `lsof -nP -iTCP:44421 -sTCP:LISTEN` zeigt den Verursacher              |
| „Cannot connect to the Docker daemon"     | Die Container-Laufzeit läuft nicht | Laufzeit starten; `docker context ls` zeigt, welcher Context aktiv ist |
| Container starten und beenden sich sofort | Zu wenig Arbeitsspeicher           | RAM-Zuteilung der Container-Laufzeit prüfen                            |
| Migrationen laufen nicht durch            | Zustand aus einem früheren Lauf    | `pnpm db:reset` — wirkt ausschließlich auf Taktus                      |

## Wiederherstellungstest

`security.md` Kapitel H führt „Backup ohne Wiederherstellungstest" als eigenes
Risiko: Eine Sicherung, die nie zurückgespielt wurde, ist eine Annahme.

**Empfohlen für Betreiber**, sobald eine produktive Instanz existiert — in
einem festen, selbst gewählten Rhythmus, und mit Protokoll:

1. Sicherung auf eine leere Instanz zurückspielen
2. Anmeldung prüfen
3. Mandantentrennung stichprobenartig prüfen — ein Nutzer aus Mandant A darf
   keine Daten aus Mandant B sehen
4. Datum, Dauer und Befund festhalten

Dasselbe gilt für die Durchsicht der Logs und des Datenmodells — beides Punkte,
die keine Automatisierung abdeckt.

> [!note] Das ist eine Empfehlung, keine Zusage dieses Projekts
> Es gibt keine produktive Instanz, gegen die dieser Test hier liefe. Ihn
> trotzdem als laufende Prüfung aufzuführen, wäre genau die Sorte Behauptung,
> die [security.md](security.md) Kapitel 2 vermeidet.

---

## Eine erreichbare Instanz aufsetzen (Demo, Vorführung, Test)

Alles oben beschreibt die Arbeit auf dem eigenen Rechner. Sobald eine Instanz
von aussen erreichbar wird, kommt ein Schritt hinzu, und er ist nicht optional.

> [!danger] Der Entwicklungs-Seed gehört auf keine erreichbare Instanz —
> jedenfalls nicht mit seinen Kennwörtern
> `supabase/seed.sql` gibt **allen sechs** Konten dasselbe Kennwort, über ein
> einziges `crypt()`. Zwei davon sind Administratoren. Das Kennwort steht im
> Klartext in der Datei, und die Datei ist öffentlich.
>
> Am 24.08.2026 lief genau dieser Seed auf einer erreichbaren Demo. Wer das
> Repository las, kam bis in die Verwaltung: Nutzer, Protokoll,
> Mandanteneinstellungen, Anonymisierung, Datenauskunft. Die Instanz wurde
> abgeschaltet.
>
> Keine Datenpanne — die Daten sind durchweg synthetisch, alle Domains liegen
> unter `.invalid`. Ein Betriebsproblem, und ein vermeidbares.

### Die Reihenfolge

```bash
# 1. Schema und Testdaten einspielen
supabase db reset --workdir .

# 2. Kennwörter setzen -- VOR dem Freischalten nach aussen
SUPABASE_URL=https://... \
SUPABASE_SERVICE_ROLE_KEY=... \
NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  node scripts/demo-kennwoerter.mjs

# 3. Erst jetzt erreichbar machen
```

Schritt 2 fragt das Kennwort **verdeckt** ab. Nicht als Argument und nicht über
eine Umgebungsvariable: Beides stünde in der Shell-Historie und für die Dauer
des Laufs in der Prozessliste, wo jeder Nutzer der Maschine es lesen kann.

### Was das Skript nachweist

Dass `updateUserById` keinen Fehler zurückgibt, heisst noch nicht, dass eine
Anmeldung gelingt — und erst recht nicht, dass die alte nicht mehr gilt. Das
Skript spielt deshalb beides an einem Konto durch, mit dem anonymen Schlüssel,
also auf demselben Weg wie die Anmeldemaske:

```
Gegenprobe an einem Konto:
  abgewiesen  admin@kanzlei.invalid mit dem Seed-Kennwort
  angenommen  admin@kanzlei.invalid mit dem neuen Kennwort
```

Bricht es hier ab, ist die Instanz **nicht** freizuschalten.

Es lässt sich jederzeit erneut ausführen und taugt damit auch als
wiederkehrende Kontrolle für eine laufende Demo.

### Ein Kennwort für alle sechs — bewusst so

Ein Kennwort je Rolle wäre umständlicher vorzuführen und schützte nichts, was
hier zu schützen wäre: Die Daten sind synthetisch. Die Folge gehört trotzdem
ausgesprochen — **wer das Kennwort kennt, kommt auch in die Verwaltung.** Für
ein Vorführsystem ist das gewollt; für alles andere wäre es die falsche
Entscheidung.

### Was beim Neuaufbau ausserdem gilt

- **Frische Schlüssel erzeugen.** Eine Instanz, deren
  `SUPABASE_SERVICE_ROLE_KEY` einmal in einer kompromittierten Umgebung stand,
  bekommt einen neuen — der Schlüssel umgeht sämtliche RLS-Policies
- **Keine Preview-Deployments für fremde Pull Requests.** Sie zeigen auf
  dieselbe Instanz und dieselben Schlüssel; kein Schalter schützt davor, nur
  die Absprache
