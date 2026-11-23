# @murky-web/oxlint-plugin-solid

## 1.7.0

### Minor Changes

- 4ab6334: New rule `solid/no-magic-numbers`, a fork of eslint's `no-magic-numbers` with
  the same options. Its message names the number with its code and the constant to
  write (`const RETRY_DELAY_MS = 1000;` at module scope, used as
  `setTimeout(retry, RETRY_DELAY_MS)`), with a unit when the code shows one, and a
  named capture group for `match[3]`. The new option `allowHttpStatusCodes` allows
  100-599 only where the number is an HTTP status: Hono's `c.json(body, 404)` and
  its siblings, `c.status(404)`, `new HTTPException(404)`, `{ status: 404 }` and
  `res.status === 404`.

  `oxc-config` switches `eslint/no-magic-numbers` off and turns
  `solid/no-magic-numbers` on in `linting/solid.jsonc` with the same options,
  without `allowHttpStatusCodes`.

## 1.6.0

### Minor Changes

- b84462f: Every rule is named with its plugin prefix. Bare names made oxlint pick one
  plugin per name: `no-nested-ternary`, `no-lonely-if` and
  `typescript/prefer-string-starts-ends-with` were switched off by unicorn's
  "off", the typescript versions of `require-await`, `no-implied-eval`,
  `prefer-promise-reject-errors` and `no-namespace` and the unicorn versions of
  `prefer-includes` and `prefer-spread` never ran, and 14 vitest rules
  (`expect-expect`, `no-focused-tests`, `valid-expect`, ...) resolved to the
  unloaded jest plugin. All of them are on now. `bun run test` in the package
  fails on a bare rule name.

  `solid/no-proxy-apis` is off: it is meant for targets without Proxy and reported
  every `createStore`. jsx-a11y treats Solid's `for` like `htmlFor`.

  `prefer-destructuring` is off: destructuring props or a store copies the value
  once and drops reactivity.

  In `*.tsx`/`*.jsx`, `typescript/explicit-function-return-type` is off: Solid's
  docs write derived values as un-annotated accessors
  (`const total = () => props.price * props.qty`). Exports keep
  `explicit-module-boundary-types`.

  New rule `solid/typed-merge-defaults`, enabled in oxc-config: an object literal
  passed to `merge` needs `satisfies Partial<Props>` (or `as const`), because a
  plain literal widens `"primary"` to `string` and `as Partial<Props>` makes the
  defaults optional again.

  In `*.tsx`/`*.jsx`, `eslint/no-ternary` is off: Solid evaluates a ternary in an
  attribute or child reactively, and the compiler memoizes element branches.
  `no-nested-ternary` and `no-unneeded-ternary` stay on.

- 96942c3: Reads after an `await` are reported once, by `reactive-async`, and only for a
  source first read after the first `await` or `yield`, as Solid's runtime does;
  `reactivity` no longer reports them a second time. The hint now recommends
  reading before the first `await` or reading every input synchronously in a
  helper call, never `untrack()`. New rule `no-single-arg-create-effect` from
  eslint-plugin-solid 0.20.1 replaces the "should not be async" report on a
  single-function `createEffect`; an async compute in
  `createEffect(compute, apply)` stays allowed.
- 2ca2286: Effect rules built from the Solid 2.0 effect docs, documented in
  `docs/solid-2-effects.md`, which the effect rules now link to.

  - New rule `solid/no-cleanup-in-effect-apply`: `onCleanup` in an effect function
    (NO_OWNER_CLEANUP, the cleanup never runs) or in an `onSettled` /
    `createTrackedEffect` callback (CLEANUP_IN_FORBIDDEN_SCOPE). Suggests
    `return fn` in place of a trailing `onCleanup(fn)`. On in `oxc-config`.
  - `solid/no-react-deps` no longer autofixes an effect into `createEffect(fn, )`,
    which threw MISSING_EFFECT_FN. It also covers `createRenderEffect` and arrays
    in the third argument, suggests the two-phase split
    `createEffect(() => ({ a: a() }), ({ a }) => { … })` and `onSettled` for `[]`,
    and autofixes a memo only when its function reads every dependency.
  - `solid/no-setter-in-effect` also reports an effect function that writes a
    signal or store its compute function reads (EFFECT_WRITES_OWN_SOURCE), and its
    relay messages name the docs' fixes: a plain function or `createMemo`, a
    writable derivation, or an async memo under `<Loading>`.

