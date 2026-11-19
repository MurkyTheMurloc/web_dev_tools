---
"@murky-web/oxlint-plugin-solid": patch
---

Autofix and import-list fixes. `solid/no-destructure` now adds the `merge`/`omit` import from `solid-js` (or calls the existing import by its local name). The shared import helper no longer turns `import * as X from "solid-js"` into the invalid `import * as X, { ... }`; it writes a separate named import (affects `solid/jsx-no-undef` and `solid/imports`). `solid/imports` no longer lists `storePath` (not exported by `solid-js` 2.x), `ClassValue` (only `JSX.ClassValue` exists) or `ValidComponent` (`solid-js` and `@solidjs/web` each declare their own).
