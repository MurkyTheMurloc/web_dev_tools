// Fork of eslint's no-magic-numbers with typescript-eslint's options (now part
// of eslint's rule too). What it reports is unchanged; the message names the
// number in its code, a constant to replace it with (named after the variable,
// property or timer callback it feeds, with a unit when the code shows one) and
// for `match[3]` a named capture group instead.
//
// New option `allowHttpStatusCodes`: an integer from 100 to 599 passes where
// it can only be an HTTP status: `c.json(body, 404)` and the other Hono
// response helpers, `c.status(404)`, `new HTTPException(404)`, `{ status: 404 }`
// and `res.status === 404`. Elsewhere (`items[404]`, `size * 500`) it is still
// reported.
import { findVariable, getSourceCode } from "../compat.mjs";

// Maximum array length by the ECMAScript specification.
const MAX_ARRAY_LENGTH = 2 ** 32 - 1;
const HTTP_STATUS_MIN = 100;
const HTTP_STATUS_MAX = 599;
const BYTES_PER_KIB = 1024;
// Characters of code kept on each side of the number in the message.
const CONTEXT_SIDE = 40;
const CONTEXT_MAX = 60;
const PLACEHOLDER = "DESCRIPTIVE_NAME";

// Hono context helpers whose second argument is the status.
const HONO_STATUS_SECOND = new Set([
    "body",
    "html",
    "json",
    "newResponse",
    "redirect",
    "text"
]);
const COMPARISONS = new Set(["==", "===", "!=", "!==", "<", "<=", ">", ">="]);
const ARITHMETIC = new Set(["+", "-", "*", "/", "%", "**"]);
const TIMERS = { setInterval: "INTERVAL_MS", setTimeout: "DELAY_MS" };
const MATCH_METHODS = new Set(["exec", "match", "matchAll"]);
// Nodes a name can flow through from the number to what it is assigned to.
const TRANSPARENT = new Set([
    "BinaryExpression",
    "ConditionalExpression",
    "LogicalExpression",
    "TSAsExpression",
    "TSNonNullExpression",
    "TSSatisfiesExpression",
    "UnaryExpression"
]);
const CONTEXT_BOUNDARIES = new Set([
    "BlockStatement",
    "ClassBody",
    "Program",
    "StaticBlock",
    "SwitchCase",
    "TSModuleBlock"
]);

const DEFAULTS = {
    allowHttpStatusCodes: false,
    detectObjects: false,
    enforceConst: false,
    ignore: [],
    ignoreArrayIndexes: false,
    ignoreClassFieldInitialValues: false,
    ignoreDefaultValues: false,
    ignoreEnums: false,
    ignoreNumericLiteralTypes: false,
    ignoreReadonlyClassProperties: false,
    ignoreTypeIndexes: false
};

const DO_NOT =
    "Do not: name it after its value (`const ONE_THOUSAND = 1000`, `const FOUR = 4`), declare the same constant again in another file, or add `// oxlint-disable`.";

const BOOLEAN = { type: "boolean" };

function normalizeIgnoreValue(value) {
    return typeof value === "string" ? BigInt(value.slice(0, -1)) : value;
}

function isNumber(node) {
    return (
        node?.type === "Literal" &&
        (typeof node.value === "number" || typeof node.value === "bigint")
    );
}

/** `5`, `-1`, `5 * 1024`: a value built from number literals only. */
function isNumberExpression(node) {
    if (node.type === "UnaryExpression") {
        return (
            (node.operator === "-" || node.operator === "+") &&
            isNumberExpression(node.argument)
        );
    }
    if (node.type === "BinaryExpression") {
        return (
            ARITHMETIC.has(node.operator) &&
            isNumberExpression(node.left) &&
            isNumberExpression(node.right)
        );
    }
    return isNumber(node);
}

function nameOf(node) {
    if (node?.type === "Identifier" || node?.type === "PrivateIdentifier") {
        return node.name;
    }
    if (node?.type === "Literal" && typeof node.value === "string") {
        return node.value;
    }
    if (node?.type === "MemberExpression" && !node.computed) {
        return node.property.name;
    }
    return null;
}

function memberName(node) {
    return node?.type === "MemberExpression" && !node.computed
        ? node.property.name
        : null;
}

function calleeName(call) {
    return call.callee.type === "Identifier"
        ? call.callee.name
        : memberName(call.callee);
}

