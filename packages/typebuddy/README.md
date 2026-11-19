# TypeBuddy

TypeBuddy is a utility library for type guards, parsing, and small TypeScript-first helper types. It focuses on two things:

- predictable runtime helpers for common JavaScript values
- a small type system around `Optional`, `Maybe`, and `Nullable`

## Features

-   runtime guards for common JavaScript values
-   parsing helpers for strings, numbers, arrays, and URLs
-   utility types like `Optional<T>`, `Maybe<T>`, `Nullable<T>`
-   type-system guards like `isOptional`, `isMaybe`, `isNullable`
-   global type opt-in through `@murky-web/typebuddy/globals`
-   custom `oxlint` rules through `@murky-web/typebuddy/oxlint`
-   tree-shake-friendly ESM output for frontend and backend bundles

## Installation

From npm:

```bash
bun add @murky-web/typebuddy
```

From JSR:

```bash
npx jsr add @murky-web/typebuddy
```

## Usage

Here's an example of how to use TypeBuddy in your TypeScript project:

```typescript
import { isString, parseNumber, isUuidString, isEmptyObject } from "@murky-web/typebuddy";

const value: unknown = "123";

if (isString(value)) {
    console.log(`The value is a string: ${value}`);
}

const numberValue = parseNumber(value);
console.log(`Parsed number: ${numberValue}`);

const uuid = "550e8400-e29b-41d4-a716-446655440000";
if (isUuidString(uuid)) {
    console.log(`The value is a valid UUID: ${uuid}`);
}

const obj = {};
if (isEmptyObject(obj)) {
    console.log("The object is empty");
}
```

### Type-system guards

```typescript
import { isArray, isNullable, isOptional } from "@murky-web/typebuddy";
import type { Nullable, Optional } from "@murky-web/typebuddy";

const title: Optional<string> = "ready";
if (isOptional(title)) {
    throw new Error("title is missing");
}

const subtitle: Nullable<string> = "ready";
if (isNullable(subtitle)) {
    throw new Error("subtitle is missing");
}

// after the early guards both values are narrowed to string
title.toUpperCase();
subtitle.toUpperCase();

const tags: Nullable<string[]> = ["a", "b"];
if (!isArray(tags)) {
    throw new Error("tags missing");
}

// tags is narrowed to string[]
tags.map((tag) => tag.toUpperCase());
```

### Global types

This opt-in global entry is available in the npm package surface. The JSR build
does not expose it because JSR rejects global augmentations in published
modules.

