# @murky-web/oxc-config

## 0.1.1

### Patch Changes

- 6747c1e: Republish through CI with trusted publishing and provenance. The
  hand-published 0.1.0 has registry metadata but no downloadable tarball.

## 0.1.0

### Minor Changes

- 0190192: New package: the shared oxfmt and oxlint configuration, so projects
  extend it from node_modules instead of keeping a copy.
- b84462f: Every rule is named with its plugin prefix. Bare names made oxlint
  pick one plugin per name: `no-nested-ternary`, `no-lonely-if` and
  `typescript/prefer-string-starts-ends-with` were switched off by unicorn's
  "off", the typescript versions of `require-await`, `no-implied-eval`,
  `prefer-promise-reject-errors` and `no-namespace` and the unicorn versions of
  `prefer-includes` and `prefer-spread` never ran, and 14 vitest rules
  (`expect-expect`, `no-focused-tests`, `valid-expect`, ...) resolved to the
  unloaded jest plugin. All of them are on now. `bun run test` in the package
  fails on a bare rule name.

    `solid/no-proxy-apis` is off: it is meant for targets without Proxy and
    reported every `createStore`. jsx-a11y treats Solid's `for` like `htmlFor`.

    `prefer-destructuring` is off: destructuring props or a store copies the
    value once and drops reactivity.

    In `*.tsx`/`*.jsx`, `typescript/explicit-function-return-type` is off:
    Solid's docs write derived values as un-annotated accessors
    (`const total = () => props.price * props.qty`). Exports keep
    `explicit-module-boundary-types`.

    New rule `solid/typed-merge-defaults`, enabled in oxc-config: an object
    literal passed to `merge` needs `satisfies Partial<Props>` (or `as const`),
    because a plain literal widens `"primary"` to `string` and
    `as Partial<Props>` makes the defaults optional again.

    In `*.tsx`/`*.jsx`, `eslint/no-ternary` is off: Solid evaluates a ternary in
    an attribute or child reactively, and the compiler memoizes element
    branches. `no-nested-ternary` and `no-unneeded-ternary` stay on.

- 96942c3: Reads after an `await` are reported once, by `reactive-async`, and
  only for a source first read after the first `await` or `yield`, as Solid's
  runtime does; `reactivity` no longer reports them a second time. The hint now
  recommends reading before the first `await` or reading every input
  synchronously in a helper call, never `untrack()`. New rule
  `no-single-arg-create-effect` from eslint-plugin-solid 0.20.1 replaces the
  "should not be async" report on a single-function `createEffect`; an async
  compute in `createEffect(compute, apply)` stays allowed.
