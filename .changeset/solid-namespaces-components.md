---
"@murky-web/oxlint-plugin-solid": patch
---

`no-unknown-namespaces`: `allowedNamespaces` now covers components, and the report on components no longer suggests deleting the prefix. Before, `<Island client:visible>` was always reported, and fix-on-save (`--fix-suggestions`) silently turned it into `<Island visible>`.
