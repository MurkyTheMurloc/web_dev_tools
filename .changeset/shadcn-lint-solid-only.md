---
"@murky-web/shadcn-lint": minor
---

Solid 2.0 only. React, Vue and Svelte support is removed: no `className`
attribute, Base UI `render` prop, `forwardRef`/`memo` default exports, `.vue`
or `.svelte` templates. The package no longer follows shadcn-ui/lint. The
`{{className}}` message placeholder is now `{{class}}`, `eslint` is no longer a
peer dependency, and Solid's CSS-text `style="..."` is checked by
`no-inline-styles`.
