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

TypeBuddy is currently used as an internal workspace package in `web_kit`.
External publish and install instructions will be added again later.

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

If you want the `typebuddy` utility types globally, opt in once in your project:

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
-   `isPromise(value: unknown): value is Promise<unknown>`
-   `isError(value: unknown): value is Error`
-   `isDate(value: unknown): value is Date`
-   `isRegExp(value: unknown): value is RegExp`
-   `isSymbol(value: unknown): value is symbol`
-   `isEmptyObject(value: unknown): value is Record<string, unknown>`
-   `isInstanceOf<T>(value: unknown, constructor: { new (...args: unknown[]): T }): value is T`
-   `isArray<T>(value: unknown): value is T[]`
-   `isEmptyArray<T>(value: unknown): value is T[]`
-   `isNumber(value: unknown): value is number`
-   `isInteger(value: unknown): value is number`
-   `isFloat(value: unknown): value is number`
-   `isString(value: unknown): value is string`
-   `isUuidString(input: unknown): input is string`
-   `isUlidString(input: unknown): input is string`

### Parsing Functions

-   `parseNumber<T extends number, R extends Optional<T>>(value: unknown, defaultValue?: R): ResolveOptional<T, R>`
-   `parseInteger(value: unknown, defaultValue?: Optional<number>): Optional<number>`
-   `parseFloat<T extends number, R extends Optional<T>>(value: unknown, defaultValue?: R): ResolveOptional<T, R>`
-   `parseString<T extends string, R extends Optional<T>>(value: unknown, defaultValue?: R): ResolveOptional<T, R>`
-   `parseArray<T, R extends Optional<T[]>>(value: unknown, defaultValue?: R): ResolveOptional<T[], R>`
-   `parseDomainName<T extends string, R extends Optional<T>>(url: string, defaultValue?: R): ResolveOptional<T, R>`

### Utility Functions

-   `getKeys<T extends Record<string, unknown>>(object: T): Array<keyof T>`
-   `arrayContainsCommonValue<T>(array1: T[], array2: T[]): boolean`
-   `isEmptyString(value: unknown): boolean`
-   `isEmptyLike(value: unknown): boolean`
-   `hasEmptyValues(value: unknown): boolean`

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

### Tooling Entries

-   `@murky-web/typebuddy/oxlint`
-   `@murky-web/typebuddy/globals`
