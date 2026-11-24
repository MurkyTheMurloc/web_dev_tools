import { readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";

import {
    findBinding,
    getDefinitions,
    planTypeBuddyImport
} from "./typebuddy_import.js";

type AstNode = {
    type: string;
    parent?: AstNode;
    [key: string]: unknown;
};

type Range = [number, number];

type RuleFixer = {
    replaceTextRange(range: Range, text: string): unknown;
    insertTextBeforeRange(range: Range, text: string): unknown;
};

type MessageData = Record<string, string>;

type RuleSuggestion = {
    messageId: string;
    data?: MessageData;
    fix(fixer: RuleFixer): unknown;
};

type SourceCode = {
    text: string;
    getText(node: unknown): string;
    getScope(node: unknown): unknown;
};

type RuleContext = {
    getSourceCode(): SourceCode;
    report(descriptor: {
        node: unknown;
        messageId: string;
        data?: MessageData;
        fix?(fixer: RuleFixer): unknown;
        suggest?: RuleSuggestion[];
    }): void;
};

/**
 * One native check and the guard it is. `fix`: the guard gives the same answer
 * for every value and narrows the same way, so `--fix` rewrites it. `suggest`:
 * the same answer for every value, but the guard narrows `unknown` or `any` (or
 * the whole inferred type) to something stricter than the native check does, so
 * code after it can stop compiling; that is an editor suggestion.
 */
type Mapping = {
    readonly guard: string;
    readonly apply: "fix" | "suggest";
    readonly why: string;
    readonly caveat?: string;
};

const MAPPINGS = {
    isArray: {
        guard: "isArray",
        apply: "suggest",
        why: "`isArray` is `Array.isArray(value)`",
        caveat: "it narrows `unknown` and `any` to `readonly unknown[]`, not `any[]`, so a `push` or a property read on an element afterwards may need a type"
    },
    isBoolean: {
        guard: "isBoolean",
        apply: "fix",
        why: '`isBoolean` is `typeof value === "boolean"`'
    },
    isDate: {
        guard: "isDate",
        apply: "fix",
        why: "`isDate` is `value instanceof Date`"
    },
    isError: {
        guard: "isError",
        apply: "fix",
        why: "`isError` is `value instanceof Error`"
    },
    isFunction: {
        guard: "isFunction",
        apply: "suggest",
        why: '`isFunction` is `typeof value === "function"`',
        caveat: "it narrows `unknown` to `(...args: readonly never[]) => unknown`, not `Function`, so a call with arguments afterwards may need a type"
    },
    isInteger: {
        guard: "isInteger",
        apply: "suggest",
        why: '`isInteger` is `typeof value === "number" && Number.isInteger(value)`, and `Number.isInteger` is `false` for every non-number already',
        caveat: "it narrows to the `IntegerNumber` brand, which spreads into inferred types (`xs.filter((n) => isInteger(n))` is `IntegerNumber[]`, so `xs.push(3)` fails)"
    },
    isNull: {
        guard: "isNull",
        apply: "fix",
        why: "`isNull` is `value === null`"
    },
    isNullableLoose: {
        guard: "isNullable",
        apply: "fix",
        why: '`== null` and `== undefined` are true for exactly `null`, `undefined` and `document.all`, and so is `isNullable` (`value === null || typeof value === "undefined"`)'
    },
    isNullablePair: {
        guard: "isNullable",
        apply: "fix",
        why: '`isNullable` is `value === null || typeof value === "undefined"`'
    },
    isNumber: {
        guard: "isNumber",
        apply: "suggest",
        why: "`isNumber` is `false` for `NaN`, `±Infinity` and every non-number, as `Number.isFinite` is",
        caveat: "it narrows to the `FiniteNumber` brand, which spreads into inferred types (`xs.filter((n) => isNumber(n))` is `FiniteNumber[]`, so `xs.push(3)` fails)"
    },
    isRegExp: {
        guard: "isRegExp",
        apply: "fix",
        why: "`isRegExp` is `value instanceof RegExp`"
    },
    isString: {
        guard: "isString",
        apply: "fix",
        why: '`isString` is `typeof value === "string"`'
    },
    isSymbol: {
        guard: "isSymbol",
        apply: "fix",
        why: '`isSymbol` is `typeof value === "symbol"`'
    },
    isUndefined: {
        guard: "isUndefined",
        apply: "fix",
        why: '`isUndefined` is `typeof value === "undefined"`'
    }
} as const satisfies Record<string, Mapping>;

/**
 * `typeof value === "<tag>"` → guard. `number`, `object` and `bigint` have
 * none.
 */
const TYPEOF_GUARDS: ReadonlyMap<string, Mapping> = new Map<string, Mapping>([
    ["boolean", MAPPINGS.isBoolean],
    ["function", MAPPINGS.isFunction],
    ["string", MAPPINGS.isString],
    ["symbol", MAPPINGS.isSymbol],
    ["undefined", MAPPINGS.isUndefined]
]);

/** `value instanceof <Global>` → guard. */
const INSTANCEOF_GUARDS: ReadonlyMap<string, Mapping> = new Map<
    string,
    Mapping
>([
    ["Date", MAPPINGS.isDate],
    ["Error", MAPPINGS.isError],
    ["RegExp", MAPPINGS.isRegExp]
]);

/** `<Global>.<method>(value)` → guard. */
const CALL_GUARDS: ReadonlyMap<string, Mapping> = new Map<string, Mapping>([
    ["Array.isArray", MAPPINGS.isArray],
    ["Number.isFinite", MAPPINGS.isNumber],
    ["Number.isInteger", MAPPINGS.isInteger]
]);

const EQUALITY_OPERATORS = new Set(["!=", "!==", "==", "==="]);

const PACKAGE_NAME = "@murky-web/typebuddy";

/** The directories of the package that ship code: its guards live there. */
const OWN_CODE_DIRECTORIES = new Set(["dist", "oxlint", "rules", "src"]);

const DECLARATION_FILE = /\.d\.[cm]?ts$/u;

const COMMENT_START = /\/[*/]/u;

type Check = {
    readonly mapping: Mapping;
    readonly operand: AstNode;
    readonly negated: boolean;
};

function isNode(value: unknown): value is AstNode {
    return typeof value === "object" && value !== null && "type" in value;
}

function child(node: AstNode, key: string): AstNode | null {
    const value = node[key];
    return isNode(value) ? value : null;
}

function getRange(node: AstNode): Range | null {
    const range = node["range"];
    if (
        Array.isArray(range) &&
        typeof range[0] === "number" &&
        typeof range[1] === "number"
    ) {
        return [range[0], range[1]];
    }

    return null;
}

function isNullLiteral(node: AstNode): boolean {
    return (
        node.type === "Literal" &&
        node["value"] === null &&
        node["raw"] === "null"
    );
}

function getStringLiteral(node: AstNode): string | null {
    return node.type === "Literal" && typeof node["value"] === "string"
        ? node["value"]
        : null;
}

function getIdentifierName(node: AstNode | null): string | null {
    return node?.type === "Identifier" && typeof node["name"] === "string"
        ? node["name"]
        : null;
}

/**
 * Whether the file names `name` itself at `node`: an import, a parameter, a
 * declaration. A configured global (`window` in an oxlint `globals` entry) has
 * no definition in the file and does not count.
 */
function isDeclaredInFile(
    sourceCode: SourceCode,
    node: AstNode,
    name: string
): boolean {
    return getDefinitions(findBinding(sourceCode, node, name)).length > 0;
}

/**
 * Whether `node` is an identifier the file declares. `typeof missing` is
 * `"undefined"` for a name nothing declares, where `isUndefined(missing)`
 * throws a `ReferenceError` (`typeof window` on a server), so a bare name is
 * only rewritten when the file declares it.
 */
function isDeclaredIdentifier(sourceCode: SourceCode, node: AstNode): boolean {
    const name = getIdentifierName(node);
    return name === null || isDeclaredInFile(sourceCode, node, name);
}

/** `Array`, `Date`, `undefined`: the global, not a local of that name. */
function isGlobalName(
    sourceCode: SourceCode,
    node: AstNode | null,
    name: string
): boolean {
    return (
        node !== null &&
        getIdentifierName(node) === name &&
        !isDeclaredInFile(sourceCode, node, name)
    );
}

function isUndefinedIdentifier(sourceCode: SourceCode, node: AstNode): boolean {
    return isGlobalName(sourceCode, node, "undefined");
}

/**
 * A reference that reads the same value twice in a row: `value`, `this.value`,
 * `a.b?.c`, `a["b"]`, `a[i]`. No call, no assignment, no `++`, so writing it
 * once instead of twice evaluates nothing less. (A getter on the chain runs
 * once instead of twice; a getter with side effects is not something a null
 * check is written against.)
 */
function isPureReference(node: AstNode | null): boolean {
    if (node === null) {
        return false;
    }

    switch (node.type) {
        case "Identifier":
        case "ThisExpression": {
            return true;
        }
        case "ChainExpression":
        case "TSNonNullExpression": {
            return isPureReference(child(node, "expression"));
        }
        case "MemberExpression": {
            if (!isPureReference(child(node, "object"))) {
                return false;
            }
            if (node["computed"] !== true) {
                return true;
            }
            const property = child(node, "property");
            if (property === null) {
                return false;
            }
            return (
                property.type === "Identifier" ||
                (property.type === "Literal" &&
                    (typeof property["value"] === "string" ||
                        typeof property["value"] === "number"))
            );
        }
        default: {
            return false;
        }
    }
}

/**
 * `typeof <operand> <op> "<tag>"`, either side. `null` when it is not one, or
 * when the tag has no guard.
 */
function classifyTypeof(sourceCode: SourceCode, node: AstNode): Check | null {
    const operator = node["operator"];
    if (typeof operator !== "string" || !EQUALITY_OPERATORS.has(operator)) {
        return null;
    }

    const left = child(node, "left");
    const right = child(node, "right");
    if (left === null || right === null) {
        return null;
    }

    for (const [unary, literal] of [
        [left, right],
        [right, left]
    ] as const) {
        if (
            unary.type !== "UnaryExpression" ||
            unary["operator"] !== "typeof"
        ) {
            continue;
        }
        const tag = getStringLiteral(literal);
        const operand = child(unary, "argument");
        if (tag === null || operand === null) {
            return null;
        }
        const mapping = TYPEOF_GUARDS.get(tag);
        if (
            mapping === undefined ||
            !isDeclaredIdentifier(sourceCode, operand)
        ) {
            return null;
        }

        return { mapping, operand, negated: operator.startsWith("!") };
    }

    return null;
}

type NullComparison = {
    readonly operand: AstNode;
    readonly against: "null" | "undefined";
    readonly operator: string;
};

/** `<operand> <op> null` or `<operand> <op> undefined`, either side. */
function classifyNullComparison(
    sourceCode: SourceCode,
    node: AstNode
): NullComparison | null {
    const operator = node["operator"];
    if (typeof operator !== "string" || !EQUALITY_OPERATORS.has(operator)) {
        return null;
    }

    const left = child(node, "left");
    const right = child(node, "right");
    if (left === null || right === null) {
        return null;
    }

    const isEmpty = (side: AstNode): "null" | "undefined" | null => {
        if (isNullLiteral(side)) {
            return "null";
        }
        return isUndefinedIdentifier(sourceCode, side) ? "undefined" : null;
    };

    const leftEmpty = isEmpty(left);
    const rightEmpty = isEmpty(right);
    if (leftEmpty !== null && rightEmpty !== null) {
        return null;
    }
    if (rightEmpty !== null) {
        return { operand: left, against: rightEmpty, operator };
    }
    if (leftEmpty !== null) {
        return { operand: right, against: leftEmpty, operator };
    }

    return null;
}

/**
 * A single comparison that is exactly one guard. `x === undefined` is not
 * `isUndefined(x)`: `document.all === undefined` is `false`, `typeof
 * document.all` is `"undefined"`.
 */
function classifyComparison(
    sourceCode: SourceCode,
    node: AstNode
): Check | null {
    const typeofCheck = classifyTypeof(sourceCode, node);
    if (typeofCheck !== null) {
        return typeofCheck;
    }

    const comparison = classifyNullComparison(sourceCode, node);
    if (comparison === null) {
        return null;
    }

    const negated = comparison.operator.startsWith("!");
    const loose = comparison.operator.length === 2;
    if (loose) {
        return {
            mapping: MAPPINGS.isNullableLoose,
            operand: comparison.operand,
            negated
        };
    }
    if (comparison.against === "null") {
        return {
            mapping: MAPPINGS.isNull,
            operand: comparison.operand,
            negated
        };
    }

    return null;
}

function classifyInstanceof(
    sourceCode: SourceCode,
    node: AstNode
): Check | null {
    if (node["operator"] !== "instanceof") {
        return null;
    }

    const operand = child(node, "left");
    const constructor = child(node, "right");
    const name = getIdentifierName(constructor);
    if (operand === null || name === null) {
        return null;
    }

    const mapping = INSTANCEOF_GUARDS.get(name);
    if (mapping === undefined || !isGlobalName(sourceCode, constructor, name)) {
        return null;
    }

    return { mapping, operand, negated: false };
}

type PairMatch =
    | { readonly kind: "nullable"; readonly operand: AstNode }
    | { readonly kind: "near" }
    | null;

/**
 * `x === null || typeof x === "undefined"` (any order, `&&` with `!==` for the
 * negation) is `isNullable(x)`. `x === null || x === undefined` is not:
 * `document.all` is `undefined` to `typeof` and `isNullable`, but `!==
 * undefined`. That pair is `"near"`: neither half is reported, a lone `isNull`
 * next to `x === undefined` would only be half a rewrite.
 */
function matchNullablePair(
    sourceCode: SourceCode,
    first: AstNode,
    second: AstNode,
    negated: boolean
): PairMatch {
    if (
        first.type !== "BinaryExpression" ||
        second.type !== "BinaryExpression"
    ) {
        return null;
    }

    const strict = negated ? "!==" : "===";
    for (const [nullSide, otherSide] of [
        [first, second],
        [second, first]
    ] as const) {
        const nullCheck = classifyNullComparison(sourceCode, nullSide);
        if (
            nullCheck === null ||
            nullCheck.against !== "null" ||
            nullCheck.operator !== strict
        ) {
            continue;
        }
        const operandText = sourceCode.getText(nullCheck.operand);

        const undefinedCheck = classifyNullComparison(sourceCode, otherSide);
        if (
            undefinedCheck !== null &&
            undefinedCheck.against === "undefined" &&
            undefinedCheck.operator === strict &&
            sourceCode.getText(undefinedCheck.operand) === operandText
        ) {
            return { kind: "near" };
        }

        const typeofCheck = classifyTypeof(sourceCode, otherSide);
        if (
            typeofCheck === null ||
            typeofCheck.mapping !== MAPPINGS.isUndefined ||
            typeofCheck.negated !== negated ||
            sourceCode.getText(typeofCheck.operand) !== operandText ||
            !isPureReference(nullCheck.operand) ||
            !isDeclaredIdentifier(sourceCode, nullCheck.operand)
        ) {
            continue;
        }

        return { kind: "nullable", operand: nullCheck.operand };
    }

    return null;
}

const packageNames = new Map<string, string | null>();

/** The `name` of the nearest `package.json` above `directory`, cached. */
function findPackage(
    directory: string
): { readonly root: string; readonly name: string | null } | null {
    let current = directory;
    for (;;) {
        let name = packageNames.get(current);
        if (name === undefined) {
            name = readPackageName(current);
            packageNames.set(current, name);
        }
        if (name !== null) {
            return { root: current, name };
        }

        const parent = dirname(current);
        if (parent === current) {
            return null;
        }
        current = parent;
    }
}

/**
 * The package name in `directory/package.json`; `""` for a `package.json`
 * without one, `null` when there is no readable `package.json`.
 */
function readPackageName(directory: string): string | null {
    try {
        const manifest: unknown = JSON.parse(
            readFileSync(join(directory, "package.json"), "utf8")
        );
        if (
            typeof manifest === "object" &&
            manifest !== null &&
            "name" in manifest &&
            typeof manifest.name === "string"
        ) {
            return manifest.name;
        }
        return "";
    } catch {
        return null;
    }
}

/**
 * Typebuddy's own shipped code (`src`, `rules`, `oxlint`, `dist` of the
 * package): the guards are defined there, from relative imports, and a guard
 * rewritten to call itself recurses forever.
 */
function isTypebuddyOwnCode(filename: string): boolean {
    if (!isAbsolute(filename)) {
        return false;
    }

    const found = findPackage(dirname(filename));
    if (found?.name !== PACKAGE_NAME) {
        return false;
    }

    const [firstSegment] = relative(found.root, filename).split(/[/\\]/u);
    return firstSegment !== undefined && OWN_CODE_DIRECTORIES.has(firstSegment);
}

function getFilename(context: object): string {
    if ("filename" in context && typeof context.filename === "string") {
        return context.filename;
    }

    return "";
}

/**
 * Reports native type checks that are exactly a typebuddy guard, and rewrites
 * them to the guard.
 *
 * "Exactly" means the same result for every value: `NaN`, `-0`, boxed
 * primitives (`new String("")` is an object to `typeof` and to the guard),
 * `document.all` (`typeof` says `"undefined"`, `=== undefined` says no),
 * objects without a prototype, arrays, class instances, functions and proxies.
 * A check that is only close to a guard is not reported at all.
 *
 * | Native check                                       | Guard            | Applied by |
 * | -------------------------------------------------- | ---------------- | ---------- |
 * | `x === null`                                       | `isNull(x)`      | `--fix`    |
 * | `typeof x === "undefined"`                         | `isUndefined(x)` | `--fix`    |
 * | `x == null`, `x == undefined`                      | `isNullable(x)`  | `--fix`    |
 * | `x === null` or-ed with `typeof x === "undefined"` | `isNullable(x)`  | `--fix`    |
 * | `typeof x === "string"`                            | `isString(x)`    | `--fix`    |
 * | `typeof x === "boolean"`                           | `isBoolean(x)`   | `--fix`    |
 * | `typeof x === "symbol"`                            | `isSymbol(x)`    | `--fix`    |
 * | `x instanceof Error`                               | `isError(x)`     | `--fix`    |
 * | `x instanceof Date`                                | `isDate(x)`      | `--fix`    |
 * | `x instanceof RegExp`                              | `isRegExp(x)`    | `--fix`    |
 * | `Array.isArray(x)`                                 | `isArray(x)`     | suggestion |
 * | `typeof x === "function"`                          | `isFunction(x)`  | suggestion |
 * | `Number.isFinite(x)`                               | `isNumber(x)`    | suggestion |
 * | `Number.isInteger(x)`                              | `isInteger(x)`   | suggestion |
 *
 * Every row also matches `!==`/`!=` (as `!guard(x)`), the operands mirrored
 * (`null === x`, `"string" === typeof x`), `!(…)` around the check, and `&&`
 * with `!==` for the pair (`!isNullable(x)`). `==` and `===` are the same thing
 * next to `typeof`, which always gives a string.
 *
 * A suggestion row is the same at runtime, but the guard narrows the type more
 * strictly than the native check: `unknown`/`any` to `readonly unknown[]`
 * instead of `any[]`, to `(...args: readonly never[]) => unknown` instead of
 * `Function`, or to a `FiniteNumber`/`IntegerNumber` brand where the native
 * call narrows nothing. Code after it may stop compiling, so it is not applied
 * by `--fix`. The `--fix` rows narrow alike, except that the guards also narrow
 * `any` (where `typeof` leaves `any` alone) and a negated null guard leaves a
 * bare type parameter `T` as `T` (where `x !== null` makes it `T & ({} |
 * undefined)`).
 *
 * Not reported, because no guard gives the same answer for every value:
 *
 * - `x === undefined`: `document.all === undefined` is `false`, `isUndefined` (a
 *   `typeof` check) says `true`. So `x === null || x === undefined` is not
 *   `isNullable(x)` either; neither half is reported.
 * - `typeof x === "number"`: `isNumber` is `false` for `NaN` and `±Infinity`.
 * - `typeof x === "object"`: `isObject` only accepts plain objects (prototype
 *   `Object.prototype`); arrays, `null`, class instances and
 *   `Object.create(null)` differ.
 * - `typeof x === "bigint"`: typebuddy has no bigint guard.
 * - `x instanceof Promise`: `isPromise` accepts any thenable.
 * - `x instanceof SomeClass`: `isInstanceOf(x, SomeClass)` only types
 *   constructors with `new (...args: unknown[])`, and is no shorter.
 * - `typeof x === "string" && x.trim() === ""` (`isEmptyString`): the guard is a
 *   plain `boolean`, so the `&&` would lose its narrowing to `string`.
 * - `isMaybe`/`isOptional`: the same as `isNull`/`isUndefined` with a narrower
 *   parameter type; the rule writes the general guard.
 *
 * Left alone, too: `typeof name` of a name the file does not declare (`typeof
 * window === "undefined"` must not become `isUndefined(window)`, which throws
 * where `window` does not exist); `Array`, `Number`, `Date`, `Error`, `RegExp`
 * or `undefined` when the file declares its own binding of that name; an
 * `||`/`&&` pair whose two sides are not the same plain reference (`f() ===
 * null || typeof f() === "undefined"` calls `f` twice); a check whose guard
 * name is another binding there (a local `isNull`); script files (no
 * `import`/`export`: the guard cannot be imported) and `.d.ts` files;
 * typebuddy's own source. A check with a comment inside is reported without a
 * fix, so the comment is not lost.
 */
const rule = {
    create(context: RuleContext) {
        const filename = getFilename(context);
        if (DECLARATION_FILE.test(filename) || isTypebuddyOwnCode(filename)) {
            return {};
        }

        const sourceCode = context.getSourceCode();
        /** Halves of a pair that the `||`/`&&` already reported, or declined. */
        const claimed = new Set<AstNode>();

        function report(
            node: AstNode,
            check: Check,
            explicitRange: Range | null
        ): void {
            let range = explicitRange ?? getRange(node);
            let negated = check.negated;

            // `!(x === null)` is `!isNull(x)`, not `!(isNull(x))`.
            const parent = node.parent;
            if (
                explicitRange === null &&
                node.type !== "CallExpression" &&
                parent?.type === "UnaryExpression" &&
                parent["operator"] === "!" &&
                parent["argument"] === node
            ) {
                range = getRange(parent);
                negated = !negated;
            }
            if (range === null) {
                return;
            }

            const { guard } = check.mapping;
            const plan = planTypeBuddyImport(sourceCode, node, guard, "guard");
            if (plan.kind === "conflict" || plan.kind === "global") {
                return;
            }

            const operandText = sourceCode.getText(check.operand);
            const argument =
                check.operand.type === "SequenceExpression"
                    ? `(${operandText})`
                    : operandText;
            const replacement = `${negated ? "!" : ""}${guard}(${argument})`;
            const native = sourceCode.text.slice(range[0], range[1]);
            const data: MessageData = {
                caveat: check.mapping.caveat ?? "",
                guard,
                native,
                replacement,
                why: check.mapping.why
            };

            const fixRange = range;
            const fix = (fixer: RuleFixer): unknown[] => {
                const edits: unknown[] = [];
                if (plan.kind === "insert") {
                    edits.push(
                        fixer.insertTextBeforeRange(plan.range, plan.text)
                    );
                }
                edits.push(fixer.replaceTextRange(fixRange, replacement));
                return edits;
            };
            const hasComment = COMMENT_START.test(native);

            if (check.mapping.apply === "fix") {
                context.report({
                    node,
                    messageId: "preferGuard",
                    data,
                    ...(hasComment ? {} : { fix })
                });
                return;
            }

            context.report({
                node,
                messageId: "preferGuardNarrowing",
                data,
                suggest: hasComment
                    ? []
                    : [{ messageId: "applyGuard", data, fix }]
            });
        }

        /**
         * `a || x === null || typeof x === "undefined"` parses as `(a || x ===
         * null) || typeof …`: the pair is the last operand of the left side and
         * the right side. The rewrite spans from the one to the other, which
         * needs the source between them to be the bare operator.
         */
        function chainRange(left: AstNode, node: AstNode): Range | null {
            const head = child(left, "left");
            const partner = child(left, "right");
            const right = child(node, "right");
            if (head === null || partner === null || right === null) {
                return null;
            }

            const headRange = getRange(head);
            const partnerRange = getRange(partner);
            const rightRange = getRange(right);
            const nodeRange = getRange(node);
            if (
                headRange === null ||
                partnerRange === null ||
                rightRange === null ||
                nodeRange === null
            ) {
                return null;
            }

            const operatorOnly = /^\s*(?:\|\||&&)\s*$/u;
            const text = sourceCode.text;
            if (
                !operatorOnly.test(text.slice(headRange[1], partnerRange[0])) ||
                !operatorOnly.test(
                    text.slice(partnerRange[1], rightRange[0])
                ) ||
                nodeRange[1] !== rightRange[1]
            ) {
                return null;
            }

            return [partnerRange[0], rightRange[1]];
        }

        /**
         * Claims and reports the pair `first`/`second` of the `||`/`&&` `node`.
         * In a chain (`range` given) a pair whose span cannot be rewritten
         * (`chainRange` returned `null`) is left to its halves.
         */
        function checkPair(
            node: AstNode,
            first: AstNode,
            second: AstNode,
            range: Range | "unusable" | null
        ): boolean {
            const negated = node["operator"] === "&&";
            const match = matchNullablePair(sourceCode, first, second, negated);
            if (
                match === null ||
                (match.kind === "nullable" && range === "unusable")
            ) {
                return false;
            }

            claimed.add(first);
            claimed.add(second);
            if (match.kind === "nullable" && range !== "unusable") {
                report(
                    node,
                    {
                        mapping: MAPPINGS.isNullablePair,
                        operand: match.operand,
                        negated
                    },
                    range
                );
            }
            return true;
        }

        return {
            BinaryExpression(node: AstNode): void {
                if (claimed.has(node)) {
                    return;
                }

                const check =
                    classifyComparison(sourceCode, node) ??
                    classifyInstanceof(sourceCode, node);
                if (check !== null) {
                    report(node, check, null);
                }
            },
            CallExpression(node: AstNode): void {
                const callee = child(node, "callee");
                const args = node["arguments"];
                if (
                    node["optional"] === true ||
                    callee?.type !== "MemberExpression" ||
                    callee["computed"] === true ||
                    callee["optional"] === true ||
                    !Array.isArray(args) ||
                    args.length !== 1
                ) {
                    return;
                }

                const [operand]: unknown[] = args;
                const object = child(callee, "object");
                const objectName = getIdentifierName(object);
                const method = getIdentifierName(child(callee, "property"));
                if (
                    !isNode(operand) ||
                    operand.type === "SpreadElement" ||
                    objectName === null ||
                    method === null
                ) {
                    return;
                }

                const mapping = CALL_GUARDS.get(`${objectName}.${method}`);
                if (
                    mapping === undefined ||
                    !isGlobalName(sourceCode, object, objectName)
                ) {
                    return;
                }

                report(node, { mapping, operand, negated: false }, null);
            },
            LogicalExpression(node: AstNode): void {
                const operator = node["operator"];
                if (operator !== "||" && operator !== "&&") {
                    return;
                }

                const left = child(node, "left");
                const right = child(node, "right");
                if (left === null || right === null) {
                    return;
                }
                if (checkPair(node, left, right, null)) {
                    return;
                }

                const partner =
                    left.type === "LogicalExpression" &&
                    left["operator"] === operator
                        ? child(left, "right")
                        : null;
                if (partner === null || claimed.has(partner)) {
                    return;
                }
                checkPair(
                    node,
                    partner,
                    right,
                    chainRange(left, node) ?? "unusable"
                );
            }
        };
    },
    defaultOptions: [],
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Use typebuddy's guards instead of the native checks they are exactly equal to."
        },
        fixable: "code",
        hasSuggestions: true,
        schema: [],
        messages: {
            preferGuard:
                '`{{native}}` is exactly `{{replacement}}`: {{why}}, for every value. One name per check lets a reader find every such test, and the guard narrows the type the same way. Fix: `{{replacement}}` with `import { {{guard}} } from "@murky-web/typebuddy";` (`--fix` applies it and adds the import, unless a comment sits inside the check).',
            preferGuardNarrowing:
                '`{{native}}` gives the same answer as `{{replacement}}` for every value: {{why}}. The guard narrows more strictly, though: {{caveat}}. Fix: `{{replacement}}` with `import { {{guard}} } from "@murky-web/typebuddy";`, then type the code the stricter narrowing breaks; do not cast the guard away with `as`. `--fix` does not apply it; it is an editor suggestion.',
            applyGuard: "Replace with `{{replacement}}`."
        }
    }
};

export { rule as preferGuardsRule };
