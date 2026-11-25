---
"@murky-web/typebuddy": minor
---

New oxlint rule `typebuddy/prefer-guards`: reports a native type check that is
exactly one of typebuddy's guards (the same answer for every value, `NaN`, `-0`,
boxed primitives, `document.all` and proxies included) and rewrites it to the
guard, adding the import or joining an existing one from `@murky-web/typebuddy`
or `@murky-web/typebuddy/guards`.

`--fix` rewrites `x === null` to `isNull(x)`, `x === undefined` to
`isUndefined(x)`, `x === null || x === undefined` to `isNullable(x)`,
`typeof x === "string" | "boolean" | "symbol"` to `isString` / `isBoolean` /
`isSymbol`, and `x instanceof Error | Date | RegExp` to `isError` / `isDate` /
`isRegExp`; negations become `!guard(x)`. `Array.isArray`,
`typeof x === "function"`, `Number.isFinite` and `Number.isInteger` are the same
at runtime but narrow more strictly (`readonly unknown[]`, a function taking
`never` arguments, the `FiniteNumber`/`IntegerNumber` brands), so they are
editor suggestions. Checks that are only close are not reported:
`typeof x === "undefined"` and `x == null` (`document.all`),
`typeof x === "number"` (`NaN`), `typeof x === "object"` (`isObject` takes plain
objects only). The rule skips test files, `.d.ts` files, script files and
typebuddy's own source.

`bun run test:browser` runs the native-versus-guard cases in headless Chromium,
where `document.all` exists.
