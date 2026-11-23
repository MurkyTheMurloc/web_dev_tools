---
"@murky-web/oxlint-plugin-solid": patch
---

The messages of `reactivity`, `reactive-async`, `no-write-in-pure-computation`,
`no-setter-in-effect`, `no-untracked-effect-read`,
`no-owned-primitives-in-ref`, `no-module-scope-reactive-primitive`,
`no-single-arg-create-effect`, `typed-merge-defaults`, `prefer-destructuring`
and `no-destructure` say what goes wrong at runtime and give a `Fix:` built
from the code's own names (the setter call, the derived function, the
`props.x` reads), plus a `Do not:` for the tempting non-fixes. What the rules
report is unchanged.
