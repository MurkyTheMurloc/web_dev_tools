# @murky-web/oxlint-plugin-solid

## 1.4.0

### Minor Changes

- 2e4e77d: Solid 2.0.2 stable API. `solid/imports` knows `createDeferred`, `createTrackedEffect`, `from`, `onFlush` and `repeat` (all `solid-js`). `solid/reactivity` treats `createDeferred` like an async memo (its callback is tracked and may return a promise, its result is an accessor), `until(fn)` as a tracked predicate and `onFlush` like `onSettled` (an untracked callback). `solid/reactive-async` checks `createDeferred` callbacks and accessors.
- e81d412: Audit fixes. `solid/validate-jsx-nesting` is implemented now (it did nothing):
  the shared config enables it as `error`, so projects that update start to get
  reports for `<p><div /></p>`, a link in a link, a row without a row group and
  the like (`<template>` content is not checked). It uses the table of invalid
  pairs of `validate-html-nesting` and a hand-written table of what the HTML
  parser repairs instead of parse5. `solid/jsx-no-script-url` now matches
  `javascript:` URLs with a tab, newline or control character in front of or
  inside the scheme (the pattern was an escaped string and matched none of them)
  and no longer flags `ABCjavascript:`. `solid/prefer-arrow-components` writes
  valid code for `export default function` (a `const` plus
  `export default Name;`), adds one `solid-js` type import at the top of the file
  instead of one next to every component, and only reports (no fix) a function
  that is read before its declaration, where the `const` would throw a
  ReferenceError. `solid/no-destructure` expands a shorthand property (`{ title }`
  becomes `{ title: props.title }`), picks a props name that no enclosing scope
  and no function around a rewritten read uses (`props2`) and only reports a
  nested pattern, a computed key that is not a literal or a write to a
  destructured name. `solid/imports` keeps a value specifier out of an
  `import type` declaration, writes a type specifier as `type Name` in a value
  import, or without `type` in a type import (TS1361, TS1484, TS2206), and no
  longer leaves a dangling comma when it moves the last specifier.
  `solid/prefer-class-object` no longer writes a second `class` attribute for
  `classList` next to `class`. `solid/event-handlers` no longer suggests the
  `attr:` namespace, which Solid 2.0 removed. `solid/no-server-import-in-client`
  finds the project root as the nearest folder that holds `src/server` (not the
  nearest `package.json`) and stops at the first folder with a `.git` or a
  package.json with `workspaces`, reads the directive prologue properly
  (`"use strict"; "use server";` is a server module, `"use server".length;` is
  not) and also checks `require("...")` and template literals in `import()`.
- a6d16f6: `solid/validate-jsx-nesting` is now the rule of `eslint-plugin-solid` 0.20: `validate-html-nesting` decides which pairs are invalid and parse5 whether the HTML parser really restructures them, instead of a hand-written copy of the parser's repairs. It follows the namespace the parser is in, so `<svg><a><a /></a></svg>` stays valid and `<svg><foreignObject><a><a /></a></foreignObject></svg>` is reported. `parse5` and `validate-html-nesting` are runtime dependencies now. Runtime dependencies are on their current majors (`is-html` 3, `kebab-case` 2, `style-to-object` 2, `known-css-properties` 0.37, which drops `anchor-default`, `anchor-scroll` and `position-fallback` and knows `position-area`, `interpolate-size` and more). A `THIRD_PARTY_NOTICES.md` with the eslint-plugin-solid licence now ships with the package.

### Patch Changes

