---
"@murky-web/simplelog": patch
---

Fix the `.`, `./bun` and `./node` entry points, which resolved to files that no longer existed. tsdown defaults `fixedExtension` to `true` for `platform: "node"`, emitting `.mjs`/`.d.mts` while the exports map points at `.js`/`.d.ts`. The build now sets `fixedExtension: false`, so every entry keeps the extension it has shipped with since 1.0.0.
