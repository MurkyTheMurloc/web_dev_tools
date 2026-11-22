---
"@murky-web/oxc-config": minor
---

Every rule is named with its plugin prefix. Bare names made oxlint pick one
plugin per name: `no-nested-ternary`, `no-lonely-if` and
`typescript/prefer-string-starts-ends-with` were switched off by unicorn's
"off", the typescript versions of `require-await`, `no-implied-eval`,
`prefer-promise-reject-errors` and `no-namespace` and the unicorn versions of
`prefer-includes` and `prefer-spread` never ran, and 14 vitest rules
(`expect-expect`, `no-focused-tests`, `valid-expect`, ...) resolved to the
unloaded jest plugin. All of them are on now. `bun run test` in the package
fails on a bare rule name.

`solid/no-proxy-apis` is off: it is meant for targets without Proxy and reported
every `createStore`. jsx-a11y treats Solid's `for` like `htmlFor`.

`prefer-destructuring` is off: destructuring props or a store copies the value
once and drops reactivity.
