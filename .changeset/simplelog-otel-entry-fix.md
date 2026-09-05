---
"@murky-web/simplelog": patch
---

Fix `@murky-web/simplelog/otel`, which threw on import in 2.0.0.

`dist/otel.js` imported `setSpanContextReader` from `dist/logger_factory.js`, and
that file did not export it:

```
SyntaxError: Export named 'setSpanContextReader' not found in module
  .../@murky-web/simplelog/dist/logger_factory.js
```

The build runs two tsdown config blocks — one `platform: "node"`, one
`platform: "neutral"` — that write to the same `outDir`. `logger_factory` was an
entry in neither, so each block emitted it keeping only the exports its own
entries used, and the block that finished last decided the file. The neutral
block's entries (`deno`, `hono`, `web`) never call `setSpanContextReader`, so
when it won, the export was gone. The order is not fixed: rebuilding the broken
config five times produced a working file once and a broken one four times,
which is how this reached npm.

Naming `logger_factory` as an entry in both blocks preserves its full export
surface either way. Verified stable across repeated builds.

A new `smoke:entries` check imports every subpath in the `exports` map from the
built output and fails if one does not load or exports nothing. It runs as part
of `release:verify:simplelog`. Nothing existing could have caught this: lint and
typecheck read the source, and the generated `otel.d.ts` described the export
that the JavaScript was missing — only loading the built files reveals it.
