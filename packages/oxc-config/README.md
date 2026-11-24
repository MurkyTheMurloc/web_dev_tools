# @murky-web/oxc-config

Shared oxfmt and oxlint configuration. Reference the files by path.

## oxfmt

```sh
oxfmt -c ./node_modules/@murky-web/oxc-config/.oxfmtrc.jsonc .
```

## oxlint

```jsonc
// .oxlintrc.jsonc
{
    "extends": ["./node_modules/@murky-web/oxc-config/.oxlintrc.jsonc"]
}
```

The rule sets for the JS plugins sit in `linting/` and need their plugin in your
own `jsPlugins`:

| File                      | Plugin                           |
| ------------------------- | -------------------------------- |
| `linting/murky.jsonc`     | `@murky-web/oxlint-plugin`       |
| `linting/solid.jsonc`     | `@murky-web/oxlint-plugin-solid` |
| `linting/typebuddy.jsonc` | `@murky-web/typebuddy/oxlint`    |
| `linting/simplelog.jsonc` | `@murky-web/simplelog/oxlint`    |
