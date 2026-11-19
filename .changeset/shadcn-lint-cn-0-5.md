---
"@murky-web/shadcn-lint": minor
---

Bundle cn 0.5.2 and Tailwind 4.3.5, require Node 22 or later.

- `bg-gradient-to-*` counts as a background image again. cn 0.5.1 groups it with background colors, so `no-raw-colors` reported `bg-gradient-to-b` as an undeclared theme color.
- Theme scales follow cn 0.5.2: `@import`s of packages (`@import "@workspace/ui/globals.css"`, resolved through `node_modules` with `exports`, the `style` condition and `style` field) are followed, declarations after a nested block inside `@theme` are read, a reset (`--radius-*: initial`, `--*: initial`) drops the names declared before it, and a declared `--spacing` keeps numeric spacing through a spacing reset.
- A project with cn older than 0.5.2 gets the bundled grammar and the one-time warning, as before.
