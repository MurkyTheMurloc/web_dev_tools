---
"@murky-web/oxc-config": patch
---

`eslint/no-magic-numbers` ignores `-1`, `0`, `1` and `2`, default values, class
field initial values, enum values, numeric literal types, readonly class
properties and type indexes. Array indexes stay reported (`match[3]` should be a
named capture group or a destructured name), and so do `1000`, `60` and `24`,
which belong in named constants with their unit.
