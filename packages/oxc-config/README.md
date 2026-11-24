# @murky-web/oxc-config

Shared oxfmt and oxlint configuration. Reference the files by path.

## oxfmt

```sh
oxfmt -c ./node_modules/@murky-web/oxc-config/.oxfmtrc.jsonc .
```

## oxlint

An app extends one file and adds only its own rules and overrides:

```jsonc
// .oxlintrc.jsonc
{
    "extends": ["./node_modules/@murky-web/oxc-config/.oxlintrc.jsonc"],
    "rules": {
        // project rules and overrides
    }
}
```

`.oxlintrc.jsonc` is the full stack: the built-in plugins (eslint, typescript,
unicorn, oxc, import, jsx-a11y, vitest, promise, node, jsdoc) and the rules of
the four `@murky-web` JS plugins, which it loads itself through `jsPlugins`.
They are dependencies of this package, so installing it installs them:

| File                      | Plugin                           |
| ------------------------- | -------------------------------- |
| `linting/murky.jsonc`     | `@murky-web/oxlint-plugin`       |
| `linting/solid.jsonc`     | `@murky-web/oxlint-plugin-solid` |
| `linting/typebuddy.jsonc` | `@murky-web/typebuddy/oxlint`    |
| `linting/simplelog.jsonc` | `@murky-web/simplelog/oxlint`    |

The type-aware rules need `oxlint-tsgolint` in the project; it is a peer
dependency (`>=7.0.2007`, the range oxlint itself names), so install it next to
`oxlint`.

### Base entry for libraries

A package the stack depends on (typebuddy, simplelog in this repo) cannot load
its own plugin before it is built. It extends `.oxlintrc.base.jsonc`, the
built-in plugins only, and adds single rule files from `linting/` with their
plugin in its own `jsPlugins` when it wants them:

```jsonc
{
    "extends": ["./node_modules/@murky-web/oxc-config/.oxlintrc.base.jsonc"]
}
```