If you want the `typebuddy` utility types globally, opt in once in your project:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "types": ["@murky-web/typebuddy/globals"]
  }
}
```

`types` is replaced, not merged, when a tsconfig `extends` another one, so a
config that sets its own `types` has to list the entry again. A side-effect
import in any `.d.ts` file the program includes works as well:

```typescript
import type {} from "@murky-web/typebuddy/globals";
```

That makes these names available globally:

-   `Optional`
-   `ResolveOptional`
-   `Maybe`
-   `ResolveMaybe`
-   `Nullable`
-   `ResolveNullable`
-   `MaybePromise`
-   `Success`
-   `Failed`
-   `JsonifiedValue`
-   `Stringified`

## API

### Type Checking Functions

-   `isObject(value: unknown): value is object`
-   `isBoolean(value: unknown): value is boolean`
-   `isNull(value: unknown): value is null`
-   `isUndefined(value: unknown): value is undefined`
-   `isOptional<T>(value: Optional<T>): value is undefined`
-   `isMaybe<T>(value: Maybe<T>): value is null`
-   `isNullable<T>(value: Nullable<T>): value is null | undefined`
-   `isFunction(value: unknown): value is Function`
-   `isPromise(value: unknown): value is PromiseLike<unknown>` (any thenable, also a callable one; `false` when reading `then` throws)
-   `isError(value: unknown): value is Error`
-   `isDate(value: unknown): value is Date`
-   `isRegExp(value: unknown): value is RegExp`
-   `isSymbol(value: unknown): value is symbol`
-   `isEmptyObject(value: unknown): value is EmptyObject` (a plain object without any own key, symbol and non-enumerable keys included)
-   `isInstanceOf<T>(value: unknown, constructor: { new (...args: unknown[]): T }): value is T`
-   `isArray<T>(value: unknown): value is T[]`
-   `isEmptyArray<T>(value: unknown): value is T[]`
-   `isNumber(value: unknown): value is FiniteNumber` (not `NaN`, not `±Infinity`; `FiniteNumber` is a `number` brand, so the `false` branch keeps `NaN`)
-   `isInteger(value: unknown): value is IntegerNumber` (a `number` brand, like `FiniteNumber`)
-   `isFloat(value: unknown): value is FloatNumber` (finite, with a fractional part; a `number` brand)
-   `isString(value: unknown): value is string`
-   `isUuidString(input: unknown): input is string` (versions 1 to 8, plus the nil and max UUID, any case)
-   `isUlidString(input: unknown): input is string` (any case, first character `0` to `7`)

### Parsing Functions

-   `parseNumber<T extends number, R extends Optional<T>>(value: unknown, defaultValue?: R): ResolveOptional<T, R>`
-   `parseInteger(value: unknown, defaultValue?: Optional<number>): Optional<number>`
-   `parseFloat<T extends number, R extends Optional<T>>(value: unknown, defaultValue?: R): ResolveOptional<T, R>`
-   `parseString<T extends string, R extends Optional<T>>(value: unknown, defaultValue?: R): ResolveOptional<T, R>`
-   `parseArray<T, R extends Optional<T[]>>(value: unknown, defaultValue?: R): ResolveOptional<T[], R>`
-   `parseDomainName<T extends string, R extends Optional<T>>(url: string, defaultValue?: R): ResolveOptional<T, R>`

What the number parsers accept in a string (the whole string, after trimming;
anything else gives the default):

-   `parseInteger`: digits with an optional sign, and a zero-only fraction
    (`"42"`, `"-7"`, `"42.0"`). Not `""`, `"12abc"`, `"0x10"`, `"1e3"`, `"1,000"`.
    A number is truncated toward zero (`-1.5` is `-1`).
-   `parseFloat`: decimal notation with an optional exponent (`"1.5"`, `".5"`,
    `"1.5e2"`). Not `""`, `"12abc"`, `"0x10"`, `"Infinity"`.
-   `parseNumber`: everything `Number()` accepts for the whole string, so also
    `"1e3"`, `"0xff"` and `"0b10"`. Not `""`, `"12abc"`, `"Infinity"`.
-   A comma is accepted only as the one decimal separator (`"1,5"` is `1.5`).
    Mixed forms (`"1,234.56"`, `"1.234,56"`), several commas and grouped forms
    (`"1,000"`, `"12,345"`, which read as one thousand in English and as one in
    German) give the default.
-   `parseArray(NaN)` has no array to return: a single-argument call with a
    number is typed `number[] | undefined`. Plain objects become `[object]`.
-   `parseDomainName` returns the leftmost label of the hostname
    (`"example.attacker.net"` is `"example"`). It is a display helper and not a
    registrable-domain check: never use it for an allowlist, compare
    `new URL(url).hostname` with the exact hosts you trust.

### Utility Functions

-   `ok(value)` and `err()` helpers for `MaybePromise` result objects
-   `getKeys<T extends Record<string, unknown>>(object: T): Array<keyof T>`
-   `arrayContainsCommonValue<T>(array1: T[], array2: T[]): boolean`
-   `isEmptyString(value: unknown): boolean`
-   `isEmptyLike(value: unknown): boolean`
-   `hasEmptyValues(value: unknown): boolean`

### Result Helpers

Use these when you want small Rust-like `Ok` and `Err` ergonomics without
hand-writing result objects:

```typescript
import { err, ok } from "@murky-web/typebuddy";

export async function loadName(): MaybePromise<string> {
    try {
        return ok("murky");
    } catch {
        return err();
    }
}

