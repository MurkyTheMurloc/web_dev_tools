---
"@murky-web/oxlint-plugin-solid": minor
"@murky-web/oxc-config": minor
---

Reads after an `await` are reported once, by `reactive-async`, and only for a
source first read after the first `await` or `yield`, as Solid's runtime does;
`reactivity` no longer reports them a second time. The hint now recommends
reading before the first `await` or reading every input synchronously in a
helper call, never `untrack()`. New rule `no-single-arg-create-effect` from
eslint-plugin-solid 0.20.1 replaces the "should not be async" report on a
single-function `createEffect`; an async compute in
`createEffect(compute, apply)` stays allowed.
