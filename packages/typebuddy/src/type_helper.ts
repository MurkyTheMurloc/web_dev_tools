import type { Maybe } from "./types/maybe.js";
import type { Nullable } from "./types/null_able.js";
import type { Optional, ResolveOptional } from "./types/optional.js";
import type { Failed, Success } from "./types/maybe_promise.js";
const uuidRegex =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

const ulidRegex = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;

function formatValueForLog(value: unknown): string {
  return typeof value === "symbol" ? value.toString() : String(value);
}

/**
 * Checks if the provided result is a `Success` type.
 *
 * @template T The type of the value contained in the `Success` type.
 * @param result The result to check, which can be either a `Success<T>` or `Failed`.
 * @returns `true` if the result is a `Success<T>`, `false` if it is a `Failed`.
 * @remarks This function acts as a type guard, narrowing the type of `result` to `Success<T>` when the condition is met.
 * @example
 * ```typescript
 * const result = await someAsyncFunction();
 * if (isSuccess(result)) {
 *   console.log(result.value); // TypeScript knows `value` is of type `T`
 * }
 * ```
 */
export function isSuccess<T>(
  result: Success<T> | Failed,
): result is Success<T> {
  return !result.isError;
}

/**
 * Check if a value is a string.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a string.
 */
export function isString<T extends string>(value: Nullable<T>): value is T;
export function isString(value: unknown): value is string;
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * Parses the input value as a boolean. Returns false if the value is no string.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a string.
 */
export function isEmptyString(value: unknown): boolean {
  if (!isString(value)) return false;
  return value.trim() === "";
}

/**
 * Returns true if the value is null.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is null.
 */
export function isNull(value: unknown): value is null {
  return value === null;
}

/**
 * Returns true if the value is undefined.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is undefined.
 */
export function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

/**
 * Checks whether an Optional value is currently in its missing state.
 * @param value - The Optional value to check.
 * @returns True when the value is undefined.
 */
export function isOptional<T>(value: Optional<T>): value is undefined {
  return isUndefined(value);
}

/**
 * Checks whether a Maybe value is currently in its missing state.
 * @param value - The Maybe value to check.
 * @returns True when the value is null.
 */
export function isMaybe<T>(value: Maybe<T>): value is null {
  return isNull(value);
}

/**
 * Checks whether a Nullable value is currently in its missing state.
 * @param value - The Nullable value to check.
 * @returns True when the value is null or undefined.
 */
export function isNullable<T>(value: Nullable<T>): value is null | undefined {
  return isNull(value) || isUndefined(value);
}

/**
 * Check if a value is an array.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is an array.
 */
export function isArray<T>(value: Nullable<T[]>): value is T[];
export function isArray<T>(value: unknown): value is T[];
export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * Check if a value is an empty array.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is an empty array.
 */
export function isEmptyArray<T>(value: Nullable<T[]>): value is T[];
export function isEmptyArray<T>(value: unknown): value is T[];
export function isEmptyArray<T>(value: unknown): value is T[] {
  return Array.isArray(value) && value.length === 0;
}

/**
 * more performant implementation of isArray for large arrays
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is an array.
 */
export function fastIsArray<T>(value: Nullable<T[]>): value is T[];
export function fastIsArray<T>(value: unknown): value is T[];
export function fastIsArray<T>(value: unknown): value is T[] {
  return Object.prototype.toString.call(value) === "[object Array]";
}

/**
 * Check if a value is a number.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a number.
 */
export function isNumber<T extends number>(value: Nullable<T>): value is T;
export function isNumber(value: unknown): value is number;
export function isNumber(value: unknown): value is number {
  if (typeof value === "string" && value.trim() === "") {
    return false;
  }
  return (
    typeof value === "number" && !Number.isNaN(value) && Number.isFinite(+value)
  );
}

/**
 * Returns true if the value is an object.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is an object.
 */
export function isObject<T extends object>(value: Nullable<T>): value is T;
export function isObject(value: unknown): value is object;
export function isObject(value: unknown): value is object {
  if (
    typeof value !== "object" ||
    value === null ||
    isArray(value) ||
    Object.prototype.toString.call(value) !== "[object Object]"
  ) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return (
    prototype === Object.prototype
  );
}

/**
 * Returns true if the value is a boolean.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a boolean.
 */
export function isBoolean<T extends boolean>(value: Nullable<T>): value is T;
export function isBoolean(value: unknown): value is boolean;
export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/**
 * Returns true if the value is a function.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a function.
 */
export function isFunction<T extends Function>(value: Nullable<T>): value is T;
export function isFunction(value: unknown): value is Function;
export function isFunction(value: unknown): value is Function {
  return typeof value === "function";
}

/**
 * Returns true if the value is a promise.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a promise.
 */
export function isPromise<T>(value: Nullable<Promise<T>>): value is Promise<T>;
export function isPromise(value: unknown): value is Promise<unknown>;
export function isPromise(value: unknown): value is Promise<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Promise<unknown>).then === "function"
  );
}

