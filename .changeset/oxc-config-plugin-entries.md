---
"@murky-web/oxc-config": patch
---

`.oxlintrc.jsonc` loads its four JS plugins through `plugins/*.mjs` instead of
by package name. With an isolated install (bun workspaces, pnpm) the plugins are
dependencies of oxc-config and are not in the project's `node_modules`, and
oxlint resolved the names from there: `Failed to load JS plugin:
@murky-web/oxlint-plugin`. The entry files re-export each plugin and are found by
relative path; their imports resolve from oxc-config's real location.