- 13af934: New rule `solid/filename-matches-export` for `.tsx`/`.jsx` files: a file that
  exports a component is named after it in PascalCase (`Navigate.tsx` exports
  `Navigate`, a default export wins), and a file without a component stays
  snake_case (`solid_ssr_renderer.tsx`). `index.tsx` is always allowed; the
  `ignore` option (default `["**/pages/**", "**/routes/**"]`) skips route folders.
  No autofix. `oxc-config` turns it on for `*.tsx`/`*.jsx` and lets
  `unicorn/filename-case` accept snakeCase and pascalCase there; `.ts` files stay
  snakeCase.
- 0f16479: New rule `solid/function-size`: eslint's `max-lines-per-function` count (blank
  and comment lines don't count, IIFEs count on their own) with a message that
  says what to extract and where. Components (a PascalCase function with JSX in a
  `.tsx`/`.jsx` file) get `maxComponent`, `createX`/`useX` primitives and other
  functions get `max`, each with its own message. Every message allows keeping a
  cohesive unit whole with a one-line comment above it and rules out
  `// oxlint-disable`.

  `oxc-config` warns instead of erroring on size and complexity:
  `solid/function-size` at `{ "max": 60, "maxComponent": 80 }` replaces
  `eslint/max-lines-per-function` (now off), `eslint/complexity` drops from 30 to
  20, and `eslint/max-lines` drops from 1000 to 400 code lines (`skipBlankLines`,
  `skipComments`). `**/*.generated.*` files are exempt from all three.

- 978b39e: New rule `solid/no-unassigned-vars`, ported from eslint-plugin-solid 0.20.1:
  eslint's `no-unassigned-vars`, except that `ref={el}` and `ref={el!}` count as
  an assignment. A bare `el` in a `ref={[…]}` array is left to
  `solid/prefer-ref-shorthand`. `oxc-config` turns it on for `*.tsx`/`*.jsx` in
  place of `eslint/no-unassigned-vars`, which stays on for everything else.
- dfa9f20: Two rules for Solid 2.0 refs.

  - New rule `solid/init-declarations`: eslint's `init-declarations` ("always"),
    except for a `let` that a `ref` assigns (`let el!: HTMLDivElement;` with
    `ref={el}`, or `el = node` in a ref callback). `oxc-config` turns it on for
    `*.tsx`/`*.jsx` in place of `eslint/init-declarations`, which stays on for
    everything else.
  - New rule `solid/prefer-ref-shorthand`: autofixes a ref callback that only
    stores the element, `ref={(node) => { el = node; }}`, to `ref={el}`, and
    reports a bare variable in a `ref={[…]}` array, which Solid never assigns,
    with the suggestion `(node) => { el = node; }`. On in `oxc-config`.

- 3a90ddb: Two rules from eslint-plugin-solid 0.20.1, enabled in oxc-config:
  `no-module-scope-reactive-primitive` (reactive state at module scope is shared
  by every SSR request) and `no-write-in-pure-computation` (setters in
  `createMemo`, the compute half of `createEffect`, or a component body).

### Patch Changes

- fc48e97: The messages of `components-return-once`, `event-handlers`, `imports`,
  `jsx-no-duplicate-props`, `jsx-no-script-url`, `jsx-no-undef`,
  `no-array-handlers`, `no-innerhtml`, `no-proxy-apis`, `no-react-deps`,
  `no-react-specific-props`, `no-server-import-in-client`,
  `no-unknown-namespaces`, `prefer-arrow-components`, `prefer-class-object`,
  `prefer-for`, `prefer-show`, `self-closing-comp`, `strict-void-return`,
  `style-prop` and `validate-jsx-nesting` name the offending code, say what goes
  wrong at run time in Solid 2.0, and give a copyable `Fix:` built from the code's
  own names, plus a `Do not:` where a tempting non-fix exists. What the rules
  report is unchanged.
