/**
 * The recursive "is this effectively blank" checks. Split out because they walk
 * arbitrary object graphs — far more code than the one-line guards they are
 * filed next to, and needed far less often.
 */

import {
    isArray,
    isBoolean,
    isEmptyObject,
    isEmptyString,
    isNull,
    isObject,
    isString,
    isUndefined,
} from "./guards.js";

/**
 * Returns true for values that behave like "empty" application input.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is nullish, empty string, empty array,
 *   false, or a plain object whose values are all empty-like.
 */
function isEmptyLike(value: unknown): boolean {
    if (isNull(value) || isUndefined(value)) {
        return true;
    }
    if (isString(value)) {
        return isEmptyString(value);
    }
    if (isArray(value)) {
        return value.every((entry) => {
            return isEmptyLike(entry);
        });
    }
    if (isBoolean(value)) {
        return !value;
    }
    if (isObject(value)) {
        if (Object.getPrototypeOf(value) !== Object.prototype) {
            return false;
        }
        return Object.values(value).every((entry) => {
            return isEmptyLike(entry);
        });
    }
    return false;
}

/**
 * Checks if the provided value contains empty values.
 *
 * This function determines if the given value is either an empty string, an
 * empty object, or a string representation of an empty object.
 *
 * @param {unknown} value - The value to check for emptiness. It can be of any
 *   type.
 * @returns {boolean} `true` if the value is an empty string, an empty object,
 *   or a string representation of an empty object; otherwise, `false`.
 */
function hasEmptyValues(value: unknown): boolean {
    if (isString(value)) {
        try {
            if (isEmptyObject(JSON.parse(value))) {
                return true;
            }
        } catch {
            return isEmptyString(value);
        }
        return isEmptyString(value);
    }
    return isEmptyObject(value);
}

export { hasEmptyValues, isEmptyLike };
