/**
 * Coercions from unknown input to a concrete type, each with a caller-supplied
 * fallback. Separate from the guards because parsing is what you do _after_ a
 * guard said no.
 */

import {
    isArray,
    isEmptyObject,
    isNull,
    isNumber,
    isString,
    isUndefined,
} from "./guards.js";
import type { Optional } from "./types/optional.js";

const EMPTY_LENGTH = 0;

function cloneDefaultArray(
    defaultValue?: readonly unknown[],
): unknown[] | undefined {
    if (!defaultValue) {
        return defaultValue;
    }

    return [...defaultValue];
}

/**
 * Parses the input value as an integer. Returns NaN if the value cannot be
 * parsed.
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
 * Parses the input value as a float. Returns NaN if the value cannot be parsed.
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
 * Parses the input value as an array. Returns an empty array if the value
 * cannot be parsed as an array.
 *
 * @param {unknown} value - The value to check.
 * @param {Optional<T[]>} defaultValue - Value gets returned if array could not
 *   be parsed.
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
    if (isEmptyObject(value)) {
        return [value];
    }

    if (isNull(value) || isUndefined(value)) {
        return cloneDefaultArray(defaultValue);
    }
    return cloneDefaultArray(defaultValue);
}

/**
 * Parses the domain name from a URL.
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
        const { hostname } = new URL(urlCandidate);
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
