# @murky-web/config

Zentrale Config-Sammlung fuer meine Web-Projekte.

Kanonische Quelle:
https://github.com/MurkyTheMurloc/web_dev_tools/tree/main/packages/config

Aktuell liegen hier zwei installierbare Setups:

- `biome/biome.jsonc`
- `oxc/` mit modularer `oxlint`- und `oxfmt`-Struktur

Zusätzlich liegen TypeScript-Templates bereit:

- `typescript/tsconfig.base.jsonc`
- `typescript/tsconfig.solid.jsonc`
- `typescript/typebuddy-globals.d.ts`

## CLI Workflow

Die CLI heisst `web-dev-config`.

```bash
web-dev-config init --oxc
```

Es gibt bewusst kein `--all`. Kombiniert werden nur orthogonale Feature-Flags.

## Install Varianten

### CLI

Nur Oxc:

```bash
web-dev-config init --oxc
```

Nur Biome:

```bash
web-dev-config init --biome
```

Nur TypeScript:

```bash
web-dev-config init --typescript
```

Oxc + TypeScript:

```bash
web-dev-config init --oxc --typescript
```

Biome + Solid:

```bash
web-dev-config init --biome --frontend-solid
```

Oxc + TypeScript + Solid:

```bash
web-dev-config init --oxc --typescript --frontend-solid
```

TypeScript + Solid:

```bash
web-dev-config init --typescript --frontend-solid
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
- loest `@murky-web/oxlint-plugin-solid` als Paket-Dependency auf
- kopiert die lokale Regelruntime aus dem aufgeloesten Paket nach
  `./oxc/jsplugins/solid/`
- setzt `jsPlugins: ["./jsplugins/solid/index.mjs"]`
- ignoriert `./jsplugins/**` im Zielprojekt-Lint, damit die kopierte
  Regelruntime nicht selbst mitgelintet wird
- aktiviert die komplette von `eslint-plugin-solid` exportierte
  Upstream-Regelmenge
- ergaenzt zusaetzlich `validate-jsx-nesting` als lokale Placeholder-Regel, weil
  upstream im Quellbaum nur eine leere Regeldatei vorliegt
- installiert die benoetigten Laufzeit-Dependencies fuer den lokalen
  Solid-Regelport
- die lokale Runtime erweitert den Upstream-Satz zusaetzlich um
  `solid/prefer-arrow-components`
- fuer `*.tsx`/`*.jsx` wird `prefer-readonly-parameter-types` im Solid-Preset
  bewusst deaktiviert, damit `Component<Props>` und `ParentComponent<Props>`
  nicht sofort wieder mit dem allgemeinen TS-Set kollidieren

Hinweis:

- `--frontend-solid` geht davon aus, dass das Zielprojekt bereits `solid-js`
  als normale Projekt-Dependency nutzt, zum Beispiel ueber ein bestehendes
  Solid- oder SolidStart-/Vite-Setup

Danach kann direkt gelintet werden:

```bash
oxlint -c ./oxc/.oxlintrc.jsonc --type-aware .
```

Oder ueber den installierten Script:

```bash
bun run lint:oxc
```

Ein typischer Autofix dabei ist `solid/prefer-arrow-components`:

```tsx
export function Card(props: Props) {
    return <section>{props.children}</section>;
}
```

wird mit `oxlint --fix` zu:

```tsx
import type { ParentComponent } from "solid-js";

export const Card: ParentComponent<Props> = (props) => {
    return <section>{props.children}</section>;
};
```

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
- vorhandene Vite-Template-Dateien wie `tsconfig.app.json` und
  `tsconfig.node.json` werden entfernt, damit unsere Templates die single source
  of truth bleiben
- aktuell werden Template-`tsconfig`s dabei bewusst direkt ersetzt und nicht
  automatisch gemerged

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
    "jsPlugins": ["@murky-web/typebuddy/oxlint"],
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
web-dev-config init --oxc --package-manager bun
web-dev-config init --biome --skip-install
web-dev-config init --oxc --typescript --frontend-solid
```

## Hinweise

- Die CLI erwartet ein vorhandenes `package.json`.
- Wenn kein Paketmanager explizit gesetzt ist, wird automatisch erkannt:
  `bun.lock` / `bun.lockb` -> `bun`, `pnpm-lock.yaml` -> `pnpm`, `yarn.lock` ->
  `yarn`, sonst `npm`.
- Die Biome-Config bleibt bewusst in `./biome/biome.jsonc`.
- Die Oxc-Config bleibt bewusst in `./oxc/`, damit alle modularen
  `jsonc`-Dateien zusammenbleiben.
- `tsconfig.base.jsonc` ist die moderne TS7-/`tsgo`-Basis,
  `tsconfig.solid.jsonc` erweitert sie fuer Solid + Vite.