- 0f16479: New rule `solid/function-size`: eslint's `max-lines-per-function`
  count (blank and comment lines don't count, IIFEs count on their own) with a
  message that says what to extract and where. Components (a PascalCase function
  with JSX in a `.tsx`/`.jsx` file) get `maxComponent`, `createX`/`useX`
  primitives and other functions get `max`, each with its own message. Every
  message allows keeping a cohesive unit whole with a one-line comment above it
  and rules out `// oxlint-disable`.

    `oxc-config` warns instead of erroring on size and complexity:
    `solid/function-size` at `{ "max": 60, "maxComponent": 80 }` replaces
    `eslint/max-lines-per-function` (now off), `eslint/complexity` drops from 30
    to 20, and `eslint/max-lines` drops from 1000 to 400 code lines
    (`skipBlankLines`, `skipComments`). `**/*.generated.*` files are exempt from
    all three.

- 3a90ddb: Two rules from eslint-plugin-solid 0.20.1, enabled in oxc-config:
  `no-module-scope-reactive-primitive` (reactive state at module scope is shared
  by every SSR request) and `no-write-in-pure-computation` (setters in
  `createMemo`, the compute half of `createEffect`, or a component body).

### Patch Changes

- 8947b21: `unicorn/no-useless-undefined` is off and
  `typebuddy/no-useless-undefined` is on in `linting/typebuddy.jsonc`. The fork
  keeps `let x: Optional<T> = undefined`, which the unicorn rule reported
  although `eslint/init-declarations` wants every `let` initialized.
- a738651: `eslint/require-await` is off in favour of
  `typescript/require-await`, which lets an async function that returns a
  promise do without `await`: in `.ts`,
  `createMemo(async () => fetchUser(id()))` now passes both it and
  `typescript/promise-function-async`. `.tsx` keeps `promise-function-async`
  off, so the docs' `createMemo(() => fetchUser(id()))` stays allowed there.
  `reactive-async`'s `return await` fix keeps `async` in `.ts` and drops it in
  `.tsx`.

    In `*.tsx`/`*.jsx`, `eslint/no-void` allows `void` as a statement, so a
    handler can start an action, `onClick={() => { void save(); }}`, without
    tripping `no-floating-promises` or `no-misused-promises`.

    `typescript/prefer-readonly-parameter-types` is off: it demands deep
    readonly on every parameter and reports `Readonly<T>`, `ReadonlyMap` and
    service objects (loggers, the Hono app, caches) that cannot be readonly.

- 2ca2286: Effect rules built from the Solid 2.0 effect docs, documented in
  `docs/solid-2-effects.md`, which the effect rules now link to.

    - New rule `solid/no-cleanup-in-effect-apply`: `onCleanup` in an effect
      function (NO_OWNER_CLEANUP, the cleanup never runs) or in an `onSettled` /
      `createTrackedEffect` callback (CLEANUP_IN_FORBIDDEN_SCOPE). Suggests
      `return fn` in place of a trailing `onCleanup(fn)`. On in `oxc-config`.
    - `solid/no-react-deps` no longer autofixes an effect into
      `createEffect(fn, )`, which threw MISSING_EFFECT_FN. It also covers
      `createRenderEffect` and arrays in the third argument, suggests the
      two-phase split `createEffect(() => ({ a: a() }), ({ a }) => { … })` and
      `onSettled` for `[]`, and autofixes a memo only when its function reads
      every dependency.
    - `solid/no-setter-in-effect` also reports an effect function that writes a
      signal or store its compute function reads (EFFECT_WRITES_OWN_SOURCE), and
      its relay messages name the docs' fixes: a plain function or `createMemo`,
      a writable derivation, or an async memo under `<Loading>`.

- 13af934: New rule `solid/filename-matches-export` for `.tsx`/`.jsx` files: a
  file that exports a component is named after it in PascalCase (`Navigate.tsx`
  exports `Navigate`, a default export wins), and a file without a component
  stays snake_case (`solid_ssr_renderer.tsx`). `index.tsx` is always allowed;
  the `ignore` option (default `["**/pages/**", "**/routes/**"]`) skips route
  folders. No autofix. `oxc-config` turns it on for `*.tsx`/`*.jsx` and lets
  `unicorn/filename-case` accept snakeCase and pascalCase there; `.ts` files
  stay snakeCase.
- 978b39e: New rule `solid/no-unassigned-vars`, ported from eslint-plugin-solid
  0.20.1: eslint's `no-unassigned-vars`, except that `ref={el}` and `ref={el!}`
  count as an assignment. A bare `el` in a `ref={[…]}` array is left to
  `solid/prefer-ref-shorthand`. `oxc-config` turns it on for `*.tsx`/`*.jsx` in
  place of `eslint/no-unassigned-vars`, which stays on for everything else.
- dfa9f20: Two rules for Solid 2.0 refs.

    - New rule `solid/init-declarations`: eslint's `init-declarations`
      ("always"), except for a `let` that a `ref` assigns
      (`let el!: HTMLDivElement;` with `ref={el}`, or `el = node` in a ref
      callback). `oxc-config` turns it on for `*.tsx`/`*.jsx` in place of
      `eslint/init-declarations`, which stays on for everything else.
    - New rule `solid/prefer-ref-shorthand`: autofixes a ref callback that only
      stores the element, `ref={(node) => { el = node; }}`, to `ref={el}`, and
      reports a bare variable in a `ref={[…]}` array, which Solid never assigns,
      with the suggestion `(node) => { el = node; }`. On in `oxc-config`.
