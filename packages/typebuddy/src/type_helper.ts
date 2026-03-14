import type { ResolveOptional, Optional } from "./types/optional.js";
import type { Success, Failed } from "./types/maybe_promise.ts";
const uuidRegex =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

const ulidRegex = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;

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
 * Check if a value is an array.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is an array.
 */
export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * Check if a value is an empty array.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is an empty array.
 */
export function isEmptyArray<T>(value: unknown): value is T[] {
  return Array.isArray(value) && value.length === 0;
}

/**
 * more performant implementation of isArray for large arrays
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is an array.
 */
export function fastIsArray<T>(value: unknown): value is T[] {
  return Object.prototype.toString.call(value) === "[object Array]";
}

/**
 * Check if a value is a number.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a number.
 */
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
export function isObject(value: unknown): value is object {
  return (
    typeof value === "object" &&
    !isNull(value) &&
    !isUndefined(value) &&
    !isEmptyArray(value)
  );
}

/**
 * Returns true if the value is a boolean.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a boolean.
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/**
 * Returns true if the value is a function.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a function.
 */
export function isFunction(value: unknown): value is Function {
  return typeof value === "function";
}

/**
 * Returns true if the value is a promise.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a promise.
 */
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
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Returns true if the value is a date.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a date.
 */
export function isDate(value: unknown): value is Date {
  return value instanceof Date;
}

/**
 * Returns true if the value is a RegExp.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a RegExp.
 */
export function isRegExp(value: unknown): value is RegExp {
  return value instanceof RegExp;
}

/**
 * Returns true if the value is a symbol.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a symbol.
 */
export function isSymbol(value: unknown): value is symbol {
  return typeof value === "symbol";
}

/**
 * Check if a value is a plain object.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a plain object.
 */
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
  value: unknown,
  constructor: { new (): T },
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
  } else if (isString(value)) {
    const parsed = Number.parseInt(value, 10);
    if (isNaN(parsed)) {
      console.error(
        `typeguard -> parseInteger: could not parse value: ${defaultValue}`,
      );
      return defaultValue;
    }
    return parsed;
  } else {
    console.error(
      `typeguard -> parseInteger: could not parse value: ${defaultValue}`,
    );
    return defaultValue;
  }
}

/**
 * Check if a value is an integer.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is an integer.
 */
export function isInteger(value: unknown): value is number {
  return Number.isInteger(value) && !isUndefined(parseInteger(value));
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
  } else if (isString(value) && value.includes(",")) {
    const parsed = Number.parseFloat(value);
    return isNaN(parsed)
      ? (defaultValue as ResolveOptional<T, R>)
      : (parsed as ResolveOptional<T, R>);
  } else {
    console.error(`typebuddy -> parseFloat: could not parse ${value} `);
    return defaultValue as ResolveOptional<T, R>;
  }
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
  } else if (isString(value)) {
    if (value.includes(",")) {
      return parseFloat(value) as ResolveOptional<T, R>;
    }
    return parseInteger(value) as ResolveOptional<T, R>;
  } else {
    console.error(`typebuddy -> parseNumber: could not parse ${value} `);
    return defaultValue as ResolveOptional<T, R>;
  }
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
  } else {
    console.error(`typebuddy -> parseString: could not parse ${value} `);
    return defaultValue as ResolveOptional<T, R>;
  }
}

/**
 * Returns true if the value is an empty string, an empty object, or an empty number.
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is an empty string, an empty object, or an empty number.
 */
export function isNullOrUndefined(value: unknown): boolean {
  if (isString(value)) {
    return isEmptyString(value);
  } else if (!isEmptyObject(value) && isObject(value)) {
    for (const key in value) {
      if (!isNullOrUndefined(value[key])) {
        return false;
      }
    }
    return true;
  } else if (isArray(value)) {
    return value.length === 0;
  } else if (isNumber(value)) {
    return isNaN(value) && value === 0;
  } else if (isBoolean(value)) {
    return !value;
  } else if (isNull(value) || isUndefined(value)) {
    return true;
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
    if (isEmptyObject(JSON.parse(value))) return true;
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
    return value.split(/[,|;\n\t ]+/) as ResolveOptional<T[], R>;
  }
  if (isNumber(value)) {
    return [value] as unknown as ResolveOptional<T[], R>;
  }
  if (isEmptyObject(value)) {
    return [value] as unknown as ResolveOptional<T[], R>;
  }

  if (isNullOrUndefined(value)) {
    console.error(`typeguard -> parseArray: could not parse ${value} `);
    return defaultValue as ResolveOptional<T[], R>;
  }
  console.error(`typeguard -> parseArray: could not parse ${value} `);
  return defaultValue as ResolveOptional<T[], R>;
}

/**
 * Compares two arrays and returns true if they have at least one common value.
 * @param array1 - First array.
 * @param array2 - Second array.
 * @returns {boolean} True if the arrays have at least one common value.
 */
export function arrayContainsCommonValue(
  array1: string[],
  array2: string[],
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
  const match = url.match(/^(?:https?:\/\/)?(?:www\d?\.)?([^/]+)/i);
  if (!match) {
    console.error(
      `typebuddy -> parseDomainName: could not parse domain name: ${url}`,
    );
    return defaultValue as ResolveOptional<T, R>;
  }

  const domainParts = match[1].split(".");
  if (domainParts.length > 1) {
    return domainParts[0] as ResolveOptional<T, R>;
  }

  return match[1] as ResolveOptional<T, R>;
}
