# @murky-web/oxlint-plugin-solid

## 0.1.2

### Patch Changes

- 2118889: Extend `prefer-arrow-components` to trigger on any `function` declaration with a `: JSX.Element` return type annotation, regardless of whether it is exported or PascalCase. Intent to write a component is clear from the return type.

## 0.1.1

### Patch Changes

- dd76850: Fix `prefer-arrow-components` rule to trigger on `export function` components with destructured props (`ObjectPattern`). Previously only `Identifier` params were detected; now all three forms — named props, destructured props, and no props — are correctly flagged and auto-fixed.

This file exists so `changesets/action` can open a package changelog when it
creates the release PR branch.
