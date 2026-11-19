/**
 * Coercions from unknown input to a concrete type, each with a caller-supplied
 * fallback. Separate from the guards because parsing is what you do _after_ a
 * guard said no.
 */

import {
    isArray,
    isNull,
    isNumber,
    isObject,
    isString,
    isUndefined,
} from "./guards.js";
import type { Optional } from "./types/optional.js";

const EMPTY_LENGTH = 0;
const ZERO = 0;

// Whole-string shapes. Anchored on both ends: a string is a number or it is
// not, never "a number followed by something".
const INTEGER_TEXT = /^[+-]?\d+(?:\.0+)?$/;
const DECIMAL_TEXT = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
// A comma that is the only separator: `1,5`, `0,25`, `,5`.
const COMMA_DECIMAL_TEXT = /^[+-]?\d*,\d+$/;
// `1,000`, `12,345`: exactly three digits after the comma behind a short
// integer part read as a thousands group in English and as a decimal in German.
// Guessing wrong silently is worse than refusing, so these are refused. An
// integer part of a lone `0` is no thousands group (nobody writes `0,500` for
// five hundred), so `0,500` and `0,125` stay decimals.
const GROUPED_TEXT = /^[+-]?[1-9]\d{0,2},\d{3}$/;

// Turns a trimmed string into dot-decimal notation, or `undefined` when the
// comma in it cannot be told from a thousands separator.
function toDotDecimal(text: string): string | undefined {
    if (!COMMA_DECIMAL_TEXT.test(text)) {
        return text;
    }
    if (GROUPED_TEXT.test(text)) {
        return undefined;
    }

    return text.replace(",", ".");
}

// `-0` is the integer zero; callers comparing with `Object.is` never see it.
function withoutNegativeZero(value: number): number {
    if (value === ZERO) {
        return ZERO;
    }

    return value;
}

function cloneDefaultArray(
    defaultValue?: readonly unknown[],
): unknown[] | undefined {
    if (!defaultValue) {
        return defaultValue;
    }

    return [...defaultValue];
}

/**
 * Parses the input value as an integer. A number is truncated toward zero
 * (`-1.5` is `-1`). A string has to be an integer written out in full: digits
 * with an optional sign, surrounding whitespace and a zero-only fraction
 * (`"42.0"`). Empty or blank strings, `"12abc"`, `"0x10"`, `"1e3"`, `"1,000"`
 * and digits beyond the safe integer range (`"9007199254740993"`, also as a
 * number: `1e21`) are not integers. Returns the default (or `undefined`) when
 * the value cannot be parsed.
 *
 * @param {unknown} value - The value to check.
 * @param {Optional<number>} defaultValue - Value gets returned if integer could
 *   not be parsed.
 * @returns {number} The parsed integer.
 */
function parseInteger(value: unknown): Optional<number>;
function parseInteger(value: unknown, defaultValue: number): number;
function parseInteger(value: unknown, defaultValue?: number): Optional<number> {
    if (isNumber(value)) {
        // The same limit as for strings: past 2^53 a double stands for a range
        // of integers, not for one, so there is no integer to answer with.
        const truncated = Math.trunc(value);
        if (Number.isSafeInteger(truncated)) {
            return withoutNegativeZero(truncated);
        }
        return defaultValue;
    }

    if (isString(value)) {
        const trimmed = value.trim();
        if (INTEGER_TEXT.test(trimmed)) {
            const parsed = Number(trimmed);
            // Past 2^53 the digits no longer fit a double: `"9007199254740993"`
            // would come back as `...992`, a different number than the one
            // written. Refusing it is better than answering with that.
            if (Number.isSafeInteger(parsed)) {
                return withoutNegativeZero(parsed);
            }
        }
    }
    return defaultValue;
}

/**
 * Parses the input value as a float. A string has to be a decimal number in
 * full: `"1.5"`, `".5"`, `"-2"`, `"1.5e2"`. A comma is accepted as the one and
 * only decimal separator (`"1,5"`); mixed forms (`"1,234.56"`, `"1.234,56"`),
 * several commas and grouped forms (`"1,000"`) are refused, because the comma
 * could be a thousands separator. Empty or blank strings, `"12abc"`, `"0x10"`
 * and `"Infinity"` are refused too. Returns the default (or `undefined`) when
 * the value cannot be parsed.
 *
 * @param {unknown} value - The value to check.
 * @param {Optional<number>} defaultValue - Value gets returned if float could
 *   not be parsed.
 * @returns {number} The parsed float.
 */
function parseFloat(value: unknown): Optional<number>;
function parseFloat(value: unknown, defaultValue: number): number;
function parseFloat(value: unknown, defaultValue?: number): Optional<number> {
    if (isNumber(value)) {
        return withoutNegativeZero(value);
    }
    if (isString(value)) {
        const dotted = toDotDecimal(value.trim());
        if (dotted !== undefined && DECIMAL_TEXT.test(dotted)) {
            const parsed = Number(dotted);
            if (Number.isFinite(parsed)) {
                return withoutNegativeZero(parsed);
            }
        }
    }
    return defaultValue;
}