- 2e4e77d: Autofix and import-list fixes. `solid/no-destructure` now adds the `merge`/`omit` import from `solid-js` (or calls the existing import by its local name). The shared import helper no longer turns `import * as X from "solid-js"` into the invalid `import * as X, { ... }`; it writes a separate named import (affects `solid/jsx-no-undef` and `solid/imports`). `solid/imports` no longer lists `storePath` (not exported by `solid-js` 2.x), `ClassValue` (only `JSX.ClassValue` exists) or `ValidComponent` (`solid-js` and `@solidjs/web` each declare their own).
- 1c31605: Review fixes for the Solid 2.0.2 autofixes. `solid/no-destructure` no longer produces a duplicate binding when the file already has a `merge` or `omit` (another import, a local declaration): it imports the `solid-js` one under a free alias (`merge as solidMerge`, then `solidMerge2`, ...) and calls that. One `oxlint --fix` run fixes every destructuring component of a file again: the fix of the first component carries the `solid-js` import for all of them, so the fixes no longer overlap. If such a fix is dropped (another rule's fix overlaps it), later runs heal the file: in a file with JSX or a `solid-js` import, calls of the shape the fix writes (`merge({ ... }, props)`, `omit(props, "a", "b")`, and their `solidMerge`/`solidOmit` aliases) that no binding resolves get their own `solid/no-destructure` report, whose fix adds the `solid-js` import for them. `solid/imports` no longer suggests `createOwner`, `createErrorBoundary`, `createLoadingBoundary` and `createRevealOrder`, which `solid-js` 2.0.2 marks `@internal` and strips from its type declarations.

## 1.3.0

### Minor Changes

- 0d666d6: New rules for the Solid 2.0 model, all syntax and scope only:
  `solid/reactive-async` (reads after an `await` in reactive computations,
  `async` callbacks that only `return await`),
  `solid/no-server-import-in-client` (client code importing a `src/server/`
  module that is not a `"use server"` module) and `solid/strict-void-return`
  (replaces the typed rule for handlers, `ref`, `onCleanup` and `onSettled`).
  The shared Solid lint config enables them and turns off
  `typescript/promise-function-async` and `typescript/strict-void-return` for
  `*.tsx`/`*.jsx`.

## 1.2.0

### Minor Changes

- 8fdeefb: Add two rules for Solid 2.0's split effects and unowned ref
  callbacks, and repair two existing ones.

  `solid/no-untracked-effect-read` reports a reactive read in the apply phase
  of a two-argument `createEffect`. That phase runs untracked, so
  `createEffect(() => roomId(), (id) => connect(id, theme()))` never re-runs
  when `theme` changes. Nothing reported this: `reactivity` marks the apply
  phase as a tracked scope, and its model has no state for "matches, but does
  not subscribe".

  `solid/no-owned-primitives-in-ref` reports `createEffect`, `onCleanup` and
  related primitives inside a ref callback. Solid 2.0 ref callbacks are
  unowned — `getOwner()` returns null — so the effect is never disposed and
  the cleanup never runs. Directive factories, which create these primitives
  while they still have an owner, are unaffected.

  `solid/no-setter-in-effect` now also reports an async apply phase that
  awaits and writes the result back into a signal. Its existing check requires
  every statement to be a setter call, which an `await` breaks.

  `solid/prefer-class-object` matched only the lowercase `classlist`. JSX prop
  names are case-sensitive and the Solid 1 prop is `classList`, so the
  migration rule missed every real call site.

  `solid/imports` now knows `createLoadingBoundary`, `createErrorBoundary` and
  `createRevealOrder`, so importing one from the wrong module is reported like
  every neighbouring primitive.

  `solid/jsx-no-duplicate-props` recommended `classList`, which Solid 2.0
  removed and the neighbouring rule reports. It now points at the object and
  array forms of `class`.

## 1.1.0

### Minor Changes

- d622c99: `reactivity`: report a reactive read after an await, not the `async`
  keyword.

  The rule rejected any async tracked scope, citing the Solid 1.x docs:
  _"[Solid's] approach only tracks synchronously. If you have a setTimeout or
  use an async function in your Effect the code that executes async after the
  fact won't be tracked."_

  Solid 2.0 makes async computations a feature — _"Solid computations can
  return promises and async iterables"_ — and `createMemo(async () => …)` is
  the shape its async-reactivity documentation demonstrates. The rule was
  flagging the official pattern.

  The premise still holds; the conclusion no longer follows. From the 2.0
  docs: _"Dependency tracking is synchronous. An async computation registers
  reactive reads made before its first await. Reads made after an await do not
  create dependency edges."_ So the hazard is not the keyword, it is a read on
  the far side of an async gap — it silently registers no dependency, and the
  computation cannot re-run when that source changes.

  The check now runs where the rule already knows every reactive read in a
  scope, and reports the identifier rather than the function, with a message
  that names the variable and says what to do. `yield` counts alongside
  `await`: an async generator driven by `action` suspends there in the same
  way. Nested functions are skipped — their gaps are their own.

  Solid's development build raises this at runtime; catching it here also
  covers production, where that check is compiled out.

  Two new test cases cover a read after `await` and a read after `yield`. A
  third asserts that a computation reading its inputs before awaiting produces
  no `reactivity` output at all — that fixture was reported by the old rule,
  so the test fails against it.

## 1.0.0

### Major Changes

- 77ff985: Target Solid 2.0. Solid moved its renderers into `@solidjs/*`
  packages and pulled the store APIs into the core, and the plugin assumed the
  1.x layout throughout. The most consequential case was silent: the import
  tracker matched only `solid-js`, so every import-tracking rule went blind
  against `@solidjs/web` and stopped reporting rather than failing.

  - `prefer-classlist` is renamed to `prefer-class-object`. It recommended
    `classlist`, which Solid 2.0 removed; it now moves the object onto
    `class`.
  - `no-unknown-namespaces` accepted `on:`, `oncapture:`, `use:`, `prop:`,
    `attr:`, `bool:`, `class:` and `style:`. All are gone, so only the DOM's
    own `xmlns:`/`xlink:` remain.
  - `no-proxy-apis` detected stores by the `solid-js/store` import path.
    Stores now live in the core that every file imports, so it matches the
    store API names instead.
  - Reactivity tracking follows the renames: `batch`/`produce` → `flush`,
    `onMount` → `onSettled`, `createSelector` → `createProjection`,
    `mergeProps` → `merge`, `indexArray` → `repeat`, `useTransition` removed.
  - `jsx-no-undef` auto-imports `Loading`/`Errored`/`Repeat`/`Reveal` instead
    of `Index`.
  - `createEffect` and `createRenderEffect` are split into `(compute, apply)`:
    the compute phase tracks, the apply phase polls. The `no-destructure`
    autofix emits `merge`/`omit`.

  Projects still on Solid 1.x can use this release with
  `"solid/imports": "off"`. That rule is the only active conflict: it reports
  `import type { JSX } from "solid-js"` and its autofix rewrites the import to
  `@solidjs/web`, which a Solid 1 project does not have installed. The other
  rules go quiet on Solid 1 patterns rather than misfiring, and TypeScript
  already rejects the removed exports (`Suspense`, `Index`, `createResource`,
  `onMount`, `mergeProps`) with a clearer message than a linter could give.

## 0.1.3

### Patch Changes

- 6057c2d: Fix `prefer-arrow-components` autofix producing overlapping edits
  when the import and function replacement span different ranges. Import is now
  embedded directly in the replacement text when needed to avoid multi-range
  conflicts.

## 0.1.2

### Patch Changes

- 2118889: Extend `prefer-arrow-components` to trigger on any `function`
  declaration with a `: JSX.Element` return type annotation, regardless of
  whether it is exported or PascalCase. Intent to write a component is clear
  from the return type.

## 0.1.1

### Patch Changes

- dd76850: Fix `prefer-arrow-components` rule to trigger on `export function`
  components with destructured props (`ObjectPattern`). Previously only
  `Identifier` params were detected; now all three forms — named props,
  destructured props, and no props — are correctly flagged and auto-fixed.

This file exists so `changesets/action` can open a package changelog when it
creates the release PR branch.
