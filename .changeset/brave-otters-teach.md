---
"@murky-web/typebuddy": minor
---

Expose the global type helpers from the package entry. `globals.ts` already declared `Maybe`, `Nullable`, `Optional`, `MaybePromise`, `Stringified` and the `JSON.stringify` augmentation, but nothing pulled that file into a consumer's program: reaching the globals required a `.d.ts` shim in the project root plus an `include` entry naming it, and a narrowed `include` dropped the shim silently, taking every global with it.

A side-effect type import in `src/index.ts` means any program that imports this package anywhere now gets the globals, with no tsconfig entry at all. It also makes the `typeRoots` route work, which was previously a dead end — `types` resolves only through `typeRoots`, never through ordinary package resolution, so both `types: ["@murky-web/typebuddy"]` and `types: ["@murky-web/typebuddy/globals"]` failed with `TS2688`.

This changes behaviour for every consumer: importing the package now brings the global declarations along whether or not they were asked for. A project that declares its own `Maybe` or `Optional` at global scope will see a conflict.
