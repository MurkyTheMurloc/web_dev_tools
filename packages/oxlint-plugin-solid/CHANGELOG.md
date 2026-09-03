# @murky-web/oxlint-plugin-solid

## 0.1.3

### Patch Changes

- 6057c2d: Fix `prefer-arrow-components` autofix producing overlapping edits when the import and function replacement span different ranges. Import is now embedded directly in the replacement text when needed to avoid multi-range conflicts.

## 0.1.2

### Patch Changes

- 2118889: Extend `prefer-arrow-components` to trigger on any `function` declaration with a `: JSX.Element` return type annotation, regardless of whether it is exported or PascalCase. Intent to write a component is clear from the return type.

## 0.1.1

### Patch Changes

- dd76850: Fix `prefer-arrow-components` rule to trigger on `export function` components with destructured props (`ObjectPattern`). Previously only `Identifier` params were detected; now all three forms — named props, destructured props, and no props — are correctly flagged and auto-fixed.

This file exists so `changesets/action` can open a package changelog when it
creates the release PR branch.

## 0.1.3

Reconstructed entry. 0.1.1, 0.1.2 and 0.1.3 were published to npm on
2026-04-08 from a working copy that was never committed, so the repository
sat at 0.1.0 while the registry was three releases ahead.

`src/rules/prefer_arrow_components.mjs` has been restored from the published
0.1.3 tarball and the version bumped to match. The recovered source is
byte-identical to what npm serves. Changes it contains, relative to 0.1.0:

- `prefer-arrow-components` recognises a component by a `JSX.Element` return
  type annotation, not only by an exported PascalCase name.
- Destructured props (`ObjectPattern`) are supported where only a plain
  identifier parameter was handled before.
- The export status of the declaration is threaded through to fix generation.