/** `retryDelay` -> `RETRY_DELAY`; null when nothing usable is left. */
function screaming(name) {
    const result = name
        ?.replace(/([a-z0-9])([A-Z])/gu, "$1_$2")
        .replace(/[^A-Za-z0-9]+/gu, "_")
        .replace(/^_+|_+$/gu, "")
        .toUpperCase();
    return result && /^[A-Z]/u.test(result) ? result : null;
}

/** `RETRY` + `DELAY_MS` -> `RETRY_DELAY_MS`; `TIMEOUT_MS` + `MS` stays. */
function withUnit(base, unit) {
    if (!unit) {
        return base;
    }
    const parts = unit.split("_");
    for (let count = parts.length; count > 0; count -= 1) {
        const head = parts.slice(0, count).join("_");
        if (base === head || base.endsWith(`_${head}`)) {
            return [base, ...parts.slice(count)].join("_");
        }
    }
    return `${base}_${unit}`;
}

/** The name the value is assigned to: variable, property or parameter. */
function assignedName(valueNode) {
    let child = valueNode;
    let { parent } = valueNode;
    while (TRANSPARENT.has(parent.type)) {
        if (parent.type === "ConditionalExpression" && parent.test === child) {
            return null;
        }
        if (
            parent.type === "BinaryExpression" &&
            !ARITHMETIC.has(parent.operator)
        ) {
            return null;
        }
        child = parent;
        ({ parent } = parent);
    }
    switch (parent.type) {
        case "VariableDeclarator":
            return nameOf(parent.id);
        case "AssignmentExpression":
        case "AssignmentPattern":
            return nameOf(parent.left);
        case "Property":
        case "PropertyDefinition":
            return parent.value === child ? nameOf(parent.key) : null;
        default:
            return null;
    }
}

/** `match[3]` where `match` comes from `.exec`, `.match` or `.matchAll`. */
function isRegexMatchCall(node) {
    const call = node?.type === "ChainExpression" ? node.expression : node;
    return (
        call?.type === "CallExpression" &&
        MATCH_METHODS.has(memberName(call.callee))
    );
}

function isStatusMember(node) {
    const member = node.type === "ChainExpression" ? node.expression : node;
    return memberName(member) === "status";
}

function isHttpStatusContext(node) {
    const { parent } = node;
    switch (parent.type) {
        case "CallExpression": {
            if (parent.callee.type !== "MemberExpression") {
                return false;
            }
            if (parent.callee.object.type !== "Identifier") {
                return false;
            }
            const method = memberName(parent.callee);
            return (
                (HONO_STATUS_SECOND.has(method) &&
                    parent.arguments[1] === node) ||
                (method === "status" && parent.arguments[0] === node)
            );
        }
        case "NewExpression":
            return (
                parent.callee.type === "Identifier" &&
                parent.callee.name === "HTTPException" &&
                parent.arguments[0] === node
            );
        case "Property":
            return (
                parent.value === node &&
                parent.parent.type === "ObjectExpression" &&
                nameOf(parent.key) === "status"
            );
        case "BinaryExpression":
            return (
                COMPARISONS.has(parent.operator) &&
                isStatusMember(
                    parent.left === node ? parent.right : parent.left
                )
            );
        default:
            return false;
    }
}

