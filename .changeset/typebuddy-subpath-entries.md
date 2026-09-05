---
"@murky-web/typebuddy": minor
---

Split `type_helper.ts` into six modules and publish each as its own entry point.

Every helper lived in one 669-line module. For a production bundle that was fine —
the file has no module-level side effects and `"sideEffects": false` holds, so rollup
shakes it per binding and an app that calls `isString` ships `isString`. Verified: a
client build using four helpers carried none of the other 34.

Dev is a different pipeline. Vite's dependency optimizer prebundles per *entry point*,
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

| entry | bundled |
| --- | --- |
| `.` | 6 728 B |
| `/guards` | 2 574 B |
| `/parse` | 3 126 B |
| `/empty` | 1 814 B |
| `/ids` | 490 B |
| `/collections` | 446 B |
| `/result` | 317 B |

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