- 957a0f4: `solid/prefer-show` reports only branches that are visibly JSX. An Identifier
  branch such as `{c() ? label : "b"}` may hold text, where a ternary is cheaper
  than `<Show>`. The `&&` rewrite is now a suggestion instead of an autofix:
  `{count() && <Badge />}` renders `0` when `count()` is 0, and `<Show>` renders
  nothing.
- 3b6f128: `no-unknown-namespaces` no longer reports `prop:` on a custom element
  (`<my-chart prop:data={points()}>`), where Solid 2.0 uses it to set a property.
  It still reports `prop:` on built-in elements.
- 701a657: `reactivity` no longer reports the entries of a React-style dependency array
  (`createEffect(fn, [a, b])`); `no-react-deps` reports the array once, with the
  2.0 rewrite. `reactivity` had suggested `() => [a, b]`, which is not the fix.
- 05564cd: `reactivity` names the fix when a reactive value is read where a handler on a
  native element is bound (`onClick={editing() ? save : cancel}`): the message
  quotes the expression and gives a copyable replacement with the code's own
  names, and says not to use `untrack()` or disable the rule.
- a738651: `eslint/require-await` is off in favour of `typescript/require-await`, which
  lets an async function that returns a promise do without `await`: in `.ts`,
  `createMemo(async () => fetchUser(id()))` now passes both it and
  `typescript/promise-function-async`. `.tsx` keeps `promise-function-async` off,
  so the docs' `createMemo(() => fetchUser(id()))` stays allowed there.
  `reactive-async`'s `return await` fix keeps `async` in `.ts` and drops it in
  `.tsx`.

  In `*.tsx`/`*.jsx`, `eslint/no-void` allows `void` as a statement, so a handler
  can start an action, `onClick={() => { void save(); }}`, without tripping
  `no-floating-promises` or `no-misused-promises`.

  `typescript/prefer-readonly-parameter-types` is off: it demands deep readonly on
  every parameter and reports `Readonly<T>`, `ReadonlyMap` and service objects
  (loggers, the Hono app, caches) that cannot be readonly.

- ae1896e: The messages of `reactivity`, `reactive-async`, `no-write-in-pure-computation`,
  `no-setter-in-effect`, `no-untracked-effect-read`,
  `no-owned-primitives-in-ref`, `no-module-scope-reactive-primitive`,
  `no-single-arg-create-effect`, `typed-merge-defaults`, `prefer-destructuring`
  and `no-destructure` say what goes wrong at runtime and give a `Fix:` built
  from the code's own names (the setter call, the derived function, the
  `props.x` reads), plus a `Do not:` for the tempting non-fixes. What the rules
  report is unchanged.

## 1.5.1

### Patch Changes

- 3f17a2f: Source formatted with the shared oxfmt config: no trailing commas,
  4-space JSON and JSONC. No behaviour change.

## 1.5.0

### Minor Changes

- 1349fcc: `no-unknown-namespaces` has a new option `allowedNamespacedProps`: a
  list of exact namespaced prop names such as `"client:visible"`. Only these
  props pass. A typo (`client:visble`) or another prop of the same namespace is
  still reported, unlike with `allowedNamespaces`, which allows the whole
  namespace. Setting only one of the two options no longer fails oxlint's option
  validation.

## 1.4.1

### Patch Changes

- 7c46ee6: `no-unknown-namespaces`: `allowedNamespaces` now covers components,
  and the report on components no longer suggests deleting the prefix. Before,
  `<Island client:visible>` was always reported, and fix-on-save
  (`--fix-suggestions`) silently turned it into `<Island visible>`.

## 1.4.0

### Minor Changes

- 2e4e77d: Solid 2.0.2 stable API. `solid/imports` knows `createDeferred`,
  `createTrackedEffect`, `from`, `onFlush` and `repeat` (all `solid-js`).
  `solid/reactivity` treats `createDeferred` like an async memo (its callback is
  tracked and may return a promise, its result is an accessor), `until(fn)` as a
  tracked predicate and `onFlush` like `onSettled` (an untracked callback).
  `solid/reactive-async` checks `createDeferred` callbacks and accessors.
