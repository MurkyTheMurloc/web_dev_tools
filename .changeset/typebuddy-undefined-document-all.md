---
"@murky-web/typebuddy": minor
---

`isUndefined(value)` is `value === undefined` now, and `isNullable(value)` is
`value === null || value === undefined`. Before, both used
`typeof value === "undefined"`. The answers differ for exactly one value, the
browser's legacy `document.all` (an object that `typeof` calls `"undefined"`):
`isUndefined(document.all)`, `isOptional(document.all)`,
`isNullable(document.all)` and `isEmptyLike(document.all)` were `true` and are
`false` now. Every other value gives the same answer as before. The guards now
say what `x === undefined` and `x === null || x === undefined` say, which is
what lets `typebuddy/prefer-guards` rewrite those checks.
