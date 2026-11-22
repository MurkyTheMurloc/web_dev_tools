---
"@murky-web/oxlint-plugin-solid": minor
"@murky-web/oxc-config": patch
---

New rule `solid/filename-matches-export` for `.tsx`/`.jsx` files: a file that
exports a component is named after it in PascalCase (`Navigate.tsx` exports
`Navigate`, a default export wins), and a file without a component stays
snake_case (`solid_ssr_renderer.tsx`). `index.tsx` is always allowed; the
`ignore` option (default `["**/pages/**", "**/routes/**"]`) skips route folders.
No autofix. `oxc-config` turns it on for `*.tsx`/`*.jsx` and lets
`unicorn/filename-case` accept snakeCase and pascalCase there; `.ts` files stay
snakeCase.
