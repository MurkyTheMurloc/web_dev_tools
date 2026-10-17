---
"@murky-web/oxlint-plugin-solid": minor
---

New rules for the Solid 2.0 model, all syntax and scope only: `solid/reactive-async` (reads after an `await` in reactive computations, `async` callbacks that only `return await`), `solid/no-server-import-in-client` (client code importing a `src/server/` module that is not a `"use server"` module) and `solid/strict-void-return` (replaces the typed rule for handlers, `ref`, `onCleanup` and `onSettled`). The shared Solid lint config enables them and turns off `typescript/promise-function-async` and `typescript/strict-void-return` for `*.tsx`/`*.jsx`.
