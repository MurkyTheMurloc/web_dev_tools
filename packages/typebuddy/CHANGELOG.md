# @murky-web/typebuddy

## 3.0.1

### Patch Changes

- 3f17a2f: Source formatted with the shared oxfmt config: no trailing commas, 4-space JSON and JSONC. No behaviour change.

## 3.0.0

### Major Changes

- 4d70070: Fixes from the audit of typebuddy: types that disagreed with the runtime, guards and parsers that accepted too much, and oxlint autofixes that changed what the code means. Several of them change types or results, so this is a major release. The README has a migration note.

  Breaking

  - `isNumber` narrows to `FiniteNumber<T>` (a brand over `number`) instead of `number`. The false branch keeps `number`: after `if (!isNumber(value))` a `number | null` stays `number | null` (before it became `null`, although `NaN` and `Infinity` land there too). `FiniteNumber` is assignable to `number`. The brand also spreads into inferred types: `[1, null].filter(isNumber)` is `FiniteNumber[]`, so `.push(3)` fails; widen with an annotation, `const xs: number[] = …`. `isInteger` and `isFloat` do the same with the brands `IntegerNumber` and `FloatNumber`.
  - `isEmptyObject` has no type parameter any more. It is `isEmptyObject(value: unknown): value is EmptyObject` with `EmptyObject = Record<string, never>`; the old overload narrowed to the caller's own type `T` and so removed a non-empty object from the false branch.
  - `parseArray` overload types: `parseArray(value: number)` is typed `number[] | undefined` (`parseArray(NaN)` has no array).
  - `Success<T>` is `{ isError: false; value: T }` and `Failed` is `{ isError: true; value: null }`. `Success<null>` was typed `isError: true` before, and `isSuccess` rejected `Result<T | null>` and a generic `Result<T>` (TS2345) and narrowed `Result<any>` to `never`. All three work now. Code that relied on `Success<null>` having `isError: true` has to read `value`.
  - `JSON.parse` of a `Stringified<T>` returns `JsonifiedValue<T>` (was `JsonifiedObject<T>`; global `JSON` augmentation in `globals.d.ts`). Generic code that declares `JsonifiedObject<T>` as the return type fails to compile and has to change it. `JSON.parse(JSON.stringify(x))` and `JsonifiedValue` also keep arrays and tuples as arrays and tuples now (`.map` works again; elements JSON cannot hold become `null`), and type a `Map` or `Set` as `Record<string, never>`. `number` stays `number`: `NaN` and `Infinity` serialise to `null`, which a type cannot express. The global `JSON` augmentation stays in the root entry, because dropping it would break every project that uses the global `Maybe`/`MaybePromise` names or the `JSON` typing without a `types` entry.
  - Parse helpers return different results at runtime:
    - `parseInteger`, `parseFloat` and `parseNumber`: a blank string gives the default (was `0`); the whole string has to be a number (`"12abc"` was `12`).
    - Grouped and mixed comma forms give the default: `"1,000"` (was `1`) and `"1,234.56"` (was `1.234`). A comma stays valid as the sole decimal separator (`"1,5"` is `1.5`), also after a lone zero (`"0,500"` is `0.5`).
    - `parseInteger` takes digits only: `"1e3"`, `"0x10"` and `"0e0"` give the default (`"42.0"` still parses), it truncates numbers toward zero (`-1.5` is `-1`, was `-2`), and it refuses integers beyond the safe range, as a string (`"9007199254740993"`) and as a number (`1e21`).
    - `parseFloat` takes decimal notation (`"0x10"` gives the default); `parseNumber` still takes everything `Number()` takes for the whole string (`"1e3"`, `"0xff"`).
    - `parseFloat` and `parseNumber` return `0` for `-0` and `"-0"`, like `parseInteger`.
    - `parseArray({ a: 1 })` is `[{ a: 1 }]` (was `undefined`).
  - `isEmptyObject` counts symbol keys and non-enumerable keys: `{ [Symbol()]: 1 }` is not empty any more.
  - Other guards answer differently: `isFloat(Infinity)` is `false` (was `true`), like `isNumber(Infinity)`; `fastIsArray` is `Array.isArray`, so `{ [Symbol.toStringTag]: "Array" }` is no longer an array; `isUuidString` accepts versions 1 to 8 and the nil and max UUID (was 1 to 5); `isUlidString` accepts lower case and rejects a first character above `7`.
  - Oxlint autofixes that became suggestions (`--fix` no longer applies them; apply them from the editor): `prefer-maybe-promise` wrapping a returned value in `ok(...)`, and `Promise` to `MaybePromise` in an interface method, a function type or an overload; `require-try-catch` wrapping a body in `try`/`catch`. `Promise` to `MaybePromise` on the file's own async function is a suggestion too in a script file, where `ok` and `err` cannot be imported.
  - Oxlint autofixes now add import lines: `prefer-maybe`, `prefer-nullable`, `prefer-optional` and the `MaybePromise` fix add `import type { … } from "@murky-web/typebuddy"` (or merge into an existing import of the package) in module files. Projects that relied on the global `Maybe`/`Nullable`/`Optional`/`MaybePromise` names get the import where they had none; script files are left alone.

  Other changes

  - `isPromise` accepts callable thenables, and answers `false` instead of throwing when reading `then` throws or the value is a revoked Proxy. `isEmptyObject` answers `false` for a revoked Proxy.
  - `isEmptyLike` no longer overflows the stack on a cyclic array or object.
  - `parseDomainName` is unchanged and now documents that it returns the leftmost label (`"example.attacker.net"` is `"example"`) and must not be used for allowlists.
  - Oxlint rules: no autofix calls a name that is not ours. `catch (err) { … }` no longer gets `return err()`, a local `ok` no longer gets `ok(ok)`, another library's `Maybe` or `MaybePromise` is not replaced. The scope decides, not the import list. `ok` and `err` imported from `@murky-web/typebuddy/result` count, and no second import is added.
  - Oxlint rules: a fix that needs an import carries it (so a dropped fix cannot leave another one without it) and merges it into an existing import from the package (a type as `import type`, or as an inline `type` specifier of a value import); otherwise it adds a new line after the last import or after the directive prologue (`"use client"`), never above it. `declare global` and `declare module` blocks in a module get the import like other code. In a script file (no `import` or `export`, e.g. `vite-env.d.ts`) no import is added, because that would turn the script into a module and take its globals away: types are written by their global name, a fix that needs `ok` or `err` is not offered. Fixes that need the same import share one insertion point, so one `--fix` pass applies one of them and the next pass applies the rest.
  - Oxlint rules: `require-try-catch` keeps `"use cache"` and `"use server"` as directives. `prefer-maybe-promise` and `require-try-catch` skip async generators.
  - Packaging: the root entry is split. `src/public_api.ts` holds the exports and `src/index.ts` adds the global augmentation on top for npm. JSR publishes `src/public_api.ts` as its root export and excludes `src/index.ts`, so the published graph no longer imports the excluded `globals.d.ts`.