/**
 * Returns true if the value is an error.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is an error.
 */
export function isError<T extends Error>(value: Nullable<T>): value is T;
export function isError(value: unknown): value is Error;
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Returns true if the value is a date.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a date.
 */
export function isDate<T extends Date>(value: Nullable<T>): value is T;
export function isDate(value: unknown): value is Date;
export function isDate(value: unknown): value is Date {
  return value instanceof Date;
}

/**
 * Returns true if the value is a RegExp.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a RegExp.
 */
export function isRegExp<T extends RegExp>(value: Nullable<T>): value is T;
export function isRegExp(value: unknown): value is RegExp;
export function isRegExp(value: unknown): value is RegExp {
  return value instanceof RegExp;
}

/**
 * Returns true if the value is a symbol.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a symbol.
 */
export function isSymbol<T extends symbol>(value: Nullable<T>): value is T;
export function isSymbol(value: unknown): value is symbol;
export function isSymbol(value: unknown): value is symbol {
  return typeof value === "symbol";
}

/**
 * Check if a value is a plain object.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a plain object.
 */
export function isEmptyObject<T extends Record<string, unknown>>(
  value: Nullable<T>,
): value is T;
export function isEmptyObject(
  value: unknown,
): value is Record<string, unknown>;
export function isEmptyObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    !isNull(value) &&
    !isUndefined(value) &&
    !isEmptyArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value).length === 0
  );
}

/**
 * Check if a value is an instance of a class.
 * @param {unknown} value - The value to check.
 * @param {unknown} constructor - The class constructor to check against.
 * @returns {boolean} True if the value is an instance of the class.
 */
export function isInstanceOf<T>(
  value: Nullable<T>,
  constructor: { new (...args: unknown[]): T },
): value is T;
export function isInstanceOf<T>(
  value: unknown,
  constructor: { new (...args: unknown[]): T },
): value is T;
export function isInstanceOf<T>(
  value: unknown,
  constructor: { new (...args: unknown[]): T },
): value is T {
  return value instanceof constructor;
}

/**
 * Get the keys of an object.
 * @param {unknown} object - The object to get the keys of.
 * @returns {Array} Keys of object.
 */
export function getKeys<T extends Record<string, unknown>>(
  object: T,
): Array<keyof T> {
  return Object.keys(object) as Array<keyof T>;
}

/**
 * Parses the input value as an integer. Returns NaN if the value cannot
 * be parsed.
 * @param {unknown} value - The value to check.
 *  @param {Optional<number>} defaultValue - Value gets returned if integer could not
 * be parsed.
 * @returns {number} The parsed integer.
 */
export function parseInteger(
  value: unknown,
  defaultValue: Optional<number> = undefined,
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

  console.error(
    `typeguard -> parseInteger: could not parse value: ${formatValueForLog(value)}`,
  );
  return defaultValue;
}

/**
 * Check if a value is an integer.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is an integer.
 */
export function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

/**
 * Check if a value is a float.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a float.
 */
