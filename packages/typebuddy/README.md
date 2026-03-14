# ts-typehelper

# TypeBuddy

TypeBuddy is a utility library for type checking and type parsing in TypeScript. It provides a set of functions to determine the type of a value, parse values into specific types, and perform various type-related operations.

## Features

-   Type checking for common JavaScript types (e.g., `string`, `number`, `boolean`, `object`, `array`, etc.)
-   Parsing values into specific types (e.g., `number`, `integer`, `float`, `string`, `array`, etc.)
-   Utility functions for working with arrays, objects, and other data structures
-   Regular expressions for validating UUID and ULID strings

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

## API

### Type Checking Functions

-   `isObject(value: unknown): value is object`
-   `isBoolean(value: unknown): value is boolean`
-   `isNull(value: unknown): value is null`
-   `isUndefined(value: unknown): value is undefined`
-   `isFunction(value: unknown): value is Function`
-   `isPromise(value: unknown): value is Promise<unknown>`
-   `isError(value: unknown): value is Error`
-   `isDate(value: unknown): value is Date`
-   `isRegExp(value: unknown): value is RegExp`
-   `isSymbol(value: unknown): value is symbol`
-   `isEmptyObject(value: unknown): value is Record<string, unknown>`
-   `isInstanceOf<T>(value: unknown, constructor: { new (): T }): value is T`
-   `isArray<T>(value: unknown): value is T[]`
-   `isEmptyArray<T>(value: unknown): value is T[]`
-   `isNumber(value: unknown): value is number`
-   `isInteger(value: unknown): value is number`
-   `isFloat(value: unknown): value is number`
-   `isString(value: unknown): value is string`
-   `isUuidString(input: unknown): input is string`
-   `isUlidString(input: unknown): input is string`

### Parsing Functions

-   `parseNumber(value: unknown): number`
-   `parseInteger(value: unknown): number`
-   `parseFloat(value: unknown): number`
-   `parseString(value: unknown): string`
-   `parseArray<T>(value: unknown): T[]`
-   `parseDomainName(url: string): string`

### Utility Functions

-   `getType<T>(value: T): T`
-   `getKeys<T extends Record<string, unknown>>(object: T): Array<keyof T>`
-   `arrayContainsCommonValue(array1: string[], array2: string[]): boolean`
-   `isEmptyString(value: unknown): boolean`
-   `isNullOrUndefined(value: unknown): boolean`
-   `hasEmptyValues(value: unknown): boolean`

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on GitHub.

## License

This project is licensed under the MIT License.