### Minor Changes

- f895542: The oxlint rules (`prefer-maybe`, `prefer-maybe-promise`, `prefer-nullable`, `prefer-optional`, `require-try-catch`) skip test files. Test helpers, fixtures and mocks no longer have to return `MaybePromise` results or use `Maybe`/`Nullable`/`Optional`. A test file is `*.test.*`, `*.spec.*` or `*.bench.*`, anything under a `__tests__/`, `tests/`, `test/` or `__mocks__/` directory, or a `vitest.setup.*`, `vitest-setup.*` or `setupTests.*` file. Names that merely contain `test`, like `latest.ts` or `contest.ts`, are still checked. Directories are matched relative to the directory oxlint runs in, so a project that lives under a folder named `test` is not silenced.

## 2.1.0

### Minor Changes

- 71b9457: `isSuccess` narrows a `Result<T>` to its `Success<T>` member: after
  the check, `result.value` is `T`, not `T | null`. The type parameter is now
  the whole result (`isSuccess<Result<T>>(…)` if you spelled it out); inferring
  it, as almost every caller does, needs no change.
- d2f9215: `require-try-catch` and `prefer-maybe-promise` skip `"use server"`
  code: files whose first statement is the directive, and functions whose body
  starts with it. Server functions log and throw on failure and the page catches
  the throw with `<Errored>`; a returned failure would resolve the caller's
  promise as success.

