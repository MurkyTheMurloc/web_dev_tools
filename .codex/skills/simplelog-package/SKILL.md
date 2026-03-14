---
name: simplelog-package
description: Use when editing packages/simplelog, especially the logger runtime, package surface, and its Bun-based TypeScript toolchain.
---

# simplelog Package

Use this skill for work inside `packages/simplelog`.

## Scope
- `src/logger.ts`
- package metadata
- README and package-local tooling files

## External docs
- When external runtime or tool docs are needed, use [$context7-defaults](/Users/paulbose/.codex/skills/context7-defaults/SKILL.md).
- Prefer this package's local allowlist:
  - [`references/approved-libraries.md`](./references/approved-libraries.md)
- Keep `simplelog` on its own doc set instead of inheriting the config or typebuddy references.

## Current standards
- Internal workspace package for now. Publish work is intentionally paused.
- Build uses `tsdown`.
- Type checking uses `tsgo`.
- Keep Bun-first tooling and avoid bringing back `tsc`-driven build scripts.

## Watch-outs
- Keep the package small and focused on logging behavior.
- Prefer minimal API churn unless the user is explicitly redesigning the logger surface.
- If runtime-specific behavior matters, call out whether it is Node-only, Bun-only, or broadly portable.
