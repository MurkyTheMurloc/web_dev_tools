---
"@murky-web/typebuddy": patch
---

`typebuddy/prefer-maybe-promise` no longer accepts `FAILED_PROMISE` and
`VOID_PROMISE`. typebuddy stopped defining these globals when `ok()` and `err()`
replaced them, so `return FAILED_PROMISE` threw a `ReferenceError` while the
rule treated it as a settled failure. Every reference to them that the file does
not declare itself is now reported and `--fix` rewrites it to `err()` / `ok()`,
adding the import (or joining an existing import from `@murky-web/typebuddy` or
`@murky-web/typebuddy/result`). A local binding of the same name is left alone.
