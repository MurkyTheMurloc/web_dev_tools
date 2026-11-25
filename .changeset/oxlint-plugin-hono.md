---
"@murky-web/oxlint-plugin-hono": minor
"@murky-web/oxc-config": minor
---

Add `@murky-web/oxlint-plugin-hono` (prefix `hono`) with Hono correctness rules and agent-ready diagnostics, and wire it into `@murky-web/oxc-config` via `linting/hono.jsonc` and `plugins/hono.mjs`.

Rules included:
- `hono/no-unused-context-response` (`error`)
- `hono/no-multiple-next` (`error`)
- `hono/no-duplicate-path-params` (`error`)
- `hono/no-duplicate-routes` (`error`)
- `hono/param-name-mismatch` (`error`)
- `hono/global-middleware-placement` (`error`)
- `hono/no-commented-out-route` (`warn`)
- `hono/no-process-env` (`off`, opt-in for edge runtimes)
- `hono/prefer-http-exception` (`off`, opt-in)