export function isFloat(value: unknown): value is number {
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
export function parseFloat<T extends number, R extends Optional<T>>(
  value: unknown,
  defaultValue?: R,
): ResolveOptional<T, R> {
  if (isNumber(value)) {
    return value as ResolveOptional<T, R>;
  }
  if (isString(value)) {
    const normalizedValue = value.trim().replace(",", ".");
    const parsed = Number.parseFloat(normalizedValue);
    return Number.isNaN(parsed)
      ? (defaultValue as ResolveOptional<T, R>)
      : (parsed as ResolveOptional<T, R>);
  }
  console.error(`typebuddy -> parseFloat: could not parse ${formatValueForLog(value)} `);
  return defaultValue as ResolveOptional<T, R>;
}
/**
 * Parses the input value as a number. Returns NaN if the value cannot be
 * parsed.
 * @param {unknown} value - The value to check.
 * @param {Optional<number>} defaultValue - Value gets returned if number could not
 * be parsed.
 * @returns {number} The parsed number.
 */
export function parseNumber<T extends number, R extends Optional<T>>(
  value: unknown,
  defaultValue?: R,
): ResolveOptional<T, R> {
  if (isNumber(value)) {
    return value as ResolveOptional<T, R>;
  }
  if (isString(value)) {
    const normalizedValue = value.trim().replace(",", ".");
    const parsed = Number(normalizedValue);
    if (Number.isFinite(parsed)) {
      return parsed as ResolveOptional<T, R>;
    }
    return defaultValue as ResolveOptional<T, R>;
  }
  console.error(`typebuddy -> parseNumber: could not parse ${formatValueForLog(value)} `);
  return defaultValue as ResolveOptional<T, R>;
}

/**
 * Parses the input value as a string. Returns an empty string if the
 * value cannot be converted.
 * @param {unknown} value - The value to check.
 * @param {Optional<string>} defaultValue - Value gets returned if string could not
 * be parsed.
 * @returns {string} The parsed string.
 */
export function parseString<T extends string, R extends Optional<T>>(
  value: unknown,
  defaultValue?: R,
): ResolveOptional<T, R> {
  if (isString(value)) {
    return value as ResolveOptional<T, R>;
  }
  if (isNumber(value)) {
    return value.toString() as ResolveOptional<T, R>;
  }
  if (typeof value === "boolean") {
    return value.toString() as ResolveOptional<T, R>;
  }
  console.error(`typebuddy -> parseString: could not parse ${formatValueForLog(value)} `);
  return (defaultValue ?? "") as ResolveOptional<T, R>;
}

/**
 * Returns true for values that behave like "empty" application input.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is nullish, empty string, empty array,
 * false, or a plain object whose values are all empty-like.
 */
export function isEmptyLike(value: unknown): boolean {
  if (isNull(value) || isUndefined(value)) {
    return true;
  }
  if (isString(value)) {
    return isEmptyString(value);
  }
  if (isArray(value)) {
    return value.length === 0 || value.every((entry) => isEmptyLike(entry));
  }
  if (isBoolean(value)) {
    return value === false;
  }
  if (isObject(value)) {
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      return false;
    }
    return Object.values(value as Record<string, unknown>).every((entry) =>
      isEmptyLike(entry),
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
 * @param value - The value to check for emptiness. It can be of any type.
 * @returns `true` if the value is an empty string, an empty object, or a string
 *          representation of an empty object; otherwise, `false`.
 */
export function hasEmptyValues(value: unknown): boolean {
  if (isString(value)) {
    try {
      if (isEmptyObject(JSON.parse(value))) return true;
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

export function parseArray<T, R extends Optional<T[]>>(
  value: unknown,
  defaultValue?: R,
): ResolveOptional<T[], R> {
  if (Array.isArray(value)) {
    return value as ResolveOptional<T[], R>;
  }
  if (isString(value)) {
    const parsed = value
      .split(/[,|;\n\t ]+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    return parsed as ResolveOptional<T[], R>;
  }
  if (isNumber(value)) {
    return [value] as unknown as ResolveOptional<T[], R>;
  }
  if (isEmptyObject(value)) {
    return [value] as unknown as ResolveOptional<T[], R>;
  }

  if (isNull(value) || isUndefined(value)) {
    console.error(
      `typeguard -> parseArray: could not parse ${formatValueForLog(value)} `,
    );
    return defaultValue as ResolveOptional<T[], R>;
  }
  console.error(
    `typeguard -> parseArray: could not parse ${formatValueForLog(value)} `,
  );
  return defaultValue as ResolveOptional<T[], R>;
}

/**
 * Compares two arrays and returns true if they have at least one common value.
 * @param array1 - First array.
 * @param array2 - Second array.
 * @returns {boolean} True if the arrays have at least one common value.
 */
export function arrayContainsCommonValue<T>(
  array1: T[],
  array2: T[],
): boolean {
  if (!isArray(array1) || !isArray(array2)) return false;

  const valueOccurrences = new Set(array1);
  return array2.some((value) => valueOccurrences.has(value));
}

/**
 * Returns true if the input is a UUID string.
 * @param {string} input - The input to check.
 * @returns {boolean} True if the input is a UUID string.
 */
export function isUuidString(input: unknown): input is string {
  return isString(input) && uuidRegex.test(input);
}

/**
 * Returns true if the input is a ULID string.
 * @param {string }input - The input to check.
 * @returns {boolean} True if the input is a ULID string.
 */
export function isUlidString(input: unknown): input is string {
  return typeof input === "string" && ulidRegex.test(input);
}

/**
 * Parses the domain name from a URL.
 * @param {string} url - The URL to parse.
 * @returns {string} The domain name.
 */
export function parseDomainName<T extends string, R extends Optional<T>>(
  url: string,
  defaultValue?: R,
): ResolveOptional<T, R> {
  const normalizedValue = url.trim();
  if (normalizedValue === "" || normalizedValue.startsWith("/")) {
    console.error(
      `typebuddy -> parseDomainName: could not parse domain name: ${url}`,
    );
    return defaultValue as ResolveOptional<T, R>;
  }

  const urlCandidate = normalizedValue.includes("://")
    ? normalizedValue
    : `https://${normalizedValue}`;

  let hostname = "";
  try {
    hostname = new URL(urlCandidate).hostname;
  } catch {
    console.error(
      `typebuddy -> parseDomainName: could not parse domain name: ${url}`,
    );
    return defaultValue as ResolveOptional<T, R>;
  }

  const normalizedHostname = hostname.replace(/^www\d?\./i, "");
  const [domainName] = normalizedHostname.split(".");
  if (!domainName) {
    console.error(
      `typebuddy -> parseDomainName: could not parse domain name: ${url}`,
    );
    return defaultValue as ResolveOptional<T, R>;
  }

  return domainName as ResolveOptional<T, R>;
}
