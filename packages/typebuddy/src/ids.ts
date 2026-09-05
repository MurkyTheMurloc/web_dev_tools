/**
 * Identifier-format checks. Their two regex literals are the only module-level
 * allocations in the package, which is the whole reason they live alone: a
 * bundler that keeps anything in a module keeps those too.
 */

import { isString } from "./guards.js";

const uuidRegex =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

const ulidRegex = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;

/**
 * Returns true if the input is a UUID string.
 *
 * @param {string} input - The input to check.
 * @returns {boolean} True if the input is a UUID string.
 */
function isUuidString(input: unknown): input is string {
    return isString(input) && uuidRegex.test(input);
}

/**
 * Returns true if the input is a ULID string.
 *
 * @param {string} input - The input to check.
 * @returns {boolean} True if the input is a ULID string.
 */
function isUlidString(input: unknown): input is string {
    return typeof input === "string" && ulidRegex.test(input);
}

export { isUlidString, isUuidString };
