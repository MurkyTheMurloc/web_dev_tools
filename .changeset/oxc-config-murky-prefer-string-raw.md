---
"@murky-web/oxc-config": patch
---

New rule set `linting/murky.jsonc` for `@murky-web/oxlint-plugin`: it turns on
`murky/prefer-string-raw` and switches `unicorn/prefer-string-raw` off, so a
plain literal with escaped backslashes at module load is no longer reported
(`String.raw` there is a call a bundler cannot drop from client chunks).
`unicorn.jsonc` keeps unicorn's rule for projects without the plugin.
