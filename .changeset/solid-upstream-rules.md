---
"@murky-web/oxlint-plugin-solid": minor
"@murky-web/oxc-config": minor
---

Two rules from eslint-plugin-solid 0.20.1, enabled in oxc-config:
`no-module-scope-reactive-primitive` (reactive state at module scope is shared
by every SSR request) and `no-write-in-pure-computation` (setters in
`createMemo`, the compute half of `createEffect`, or a component body).
