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

// The runtime half of `typebuddy/prefer-guards`, shared by the Node test
// (tests/prefer_guards_equivalence.test.ts) and the browser run
// (smoke/browser/run.ts), which adds `document.all` and values from another
// realm. Not a test file itself: both import it.

type Check = (value: unknown) => unknown;

/** A native check, the guard the rule rewrites it to, and its name. */
type GuardPair = readonly [name: string, native: Check, guard: Check];

type Outcome = { readonly value: unknown } | { readonly threw: true };

type Mismatch = {
    readonly check: string;
    readonly value: string;
    readonly native: Outcome;
    readonly guard: Outcome;
};

class Point {
    readonly x = 1;
}

/**
 * Every edge value the rule's JSDoc promises: NaN, -0, boxed primitives,
 * prototype-less objects, arrays, class instances, functions, proxies (a
 * revoked one throws from most traps) and values faking a tag.
 */
function edgeValues(): Array<readonly [string, unknown]> {
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();

    return [
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
}

/** What the rule rewrites: each pair must agree for every value. */
const MAPPED: readonly GuardPair[] = [
    ["value === null", (value) => value === null, isNull],
    ["value === undefined", (value) => value === undefined, isUndefined],
    [
        "value === null || value === undefined",
        (value) => value === null || value === undefined,
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

/**
 * What the rule leaves alone because of `document.all` alone: in Node these
 * agree for every value, in a browser `document.all` tells them apart.
 */
const DOCUMENT_ALL_EXCLUDED: readonly GuardPair[] = [
    [
        'typeof value === "undefined"',
        (value) => typeof value === "undefined",
        isUndefined
    ],
    ["value == null", (value) => value == null, isNullable],
    [
        'value === null || typeof value === "undefined"',
        (value) => value === null || typeof value === "undefined",
        isNullable
    ]
];

function outcome(check: () => unknown): Outcome {
    try {
        return { value: check() };
    } catch {
        return { threw: true };
    }
}

function sameOutcome(left: Outcome, right: Outcome): boolean {
    if ("threw" in left || "threw" in right) {
        return "threw" in left && "threw" in right;
    }

    return Object.is(left.value, right.value);
}

/** Every (pair, value) where the native check and the guard disagree. */
function findMismatches(
    pairs: readonly GuardPair[],
    values: ReadonlyArray<readonly [string, unknown]>
): Mismatch[] {
    const mismatches: Mismatch[] = [];
    for (const [check, native, guard] of pairs) {
        for (const [name, value] of values) {
            const nativeOutcome = outcome(() => native(value));
            const guardOutcome = outcome(() => guard(value));
            if (!sameOutcome(nativeOutcome, guardOutcome)) {
                mismatches.push({
                    check,
                    value: name,
                    native: nativeOutcome,
                    guard: guardOutcome
                });
            }
        }
    }

    return mismatches;
}

export {
    DOCUMENT_ALL_EXCLUDED,
    MAPPED,
    edgeValues,
    findMismatches,
    outcome,
    sameOutcome
};
export type { GuardPair, Mismatch, Outcome };
