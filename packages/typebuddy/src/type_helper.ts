import type { Maybe } from "./types/maybe.js";
import type { Nullable } from "./types/nullable.js";
import type { Optional } from "./types/optional.js";
import type { Failed, Success } from "./types/maybe_promise.js";

type UnknownFunction = (...args: readonly never[]) => unknown;
const EMPTY_LENGTH = 0;
const uuidRegex =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

const ulidRegex = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;

function cloneDefaultArray(
  defaultValue?: readonly unknown[],
): unknown[] | undefined {
  if (!defaultValue) {
    return defaultValue;
  }

  return [...defaultValue];
}

/**
 * Checks if the provided result is a `Success` type.
 *
 * @template T The type of the value contained in the `Success` type.
 * @param {Readonly<Success<T> | Failed>} result The result to check, which can
 * be either a `Success<T>` or `Failed`.
 * @returns {boolean} `true` if the result is a `Success<T>`, `false` if it is a `Failed`.
 * This function acts as a type guard, narrowing the type of `result`
 * to `Success<T>` when the condition is met.
 * @example
 * ```typescript
 * const result = await someAsyncFunction();
* if (isSuccess(result)) {
*   return result.value; // TypeScript knows `value` is of type `T`
* }
 * ```
 */
function isSuccess<T>(
  result: Readonly<Success<T> | Failed>,
): result is Success<T> {
  return !result.isError;
}

/**
 * Check if a value is a string.
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
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a string.
 */
function isEmptyString(value: unknown): boolean {
  if (!isString(value)) {return false;}
  return value.trim() === "";
}

/**
 * Returns true if the value is null.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is null.
 */
function isNull(value: unknown): value is null {
  return value === null;
}

/**
 * Returns true if the value is undefined.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is undefined.
 */
function isUndefined(value: unknown): value is undefined {
  return typeof value === "undefined";
}

/**
 * Checks whether an Optional value is currently in its missing state.
 * @param {Optional<T>} value - The Optional value to check.
 * @returns {boolean} True when the value is undefined.
 */
function isOptional<T>(value: Optional<T>): value is undefined {
  return isUndefined(value);
}

/**
 * Checks whether a Maybe value is currently in its missing state.
 * @param {Maybe<T>} value - The Maybe value to check.
 * @returns {boolean} True when the value is null.
 */
function isMaybe<T>(value: Maybe<T>): value is null {
  return isNull(value);
}

/**
 * Checks whether a Nullable value is currently in its missing state.
 * @param {Nullable<T>} value - The Nullable value to check.
 * @returns {boolean} True when the value is null or undefined.
 */
function isNullable<T>(value: Nullable<T>): value is null | undefined {
  return isNull(value) || isUndefined(value);
}

/**
 * Check if a value is an array.
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
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is an empty array.
 */
function isEmptyArray<T>(value: Nullable<readonly T[]>): value is readonly T[];
function isEmptyArray(value: unknown): value is readonly unknown[];
function isEmptyArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value) && value.length === EMPTY_LENGTH;
}

/**
 * more performant implementation of isArray for large arrays
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
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a number.
 */
function isNumber<T extends number>(value: Nullable<T>): value is T;
function isNumber(value: unknown): value is number;
function isNumber(value: unknown): value is number {
  if (typeof value === "string" && value.trim() === "") {
    return false;
  }
  return typeof value === "number" && !Number.isNaN(value) && Number.isFinite(value);
}

/**
 * Returns true if the value is an object.
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
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a function.
 */
function isFunction<T extends UnknownFunction>(
  value: Nullable<T>,
): value is T;
function isFunction(value: unknown): value is UnknownFunction;
function isFunction(value: unknown): value is UnknownFunction {
  return typeof value === "function";
}

/**
 * Returns true if the value is a promise.
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
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a plain object.
 */
