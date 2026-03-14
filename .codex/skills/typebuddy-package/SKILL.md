---
name: typebuddy-package
description: Use when editing packages/typebuddy, including runtime type guards, utility types, custom ESLint rules, Biome rule experiments, and the package's Bun-based toolchain.
---

# typebuddy Package

Use this skill for work inside `packages/typebuddy`.

## Scope
- `src/type_helper.ts`
- `src/types/`
- `src/eslint/`
- `src/biome/`
- tests and package metadata

## External docs
- When external library or tool docs are needed, use [$context7-defaults](/Users/paulbose/.codex/skills/context7-defaults/SKILL.md).
- Prefer this package's local allowlist:
  - [`references/approved-libraries.md`](./references/approved-libraries.md)
- Do not default to the `config` package's doc set unless the task is explicitly cross-package.

## Current standards
- Internal workspace package for now. Publish work is intentionally paused.
- Test runner is Vitest.
- Type checking uses `tsgo`.
- Build uses `tsdown`.
- Do not reintroduce Jest, `tsc`, or `pnpm`-specific scripts.

## Watch-outs
- This package still needs a deeper overhaul, so prefer clear incremental cleanup over premature publish optimization.
- It mixes runtime helpers and lint-rule-related code, so keep those boundaries clear in changes.
- If you touch custom rule code, check whether the change belongs to ESLint-only behavior, Biome-only behavior, or shared helper logic.