/**
 * Parses the input value as a number. The most permissive of the three: a
 * string may be anything `Number()` accepts for the whole string, so also
 * `"1e3"`, `"0xff"` and `"0b10"`. The comma rule is the one of `parseFloat`
 * (`"1,5"` is `1.5`, `"1,000"` and `"1,234.56"` are refused). Empty or blank
 * strings, `"12abc"` and `"Infinity"` are refused. Returns the default (or
 * `undefined`) when the value cannot be parsed.
 *
 * @param {unknown} value - The value to check.
 * @param {Optional<number>} defaultValue - Value gets returned if number could
 *   not be parsed.
 * @returns {number} The parsed number.
 */
function parseNumber(value: unknown): Optional<number>;
function parseNumber(value: unknown, defaultValue: number): number;
function parseNumber(value: unknown, defaultValue?: number): Optional<number> {
    if (isNumber(value)) {
        return withoutNegativeZero(value);
    }
    if (isString(value)) {
        const dotted = toDotDecimal(value.trim());
        if (dotted !== undefined && dotted !== "") {
            const parsed = Number(dotted);
            if (Number.isFinite(parsed)) {
                return withoutNegativeZero(parsed);
            }
        }
    }
    return defaultValue;
}

/**
 * Parses the input value as a string. Returns an empty string if the value
 * cannot be converted.
 *
 * @param {unknown} value - The value to check.
 * @param {Optional<string>} defaultValue - Value gets returned if string could
 *   not be parsed.
 * @returns {string} The parsed string.
 */
function parseString(value: unknown, defaultValue = ""): string {
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
 * Parses the input value as an array. An array is copied, a string is split on
 * commas, pipes, semicolons and whitespace, a finite number or a plain object
 * becomes a one-element array. Anything else (`null`, `NaN`, `Infinity`, a
 * class instance, a symbol) gives the default, or `undefined` without one: a
 * single-argument call with a number is therefore typed `number[] | undefined`,
 * since `NaN` has no array.
 *
 * @param {unknown} value - The value to check.
 * @param {Optional<T[]>} defaultValue - Value gets returned if array could not
 *   be parsed.
 * @returns {Optional<T[]>} The parsed array.
 */

function parseArray<T>(value: readonly T[]): T[];
function parseArray(value: string): string[];
function parseArray(value: number): number[] | undefined;
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
            .map((entry) => {
                return entry.trim();
            })
            .filter((entry) => {
                return entry.length > EMPTY_LENGTH;
            });
        return parsed;
    }
    if (isNumber(value)) {
        return [value];
    }
    if (isObject(value)) {
        return [value];
    }

    if (isNull(value) || isUndefined(value)) {
        return cloneDefaultArray(defaultValue);
    }
    return cloneDefaultArray(defaultValue);
}

/**
 * Parses the first label of the hostname of a URL, without a leading `www.` or
 * `www2.`: `"https://www.example.com/x"` gives `"example"`.
 *
 * This is a display helper, not a registrable-domain check. It returns the
 * LEFTMOST label, so `"example.attacker.net"` gives `"example"` as well, and
 * `"subdomain.example.dev"` gives `"subdomain"`. It knows nothing about the
 * public-suffix list. Never use it to decide whether a host belongs to a site,
 * for an allowlist, a redirect check or a CORS origin: compare the whole
 * hostname (`new URL(url).hostname`) against the exact hosts you trust.
 *
 * @param {string} url - The URL to parse.
 * @param {Optional<T>} defaultValue - The fallback when parsing fails.
 * @returns {string} The domain name.
 */
function parseDomainName(url: string): Optional<string>;
function parseDomainName(url: string, defaultValue: string): string;
function parseDomainName(url: string, defaultValue?: string): Optional<string> {
    const normalizedValue = url.trim();
    if (normalizedValue === "" || normalizedValue.startsWith("/")) {
        return defaultValue;
    }

    let urlCandidate = normalizedValue;
    if (!normalizedValue.includes("://")) {
        urlCandidate = `https://${normalizedValue}`;
    }

    // Everything that depends on a parseable URL stays inside the `try`, so
    // there is no binding that has to be declared before it can be assigned.
    try {
        const { hostname } = new globalThis.URL(urlCandidate);
        const normalizedHostname = hostname.replace(/^www\d?\./i, "");
        const [domainName] = normalizedHostname.split(".");
        if (domainName === undefined || domainName === "") {
            return defaultValue;
        }

        return domainName;
    } catch {
        return defaultValue;
    }
}

export {
    parseArray,
    parseDomainName,
    parseFloat,
    parseInteger,
    parseNumber,
    parseString,
};