## 2.0.0

### Major Changes

- 3f873f5: Remove the `@murky-web/typebuddy/biome` entry point.

  Biome is no longer supported. The `./biome` export (`MaybePromiseRule`,
  `OptionalRule`, `TryCatchAsyncRule`) and the Grit plugin files it pointed at
  are gone from npm and JSR. Use the `@murky-web/typebuddy/oxlint` plugin with
  oxlint instead; it has the matching rules.

## 1.5.0

### Minor Changes

- c3507ec: Ship `@murky-web/typebuddy/globals` as a declaration file, so it
  works in `compilerOptions.types`.

  `"types": ["@murky-web/typebuddy/globals"]` failed with
  `TS2688: Cannot find type definition file`. A `types` entry resolves only to
  `.d.ts` files, and the export pointed at `globals.ts`. The file is now
  `globals.d.ts`, and the export points at it. The `.d.ts` shim with
  `import type {} from "@murky-web/typebuddy/globals"` keeps working.

  The subpath no longer has a runtime file. `dist/globals.js` was always
  empty, so only a value import like `import "@murky-web/typebuddy/globals"`
  is affected; switch it to `import type {}`.

## 1.4.0

### Minor Changes

- 6c30131: Repair the oxlint autofixes and close the rules' blind spots.

  Two fixes were producing broken code. `prefer-maybe-promise` inserted
  `return err()` directly before a catch block's closing brace, so
  `catch { log("boom") }` became `catch { log("boom") return err(); }`, which
  does not parse. `require-try-catch` rebuilt the function body line by line
  and stripped leading whitespace from every line — including lines inside
  template literals, silently changing string values. It now wraps the body
  with two zero-width insertions and leaves it byte for byte intact.

  Six blind spots closed:

  - The catch branch settles on `err()`. It was fed to the same code path as
    the try block, so a catch return got two reports with opposite fixes
    (`ok(value)` and `err()`), and `--fix` appended an unreachable
    `return err()` after an existing return. Returns that hand back a value
    are now reported without a fix — rewriting them to `err()` would drop the
    author's fallback, and where the default belongs is the author's decision.
  - Returns nested inside an `if`, loop or `switch` in a try block are
    wrapped. Only the try block's direct children were, so
    `try { if (flag) return "early"; return "late"; }` wrapped just `"late"`.
  - `Promise<T>` in a type-level signature is reported. `TSDeclareFunction`,
    `TSFunctionType` and `TSMethodSignature` were routed through a check for
    `async`, which a type signature can never carry, so all three visitors
    were unreachable. Ambient `declare` context stays exempt: rewriting a
    third-party callback shape would misdescribe that API.
  - `MaybePromise` and `AsyncResult` count as awaited return types. Matching
    only `Promise` meant a bare `return;` in a `MaybePromise<void>` function
    was left alone while its `Promise<void>` twin was fixed — the rule went
    blind on already-migrated code, and on the spelling the package
    recommends.
  - Expression-bodied async arrows are reported and fixed.
    `async () => fetch(url)` has no block for the try/catch to live in and
    escaped entirely.
  - `null | undefined` is left alone instead of being rewritten to the
    equivalent-but-longer `Optional<null>`.

  Also fixed: an inserted helper import landed glued to the following
  statement in any file that starts with a comment. Whether to append after an
  existing import was inferred from the anchor's byte offset, which only
  answers that question in a file whose first statement begins at byte zero.

## 1.3.0

### Minor Changes

