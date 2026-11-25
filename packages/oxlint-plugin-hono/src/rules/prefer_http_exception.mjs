import { sourceCodeOf } from "@murky-web/oxlint-plugin/utils";

import {
    createHonoTracker,
    isFunctionNode,
    unwrapExpression
} from "../hono_ast.mjs";

const DOCS_URL =
    "https://github.com/MurkyTheMurloc/web_dev_tools/tree/main/packages/oxlint-plugin-hono";

function walkOwnBody(node, visit) {
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
                walkOwnBody(child, visit);
            }
        }
    }
}

function isPlainErrorConstructor(expr) {
    const node = unwrapExpression(expr);
    if (!node) {
        return false;
    }
    if (
        (node.type === "NewExpression" || node.type === "CallExpression") &&
        node.callee.type === "Identifier" &&
        node.callee.name === "Error"
    ) {
        return true;
    }
    return false;
}

export default {
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Prefer throwing `HTTPException` from `hono/http-exception` instead of generic `Error` inside Hono route handlers and middleware.",
            url: DOCS_URL
        },
        schema: [],
        messages: {
            preferHttpException:
                "Throwing a generic `Error` inside a Hono handler produces an untyped 500 error with no HTTP status code. Fix: throw `new HTTPException(status, { message: ... })` from `hono/http-exception` (for example `400`, `401`, `403`, or `404`) so Hono returns the right HTTP response automatically. Do not: return raw error strings or disable the rule."
        }
    },
    defaultOptions: [],
    create(context) {
        const sourceCode = sourceCodeOf(context);
        const tracker = createHonoTracker(sourceCode);
        const checkedFunctions = new WeakSet();

        function checkHandler(fnNode) {
            if (
                !isFunctionNode(fnNode) ||
                checkedFunctions.has(fnNode) ||
                fnNode.body.type !== "BlockStatement"
            ) {
                return;
            }
            checkedFunctions.add(fnNode);

            walkOwnBody(fnNode.body, (node) => {
                if (
                    node.type === "ThrowStatement" &&
                    isPlainErrorConstructor(node.argument)
                ) {
                    context.report({
                        messageId: "preferHttpException",
                        node
                    });
                }
            });
        }

        function onFunction(node) {
            tracker.handleFunction(node);
            const standalone = tracker.inspectStandaloneHandler(node);
            if (standalone) {
                checkHandler(node);
            }
        }

        return {
            ArrowFunctionExpression: onFunction,
            CallExpression(node) {
                const info = tracker.inspectAppCall(node);
                if (!info) {
                    return;
                }
                if (info.kind === "route" || info.kind === "use") {
                    for (const handler of info.handlers) {
                        checkHandler(handler);
                    }
                }
            },
            FunctionDeclaration: onFunction,
            FunctionExpression: onFunction,
            ImportDeclaration: tracker.handleImportDeclaration,
            VariableDeclarator: tracker.handleVariableDeclarator
        };
    }
};
