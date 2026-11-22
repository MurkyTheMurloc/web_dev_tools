---
"@murky-web/oxlint-plugin-solid": patch
---

`reactivity` no longer reports the entries of a React-style dependency array
(`createEffect(fn, [a, b])`); `no-react-deps` reports the array once, with the
2.0 rewrite. `reactivity` had suggested `() => [a, b]`, which is not the fix.
