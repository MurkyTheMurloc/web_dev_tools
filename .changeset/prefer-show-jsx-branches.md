---
"@murky-web/oxlint-plugin-solid": patch
---

`solid/prefer-show` reports only branches that are visibly JSX. An Identifier
branch such as `{c() ? label : "b"}` may hold text, where a ternary is cheaper
than `<Show>`. The `&&` rewrite is now a suggestion instead of an autofix:
`{count() && <Badge />}` renders `0` when `count()` is 0, and `<Show>` renders
nothing.
