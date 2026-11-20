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
    isUndefined
} from "./guards.js";

type Container = {
    readonly node: object;
    readonly entries: readonly unknown[];
};

// The arrays and plain objects `isEmptyLike` looks into, with what to look at.
// Class instances, dates, maps and the like are not containers: they are
// content.
function toContainer(value: unknown): Container | undefined {
    if (isArray(value)) {
        return { entries: value, node: value };
    }
    if (isObject(value) && Object.getPrototypeOf(value) === Object.prototype) {
        return { entries: Object.values(value), node: value };
    }

    return undefined;
}

/**
 * Returns true for values that behave like "empty" application input.
 *
 * A reference back to an array or object that is still being walked adds no
 * content of its own, so it counts as empty and the walk ends there: a cyclic
 * structure is empty-like when everything else in it is. A value that merely
 * appears twice is not a cycle and is walked both times.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is nullish, empty string, empty array,
 *   false, or a plain object whose values are all empty-like.
 */
function isEmptyLike(value: unknown): boolean {
    // The arrays and objects on the path from the root to the value being
    // looked at. An entry is removed again when its walk is done, so a value
    // that appears twice side by side is not taken for a cycle.
    const walking = new WeakSet<object>();

    /**
     * @param {unknown} candidate - The value being looked at.
     * @returns {boolean} True if the candidate is empty-like.
     */
    function walk(candidate: unknown): boolean {
        if (isNull(candidate) || isUndefined(candidate)) {
            return true;
        }
        if (isString(candidate)) {
            return isEmptyString(candidate);
        }
        if (isBoolean(candidate)) {
            return !candidate;
        }

        const container = toContainer(candidate);
        if (container === undefined) {
            return false;
        }
        if (walking.has(container.node)) {
            return true;
        }

        walking.add(container.node);
        const result = container.entries.every((entry) => {
            return walk(entry);
        });
        walking.delete(container.node);
        return result;
    }

    return walk(value);
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
