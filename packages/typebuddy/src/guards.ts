/**
 * Runtime type guards. The leaf module: everything else here builds on it, it
 * builds on nothing.
 */

import type { Maybe } from "./types/maybe.js";
import type { Nullable } from "./types/nullable.js";
import type { Optional } from "./types/optional.js";

type UnknownFunction = (...args: readonly never[]) => unknown;

declare const finiteNumberBrand: unique symbol;

/**
 * A `number` that `isNumber` accepted: neither `NaN` nor `±Infinity`.
 *
 * It is a brand rather than plain `number` on purpose. A guard typed `value is
 * number` also narrows the false branch, so `number | null` would become `null`
 * after `if (!isNumber(value))`, although `NaN` and `Infinity` are `number`s
 * that land there too. A branded type is not what a bare `number` is assignable
 * to, so the false branch keeps them.
 */
type FiniteNumber<T extends number = number> = T & {
    readonly [finiteNumberBrand]: true;
};

declare const integerBrand: unique symbol;
declare const floatBrand: unique symbol;

/**
 * A `number` that `isInteger` accepted. A brand for the same reason as
 * `FiniteNumber`: a plain `value is number` would leave `null` alone in the
 * false branch of a `number | null`, although `1.5` and `NaN` land there too.
 */
type IntegerNumber = FiniteNumber & { readonly [integerBrand]: true };

/** A `number` that `isFloat` accepted. See `IntegerNumber` for the brand. */
type FloatNumber = FiniteNumber & { readonly [floatBrand]: true };

/**
 * What `isEmptyObject` narrows to: an object with no own keys at all. The index
 * signature of `never` is the type of "nothing can be read from it".
 */
type EmptyObject = Record<string, never>;

const EMPTY_LENGTH = 0;

/**
 * Check if a value is a string.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a string.
 */
function isString<T extends string>(value: Nullable<T>): value is T;
function isString(value: unknown): value is string;
function isString(value: unknown): value is string {
    return typeof value === "string";
}

/**
 * Parses the input value as a boolean. Returns false if the value is no string.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a string.
 */
function isEmptyString(value: unknown): boolean {
    if (!isString(value)) {
        return false;
    }
    return value.trim() === "";
}

/**
 * Returns true if the value is null.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is null.
 */
function isNull(value: unknown): value is null {
    return value === null;
}

/**
 * Returns true if the value is `undefined`: `value === undefined`, nothing
 * else.
 *
 * Not a `typeof` check on purpose. The two differ for exactly one value, the
 * browser's legacy `document.all`, which `typeof` calls `"undefined"` although
 * it is an object. `isUndefined(x)` is what `x === undefined` says, so the one
 * can replace the other (`typebuddy/prefer-guards` does).
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is undefined.
 */
function isUndefined(value: unknown): value is undefined {
    return value === undefined;
}

/**
 * Checks whether an Optional value is currently in its missing state.
 *
 * @param {Optional<T>} value - The Optional value to check.
 * @returns {boolean} True when the value is undefined.
 */
function isOptional<T>(value: Optional<T>): value is undefined {
    return isUndefined(value);
}

/**
 * Checks whether a Maybe value is currently in its missing state.
 *
 * @param {Maybe<T>} value - The Maybe value to check.
 * @returns {boolean} True when the value is null.
 */
function isMaybe<T>(value: Maybe<T>): value is null {
    return isNull(value);
}

/**
 * Checks whether a Nullable value is currently in its missing state: `value ===
 * null || value === undefined`.
 *
 * Not `value == null`: that is also true for the browser's `document.all`,
 * which is an object, not a missing value.
 *
 * @param {Nullable<T>} value - The Nullable value to check.
 * @returns {boolean} True when the value is null or undefined.
 */
function isNullable<T>(value: Nullable<T>): value is null | undefined {
    return isNull(value) || isUndefined(value);
}

/**
 * Check if a value is an array.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is an array.
 */
function isArray<T>(value: Nullable<readonly T[]>): value is readonly T[];
function isArray(value: unknown): value is readonly unknown[];
function isArray(value: unknown): value is readonly unknown[] {
    return Array.isArray(value);
}

/**
 * Check if a value is an empty array.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is an empty array.
 */
function isEmptyArray<T>(value: Nullable<readonly T[]>): value is readonly T[];
function isEmptyArray(value: unknown): value is readonly unknown[];
function isEmptyArray(value: unknown): value is readonly unknown[] {
    return Array.isArray(value) && value.length === EMPTY_LENGTH;
}

/**
 * Kept for compatibility: the same check as `isArray`. It used to compare
 * `Object.prototype.toString` with `"[object Array]"`, which any object can
 * fake through `Symbol.toStringTag`; `Array.isArray` cannot be faked and is the
 * fast path engines optimise anyway.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is an array.
 */
function fastIsArray<T>(value: Nullable<readonly T[]>): value is readonly T[];
function fastIsArray(value: unknown): value is readonly unknown[];
function fastIsArray(value: unknown): value is readonly unknown[] {
    return Array.isArray(value);
}

/**
 * Check if a value is a finite number: not `NaN`, not `±Infinity`.
 *
 * The narrowed type is `FiniteNumber`, a brand over `number`, so the false
 * branch still contains the `number`s this guard rejects.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a finite number.
 */
function isNumber<T extends number>(
    value: Nullable<T>
): value is FiniteNumber<T>;
function isNumber(value: unknown): value is FiniteNumber;
function isNumber(value: unknown): value is FiniteNumber {
    if (typeof value === "string" && value.trim() === "") {
        return false;
    }
    return (
        typeof value === "number" &&
        !Number.isNaN(value) &&
        Number.isFinite(value)
    );
}

