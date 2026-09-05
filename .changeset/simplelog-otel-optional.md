---
"@murky-web/simplelog": major
---

Move OpenTelemetry behind its own entry so it stops shipping to every consumer.

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
