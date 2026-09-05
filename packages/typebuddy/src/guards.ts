/**
 * Runtime type guards. The leaf module: everything else here builds on it, it
 * builds on nothing.
 */

import type { Maybe } from "./types/maybe.js";
import type { Nullable } from "./types/nullable.js";
import type { Optional } from "./types/optional.js";

type UnknownFunction = (...args: readonly never[]) => unknown;

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
 * Returns true if the value is undefined.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is undefined.
 */
function isUndefined(value: unknown): value is undefined {
    return typeof value === "undefined";
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
 * Checks whether a Nullable value is currently in its missing state.
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
 * More performant implementation of isArray for large arrays
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is an array.
 */
function fastIsArray<T>(value: Nullable<readonly T[]>): value is readonly T[];
function fastIsArray(value: unknown): value is readonly unknown[];
function fastIsArray(value: unknown): value is readonly unknown[] {
    return Object.prototype.toString.call(value) === "[object Array]";
}

/**
 * Check if a value is a number.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a number.
 */
function isNumber<T extends number>(value: Nullable<T>): value is T;
function isNumber(value: unknown): value is number;
function isNumber(value: unknown): value is number {
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
    value: Nullable<T>,
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
 * Returns true if the value is a promise.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a promise.
 */
function isPromise<T>(
    value: Nullable<Readonly<PromiseLike<T>>>,
): value is PromiseLike<T>;
function isPromise(value: unknown): value is PromiseLike<unknown>;
function isPromise(value: unknown): value is PromiseLike<unknown> {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    return typeof Reflect.get(value, "then") === "function";
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
 * Check if a value is a plain object.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a plain object.
 */
function isEmptyObject<T extends Record<string, unknown>>(
    value: Nullable<T>,
): value is T;
function isEmptyObject(value: unknown): value is Record<string, unknown>;
function isEmptyObject(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        !isNull(value) &&
        !isUndefined(value) &&
        !isEmptyArray(value) &&
        Object.getPrototypeOf(value) === Object.prototype &&
        Object.keys(value).length === EMPTY_LENGTH
    );
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
    constructor: new (...args: unknown[]) => T,
): value is T {
    return value instanceof constructor;
}

/**
 * Check if a value is an integer.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is an integer.
 */
function isInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value);
}

/**
 * Check if a value is a float.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a float.
 */
function isFloat(value: unknown): value is number {
    return (
        typeof value === "number" &&
        !Number.isNaN(value) &&
        !Number.isInteger(value)
    );
}

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
    isUndefined,
};
