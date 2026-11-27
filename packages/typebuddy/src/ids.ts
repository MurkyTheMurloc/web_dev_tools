/**
 * Identifier-format checks and brand guards. Their two regex literals are the
 * only module-level allocations in the package, which is the whole reason they
 * live alone: a bundler that keeps anything in a module keeps those too.
 */

import { isString } from "./guards.js";
import type {
    Brand,
    NonEmptyString,
    UlidString,
    UuidString
} from "./types/brand.js";

// RFC 9562: versions 1 to 8 with the `10xx` variant, plus the two special
// values, nil (all zero) and max (all one). Case-insensitive.
const uuidRegex =
    /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|0{8}-0{4}-0{4}-0{4}-0{12}|f{8}-f{4}-f{4}-f{4}-f{12})$/i;

// Crockford base32 (no I, L, O, U), case-insensitive. The first character
// carries the top 3 bits of the 48-bit timestamp, so it stops at `7`: anything
// above overflows 128 bits and is not a ULID.
const ulidRegex = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i;

/**
 * Returns true if the input is a UUID string: versions 1 to 8, or the nil or
 * max UUID, in either case. Narrows to the branded `UuidString` type.
 *
 * @param {unknown} input - The input to check.
 * @returns {boolean} True if the input is a UUID string.
 */
function isUuidString(input: unknown): input is UuidString {
    return isString(input) && uuidRegex.test(input);
}

/**
 * Returns true if the input is a ULID string, in either case. Narrows to the
 * branded `UlidString` type.
 *
 * @param {unknown} input - The input to check.
 * @returns {boolean} True if the input is a ULID string.
 */
function isUlidString(input: unknown): input is UlidString {
    return isString(input) && ulidRegex.test(input);
}

/**
 * Returns true if the input is a string containing at least one non-whitespace
 * character. Narrows to the branded `NonEmptyString` type.
 *
 * @param {unknown} input - The input to check.
 * @returns {boolean} True if the input is a non-empty string.
 */
function isNonEmptyString(input: unknown): input is NonEmptyString {
    return isString(input) && input.trim() !== "";
}

/**
 * Turns a boolean validation predicate into a type guard that narrows `T` to a
 * nominal `Brand<T, Tag>` without any unsafe cast at call sites.
 *
 * @param {(value: T) => boolean} predicate - Runtime check that must hold.
 * @returns {(value: T) => value is Brand<T, Tag>} A narrowing guard for the
 *   brand.
 */
function createBrandGuard<T, Tag extends string>(
    predicate: (value: T) => boolean
): (value: T) => value is Brand<T, Tag> {
    return (value: T): value is Brand<T, Tag> => {
        return predicate(value);
    };
}

export { createBrandGuard, isNonEmptyString, isUlidString, isUuidString };