export async function flush(): MaybePromise<void> {
    return ok();
}
```

### Types

-   `Optional<T>`
-   `ResolveOptional<T, R>`
-   `Maybe<T>`
-   `ResolveMaybe<T, R>`
-   `Nullable<T>`
-   `ResolveNullable<T, R>`
-   `MaybePromise<T>`
-   `Success<T>`
-   `Failed<T>`
-   `JsonifiedObject<T>`
-   `JsonifiedValue<T>`
-   `Stringified<T>`

### Oxlint rules

`@murky-web/typebuddy/oxlint` has `prefer-maybe`, `prefer-maybe-promise`,
`prefer-nullable`, `prefer-optional` and `require-try-catch`. They skip test
files: `*.test.*`, `*.spec.*` and `*.bench.*`, anything under a `__tests__/`,
`tests/`, `test/` or `__mocks__/` directory, and `vitest.setup.*`,
`vitest-setup.*` and `setupTests.*`. Names like `latest.ts` or `contest.ts` are
source files and stay checked. Directories count relative to the directory
oxlint runs in, so a project checked out under `/tmp/test/` is not silenced.

Autofixes only do what cannot change what the code means:

-   A fix is offered only where the name it writes is free. `catch (err)` makes
    `err()` the caught value, a local `ok` is not the helper, and another
    library's `Maybe` is not ours: there the rule reports without a fix. `ok`
    and `err` count as imported from `@murky-web/typebuddy` or
    `@murky-web/typebuddy/result`.
-   Fixed: `Promise<T>` to `MaybePromise<T>` on an async function this file
    defines, `return;` to `return ok();`, `isError`/`value` literals with
    exactly those two properties to `ok(value)`/`err()`, a `return err()` added
    to a catch without a return, `T | null` to `Maybe<T>` and the like.
-   A fix that needs an import carries it: appended to an existing import of
    the same kind from the package, otherwise a new line after the last import
    (after a `"use client"` directive, never above it). Fixes that need the
    same import share one insertion point, so one `--fix` pass applies one of
    them and the next pass applies the rest. A type joins an existing
    `import type { … }` of the package, or else a value import as an inline
    `type Name` specifier. In a module, `declare global` and `declare module`
    blocks get the import like any other code. In a script file (no `import` or
    `export`, e.g. `vite-env.d.ts`) no import is added, because that would turn
    the script into a module: a type is written by its global name (it needs the
    `@murky-web/typebuddy/globals` entry), a fix that needs `ok` or `err` is not
    offered, and `Promise` to `MaybePromise` on the file's own functions is a
    suggestion there, since the `ok(...)`/`err()` that must follow cannot be
    fixed.
-   Suggestions, applied one by one from your editor: wrapping a returned value
    in `ok(...)` (it may already be a `Result` or a `MaybePromise`), wrapping a
    function body in `try`/`catch` (every exception becomes `err()`), and
    `Promise` to `MaybePromise` in an interface method, a function type or an
    overload (that shape is often a library's).
-   Async generators are left alone.

### Migrating from 2.x to 3.0

-   `Success<T>` is `{ isError: false; value: T }`. Code that read
    `ok(null).isError` as `true` in the types is wrong; read `value`.
-   `isNumber`, `isInteger` and `isFloat` narrow to the brands `FiniteNumber`,
    `IntegerNumber` and `FloatNumber` (assignable to `number`). The false branch
    keeps `number`: after `if (!isNumber(value))` a `number | null` is still
    `number | null`. Where you relied on it becoming `null`, test `isNull`.
    The brand also spreads into inferred types: `[1, null].filter(isNumber)` is
    `FiniteNumber[]`, so `xs.push(3)` fails. Widen with an annotation:
    `const xs: number[] = [1, null].filter(isNumber);`.
-   `JSON.parse` of a `Stringified<T>` returns `JsonifiedValue<T>`, no longer
    `JsonifiedObject<T>`. Generic code that declares `JsonifiedObject<T>` as its
    return type has to change it to `JsonifiedValue<T>`.
-   `isFloat(Infinity)` is `false`, `fastIsArray` is `Array.isArray`,
    `isUuidString` accepts versions 6 to 8 and the nil and max UUID, and
    `isUlidString` accepts lower case. Check code that relied on the old answers.
-   `parseInteger` also refuses numbers beyond 2^53 (`1e21`).
-   `prefer-maybe`, `prefer-nullable`, `prefer-optional` and the `MaybePromise`
    fix now add an `import type` line (or merge into an existing import of the
    package). A project that relied on the global names in a module file gets
    the import; script files are left alone.
-   `isEmptyObject(value)` has no type parameter and narrows to `EmptyObject`.
    A symbol key or a non-enumerable key now counts as a key.
-   `parseArray(value: number)` is typed `number[] | undefined`. Handle the
    `undefined` or pass a default.
-   `parseInteger`, `parseFloat` and `parseNumber` return the default for blank
    strings, for grouped numbers such as `"1,000"`, and for anything that is not
    a number as a whole (`"12abc"`). `parseInteger` takes digits only
    (`"1e3"`, `"0x10"` give the default), truncates toward zero and refuses
    digits beyond 2^53. If you used `"1,000"` or `"1e3"` as input, normalise
    the string before parsing.
-   `prefer-maybe-promise` and `require-try-catch`: `--fix` no longer wraps
    return values in `ok(...)`, no longer wraps bodies in `try`/`catch` and no
    longer rewrites `Promise` in interface methods, function types and
    overloads. They are editor suggestions now; apply them by hand.

### Tooling Entries

-   `@murky-web/typebuddy/oxlint`
-   `@murky-web/typebuddy/globals`
