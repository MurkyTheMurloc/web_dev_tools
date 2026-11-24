import { fileURLToPath } from "node:url";

import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";

import { typebuddyOxlintPlugin } from "../oxlint/index.js";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

// `typebuddy/prefer-guards` through oxlint's own RuleTester: the real parser,
// scope manager and fixer. `output` is the file after one `--fix` pass (`null`:
// no autofix); `suggestions` are the editor fixes.
const tester = new RuleTester({
    languageOptions: { parserOptions: { lang: "ts" } }
});

type TesterRule = Parameters<RuleTester["run"]>[1];
type Valid = Parameters<RuleTester["run"]>[2]["valid"][number];
type Invalid = Parameters<RuleTester["run"]>[2]["invalid"][number];

function isTesterRule(value: unknown): value is TesterRule {
    return (
        typeof value === "object" &&
        value !== null &&
        "create" in value &&
        typeof value.create === "function"
    );
}

const rule = typebuddyOxlintPlugin.rules["prefer-guards"];
if (!isTesterRule(rule)) {
    throw new Error("typebuddy/prefer-guards is not a rule");
}

const PACKAGE = "@murky-web/typebuddy";
const PACKAGE_ROOT = fileURLToPath(new URL("../", import.meta.url));

function lines(...rows: string[]): string {
    return rows.join("\n");
}

function messageWith(...pieces: string[]): RegExp {
    const escaped = pieces.map((piece) =>
        piece.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&")
    );
    return new RegExp(escaped.join("[\\s\\S]*"), "u");
}

/**
 * A module that declares `x`, `o`, `e`, `f` and exports `check`, the expression
 * under test. Declared, so `typeof x` is not a name the file never declares.
 */
function source(expression: string, head: string[] = []): string {
    return lines(
        ...head,
        "declare const x: unknown;",
        "declare const o: { a?: { b?: string | null } };",
        "declare const e: unknown;",
        "declare function f(): unknown;",
        `export const check = ${expression};`
    );
}

/** `expression` fixed to `fixedExpression`, with the guard's import added. */
function fixed(
    expression: string,
    fixedExpression: string,
    guard: string
): Invalid {
    return {
        name: `${expression} -> ${fixedExpression}`,
        code: source(expression),
        errors: [{ messageId: "preferGuard" }],
        output: source(fixedExpression, [
            `import { ${guard} } from "${PACKAGE}";`
        ])
    };
}

/** `expression` reported with an editor suggestion and no autofix. */
function suggested(
    expression: string,
    fixedExpression: string,
    guard: string
): Invalid {
    return {
        name: `${expression} -> suggestion ${fixedExpression}`,
        code: source(expression),
        errors: [
            {
                messageId: "preferGuardNarrowing",
                suggestions: [
                    {
                        messageId: "applyGuard",
                        output: source(fixedExpression, [
                            `import { ${guard} } from "${PACKAGE}";`
                        ])
                    }
                ]
            }
        ],
        output: null
    };
}

function silent(name: string, expression: string, head: string[] = []): Valid {
    return { name, code: source(expression, head) };
}

