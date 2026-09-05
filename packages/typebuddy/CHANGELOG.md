# @murky-web/typebuddy

## 1.3.0

### Minor Changes

- e6e38a1: Name the settled result, and stop forcing a result onto code that throws.

  `MaybePromise<T>` had a name for `Promise<Success<T> | Failed>` but none for what
  it resolves to. Anything holding an already-awaited outcome had to restate the
  union or reach for `Awaited<...>` to undo a wrapper that was no longer there —
  describing the route taken rather than the thing being held.

  ```ts
  type Result<T> = Success<T> | Failed;
  type MaybePromise<T> = Promise<Result<T>>;
  ```

  `AsyncResult<T>` is added as an alias for `MaybePromise<T>`. Elsewhere in the
  ecosystem `MaybePromise<T>` almost always means `T | Promise<T>` — a value that
  may or may not be a promise — so a reader who knows that convention reads this
  one wrong. `MaybePromise` keeps working and is still what `prefer-maybe-promise`
  suggests; `AsyncResult` is there for new code.

  `prefer-maybe-promise` and `require-try-catch` now leave a function alone when
  its body throws. A `throw` is the author saying this failure is not a value to
  hand back: a missing manifest for a route being navigated to, an unreachable
  branch, a broken invariant. Wrapping those in `err()` turns a bug into a
  silently handled outcome, and the caller degrades politely instead of surfacing
  that something is wrong. The rules exist to push _recoverable_ failures into the
  return type, not to abolish throwing.

  The exemption is shared between both rules rather than written twice — two rules
  disagreeing about what counts as throwing is exactly the drift worth preventing.
  A throw inside a nested function belongs to that function and does not count; a
  rethrow inside `catch` does.

  Measured against the rules' own smoke fixtures: a file with two deliberately
  throwing async functions goes from five reports to none, while the existing
  violation fixtures are unchanged.

- f6d563b: Split `type_helper.ts` into six modules and publish each as its own entry point.

  Every helper lived in one 669-line module. For a production bundle that was fine —
  the file has no module-level side effects and `"sideEffects": false` holds, so rollup
  shakes it per binding and an app that calls `isString` ships `isString`. Verified: a
  client build using four helpers carried none of the other 34.

  Dev is a different pipeline. Vite's dependency optimizer prebundles per _entry point_,
  not per binding, so importing anything from `@murky-web/typebuddy` produced a chunk
  holding all 38 exports. Splitting the source alone would not have changed that — the
  optimizer would still see one entry. Subpath exports are what changes it, and the
  split is their prerequisite.

  ```ts
  import { isString } from "@murky-web/typebuddy/guards";
  import { ok, err } from "@murky-web/typebuddy/result";
  ```

  Measured with esbuild, which is what the optimizer runs, as the size of each entry
  with its export surface intact:

  | entry          | bundled |
  | -------------- | ------- |
  | `.`            | 6 728 B |
  | `/guards`      | 2 574 B |
  | `/parse`       | 3 126 B |
  | `/empty`       | 1 814 B |
  | `/ids`         | 490 B   |
  | `/collections` | 446 B   |
  | `/result`      | 317 B   |

  A consumer of `guards` + `result` goes from 6 728 B to 2 891 B.

  `/result` is deliberately dependency-free: `ok`, `err` and `isSuccess` reference no
  guard, so a caller doing result plumbing pulls 317 B and nothing else. `/ids` exists
  because its two regex literals are the only module-level allocations in the package —
  a bundler that retains anything in a module retains those, so they should not sit in
  the module everyone imports.

  Not breaking. The root entry still exports all 38 names, `src/type_helper.ts` still
  resolves and re-exports everything, and no existing import needs to change — the
  subpaths are an addition, taken only where a smaller dev chunk is worth the longer
  specifier.

  A new `smoke:subpath` check walks the exports map and fails if a subpath points at a
  file the build did not emit, which is how this arrangement rots: a helper moves, the
  export is added, the tsdown entry is forgotten, and nothing complains until a consumer
  tries to import it. It also asserts the groups stayed independent.

## 1.2.0

### Minor Changes

- 77ff985: Expose the global type helpers from the package entry. `globals.ts` already declared `Maybe`, `Nullable`, `Optional`, `MaybePromise`, `Stringified` and the `JSON.stringify` augmentation, but nothing pulled that file into a consumer's program: reaching the globals required a `.d.ts` shim in the project root plus an `include` entry naming it, and a narrowed `include` dropped the shim silently, taking every global with it.

  A side-effect type import in `src/index.ts` means any program that imports this package anywhere now gets the globals, with no tsconfig entry at all. It also makes the `typeRoots` route work, which was previously a dead end — `types` resolves only through `typeRoots`, never through ordinary package resolution, so both `types: ["@murky-web/typebuddy"]` and `types: ["@murky-web/typebuddy/globals"]` failed with `TS2688`.

  This changes behaviour for every consumer: importing the package now brings the global declarations along whether or not they were asked for. A project that declares its own `Maybe` or `Optional` at global scope will see a conflict.

This file exists so `changesets/action` can open a package changelog when it
creates the release PR branch.
