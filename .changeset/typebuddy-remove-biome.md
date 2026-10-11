---
"@murky-web/typebuddy": major
---

Remove the `@murky-web/typebuddy/biome` entry point.

Biome is no longer supported. The `./biome` export (`MaybePromiseRule`,
`OptionalRule`, `TryCatchAsyncRule`) and the Grit plugin files it pointed at are
gone from npm and JSR. Use the `@murky-web/typebuddy/oxlint` plugin with oxlint
instead; it has the matching rules.