export default {
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Disallow magic numbers; optionally allow HTTP status codes where they are used as one."
        },
        schema: [
            {
                type: "object",
                properties: {
                    allowHttpStatusCodes: BOOLEAN,
                    detectObjects: BOOLEAN,
                    enforceConst: BOOLEAN,
                    ignore: {
                        type: "array",
                        items: {
                            anyOf: [
                                { type: "number" },
                                {
                                    type: "string",
                                    pattern: "^[+-]?(?:0|[1-9][0-9]*)n$"
                                }
                            ]
                        },
                        uniqueItems: true
                    },
                    ignoreArrayIndexes: BOOLEAN,
                    ignoreClassFieldInitialValues: BOOLEAN,
                    ignoreDefaultValues: BOOLEAN,
                    ignoreEnums: BOOLEAN,
                    ignoreNumericLiteralTypes: BOOLEAN,
                    ignoreReadonlyClassProperties: BOOLEAN,
                    ignoreTypeIndexes: BOOLEAN
                },
                additionalProperties: false
            }
        ],
        messages: {
            noMagic: `\`{{raw}}\` in \`{{context}}\` is an unnamed number: it hides what the value means, and every copy of it is repeated without a link to the others. Fix: {{fix}} ${DO_NOT}`,
            useConst: `\`{{raw}}\` in \`{{context}}\` is declared with \`{{kind}}\`, so the name can be reassigned and stops naming one value. Fix: \`const {{name}} = {{raw}};\`, at module scope when it does not depend on the function. ${DO_NOT}`
        }
    },
    defaultOptions: [],
    create(context) {
        const options = { ...DEFAULTS, ...context.options?.[0] };
        const ignore = new Set(options.ignore.map(normalizeIgnoreValue));
        const sourceCode = getSourceCode(context);
        const okTypes = options.detectObjects
            ? []
            : ["ObjectExpression", "Property", "AssignmentExpression"];

        /**
         * The code around `node`: the largest enclosing expression or statement
         * that fits on one short line, else the parent cut to the number's
         * neighbourhood. `replacement` stands in for `node`.
         */
        function snippet(node, replacement) {
            let contextNode = node.parent;
            for (
                let current = node.parent;
                current && !CONTEXT_BOUNDARIES.has(current.type);
                current = current.parent
            ) {
                const text = sourceCode.getText(current);
                if (text.length > CONTEXT_MAX || text.includes("\n")) {
                    break;
                }
                contextNode = current;
                if (/(?:Statement|Declaration)$/u.test(current.type)) {
                    break;
                }
            }
            const { text } = sourceCode;
            const flat = (part) => part.replace(/\s+/gu, " ");
            let before = flat(text.slice(contextNode.range[0], node.range[0]));
            let after = flat(text.slice(node.range[1], contextNode.range[1]));
            if (before.length > CONTEXT_SIDE) {
                before = `…${before.slice(-CONTEXT_SIDE).trimStart()}`;
            }
            if (after.length > CONTEXT_SIDE) {
                after = `${after.slice(0, CONTEXT_SIDE).trimEnd()}…`;
            }
            return `${before}${replacement}${after}`;
        }

        function regexMatchObject(member) {
            if (isRegexMatchCall(member.object)) {
                return "match";
            }
            if (member.object.type !== "Identifier") {
                return null;
            }
            const definition = findVariable(context, member.object)?.defs[0];
            const declarator = definition?.node;
            if (declarator?.type !== "VariableDeclarator") {
                return null;
            }
            const loop = declarator.parent.parent;
            const source =
                loop?.type === "ForOfStatement" &&
                loop.left === declarator.parent
                    ? loop.right
                    : declarator.init;
            return isRegexMatchCall(source) ? member.object.name : null;
        }

        /** The `Fix:` text: a named constant, or a named capture group. */
        function buildFix(numberNode) {
            const { parent } = numberNode;
            if (
                parent.type === "MemberExpression" &&
                parent.computed &&
                parent.property === numberNode
            ) {
                const match = regexMatchObject(parent);
                if (match) {
                    return `a named capture group, \`(?<name>…)\`, read as \`${match}.groups.name\`, or destructure the match (\`const [, first, second] = ${match}\`).`;
                }
            }

            let valueNode = numberNode;
            while (isNumberExpression(valueNode.parent)) {
                valueNode = valueNode.parent;
            }
            // `const MAX = 5 * 1024` is named already; its factors are not.
            if (valueNode.parent.type === "VariableDeclarator") {
                valueNode = numberNode;
            }
            const value = sourceCode.getText(valueNode);
            const holder = valueNode.parent;
            const assigned = assignedName(valueNode);
            const ownName = screaming(assigned);
            const isWholeValue =
                valueNode !== numberNode ||
                (!TRANSPARENT.has(holder.type) &&
                    holder.type !== "CallExpression" &&
                    holder.type !== "NewExpression");
            let name = (isWholeValue && ownName) || PLACEHOLDER;
            let note = "";

            const callee =
                holder.type === "CallExpression" ? calleeName(holder) : null;
            if (
                Object.hasOwn(TIMERS, callee) &&
                holder.arguments[1] === valueNode
            ) {
                name = withUnit(
                    screaming(nameOf(holder.arguments[0])) ?? PLACEHOLDER,
                    TIMERS[callee]
                );
            } else if (
                callee === "timeout" &&
                holder.callee.object?.name === "AbortSignal"
            ) {
                name = withUnit(name, "TIMEOUT_MS");
            } else if (
                valueNode !== numberNode &&
                /(?:[*/]\s*1024|1024\s*\*)\b/u.test(value)
            ) {
                name = withUnit(name, "BYTES");
            } else if (
                numberNode.value === BYTES_PER_KIB &&
                holder.type === "BinaryExpression" &&
                (holder.operator === "*" || holder.operator === "/")
            ) {
                name = "BYTES_PER_KIB";
                note =
                    " A value in KiB gets the suffix `_KIB`, one in bytes `_BYTES`.";
            } else if (/timeout|delay|interval/iu.test(assigned ?? "")) {
                name = withUnit(name, "MS");
            }

            const named = name.startsWith(PLACEHOLDER)
                ? ", named for what the number means"
                : "";
            return `\`const ${name} = ${value};\` at module scope${named}, used as \`${snippet(valueNode, name)}\`.${note}`;
        }

        return {
            Literal(node) {
                if (!isNumber(node)) {
                    return;
                }
                let fullNumberNode = node;
                let { value } = node;
                let { raw } = node;
                // Treat unary minus/plus as part of the number.
                if (
                    node.parent.type === "UnaryExpression" &&
                    (node.parent.operator === "-" ||
                        node.parent.operator === "+")
                ) {
                    fullNumberNode = node.parent;
                    value = node.parent.operator === "-" ? -value : value;
                    raw = `${node.parent.operator}${raw}`;
                }
                const { parent } = fullNumberNode;

                // A literal type, `type T = 1 | 2`, possibly in a union or
                // intersection; for an indexed type, `T[0]`.
                let typeAncestor = parent;
                while (
                    typeAncestor.parent.type === "TSUnionType" ||
                    typeAncestor.parent.type === "TSIntersectionType"
                ) {
                    typeAncestor = typeAncestor.parent;
                }

                if (
                    ignore.has(value) ||
                    (options.ignoreDefaultValues &&
                        parent.type === "AssignmentPattern" &&
                        parent.right === fullNumberNode) ||
                    (options.ignoreClassFieldInitialValues &&
                        parent.type === "PropertyDefinition" &&
                        parent.value === fullNumberNode) ||
                    (options.ignoreEnums && parent.type === "TSEnumMember") ||
                    (options.ignoreNumericLiteralTypes &&
                        typeAncestor.parent.type ===
                            "TSTypeAliasDeclaration") ||
                    (options.ignoreTypeIndexes &&
                        typeAncestor.parent.type === "TSIndexedAccessType") ||
                    (options.ignoreReadonlyClassProperties &&
                        parent.type === "PropertyDefinition" &&
                        parent.readonly) ||
                    // parseInt radix
                    (parent.type === "CallExpression" &&
                        parent.arguments[1] === fullNumberNode &&
                        ["parseInt", "Number.parseInt"].includes(
                            sourceCode.getText(parent.callee)
                        )) ||
                    parent.type.startsWith("JSX") ||
                    (options.ignoreArrayIndexes &&
                        parent.type === "MemberExpression" &&
                        parent.property === fullNumberNode &&
                        (Number.isInteger(value) ||
                            typeof value === "bigint") &&
                        value >= 0 &&
                        value < MAX_ARRAY_LENGTH) ||
                    (options.allowHttpStatusCodes &&
                        fullNumberNode === node &&
                        Number.isInteger(value) &&
                        value >= HTTP_STATUS_MIN &&
                        value <= HTTP_STATUS_MAX &&
                        isHttpStatusContext(node))
                ) {
                    return;
                }

                if (parent.type === "VariableDeclarator") {
                    if (
                        options.enforceConst &&
                        parent.parent.kind !== "const"
                    ) {
                        context.report({
                            data: {
                                context: snippet(fullNumberNode, raw),
                                kind: parent.parent.kind,
                                name:
                                    screaming(nameOf(parent.id)) ?? PLACEHOLDER,
                                raw
                            },
                            messageId: "useConst",
                            node: fullNumberNode
                        });
                    }
                    return;
                }
                if (
                    !okTypes.includes(parent.type) ||
                    (parent.type === "AssignmentExpression" &&
                        parent.left.type === "Identifier")
                ) {
                    context.report({
                        data: {
                            context: snippet(fullNumberNode, raw),
                            fix: buildFix(fullNumberNode),
                            raw
                        },
                        messageId: "noMagic",
                        node: fullNumberNode
                    });
                }
            }
        };
    }
};
