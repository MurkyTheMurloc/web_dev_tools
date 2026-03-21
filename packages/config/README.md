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

In monorepos, the CLI resolves the nearest package root above the current
working directory and detects the workspace package manager from the monorepo
root.

The default stack includes:

- `--oxc`
- `--typescript`
- `--frontend-solid`
- `--typebuddy`
- `--simplelog`
- `--skill-coding-quality`
- `--skill-context-mode`
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
bunx github:MurkyTheMurloc/web_dev_tools#main init
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
  --skill-coding-quality \
  --skill-context-mode \
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

- copies `./.oxlintrc.jsonc`
- copies `./.oxfmtrc.jsonc`
- copies `oxc/linting/`
- installs `oxfmt`
- installs `oxlint`
- installs `oxlint-tsgolint@latest`
- adds these `package.json` scripts:

```json
{
    "scripts": {
        "format:oxc": "oxfmt -c ./.oxfmtrc.jsonc .",
        "format:oxc:check": "oxfmt -c ./.oxfmtrc.jsonc --check .",
        "lint:oxc": "oxlint -c ./.oxlintrc.jsonc --type-aware ."
    }
}
```

When `--frontend-solid` is set:

- extends `./.oxlintrc.jsonc` with `./oxc/linting/solid.jsonc`
- installs `@murky-web/oxlint-plugin-solid`
- adds `@murky-web/oxlint-plugin-solid` to `jsPlugins`
- enables the full locally ported Solid rule set

When `--typebuddy` is set:

- installs `@murky-web/typebuddy`
- extends `./.oxlintrc.jsonc` with `./oxc/linting/typebuddy.jsonc`
- adds `@murky-web/typebuddy/oxlint` to `jsPlugins`

When `--simplelog` is set:

- installs `@murky-web/simplelog`
- extends `./.oxlintrc.jsonc` with `./oxc/linting/simplelog.jsonc`
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

- writes a TypeScript variant plus `./typebuddy-globals.d.ts`
- imports `@murky-web/typebuddy/globals` through that shim so the library's
  global types are available out of the box

## Skills

Installed skill files live under the target project's `.codex/skills/`
directory.

Current skill flags:

- `--skill-coding-quality`
- `--skill-context7-defaults`
- `--skill-context-mode`
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
