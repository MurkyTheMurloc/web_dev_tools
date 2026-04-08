---
"@murky-web/oxlint-plugin-solid": patch
---

Extend `prefer-arrow-components` to trigger on any `function` declaration with a `: JSX.Element` return type annotation, regardless of whether it is exported or PascalCase. Intent to write a component is clear from the return type.