/**
 * Returns true if the value is an object.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is an object.
 */
function isObject<T extends Record<string, unknown>>(
    value: Nullable<T>
): value is T;
function isObject(value: unknown): value is Record<string, unknown>;
function isObject(value: unknown): value is Record<string, unknown> {
    if (
        typeof value !== "object" ||
        value === null ||
        isArray(value) ||
        Object.prototype.toString.call(value) !== "[object Object]"
    ) {
        return false;
    }

    const objectValue: object = value;
    return Object.getPrototypeOf(objectValue) === Object.prototype;
}

/**
 * Returns true if the value is a boolean.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a boolean.
 */
function isBoolean<T extends boolean>(value: Nullable<T>): value is T;
function isBoolean(value: unknown): value is boolean;
function isBoolean(value: unknown): value is boolean {
    return typeof value === "boolean";
}

/**
 * Returns true if the value is a function.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a function.
 */
function isFunction<T extends UnknownFunction>(value: Nullable<T>): value is T;
function isFunction(value: unknown): value is UnknownFunction;
function isFunction(value: unknown): value is UnknownFunction {
    return typeof value === "function";
}

/**
 * Returns true if the value is a promise, or any other thenable: an object or a
 * function with a callable `then`.
 *
 * A `then` getter that throws, or a revoked Proxy, means the value cannot be
 * awaited safely; that is a `false`, not an exception from the guard.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a promise.
 */
function isPromise<T>(
    value: Nullable<Readonly<PromiseLike<T>>>
): value is PromiseLike<T>;
function isPromise(value: unknown): value is PromiseLike<unknown>;
function isPromise(value: unknown): value is PromiseLike<unknown> {
    if (
        (typeof value !== "object" && typeof value !== "function") ||
        value === null
    ) {
        return false;
    }

    try {
        return typeof Reflect.get(value, "then") === "function";
    } catch {
        return false;
    }
}

/**
 * Returns true if the value is an error.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is an error.
 */
function isError<T extends Error>(value: Nullable<T>): value is T;
function isError(value: unknown): value is Error;
function isError(value: unknown): value is Error {
    return value instanceof Error;
}

/**
 * Returns true if the value is a date.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a date.
 */
function isDate<T extends Date>(value: Nullable<T>): value is T;
function isDate(value: unknown): value is Date;
function isDate(value: unknown): value is Date {
    return value instanceof Date;
}

/**
 * Returns true if the value is a RegExp.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a RegExp.
 */
function isRegExp<T extends RegExp>(value: Nullable<T>): value is T;
function isRegExp(value: unknown): value is RegExp;
function isRegExp(value: unknown): value is RegExp {
    return value instanceof RegExp;
}

/**
 * Returns true if the value is a symbol.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a symbol.
 */
function isSymbol<T extends symbol>(value: Nullable<T>): value is T;
function isSymbol(value: unknown): value is symbol;
function isSymbol(value: unknown): value is symbol {
    return typeof value === "symbol";
}

/**
 * Check if a value is an empty plain object: its prototype is
 * `Object.prototype` and it has no own keys at all. A symbol key or a
 * non-enumerable key counts as a key, so `{ [Symbol()]: 1 }` is not empty.
 *
 * The guard narrows to `EmptyObject`, never to the caller's own object type: an
 * object type with required keys can not be empty, and narrowing to it would
 * hide the very values the guard rejects from the false branch.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is an empty plain object.
 */
function isEmptyObject(value: unknown): value is EmptyObject {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    // A revoked Proxy is an `object` whose every trap throws.
    try {
        return (
            Object.getPrototypeOf(value) === Object.prototype &&
            Reflect.ownKeys(value).length === EMPTY_LENGTH
        );
    } catch {
        return false;
    }
}

/**
 * Check if a value is an instance of a class.
 *
 * @param {unknown} value - The value to check.
 * @param {unknown} constructor - The class constructor to check against.
 * @returns {boolean} True if the value is an instance of the class.
 */
function isInstanceOf<T>(
    value: unknown,
    constructor: new (...args: unknown[]) => T
): value is T {
    return value instanceof constructor;
}

/**
 * Check if a value is an integer. The narrowed type is `IntegerNumber`, a brand
 * over `number`, so the false branch still contains the `number`s this guard
 * rejects.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is an integer.
 */
function isInteger(value: unknown): value is IntegerNumber {
    return typeof value === "number" && Number.isInteger(value);
}

/**
 * Check if a value is a float: a finite number with a fractional part. `NaN`
 * and `±Infinity` are not floats, consistent with `isNumber`. The narrowed type
 * is `FloatNumber`, a brand over `number`, like `isInteger`'s.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a float.
 */
function isFloat(value: unknown): value is FloatNumber {
    return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        !Number.isInteger(value)
    );
}

export type { EmptyObject, FiniteNumber, FloatNumber, IntegerNumber };

export {
    fastIsArray,
    isArray,
    isBoolean,
    isDate,
    isEmptyArray,
    isEmptyObject,
    isEmptyString,
    isError,
    isFloat,
    isFunction,
    isInstanceOf,
    isInteger,
    isMaybe,
    isNull,
    isNullable,
    isNumber,
    isObject,
    isOptional,
    isPromise,
    isRegExp,
    isString,
    isSymbol,
    isUndefined
};
