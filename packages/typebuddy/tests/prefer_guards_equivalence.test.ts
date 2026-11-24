import { describe, expect, it } from "vitest";

import {
    isArray,
    isBoolean,
    isDate,
    isError,
    isFunction,
    isInteger,
    isNull,
    isNullable,
    isNumber,
    isRegExp,
    isString,
    isSymbol,
    isUndefined
} from "../src/guards.js";

// The runtime half of `typebuddy/prefer-guards`: every native check the rule
// rewrites gives the guard's answer for every value below, a thrown error
// included. (`document.all` does not exist in Node; the rule's JSDoc carries
// that argument.)

class Point {
    readonly x = 1;
}

const revoked = Proxy.revocable({}, {});
revoked.revoke();

const VALUES: ReadonlyArray<readonly [string, unknown]> = [
    ["undefined", undefined],
    ["null", null],
    ["0", 0],
    ["-0", -0],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
    ["1.5", 1.5],
    ["2 ** 53", 2 ** 53],
    ["1n", 1n],
    ['""', ""],
    ['" "', " "],
    ['"1"', "1"],
    ["true", true],
    ["false", false],
    ["Symbol()", Symbol("s")],
    ["new String()", new String("")],
    ["new Number()", new Number(1)],
    ["new Boolean()", new Boolean(false)],
    ["{}", {}],
    ["Object.create(null)", Object.create(null)],
    ["[]", []],
    ["new Proxy([])", new Proxy([], {})],
    ["new Proxy({})", new Proxy({}, {})],
    ["new Proxy(fn)", new Proxy(() => 1, {})],
    ["revoked proxy", revoked.proxy],
    ["() => 1", () => 1],
    ["class", Point],
    ["async fn", async () => 1],
    ["new Point()", new Point()],
    ["new Date()", new Date()],
    ["new Date(NaN)", new Date(Number.NaN)],
    ["new Error()", new Error("e")],
    ["new TypeError()", new TypeError("e")],
    ["/x/", /x/u],
    ["{ then() {} }", { then() {} }],
    ["Promise", Promise.resolve(1)],
    ["fake Error tag", { [Symbol.toStringTag]: "Error" }],
    ["fake Array tag", { [Symbol.toStringTag]: "Array", length: 0 }]
];

type Outcome = { readonly value: unknown } | { readonly threw: true };

function outcome(check: () => unknown): Outcome {
    try {
        return { value: check() };
    } catch {
        return { threw: true };
    }
}

const MAPPINGS: ReadonlyArray<
    readonly [string, (value: unknown) => unknown, (value: unknown) => unknown]
> = [
    ["value === null", (value) => value === null, isNull],
    [
        'typeof value === "undefined"',
        (value) => typeof value === "undefined",
        isUndefined
    ],
    ["value == null", (value) => value == null, isNullable],
    ["value == undefined", (value) => value == undefined, isNullable],
    [
        'value === null || typeof value === "undefined"',
        (value) => value === null || typeof value === "undefined",
        isNullable
    ],
    [
        'typeof value === "string"',
        (value) => typeof value === "string",
        isString
    ],
    [
        'typeof value === "boolean"',
        (value) => typeof value === "boolean",
        isBoolean
    ],
    [
        'typeof value === "symbol"',
        (value) => typeof value === "symbol",
        isSymbol
    ],
    [
        'typeof value === "function"',
        (value) => typeof value === "function",
        isFunction
    ],
    ["value instanceof Error", (value) => value instanceof Error, isError],
    ["value instanceof Date", (value) => value instanceof Date, isDate],
    ["value instanceof RegExp", (value) => value instanceof RegExp, isRegExp],
    ["Array.isArray(value)", (value) => Array.isArray(value), isArray],
    ["Number.isFinite(value)", (value) => Number.isFinite(value), isNumber],
    ["Number.isInteger(value)", (value) => Number.isInteger(value), isInteger]
];

describe("prefer-guards rewrites only exact equivalents", () => {
    for (const [native, check, guard] of MAPPINGS) {
        it.each(VALUES)(`${native} for %s`, (_name, value) => {
            expect(outcome(() => guard(value))).toEqual(
                outcome(() => check(value))
            );
        });
    }

    it("is not exact for the checks it leaves alone", () => {
        // `typeof NaN === "number"`, `isNumber(NaN)` is false.
        expect(typeof Number.NaN === "number").not.toBe(isNumber(Number.NaN));
    });
});