const valid: Valid[] = [
    // Close, but not the same for every value.
    // `typeof document.all` is "undefined", `document.all === undefined` is
    // false: isUndefined and isNullable are the `===` checks.
    silent('typeof x === "undefined"', 'typeof x === "undefined"'),
    silent('"undefined" !== typeof x', '"undefined" !== typeof x'),
    silent(
        'x === null || typeof x === "undefined": neither half',
        'x === null || typeof x === "undefined"'
    ),
    silent(
        'typeof x !== "undefined" && x !== null: neither half',
        'typeof x !== "undefined" && x !== null'
    ),
    // `document.all == null` is true, `isNullable(document.all)` is false.
    silent("x == null", "x == null"),
    silent("x != null", "x != null"),
    silent("undefined == x", "undefined == x"),
    silent(
        'typeof x === "number": isNumber rejects NaN and Infinity',
        'typeof x === "number"'
    ),
    silent(
        'typeof x === "object": isObject only takes plain objects',
        'typeof x === "object"'
    ),
    silent('typeof x === "bigint": no guard', 'typeof x === "bigint"'),
    silent(
        "x instanceof Promise: isPromise takes thenables",
        "x instanceof Promise"
    ),
    silent("x instanceof Map: no guard", "x instanceof Map"),
    silent("isFinite(x) coerces", "isFinite(x)"),
    silent("a typo in the tag", 'typeof x === "strnig"'),
    silent("typeof against typeof", "typeof x === typeof e"),
    silent("null === undefined", "null === undefined"),

    // A name the file does not declare: `isString(missing)` throws.
    silent("typeof of an undeclared name", 'typeof missing === "string"'),
    silent(
        "typeof of an undeclared global function",
        'typeof require === "function"'
    ),

    // The guard name is something else here.
    silent("a local isNull", "x === null", [
        "function isNull(value: unknown): boolean { return value === null; }"
    ]),
    silent("isString from another library", 'typeof x === "string"', [
        'import { isString } from "other-lib";'
    ]),
    silent("a local const isNull", "x === null", [
        `import { isNull as nul } from "other-lib";`,
        "const isNull = nul;"
    ]),
    silent("isError as a type-only import", "e instanceof Error", [
        `import type { isError } from "${PACKAGE}";`
    ]),

    // The global the check needs is shadowed.
    silent("a local Date", "x instanceof Date", ["class Date {}"]),
    silent("a local Array", "Array.isArray(x)", [
        "const Array = { isArray: (_: unknown) => true };"
    ]),
    silent("a local Number", "Number.isFinite(x)", [
        "const Number = { isFinite: (_: unknown) => true };"
    ]),
    {
        name: "a parameter called undefined",
        code: lines(
            "export function check(x: unknown, undefined: unknown): boolean {",
            "    return x === undefined;",
            "}"
        )
    },

    // Calls that are not the plain global method.
    silent("optional call", "Array.isArray?.(x)"),
    silent("spread argument", "Array.isArray(...[x])"),
    silent("two arguments", "Array.isArray(x, f())"),
    silent("computed member", 'Array["isArray"](x)'),

    // Where the rule does not apply at all.
    {
        name: "a script file cannot import the guard",
        code: lines("declare const x: unknown;", "const check = x === null;")
    },
    {
        name: "a test file",
        filename: "src/a.test.ts",
        code: source("x === null")
    },
    {
        name: "a declaration file",
        filename: "types.d.ts",
        code: source("x === null")
    },
    {
        name: "typebuddy's own source",
        filename: `${PACKAGE_ROOT}src/new_guard.ts`,
        code: source("x === null")
    }
];

