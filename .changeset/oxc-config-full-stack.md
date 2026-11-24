---
"@murky-web/oxc-config": minor
---

`.oxlintrc.jsonc` is the full stack now: besides the built-in plugins it extends
`linting/murky.jsonc`, `linting/solid.jsonc`, `linting/typebuddy.jsonc` and
`linting/simplelog.jsonc` and loads their plugins through `jsPlugins`. An app
extends this one file and adds only its own rules. The four plugins
(`@murky-web/oxlint-plugin`, `@murky-web/oxlint-plugin-solid`,
`@murky-web/typebuddy`, `@murky-web/simplelog`) are dependencies of this package,
because oxlint resolves `jsPlugins` from the config file.

The built-in-only config moved to `.oxlintrc.base.jsonc`, for libraries the
stack depends on; `.oxlintrc.typebuddy.jsonc` and `.oxlintrc.simplelog.jsonc`
extend it.

`oxlint-tsgolint` (>=7.0.2007, the range oxlint itself names) is a peer
dependency now: the type-aware rules of the stack need it, and the package
manager says so on install instead of the first lint run failing.
