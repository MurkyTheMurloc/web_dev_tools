# Plugin entries

`.oxlintrc.jsonc` loads its JS plugins through these files instead of by
package name.

oxlint resolves a `jsPlugins` package name from the config file's path as the
project sees it: `node_modules/@murky-web/oxc-config/`. With an isolated install
(bun workspaces, pnpm) the plugins are dependencies of this package and sit next
to its real folder in the store, not in the project's `node_modules`, so the
name does not resolve there. A relative path resolves from the same place and
reaches these files; the runtime that loads them resolves their `import` from
their real location, where the plugins are.
