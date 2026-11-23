---
"@murky-web/oxc-config": minor
"@murky-web/oxlint-plugin-solid": minor
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

In `*.tsx`/`*.jsx`, `typescript/explicit-function-return-type` is off: Solid's
docs write derived values as un-annotated accessors
(`const total = () => props.price * props.qty`). Exports keep
`explicit-module-boundary-types`.

New rule `solid/typed-merge-defaults`, enabled in oxc-config: an object literal
passed to `merge` needs `satisfies Partial<Props>` (or `as const`), because a
plain literal widens `"primary"` to `string` and `as Partial<Props>` makes the
defaults optional again.

In `*.tsx`/`*.jsx`, `eslint/no-ternary` is off: Solid evaluates a ternary in an
attribute or child reactively, and the compiler memoizes element branches.
`no-nested-ternary` and `no-unneeded-ternary` stay on.
