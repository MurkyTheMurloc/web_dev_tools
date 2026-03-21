# @murky-web/config

Central config package for my web projects.

Canonical source:
https://github.com/MurkyTheMurloc/web_dev_tools/tree/main/packages/config

This package ships:

- Oxc and Oxfmt config presets
- Biome config presets
- TypeScript templates
- a local Codex skill catalog
- the `web-dev-config` installer CLI

## CLI Workflow

The CLI is named `web-dev-config`.

`web-dev-config init` now installs the default stack when you do not pass
explicit install flags.

The default stack includes:

- `--oxc`
- `--typescript`
- `--frontend-solid`
- `--typebuddy`
- `--simplelog`
- default skills for docs, workflow, frontend, Solid, TypeBuddy, TDD, and
  SimpleLog

You can also request the same bundle explicitly with `--defaults`.

When skills are installed, the CLI adds these entries to the target project's
`.gitignore`:

- `.codex/skills/`
- `.skills/`

## Install Variants

Run directly from GitHub:

```bash
bunx github:MurkyTheMurloc/web_dev_tools web-dev-config init
```

Default stack:

```bash
web-dev-config init
```

Explicit default stack:

```bash
web-dev-config init --defaults
```

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

Oxc + TypeScript + Solid:

```bash
web-dev-config init --oxc --typescript --frontend-solid
```

Install just the default skill set without config files:

```bash
web-dev-config init \
  --skill-context7-defaults \
  --skill-find-docs \
  --skill-frontend-design \
  --skill-frontend-taste \
  --skill-simplelog \
  --skill-solidjs \
  --skill-tailwindcss \
  --skill-tdd \
  --skill-typebuddy \
  --skill-workspace-defaults
```

## What `init --oxc` Does

- copies `oxc/.oxlintrc.jsonc`
- copies `oxc/.oxfmtrc.jsonc`
- copies `oxc/linting/`
- installs `oxfmt`
- installs `oxlint`
- installs `oxlint-tsgolint@latest`
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
- resolves `@murky-web/oxlint-plugin-solid`
- copies the local Solid rule runtime into `./oxc/jsplugins/solid/`
- adds `./jsplugins/solid/index.mjs` to `jsPlugins`
- ignores `./jsplugins/**` so the copied runtime is not linted as app code
- enables the full locally ported Solid rule set

When `--typebuddy` is set:

- installs `@murky-web/typebuddy`
- extends `./oxc/.oxlintrc.jsonc` with `./linting/typebuddy.jsonc`
- adds `@murky-web/typebuddy/oxlint` to `jsPlugins`

When `--simplelog` is set:

- installs `@murky-web/simplelog`
- extends `./oxc/.oxlintrc.jsonc` with `./linting/simplelog.jsonc`
- adds `@murky-web/simplelog/oxlint` to `jsPlugins`

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
- keeps JSX preserved with Solid typing
- uses browser libs and Vite client types
- removes legacy Vite template files such as `tsconfig.app.json` and
  `tsconfig.node.json`

When `--typebuddy` is set:

- writes a TypeScript variant that includes `@murky-web/typebuddy/globals`
  directly in `compilerOptions.types`

## Skills

Installed skill files live under the target project's `.codex/skills/`
directory.

Current skill flags:

- `--skill-context7-defaults`
- `--skill-find-docs`
- `--skill-frontend-design`
- `--skill-frontend-taste`
- `--skill-git-guardrails-claude-code`
- `--skill-grill-me`
- `--skill-improve-codebase-architecture`
- `--skill-simplelog`
- `--skill-solidjs`
- `--skill-tailwindcss`
- `--skill-tdd`
- `--skill-typebuddy`
- `--skill-ubiquitous-language`
- `--skill-workspace-defaults`
