---
"@murky-web/oxlint-plugin-solid": minor
---

`solid/validate-jsx-nesting` is now the rule of `eslint-plugin-solid` 0.20: `validate-html-nesting` decides which pairs are invalid and parse5 whether the HTML parser really restructures them, instead of a hand-written copy of the parser's repairs. It follows the namespace the parser is in, so `<svg><a><a /></a></svg>` stays valid and `<svg><foreignObject><a><a /></a></foreignObject></svg>` is reported. `parse5` and `validate-html-nesting` are runtime dependencies now. Runtime dependencies are on their current majors (`is-html` 3, `kebab-case` 2, `style-to-object` 2, `known-css-properties` 0.37, which drops `anchor-default`, `anchor-scroll` and `position-fallback` and knows `position-area`, `interpolate-size` and more). A `THIRD_PARTY_NOTICES.md` with the eslint-plugin-solid licence now ships with the package.