const invalid: Invalid[] = [
    // --fix
    fixed("x === null", "isNull(x)", "isNull"),
    fixed("null === x", "isNull(x)", "isNull"),
    fixed("x !== null", "!isNull(x)", "isNull"),
    fixed("!(x === null)", "!isNull(x)", "isNull"),
    fixed("!(x !== null)", "isNull(x)", "isNull"),
    fixed("f() === null", "isNull(f())", "isNull"),
    fixed("(f(), x) === null", "isNull((f(), x))", "isNull"),
    fixed("x === undefined", "isUndefined(x)", "isUndefined"),
    fixed("undefined !== x", "!isUndefined(x)", "isUndefined"),
    fixed("o.a === undefined", "isUndefined(o.a)", "isUndefined"),
    fixed("x === null || x === undefined", "isNullable(x)", "isNullable"),
    fixed("x === undefined || null === x", "isNullable(x)", "isNullable"),
    fixed("x !== null && x !== undefined", "!isNullable(x)", "isNullable"),
    fixed("!(x === null || x === undefined)", "!isNullable(x)", "isNullable"),
    fixed("!(x !== null && x !== undefined)", "isNullable(x)", "isNullable"),
    fixed(
        "o.a?.b === null || o.a?.b === undefined",
        "isNullable(o.a?.b)",
        "isNullable"
    ),
    fixed(
        "this.v === null || this.v === undefined",
        "isNullable(this.v)",
        "isNullable"
    ),
    fixed(
        "f() || x === null || x === undefined",
        "f() || isNullable(x)",
        "isNullable"
    ),
    fixed(
        "x === null || x === undefined || f()",
        "isNullable(x) || f()",
        "isNullable"
    ),
    fixed('typeof x === "string"', "isString(x)", "isString"),
    fixed('"string" == typeof x', "isString(x)", "isString"),
    fixed('typeof x != "string"', "!isString(x)", "isString"),
    fixed('!(typeof x === "string")', "!isString(x)", "isString"),
    // isEmptyString is a plain boolean: only the `typeof` half is a guard.
    fixed(
        'typeof x === "string" && x.trim() === ""',
        'isString(x) && x.trim() === ""',
        "isString"
    ),
    fixed('typeof x === "boolean"', "isBoolean(x)", "isBoolean"),
    fixed('typeof x === "symbol"', "isSymbol(x)", "isSymbol"),
    fixed("e instanceof Error", "isError(e)", "isError"),
    fixed("!(e instanceof Error)", "!isError(e)", "isError"),
    fixed("x instanceof Date", "isDate(x)", "isDate"),
    fixed("x instanceof RegExp", "isRegExp(x)", "isRegExp"),

    // Suggestions: same answer, stricter narrowing.
    suggested("Array.isArray(x)", "isArray(x)", "isArray"),
    suggested("!Array.isArray(x)", "!isArray(x)", "isArray"),
    suggested('typeof x === "function"', "isFunction(x)", "isFunction"),
    suggested('typeof x !== "function"', "!isFunction(x)", "isFunction"),
    suggested("Number.isFinite(x)", "isNumber(x)", "isNumber"),
    suggested("Number.isInteger(x)", "isInteger(x)", "isInteger"),

    {
        name: "the message says what, why and the exact fix",
        code: source("x === null"),
        errors: [
            {
                message: messageWith(
                    "`x === null` is exactly `isNull(x)`: `isNull` is `value === null`, for every value.",
                    `Fix: \`isNull(x)\` with \`import { isNull } from "${PACKAGE}";\``,
                    "`--fix` applies it"
                )
            }
        ],
        output: source("isNull(x)", [`import { isNull } from "${PACKAGE}";`])
    },
    {
        name: "the suggestion message names the narrowing",
        code: source("Array.isArray(x)"),
        errors: [
            {
                message: messageWith(
                    "`Array.isArray(x)` gives the same answer as `isArray(x)` for every value",
                    "`readonly unknown[]`",
                    "`--fix` does not apply it"
                ),
                suggestions: [
                    {
                        messageId: "applyGuard",
                        output: source("isArray(x)", [
                            `import { isArray } from "${PACKAGE}";`
                        ])
                    }
                ]
            }
        ],
        output: null
    },

    // A pair over calls is not one `isNullable`: each half is its own guard.
    {
        name: "a pair over a call becomes two guards, f() still runs twice",
        code: source("f() === null || f() === undefined", [
            `import { isNull, isUndefined } from "${PACKAGE}";`
        ]),
        errors: [{ messageId: "preferGuard" }, { messageId: "preferGuard" }],
        output: source("isNull(f()) || isUndefined(f())", [
            `import { isNull, isUndefined } from "${PACKAGE}";`
        ])
    },
    {
        name: "a pair over two different references is not isNullable",
        code: source("x === null || e === undefined", [
            `import { isNull, isUndefined } from "${PACKAGE}";`
        ]),
        errors: [{ messageId: "preferGuard" }, { messageId: "preferGuard" }],
        output: source("isNull(x) || isUndefined(e)", [
            `import { isNull, isUndefined } from "${PACKAGE}";`
        ])
    },
    {
        name: "a pair with a parenthesised half inside a chain is left to its halves",
        code: source("f() || (x === null) || x === undefined", [
            `import { isNull, isUndefined } from "${PACKAGE}";`
        ]),
        errors: [{ messageId: "preferGuard" }, { messageId: "preferGuard" }],
        output: source("f() || (isNull(x)) || isUndefined(x)", [
            `import { isNull, isUndefined } from "${PACKAGE}";`
        ])
    },

    // Imports.
    {
        name: "joins an existing import of the package",
        code: source("x === null", [`import { ok } from "${PACKAGE}";`]),
        errors: [{ messageId: "preferGuard" }],
        output: source("isNull(x)", [
            `import { ok, isNull } from "${PACKAGE}";`
        ])
    },
    {
        name: "joins an existing import of the guards entry",
        code: source("x === null", [
            `import { isString } from "${PACKAGE}/guards";`
        ]),
        errors: [{ messageId: "preferGuard" }],
        output: source("isNull(x)", [
            `import { isString, isNull } from "${PACKAGE}/guards";`
        ])
    },
    {
        name: "adds no import when the guard is imported already",
        code: source("x === null", [
            `import { isNull } from "${PACKAGE}/guards";`
        ]),
        errors: [{ messageId: "preferGuard" }],
        output: source("isNull(x)", [
            `import { isNull } from "${PACKAGE}/guards";`
        ])
    },
    {
        name: "does not join a type-only import",
        code: source("x === null", [
            `import type { Maybe } from "${PACKAGE}";`
        ]),
        errors: [{ messageId: "preferGuard" }],
        output: source("isNull(x)", [
            `import type { Maybe } from "${PACKAGE}";`,
            `import { isNull } from "${PACKAGE}";`
        ])
    },
    {
        name: "two fixes needing one import: one pass applies the first",
        code: source('x === null || typeof e === "string"'),
        errors: [{ messageId: "preferGuard" }, { messageId: "preferGuard" }],
        output: source('isNull(x) || typeof e === "string"', [
            `import { isNull } from "${PACKAGE}";`
        ])
    },

    // Reported, not fixed.
    {
        name: "a comment inside the check is not dropped by a fix",
        code: source("x /* nothing yet */ === null"),
        errors: [{ messageId: "preferGuard" }],
        output: null
    },
    {
        name: "outside typebuddy's shipped directories the package is linted",
        filename: `${PACKAGE_ROOT}smoke/oxlint/guards.ts`,
        code: source("x === null"),
        errors: [{ messageId: "preferGuard" }],
        output: source("isNull(x)", [`import { isNull } from "${PACKAGE}";`])
    }
];

describe("prefer-guards", () => {
    tester.run("prefer-guards", rule, { valid, invalid });
});