- e81d412: Audit fixes. `solid/validate-jsx-nesting` is implemented now (it did
  nothing): the shared config enables it as `error`, so projects that update
  start to get reports for `<p><div /></p>`, a link in a link, a row without a
  row group and the like (`<template>` content is not checked). It uses the
  table of invalid pairs of `validate-html-nesting` and a hand-written table of
  what the HTML parser repairs instead of parse5. `solid/jsx-no-script-url` now
  matches `javascript:` URLs with a tab, newline or control character in front
  of or inside the scheme (the pattern was an escaped string and matched none of
  them) and no longer flags `ABCjavascript:`. `solid/prefer-arrow-components`
  writes valid code for `export default function` (a `const` plus
  `export default Name;`), adds one `solid-js` type import at the top of the
  file instead of one next to every component, and only reports (no fix) a
  function that is read before its declaration, where the `const` would throw a
  ReferenceError. `solid/no-destructure` expands a shorthand property
  (`{ title }` becomes `{ title: props.title }`), picks a props name that no
  enclosing scope and no function around a rewritten read uses (`props2`) and
  only reports a nested pattern, a computed key that is not a literal or a write
  to a destructured name. `solid/imports` keeps a value specifier out of an
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
- a6d16f6: `solid/validate-jsx-nesting` is now the rule of `eslint-plugin-solid`
  0.20: `validate-html-nesting` decides which pairs are invalid and parse5
  whether the HTML parser really restructures them, instead of a hand-written
  copy of the parser's repairs. It follows the namespace the parser is in, so
  `<svg><a><a /></a></svg>` stays valid and
  `<svg><foreignObject><a><a /></a></foreignObject></svg>` is reported. `parse5`
  and `validate-html-nesting` are runtime dependencies now. Runtime dependencies
  are on their current majors (`is-html` 3, `kebab-case` 2, `style-to-object` 2,
  `known-css-properties` 0.37, which drops `anchor-default`, `anchor-scroll` and
  `position-fallback` and knows `position-area`, `interpolate-size` and more). A
  `THIRD_PARTY_NOTICES.md` with the eslint-plugin-solid licence now ships with
  the package.

### Patch Changes

- 2e4e77d: Autofix and import-list fixes. `solid/no-destructure` now adds the
  `merge`/`omit` import from `solid-js` (or calls the existing import by its
  local name). The shared import helper no longer turns
  `import * as X from "solid-js"` into the invalid `import * as X, { ... }`; it
  writes a separate named import (affects `solid/jsx-no-undef` and
  `solid/imports`). `solid/imports` no longer lists `storePath` (not exported by
  `solid-js` 2.x), `ClassValue` (only `JSX.ClassValue` exists) or
  `ValidComponent` (`solid-js` and `@solidjs/web` each declare their own).
- 1c31605: Review fixes for the Solid 2.0.2 autofixes. `solid/no-destructure` no
  longer produces a duplicate binding when the file already has a `merge` or
  `omit` (another import, a local declaration): it imports the `solid-js` one
  under a free alias (`merge as solidMerge`, then `solidMerge2`, ...) and calls
  that. One `oxlint --fix` run fixes every destructuring component of a file
  again: the fix of the first component carries the `solid-js` import for all of
  them, so the fixes no longer overlap. If such a fix is dropped (another rule's
  fix overlaps it), later runs heal the file: in a file with JSX or a `solid-js`
  import, calls of the shape the fix writes (`merge({ ... }, props)`,
  `omit(props, "a", "b")`, and their `solidMerge`/`solidOmit` aliases) that no
  binding resolves get their own `solid/no-destructure` report, whose fix adds
  the `solid-js` import for them. `solid/imports` no longer suggests
  `createOwner`, `createErrorBoundary`, `createLoadingBoundary` and
  `createRevealOrder`, which `solid-js` 2.0.2 marks `@internal` and strips from
  its type declarations.

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
