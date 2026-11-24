---
"@murky-web/typebuddy": minor
---

New oxlint rule `typebuddy/prefer-guards`: reports a native type check that is
exactly one of typebuddy's guards (the same answer for every value, `NaN`,
`-0`, boxed primitives, `document.all` and proxies included) and rewrites it to
the guard, adding the import or joining an existing one from
`@murky-web/typebuddy` or `@murky-web/typebuddy/guards`.

`--fix` rewrites `x === null` to `isNull(x)`, `typeof x === "undefined"` to
`isUndefined(x)`, `x == null` / `x == undefined` and
`x === null || typeof x === "undefined"` to `isNullable(x)`,
`typeof x === "string" | "boolean" | "symbol"` to `isString` / `isBoolean` /
`isSymbol`, and `x instanceof Error | Date | RegExp` to `isError` / `isDate` /
`isRegExp`; negations become `!guard(x)`. `Array.isArray`,
`typeof x === "function"`, `Number.isFinite` and `Number.isInteger` are the
same at runtime but narrow more strictly (`readonly unknown[]`, a function
taking `never` arguments, the `FiniteNumber`/`IntegerNumber` brands), so they
are editor suggestions. Checks that are only close are not reported:
`x === undefined` (`document.all`), `typeof x === "number"` (`NaN`),
`typeof x === "object"` (`isObject` takes plain objects only). `typeof` of a
name the file never declares (`typeof window`) is left alone. The rule skips
test files, `.d.ts` files, script files and typebuddy's own source.
