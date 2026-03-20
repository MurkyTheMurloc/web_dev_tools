# @murky-web/config

Central config package for my web projects.

Canonical source:
https://github.com/MurkyTheMurloc/web_dev_tools/tree/main/packages/config

This package currently ships two installable config stacks:

- `biome/biome.jsonc`
- `oxc/` with modular `oxlint` and `oxfmt` config files

It also ships TypeScript templates:

- `typescript/tsconfig.base.jsonc`
- `typescript/tsconfig.solid.jsonc`
- `typescript/tsconfig.typebuddy.jsonc`
- `typescript/tsconfig.solid.typebuddy.jsonc`

## CLI Workflow

The CLI is named `web-dev-config`.

```bash
web-dev-config init
```

Running `init` without install target flags now installs the defaults:

- `--oxc`
- `--typescript`
- `--frontend-solid`
- `--typebuddy`
- `--simplelog`

You can also request the same bundle explicitly with `--defaults`.

## Install Variants

### CLI

Defaults:

```bash
web-dev-config init
```

Or explicitly:

```bash
web-dev-config init --defaults
```

The default bundle includes:

- Oxc + Oxfmt
- TypeScript setup
- Solid frontend presets
- `@murky-web/typebuddy` with TypeScript and Oxc integration
- `@murky-web/simplelog` as the default logger dependency

Only Oxc:

```bash
web-dev-config init --oxc
```

Only Biome:

```bash
web-dev-config init --biome
```

Only TypeScript:

```bash
web-dev-config init --typescript
```

Oxc + TypeScript:

```bash
web-dev-config init --oxc --typescript
```

Defaults plus Solid:

```bash
web-dev-config init --frontend-solid
```

Or explicitly:

```bash
web-dev-config init --defaults --frontend-solid
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

## What `init --biome` Does

- copies `biome/` into your project
- installs `@biomejs/biome` as a dev dependency
- adds these `package.json` scripts:

```json
{
  "scripts": {
    "check:biome": "biome check --config-path ./biome/biome.jsonc .",
    "format:biome": "biome format --config-path ./biome/biome.jsonc --write .",
    "lint:biome": "biome lint --config-path ./biome/biome.jsonc ."
  }
}
```

When `--frontend-solid` is set:

- enables the Biome Solid domain with `all`

## What `init --oxc` Does

- copies `oxc/.oxlintrc.jsonc`
- copies `oxc/.oxfmtrc.jsonc`
- copies `oxc/linting/`
- installs `oxfmt`
- installs `oxlint`
- installs `oxlint-tsgolint@latest` for type-aware rules
- adds these `package.json` scripts:

```json
{
  "scripts": {
    "format:oxc": "oxfmt -c ./oxc/.oxfmtrc.jsonc .",
    "format:oxc:check": "oxfmt -c ./oxc/.oxfmtrc.jsonc --check .",
    "lint:oxc": "oxlint -c ./oxc/.oxlintrc.jsonc --type-aware ."
  }
}
```

When `--frontend-solid` is set:

- extends `./oxc/.oxlintrc.jsonc` with `./linting/solid.jsonc`
- resolves `@murky-web/oxlint-plugin-solid` as a package dependency
- copies the local Solid rule runtime from that package into
  `./oxc/jsplugins/solid/`
- adds `jsPlugins: ["./jsplugins/solid/index.mjs"]`
- ignores `./jsplugins/**` in the target project lint config so the copied
  runtime is not linted as application code
- enables the complete locally ported Solid rule set
- includes `solid/prefer-arrow-components`
- disables `prefer-readonly-parameter-types` for `*.tsx` and `*.jsx` in the
  Solid preset so `Component<Props>` and `ParentComponent<Props>` do not
  conflict with the general TypeScript policy

When `--typebuddy` is set:

- extends `./oxc/.oxlintrc.jsonc` with `./linting/typebuddy.jsonc`
- adds `@murky-web/typebuddy/oxlint` to `jsPlugins`

Note:

- `--frontend-solid` assumes the target project already uses `solid-js` as a
  normal project dependency, for example through an existing Solid or
  SolidStart/Vite setup

After installation you can lint immediately:

```bash
oxlint -c ./oxc/.oxlintrc.jsonc --type-aware .
```

Or via the installed script:

```bash
bun run lint:oxc
```

A typical autofix is `solid/prefer-arrow-components`:

```tsx
export function Card(props: Props) {
  return <section>{props.children}</section>;
}
```

which becomes:

```tsx
import type { ParentComponent } from "solid-js";

export const Card: ParentComponent<Props> = (props) => {
  return <section>{props.children}</section>;
};
```

## What `init --typescript` Does

- copies `typescript/tsconfig.base.jsonc` to `./tsconfig.base.jsonc`
- writes `./tsconfig.json`
- installs `@typescript/native-preview`
- adds this `package.json` script:

```json
{
  "scripts": {
    "typecheck": "tsgo --project ./tsconfig.json --noEmit"
  }
}
```

When `--frontend-solid` is set:

- writes a Solid-oriented `tsconfig.json`
- keeps JSX preserved with `solid-js` typing
- uses browser libs and Vite client types
- removes legacy Vite template files like `tsconfig.app.json` and
  `tsconfig.node.json` so these templates stay the single source of truth

When `--typebuddy` is set:

- writes a TypeScript variant that includes
  `@murky-web/typebuddy/globals` directly in `compilerOptions.types`
- enables TypeBuddy globals through the generated TS config itself instead of
  requiring a separate project file

## Optional TypeBuddy Integration

If a project uses `@murky-web/typebuddy`, `config` ships these reusable pieces:

### Oxc Rules

`oxc/linting/typebuddy.jsonc` enables the `typebuddy` rule set, and
`oxc/.oxlintrc.typebuddy.jsonc` shows the minimal plugin wiring:

```jsonc
{
  "extends": ["./.oxlintrc.jsonc", "./linting/typebuddy.jsonc"],
  "jsPlugins": ["@murky-web/typebuddy/oxlint"]
}
```

This keeps the base config generic while still allowing TypeBuddy to be layered
in wherever the package is actually used.

## Simplelog as a Default

When `--simplelog` is set, the CLI installs `@murky-web/simplelog` as a normal
project dependency. It intentionally does not generate a logger source file, so
the target project remains free to choose its own runtime-specific wiring and
integration strategy.

## Options

The CLI supports:

- `init`
- `--defaults`
- `--oxc`
- `--biome`
- `--typescript`
- `--frontend-solid`
- `--typebuddy`
- `--simplelog`
- `--skip-install`
- `--package-manager bun|pnpm|npm|yarn`
- an optional absolute or relative target path

Examples:

```bash
web-dev-config init
web-dev-config init --frontend-solid
web-dev-config init --typebuddy
web-dev-config init --simplelog
web-dev-config init --oxc --package-manager bun
web-dev-config init --biome --skip-install
web-dev-config init --oxc --typescript --frontend-solid
```

## Notes

- The CLI expects an existing `package.json`.
- If no package manager is explicitly set, it is auto-detected:
  `bun.lock` / `bun.lockb` -> `bun`, `pnpm-lock.yaml` -> `pnpm`, `yarn.lock` ->
  `yarn`, otherwise `npm`.
- The Biome config intentionally lives in `./biome/biome.jsonc`.
- The Oxc config intentionally lives in `./oxc/` so the modular `jsonc` files
  stay together.
- `tsconfig.base.jsonc` is the modern TS7 / `tsgo` base, and the Solid
  templates extend it for Solid + Vite projects.