function isEmptyObject<T extends Record<string, unknown>>(
  value: Nullable<T>,
): value is T;
function isEmptyObject(
  value: unknown,
): value is Record<string, unknown>;
function isEmptyObject(
  value: unknown,
): value is Record<string, unknown> {
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
 * Get the keys of an object.
 * @param {unknown} object - The object to get the keys of.
 * @returns {Array} Keys of object.
 */
function getKeys<T extends Record<string, unknown>>(
  object: T,
): (keyof T)[] {
  return Object.keys(object) as (keyof T)[];
}

/**
 * Parses the input value as an integer. Returns NaN if the value cannot
 * be parsed.
 * @param {unknown} value - The value to check.
 *  @param {Optional<number>} defaultValue - Value gets returned if integer could not
 * be parsed.
 * @returns {number} The parsed integer.
 */
function parseInteger(value: unknown): Optional<number>;
function parseInteger(value: unknown, defaultValue: number): number;
function parseInteger(
  value: unknown,
  defaultValue?: number,
): Optional<number> {
  if (isNumber(value)) {
    return Math.floor(value);
  }

  if (isString(value)) {
    const parsed = Number(value.trim());
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }
  return defaultValue;
}

/**
 * Check if a value is an integer.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is an integer.
 */
function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

/**
 * Check if a value is a float.
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

/**
 * Parses the input value as a float. Returns NaN if the value
 * cannot be parsed.
 * @param {unknown} value - The value to check.
 * @param {Optional<number>} defaultValue - Value gets returned if float could not
 * be parsed.
 * @returns {number} The parsed float.
 */
function parseFloat(value: unknown): Optional<number>;
function parseFloat(value: unknown, defaultValue: number): number;
function parseFloat(
  value: unknown,
  defaultValue?: number,
): Optional<number> {
  if (isNumber(value)) {
    return value;
  }
  if (isString(value)) {
    const normalizedValue = value.trim().replace(",", ".");
    const parsed = Number.parseFloat(normalizedValue);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return defaultValue;
}
/**
 * Parses the input value as a number. Returns NaN if the value cannot be
 * parsed.
 * @param {unknown} value - The value to check.
 * @param {Optional<number>} defaultValue - Value gets returned if number could not
 * be parsed.
 * @returns {number} The parsed number.
 */
function parseNumber(value: unknown): Optional<number>;
function parseNumber(value: unknown, defaultValue: number): number;
function parseNumber(
  value: unknown,
  defaultValue?: number,
): Optional<number> {
  if (isNumber(value)) {
    return value;
  }
  if (isString(value)) {
    const normalizedValue = value.trim().replace(",", ".");
    const parsed = Number(normalizedValue);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return defaultValue;
}

/**
 * Parses the input value as a string. Returns an empty string if the
 * value cannot be converted.
 * @param {unknown} value - The value to check.
 * @param {Optional<string>} defaultValue - Value gets returned if string could not
 * be parsed.
 * @returns {string} The parsed string.
 */
function parseString(
  value: unknown,
  defaultValue = "",
): string {
  if (isString(value)) {
    return value;
  }
  if (isNumber(value)) {
    return value.toString();
  }
  if (typeof value === "boolean") {
    return value.toString();
  }
  return defaultValue;
}

/**
 * Returns true for values that behave like "empty" application input.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is nullish, empty string, empty array,
 * false, or a plain object whose values are all empty-like.
 */
function isEmptyLike(value: unknown): boolean {
  if (isNull(value) || isUndefined(value)) {
    return true;
  }
  if (isString(value)) {
    return isEmptyString(value);
  }
  if (isArray(value)) {
    return value.every((entry) => {return isEmptyLike(entry)});
  }
  if (isBoolean(value)) {
    return !value;
  }
  if (isObject(value)) {
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      return false;
    }
    return Object.values(value).every((entry) =>
      {return isEmptyLike(entry)},
    );
  }
  return false;
}

/**
 * Checks if the provided value contains empty values.
 *
 * This function determines if the given value is either an empty string,
 * an empty object, or a string representation of an empty object.
 *
 * @param {unknown} value - The value to check for emptiness. It can be of any type.
 * @returns {boolean} `true` if the value is an empty string, an empty object, or a string
 *          representation of an empty object; otherwise, `false`.
 */
function hasEmptyValues(value: unknown): boolean {
  if (isString(value)) {
    try {
      if (isEmptyObject(JSON.parse(value))) {return true;}
    } catch {
      return isEmptyString(value);
    }
    return isEmptyString(value);
  }
  return isEmptyObject(value);
}

/**
 * Parses the input value as an array. Returns an empty array if the value
 * cannot be parsed as an array.
 * @param {unknown} value - The value to check.
 * @param {Optional<T[]>} defaultValue - Value gets returned if array could not
 * be parsed.
 * @returns {Optional<T[]>} The parsed array.
 */

function parseArray<T>(value: readonly T[]): T[];
function parseArray(value: string): string[];
function parseArray(value: number): number[];
function parseArray<T extends Record<string, unknown>>(value: T): T[];
function parseArray<T>(value: unknown, defaultValue: readonly T[]): T[];
function parseArray(value: unknown): unknown[] | undefined;
function parseArray(
  value: unknown,
  defaultValue?: readonly unknown[],
): unknown[] | undefined {
  if (isArray(value)) {
    return [...value];
  }
  if (isString(value)) {
    const parsed = value
      .split(/[,|;\n\t ]+/)
      .map((entry) => {return entry.trim()})
      .filter((entry) => {return entry.length > EMPTY_LENGTH});
    return parsed;
  }
  if (isNumber(value)) {
    return [value];
  }
  if (isEmptyObject(value)) {
    return [value];
  }

  if (isNull(value) || isUndefined(value)) {
    return cloneDefaultArray(defaultValue);
  }
  return cloneDefaultArray(defaultValue);
}

/**
 * Compares two arrays and returns true if they have at least one common value.
 * @param {readonly T[]} array1 - First array.
 * @param {readonly T[]} array2 - Second array.
 * @returns {boolean} True if the arrays have at least one common value.
 */
function arrayContainsCommonValue<T>(
  array1: readonly T[],
  array2: readonly T[],
): boolean {
  if (!isArray(array1) || !isArray(array2)) {return false;}

  const valueOccurrences = new Set(array1);
  return array2.some((value) => {return valueOccurrences.has(value)});
}

/**
 * Returns true if the input is a UUID string.
 * @param {string} input - The input to check.
 * @returns {boolean} True if the input is a UUID string.
 */
function isUuidString(input: unknown): input is string {
  return isString(input) && uuidRegex.test(input);
}

/**
 * Returns true if the input is a ULID string.
 * @param {string }input - The input to check.
 * @returns {boolean} True if the input is a ULID string.
 */
function isUlidString(input: unknown): input is string {
  return typeof input === "string" && ulidRegex.test(input);
}

/**
 * Parses the domain name from a URL.
 * @param {string} url - The URL to parse.
 * @param {Optional<T>} defaultValue - The fallback when parsing fails.
 * @returns {string} The domain name.
 */
function parseDomainName(url: string): Optional<string>;
function parseDomainName(url: string, defaultValue: string): string;
function parseDomainName(
  url: string,
  defaultValue?: string,
): Optional<string> {
  const normalizedValue = url.trim();
  if (normalizedValue === "" || normalizedValue.startsWith("/")) {
    return defaultValue;
  }

  let urlCandidate = normalizedValue;
  if (!normalizedValue.includes("://")) {
    urlCandidate = `https://${normalizedValue}`;
  }

  let hostname = "";
  try {
    ({ hostname } = new URL(urlCandidate));
  } catch {
    return defaultValue;
  }

  const normalizedHostname = hostname.replace(/^www\d?\./i, "");
  const [domainName] = normalizedHostname.split(".");
  if (!domainName) {
    return defaultValue;
  }

  return domainName;
}

export {
  arrayContainsCommonValue,
  fastIsArray,
  getKeys,
  hasEmptyValues,
  isArray,
  isBoolean,
  isDate,
  isEmptyArray,
  isEmptyLike,
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
  isSuccess,
  isSymbol,
  isUlidString,
  isUndefined,
  isUuidString,
  parseArray,
  parseDomainName,
  parseFloat,
  parseInteger,
  parseNumber,
  parseString,
};
