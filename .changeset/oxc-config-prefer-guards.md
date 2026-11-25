---
"@murky-web/oxc-config": minor
---

`linting/typebuddy.jsonc` turns on `typebuddy/prefer-guards` as an error: native
checks that are exactly a typebuddy guard (`x === null`,
`typeof x === "string"`, `x instanceof Error`, …) are reported and `--fix`
rewrites them to the guard. It needs `@murky-web/typebuddy` with the rule, which
the dependency range picks up with this release.
