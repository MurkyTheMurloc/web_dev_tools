# web_dev_config

Zentrale Config-Sammlung fuer meine Web-Projekte.

Aktuell liegen hier zwei installierbare Setups:

- `biome/biome.jsonc`
- `oxc/` mit modularer `oxlint`- und `oxfmt`-Struktur

Zusätzlich liegen TypeScript-Templates bereit:

- `typescript/tsconfig.base.jsonc`
- `typescript/tsconfig.solid.jsonc`
- `typescript/typebuddy-globals.d.ts`

## CLI Workflow

Der Einstieg ist jetzt ueber `bunx` direkt aus GitHub:

```bash
bunx github:MurkyTheMurloc/web_dev_config init --oxc
```

Oder als volle HTTPS-Variante:

```bash
bunx --package git+https://github.com/MurkyTheMurloc/web_dev_config.git web-dev-config init --oxc
```

Es gibt bewusst kein `--all`. Kombiniert werden nur orthogonale Feature-Flags.

## Install Varianten

### GitHub Kurzform

Nur Oxc:

```bash
bunx github:MurkyTheMurloc/web_dev_config init --oxc
```

Nur Biome:

```bash
bunx github:MurkyTheMurloc/web_dev_config init --biome
```

Nur TypeScript:

```bash
bunx github:MurkyTheMurloc/web_dev_config init --typescript
```

Oxc + TypeScript:

```bash
bunx github:MurkyTheMurloc/web_dev_config init --oxc --typescript
```

Biome + Solid:

```bash
bunx github:MurkyTheMurloc/web_dev_config init --biome --frontend-solid
```

Oxc + TypeScript + Solid:

```bash
bunx github:MurkyTheMurloc/web_dev_config init --oxc --typescript --frontend-solid
```

TypeScript + Solid:

```bash
bunx github:MurkyTheMurloc/web_dev_config init --typescript --frontend-solid
```

### HTTPS Variante

Nur Oxc:

```bash
bunx --package git+https://github.com/MurkyTheMurloc/web_dev_config.git web-dev-config init --oxc
```

Nur Biome:

```bash
bunx --package git+https://github.com/MurkyTheMurloc/web_dev_config.git web-dev-config init --biome
```

Nur TypeScript:

```bash
bunx --package git+https://github.com/MurkyTheMurloc/web_dev_config.git web-dev-config init --typescript
```

Oxc + TypeScript:

```bash
bunx --package git+https://github.com/MurkyTheMurloc/web_dev_config.git web-dev-config init --oxc --typescript
```

Biome + Solid:

```bash
bunx --package git+https://github.com/MurkyTheMurloc/web_dev_config.git web-dev-config init --biome --frontend-solid
```

Oxc + TypeScript + Solid:

```bash
bunx --package git+https://github.com/MurkyTheMurloc/web_dev_config.git web-dev-config init --oxc --typescript --frontend-solid
```

TypeScript + Solid:

```bash
bunx --package git+https://github.com/MurkyTheMurloc/web_dev_config.git web-dev-config init --typescript --frontend-solid
```

## Was `init --biome` macht

- kopiert `biome/` in dein Projekt
- installiert `@biomejs/biome` als Dev-Dependency
- traegt diese `package.json`-Scripts ein:

```json
{
  "scripts": {
    "check:biome": "biome check --config-path ./biome/biome.jsonc .",
    "format:biome": "biome format --config-path ./biome/biome.jsonc --write .",
    "lint:biome": "biome lint --config-path ./biome/biome.jsonc ."
  }
}
```

Wenn `--frontend-solid` gesetzt ist:

- aktiviert die Biome-Solid-Domain auf `all`

## Was `init --oxc` macht

- kopiert `oxc/.oxlintrc.jsonc`
- kopiert `oxc/.oxfmtrc.jsonc`
- kopiert `oxc/linting/`
- installiert `oxfmt`
- installiert `oxlint`
- installiert `oxlint-tsgolint@latest` fuer type-aware Regeln
- traegt diese `package.json`-Scripts ein:

