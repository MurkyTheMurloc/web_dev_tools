# @murky-web/oxlint-plugin-solid

## 1.1.0

### Minor Changes

- d622c99: `reactivity`: report a reactive read after an await, not the `async` keyword.

  The rule rejected any async tracked scope, citing the Solid 1.x docs: _"[Solid's]
  approach only tracks synchronously. If you have a setTimeout or use an async
  function in your Effect the code that executes async after the fact won't be
  tracked."_

  Solid 2.0 makes async computations a feature — _"Solid computations can return
  promises and async iterables"_ — and `createMemo(async () => …)` is the shape its
  async-reactivity documentation demonstrates. The rule was flagging the official
  pattern.

  The premise still holds; the conclusion no longer follows. From the 2.0 docs:
  _"Dependency tracking is synchronous. An async computation registers reactive
  reads made before its first await. Reads made after an await do not create
  dependency edges."_ So the hazard is not the keyword, it is a read on the far
  side of an async gap — it silently registers no dependency, and the computation
  cannot re-run when that source changes.

  The check now runs where the rule already knows every reactive read in a scope,
  and reports the identifier rather than the function, with a message that names
  the variable and says what to do. `yield` counts alongside `await`: an async
  generator driven by `action` suspends there in the same way. Nested functions are
  skipped — their gaps are their own.

  Solid's development build raises this at runtime; catching it here also covers
  production, where that check is compiled out.

  Two new test cases cover a read after `await` and a read after `yield`. A third
  asserts that a computation reading its inputs before awaiting produces no
  `reactivity` output at all — that fixture was reported by the old rule, so the
  test fails against it.

## 1.0.0

### Major Changes

- 77ff985: Target Solid 2.0. Solid moved its renderers into `@solidjs/*` packages and pulled the store APIs into the core, and the plugin assumed the 1.x layout throughout. The most consequential case was silent: the import tracker matched only `solid-js`, so every import-tracking rule went blind against `@solidjs/web` and stopped reporting rather than failing.

  - `prefer-classlist` is renamed to `prefer-class-object`. It recommended `classlist`, which Solid 2.0 removed; it now moves the object onto `class`.
  - `no-unknown-namespaces` accepted `on:`, `oncapture:`, `use:`, `prop:`, `attr:`, `bool:`, `class:` and `style:`. All are gone, so only the DOM's own `xmlns:`/`xlink:` remain.
  - `no-proxy-apis` detected stores by the `solid-js/store` import path. Stores now live in the core that every file imports, so it matches the store API names instead.
  - Reactivity tracking follows the renames: `batch`/`produce` → `flush`, `onMount` → `onSettled`, `createSelector` → `createProjection`, `mergeProps` → `merge`, `indexArray` → `repeat`, `useTransition` removed.
  - `jsx-no-undef` auto-imports `Loading`/`Errored`/`Repeat`/`Reveal` instead of `Index`.
  - `createEffect` and `createRenderEffect` are split into `(compute, apply)`: the compute phase tracks, the apply phase polls. The `no-destructure` autofix emits `merge`/`omit`.

  Projects still on Solid 1.x can use this release with `"solid/imports": "off"`. That rule is the only active conflict: it reports `import type { JSX } from "solid-js"` and its autofix rewrites the import to `@solidjs/web`, which a Solid 1 project does not have installed. The other rules go quiet on Solid 1 patterns rather than misfiring, and TypeScript already rejects the removed exports (`Suspense`, `Index`, `createResource`, `onMount`, `mergeProps`) with a clearer message than a linter could give.

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
