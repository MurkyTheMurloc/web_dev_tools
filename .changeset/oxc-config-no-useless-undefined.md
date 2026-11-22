---
"@murky-web/oxc-config": patch
---

`unicorn/no-useless-undefined` is off and `typebuddy/no-useless-undefined` is on
in `linting/typebuddy.jsonc`. The fork keeps `let x: Optional<T> = undefined`,
which the unicorn rule reported although `eslint/init-declarations` wants every
`let` initialized.
