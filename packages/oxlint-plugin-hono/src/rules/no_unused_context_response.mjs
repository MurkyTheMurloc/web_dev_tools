import { sourceCodeOf } from "@murky-web/oxlint-plugin/utils";

import {
    createHonoTracker,
    getParamIdentifier,
    isFunctionNode,
    refersToVariable,
    resolveVariable,
    RESPONSE_METHODS,
    unwrapExpression
} from "../hono_ast.mjs";

const DOCS_URL =
    "https://github.com/MurkyTheMurloc/web_dev_tools/tree/main/packages/oxlint-plugin-hono";

/**
 * Checks whether `node` is a direct `c.<responseMethod>(...)` call (or `await
 * c.<responseMethod>(...)` / `void c.<responseMethod>(...)`) whose returned
 * Response is discarded.
 */
function findDiscardedResponseCall(
    statement,
    sourceCode,
    contextVar,
    contextName
) {
    if (statement.type !== "ExpressionStatement") {
        return null;
    }

    let expr = unwrapExpression(statement.expression);
    while (
        expr &&
        (expr.type === "AwaitExpression" ||
            (expr.type === "UnaryExpression" && expr.operator === "void"))
    ) {
        expr = unwrapExpression(expr.argument);
    }

    if (
        expr?.type !== "CallExpression" ||
        expr.callee.type !== "MemberExpression" ||
        expr.callee.computed ||
        expr.callee.property.type !== "Identifier" ||
        !RESPONSE_METHODS.has(expr.callee.property.name)
    ) {
        return null;
    }

    const receiver = unwrapExpression(expr.callee.object);
    if (!refersToVariable(sourceCode, receiver, contextVar, contextName)) {
        return null;
    }

    return {
        call: expr,
        method: expr.callee.property.name
    };
}

/**
 * Walks `node` within the current function body without descending into nested
 * functions.
 */
function walkOwnStatements(node, visit) {
    if (!node || typeof node !== "object") {
        return;
    }
    visit(node);

    for (const [key, value] of Object.entries(node)) {
        if (key === "parent") {
            continue;
        }
        const children = Array.isArray(value) ? value : [value];
        for (const child of children) {
            if (
                child &&
                typeof child === "object" &&
                typeof child.type === "string" &&
                !isFunctionNode(child)
            ) {
                walkOwnStatements(child, visit);
            }
        }
    }
}

export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow discarding the Response returned by Hono Context response methods such as `c.json()` and `c.text()`.",
            url: DOCS_URL
        },
        schema: [],
        messages: {
            unusedContextResponse:
                "`{{context}}.{{method}}(...)` only constructs a `Response` and does not send it, so discarding its return value lets the Hono handler fall through (typically returning 404 or an empty response). Fix: return the response (`return {{context}}.{{method}}(...)`), assign it in a middleware (`{{context}}.res = {{context}}.{{method}}(...)`), or store it in a variable before returning. Do not: wrap the call in `void` or disable the rule."
        }
    },
    defaultOptions: [],
    create(context) {
        const sourceCode = sourceCodeOf(context);
        const tracker = createHonoTracker(sourceCode);
        const checkedFunctions = new WeakSet();

        function checkHandler(fnNode, contextParamIndex) {
            if (
                !isFunctionNode(fnNode) ||
                checkedFunctions.has(fnNode) ||
                fnNode.body.type !== "BlockStatement"
            ) {
                return;
            }

            const paramId = getParamIdentifier(fnNode, contextParamIndex);
            if (!paramId) {
                return;
            }

            checkedFunctions.add(fnNode);
            const contextVar = resolveVariable(sourceCode, paramId);
            const contextName = paramId.name;

            walkOwnStatements(fnNode.body, (node) => {
                const discarded = findDiscardedResponseCall(
                    node,
                    sourceCode,
                    contextVar,
                    contextName
                );
                if (!discarded) {
                    return;
                }
                context.report({
                    data: {
                        context: contextName,
                        method: discarded.method
                    },
                    messageId: "unusedContextResponse",
                    node
                });
            });
        }

        function onFunction(node) {
            tracker.handleFunction(node);
            const standalone = tracker.inspectStandaloneHandler(node);
            if (standalone && standalone.contextParamIndex !== -1) {
                checkHandler(node, standalone.contextParamIndex);
            }
        }

        return {
            ArrowFunctionExpression: onFunction,
            CallExpression(node) {
                const info = tracker.inspectAppCall(node);
                if (!info || info.handlers.length === 0) {
                    return;
                }
                const contextParamIndex = info.kind === "onError" ? 1 : 0;
                for (const handler of info.handlers) {
                    checkHandler(handler, contextParamIndex);
                }
            },
            FunctionDeclaration: onFunction,
            FunctionExpression: onFunction,
            ImportDeclaration: tracker.handleImportDeclaration,
            VariableDeclarator: tracker.handleVariableDeclarator
        };
    }
};