```json
{
  "scripts": {
    "format:oxc": "oxfmt -c ./oxc/.oxfmtrc.jsonc .",
    "format:oxc:check": "oxfmt -c ./oxc/.oxfmtrc.jsonc --check .",
    "lint:oxc": "oxlint -c ./oxc/.oxlintrc.jsonc --type-aware ."
  }
}
```

Wenn `--frontend-solid` gesetzt ist:

- haengt `./linting/solid.jsonc` in `./oxc/.oxlintrc.jsonc` ein
- setzt `jsPlugins: ["eslint-plugin-solid"]`
- installiert `eslint-plugin-solid`

## Was `init --typescript` macht

- kopiert `typescript/tsconfig.base.jsonc` nach `./tsconfig.base.jsonc`
- schreibt `./tsconfig.json`
- installiert `@typescript/native-preview`
- traegt diesen `package.json`-Script ein:

```json
{
  "scripts": {
    "typecheck": "tsgo --project ./tsconfig.json --noEmit"
  }
}
```

Wenn `--frontend-solid` gesetzt ist:

- wird `typescript/tsconfig.solid.jsonc` als `./tsconfig.json` kopiert
- `./tsconfig.json` erweitert dann `./tsconfig.base.jsonc`
- vorhandene Vite-Template-Dateien wie `tsconfig.app.json` und `tsconfig.node.json` werden entfernt, damit unsere Templates die single source of truth bleiben
- aktuell werden Template-`tsconfig`s dabei bewusst direkt ersetzt und nicht automatisch gemerged

## Optionale TypeBuddy Integration

Wenn ein Projekt `@murky-web/typebuddy` nutzt, gibt es in `config` zwei opt-in
Bausteine:

### TypeScript Globals

`typescript/typebuddy-globals.d.ts` aktiviert die globalen `typebuddy`-Typen:

```ts
import type {} from "@murky-web/typebuddy/globals";
```

Die Datei kann einfach ins Projekt-Root kopiert werden. Wenn sie dort liegt,
wird sie von TypeScript automatisch mit aufgenommen.

### Oxc Regeln

`oxc/linting/typebuddy.jsonc` aktiviert die `typebuddy`-Regeln, und
`oxc/.oxlintrc.typebuddy.jsonc` haengt zusaetzlich das `oxlint`-Plugin ein:

```jsonc
{
  "extends": ["./.oxlintrc.jsonc", "./linting/typebuddy.jsonc"],
  "jsPlugins": ["@murky-web/typebuddy/oxlint"]
}
```

Damit bleibt die Standard-Config generisch, und `typebuddy` kann nur dort
zugeschaltet werden, wo das Paket auch wirklich genutzt wird.

## Optionen

Die CLI unterstuetzt:

- `init`
- `--oxc`
- `--biome`
- `--typescript`
- `--skip-install`
- `--package-manager bun|pnpm|npm|yarn`
- `--frontend-solid`
- optional einen absoluten oder relativen Zielpfad

Beispiele:

```bash
bunx github:MurkyTheMurloc/web_dev_config init --oxc --package-manager bun
bunx github:MurkyTheMurloc/web_dev_config init --biome --skip-install
bunx github:MurkyTheMurloc/web_dev_config init --oxc --typescript --frontend-solid
```

## Hinweise

- Die CLI erwartet ein vorhandenes `package.json`.
- Wenn kein Paketmanager explizit gesetzt ist, wird automatisch erkannt:
  `bun.lock` / `bun.lockb` -> `bun`, `pnpm-lock.yaml` -> `pnpm`, `yarn.lock` -> `yarn`, sonst `npm`.
- Die Biome-Config bleibt bewusst in `./biome/biome.jsonc`.
- Die Oxc-Config bleibt bewusst in `./oxc/`, damit alle modularen `jsonc`-Dateien zusammenbleiben.
- `tsconfig.base.jsonc` ist die moderne TS7-/`tsgo`-Basis, `tsconfig.solid.jsonc` erweitert sie fuer Solid + Vite.
