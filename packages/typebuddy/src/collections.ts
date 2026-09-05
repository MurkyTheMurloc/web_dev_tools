/** Operations on collections rather than checks on them. */

import { isArray } from "./guards.js";

/**
 * Get the keys of an object.
 *
 * @param {unknown} object - The object to get the keys of.
 * @returns {Array} Keys of object.
 */
function getKeys<T extends Record<string, unknown>>(object: T): (keyof T)[] {
    return Object.keys(object);
}

/**
 * Compares two arrays and returns true if they have at least one common value.
 *
 * @param {readonly T[]} array1 - First array.
 * @param {readonly T[]} array2 - Second array.
 * @returns {boolean} True if the arrays have at least one common value.
 */
function arrayContainsCommonValue<T>(
    array1: readonly T[],
    array2: readonly T[],
): boolean {
    if (!isArray(array1) || !isArray(array2)) {
        return false;
    }

    const valueOccurrences = new Set(array1);
    return array2.some((value) => {
        return valueOccurrences.has(value);
    });
}

export { arrayContainsCommonValue, getKeys };
