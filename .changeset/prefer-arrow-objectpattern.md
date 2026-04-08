---
"@murky-web/oxlint-plugin-solid": patch
---

Fix `prefer-arrow-components` rule to trigger on `export function` components with destructured props (`ObjectPattern`). Previously only `Identifier` params were detected; now all three forms — named props, destructured props, and no props — are correctly flagged and auto-fixed.
