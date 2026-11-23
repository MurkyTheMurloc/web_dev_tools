---
"@murky-web/oxlint-plugin-solid": minor
"@murky-web/oxc-config": patch
---

New rule `solid/no-magic-numbers`, a fork of eslint's `no-magic-numbers` with
the same options. Its message names the number with its code and the constant to
write (`const RETRY_DELAY_MS = 1000;` at module scope, used as
`setTimeout(retry, RETRY_DELAY_MS)`), with a unit when the code shows one, and a
named capture group for `match[3]`. The new option `allowHttpStatusCodes` allows
100-599 only where the number is an HTTP status: Hono's `c.json(body, 404)` and
its siblings, `c.status(404)`, `new HTTPException(404)`, `{ status: 404 }` and
`res.status === 404`.

`oxc-config` switches `eslint/no-magic-numbers` off and turns
`solid/no-magic-numbers` on in `linting/solid.jsonc` with the same options,
without `allowHttpStatusCodes`.
