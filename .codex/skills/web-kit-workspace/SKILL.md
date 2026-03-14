---
name: web-kit-workspace
description: Use when working anywhere in the web_kit monorepo, especially for cross-package changes, package-boundary decisions, or shared standards like Bun, Oxc, TypeScript, scripts, and repository policy.
---

# web_kit Workspace

Use this skill when a task touches more than one package or needs a workspace-level decision.

## Packages
- `packages/config`: internal config and installer package for Oxc, Biome, and TypeScript templates.
- `packages/typebuddy`: runtime guards, utility types, custom ESLint rules, and Biome rule experiments.
- `packages/simplelog`: logger runtime package.

## Current standards
- Bun workspace at the root.
- Package scope is `@murky-web/*`.
- Shared TypeScript base lives at the repo root in `tsconfig.base.jsonc`.
- Type checking uses `tsgo` from `@typescript/native-preview`.
- Linting and formatting use Oxc from `packages/config/oxc`.
- Vitest is the test runner. Do not reintroduce Jest.
- Publishing is intentionally paused for now. Treat workspace packages as internal unless the user explicitly reopens release work.
- Version control is a single monorepo for now. Do not introduce submodules unless explicitly requested.

## Workflow
1. Decide whether the change is workspace-wide or package-specific.
2. If package-specific, load that package skill as well.
3. Prefer shared root tooling over package-local duplicates.
4. Keep package-manager examples and scripts Bun-first unless the task is specifically about the config installer supporting other package managers.