- e6e38a1: Name the settled result, and stop forcing a result onto code that
  throws.

  `MaybePromise<T>` had a name for `Promise<Success<T> | Failed>` but none for
  what it resolves to. Anything holding an already-awaited outcome had to
  restate the union or reach for `Awaited<...>` to undo a wrapper that was no
  longer there — describing the route taken rather than the thing being held.

  ```ts
  type Result<T> = Success<T> | Failed;
  type MaybePromise<T> = Promise<Result<T>>;
  ```

  `AsyncResult<T>` is added as an alias for `MaybePromise<T>`. Elsewhere in
  the ecosystem `MaybePromise<T>` almost always means `T | Promise<T>` — a
  value that may or may not be a promise — so a reader who knows that
  convention reads this one wrong. `MaybePromise` keeps working and is still
  what `prefer-maybe-promise` suggests; `AsyncResult` is there for new code.

  `prefer-maybe-promise` and `require-try-catch` now leave a function alone
  when its body throws. A `throw` is the author saying this failure is not a
  value to hand back: a missing manifest for a route being navigated to, an
  unreachable branch, a broken invariant. Wrapping those in `err()` turns a
  bug into a silently handled outcome, and the caller degrades politely
  instead of surfacing that something is wrong. The rules exist to push
  _recoverable_ failures into the return type, not to abolish throwing.

  The exemption is shared between both rules rather than written twice — two
  rules disagreeing about what counts as throwing is exactly the drift worth
  preventing. A throw inside a nested function belongs to that function and
  does not count; a rethrow inside `catch` does.

  Measured against the rules' own smoke fixtures: a file with two deliberately
  throwing async functions goes from five reports to none, while the existing
  violation fixtures are unchanged.

- f6d563b: Split `type_helper.ts` into six modules and publish each as its own
  entry point.

  Every helper lived in one 669-line module. For a production bundle that was
  fine — the file has no module-level side effects and `"sideEffects": false`
  holds, so rollup shakes it per binding and an app that calls `isString`
  ships `isString`. Verified: a client build using four helpers carried none
  of the other 34.

  Dev is a different pipeline. Vite's dependency optimizer prebundles per
  _entry point_, not per binding, so importing anything from
  `@murky-web/typebuddy` produced a chunk holding all 38 exports. Splitting
  the source alone would not have changed that — the optimizer would still see
  one entry. Subpath exports are what changes it, and the split is their
  prerequisite.

  ```ts
  import { isString } from "@murky-web/typebuddy/guards";
  import { ok, err } from "@murky-web/typebuddy/result";
  ```

  Measured with esbuild, which is what the optimizer runs, as the size of each
  entry with its export surface intact:

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

  `/result` is deliberately dependency-free: `ok`, `err` and `isSuccess`
  reference no guard, so a caller doing result plumbing pulls 317 B and
  nothing else. `/ids` exists because its two regex literals are the only
  module-level allocations in the package — a bundler that retains anything in
  a module retains those, so they should not sit in the module everyone
  imports.

  Not breaking. The root entry still exports all 38 names,
  `src/type_helper.ts` still resolves and re-exports everything, and no
  existing import needs to change — the subpaths are an addition, taken only
  where a smaller dev chunk is worth the longer specifier.

  A new `smoke:subpath` check walks the exports map and fails if a subpath
  points at a file the build did not emit, which is how this arrangement rots:
  a helper moves, the export is added, the tsdown entry is forgotten, and
  nothing complains until a consumer tries to import it. It also asserts the
  groups stayed independent.

## 1.2.0

### Minor Changes

- 77ff985: Expose the global type helpers from the package entry. `globals.ts`
  already declared `Maybe`, `Nullable`, `Optional`, `MaybePromise`,
  `Stringified` and the `JSON.stringify` augmentation, but nothing pulled that
  file into a consumer's program: reaching the globals required a `.d.ts` shim
  in the project root plus an `include` entry naming it, and a narrowed
  `include` dropped the shim silently, taking every global with it.

  A side-effect type import in `src/index.ts` means any program that imports
  this package anywhere now gets the globals, with no tsconfig entry at all.
  It also makes the `typeRoots` route work, which was previously a dead end —
  `types` resolves only through `typeRoots`, never through ordinary package
  resolution, so both `types: ["@murky-web/typebuddy"]` and
  `types: ["@murky-web/typebuddy/globals"]` failed with `TS2688`.

  This changes behaviour for every consumer: importing the package now brings
  the global declarations along whether or not they were asked for. A project
  that declares its own `Maybe` or `Optional` at global scope will see a
  conflict.

This file exists so `changesets/action` can open a package changelog when it
creates the release PR branch.
