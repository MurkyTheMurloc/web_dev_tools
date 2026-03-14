---
name: config-package
description: Use when editing packages/config, including the Bun CLI installer, Oxc and Biome configuration packages, TypeScript templates, and setup documentation.
---

# config Package

Use this skill for work inside `packages/config`.

## Scope
- `bin/web-dev-config.mjs`
- `scripts/`
- `oxc/`
- `biome/`
- `typescript/`
- package docs like `README.md` and `TODO.md`

## Current package role
- Internal workspace package for now.
- Owns the canonical config templates copied into user projects.
- CLI flags currently include `--oxc`, `--biome`, `--typescript`, and `--frontend-solid`.

## External docs
- When external library or framework docs are needed, use [$context7-defaults](/Users/paulbose/.codex/skills/context7-defaults/SKILL.md).
- Prefer this package's local allowlists:
  - [`references/approved-libraries.md`](./references/approved-libraries.md)
  - [`references/approved-direct-sources.md`](./references/approved-direct-sources.md)
- Do not silently reuse sibling-package docs when the task is specific to `packages/config`.

## Rules
- Prefer `jsonc` for config templates.
- Keep Oxc modular under `oxc/linting`.
- Bun is the primary local runtime and example path.
- Installed TypeScript configs should treat this package as the source of truth.
- Template-generated `tsconfig` files in target projects are currently replaced rather than merged.
- If changing installer behavior, keep the package-manager abstraction intact unless the user asks to narrow it.

## Watch-outs
- Oxc Solid support currently depends on `eslint-plugin-solid` via `jsPlugins` and may still have upstream limitations.
- When changing schema paths in copied configs, remember they resolve from the target project, not from this package.
