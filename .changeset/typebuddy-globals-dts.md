---
"@murky-web/typebuddy": minor
---

Ship `@murky-web/typebuddy/globals` as a declaration file, so it works in
`compilerOptions.types`.

`"types": ["@murky-web/typebuddy/globals"]` failed with `TS2688: Cannot find
type definition file`. A `types` entry resolves only to `.d.ts` files, and the
export pointed at `globals.ts`. The file is now `globals.d.ts`, and the export
points at it. The `.d.ts` shim with `import type {} from
"@murky-web/typebuddy/globals"` keeps working.

The subpath no longer has a runtime file. `dist/globals.js` was always empty,
so only a value import like `import "@murky-web/typebuddy/globals"` is
affected; switch it to `import type {}`.
