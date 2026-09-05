# @murky-web/simplelog

## 2.0.1

### Patch Changes

- c924b3f: Fix `@murky-web/simplelog/otel`, which threw on import in 2.0.0.

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

## 2.0.0

### Major Changes

- 159bd5f: Move OpenTelemetry behind its own entry so it stops shipping to every consumer.

  `logger_factory` imported `@opentelemetry/api` at the top of the module for a single
  call site, guarded by an option that is off by default. That made the package
  unremovable: it registers itself on `globalThis`, so a bundler must treat importing it
  as a side effect and keep it even with `"sideEffects": false`. Measured in a browser
  build it cost ~7.5 kB raw / 2.5 kB gzip in a bundle that can never have an active span.

  Span reading is now injected. Nothing in the package references OpenTelemetry except
  the new `@murky-web/simplelog/otel` entry:

  ```ts
  import { enableOpenTelemetryContext } from "@murky-web/simplelog/otel";

  enableOpenTelemetryContext(); // once, at startup
  ```

  It is a function rather than an import-for-side-effect on purpose — the package
  declares `"sideEffects": false`, so a bare import would be legal for a bundler to drop.
  `disableOpenTelemetryContext()` undoes it, for tests and worker shutdown.

  **Breaking, two ways:**

  `@opentelemetry/api` moved from `dependencies` to an optional `peerDependency`. Anyone
  who relied on it being installed transitively now has to add it themselves — but only
  if they use the `/otel` entry.

  `includeOpenTelemetryContext: true` no longer works on its own; it needs
  `enableOpenTelemetryContext()` as well. Rather than logging empty ids silently, the
  logger warns once when the option is on and no reader is registered.

  Measured on a real client build: the chunk carrying the logger went from 15 203 B raw /
  5 225 B gzip to 7 635 B / 2 725 B. Server entries are unaffected in size and behaviour
  once `/otel` is wired.

## 1.0.2

### Patch Changes

- 4d2bc18: Fix the `.`, `./bun` and `./node` entry points, which resolved to files that no longer existed. tsdown defaults `fixedExtension` to `true` for `platform: "node"`, emitting `.mjs`/`.d.mts` while the exports map points at `.js`/`.d.ts`. The build now sets `fixedExtension: false`, so every entry keeps the extension it has shipped with since 1.0.0.

## 1.0.1

### Patch Changes

- 7e352f1: Fix structured logger argument serialization so functions nested inside objects and arrays are preserved as readable labels like `[Function namedHelper]` instead of being dropped by JSON serialization.

This file exists so `changesets/action` can open a package changelog when it
creates the release PR branch.

## 1.0.1

- Fix structured logger argument serialization so functions nested inside
  objects and arrays are preserved as readable labels like
  `[Function namedHelper]` instead of being dropped by JSON serialization.

  Released to npm on 2026-04-08; the `chore: version packages` commit never
  landed on `main`, so this entry was reconstructed from the changeset.
