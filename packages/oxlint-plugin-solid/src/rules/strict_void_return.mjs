import { isFunctionNode, jsxPropName, trackImports } from "../utils.mjs";

const EVENT_HANDLER_NAME = /^on(?::|[A-Z])/;
const DOM_EVENT_NAME = /^on[a-z]/;
const DOM_ELEMENT_NAME = /^[a-z]/;
const CLEANUP_PRIMITIVES = ["onCleanup"];
const SETTLED_PRIMITIVES = ["onSettled"];

/** Values that can never be a cleanup function and are never void. */
const PLAIN_VALUE_TYPES = new Set([
    "ArrayExpression",
    "AssignmentExpression",
    "BinaryExpression",
    "Literal",
    "ObjectExpression",
    "TemplateLiteral",
    "UpdateExpression",
]);

function isVoidExpression(expression) {
    return (
        (expression.type === "UnaryExpression" &&
            expression.operator === "void") ||
        (expression.type === "Identifier" && expression.name === "undefined")
    );
}

function describe(expression) {
    return expression.type === "CallExpression"
        ? "the call's result"
        : "its value";
}

/** Every `return <expr>` of a function, without looking into inner ones. */
function collectReturns(node, into) {
    if (node === null || typeof node !== "object") {
        return;
    }

    if (node.type === "ReturnStatement" && node.argument) {
        into.push(node.argument);
    }

    for (const [key, value] of Object.entries(node)) {
        if (key === "parent") {
            continue;
        }

        const candidates = Array.isArray(value) ? value : [value];
        for (const candidate of candidates) {
            if (
                candidate !== null &&
                typeof candidate === "object" &&
                typeof candidate.type === "string" &&
                !isFunctionNode(candidate)
            ) {
                collectReturns(candidate, into);
            }
        }
    }
}

/** The callbacks a `ref` applies, including the ones in a ref array. */
function getRefCallbacks(expression) {
    if (isFunctionNode(expression)) {
        return [expression];
    }

    if (expression?.type === "ArrayExpression") {
        return expression.elements.filter((element) => isFunctionNode(element));
    }

    return [];
}

export const strictVoidReturnRule = {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow returning a value from callbacks Solid ignores the return of (event handlers, ref callbacks, onCleanup, onSettled).",
            url: "https://docs.solidjs.com/",
        },
        schema: [],
        messages: {
            handlerReturnsValue:
                "This `{{attribute}}` callback is an expression-bodied arrow, so it returns {{what}}, which Solid ignores. Write a block body (`() => { … }`) or discard it explicitly with `void …`.",
            cleanupReturnsValue:
                "This `{{primitive}}` callback returns a value, which is ignored. Remove the `return`, or use a block body that does not return.",
            settledReturnsValue:
                "This `onSettled` callback returns a value that is not a function. Only a returned cleanup function is used; remove the `return` or return `() => { … }`.",
        },
    },
    defaultOptions: [],
    create(context) {
        const { matchImport, handleImportDeclaration } = trackImports();

        function checkHandler(callback, attribute) {
            if (
                !isFunctionNode(callback) ||
                callback.body.type === "BlockStatement" ||
                isVoidExpression(callback.body)
            ) {
                return;
            }

            context.report({
                node: callback,
                messageId: "handlerReturnsValue",
                data: {
                    attribute,
                    what: describe(callback.body),
                },
            });
        }

        function checkCleanup(callback, primitive) {
            const values = [];
            if (callback.body.type === "BlockStatement") {
                collectReturns(callback.body, values);
            } else {
                values.push(callback.body);
            }

            // A call may well return nothing (`() => clearInterval(id)`); without
            // types only values that are certainly not void are reported.
            if (
                values.some(
                    (value) =>
                        PLAIN_VALUE_TYPES.has(value.type) &&
                        !isVoidExpression(value),
                )
            ) {
                context.report({
                    node: callback,
                    messageId:
                        primitive === "onSettled"
                            ? "settledReturnsValue"
                            : "cleanupReturnsValue",
                    data: { primitive },
                });
            }
        }

        return {
            ImportDeclaration: handleImportDeclaration,
            JSXAttribute(node) {
                const isForeignNamespace =
                    node.name.type === "JSXNamespacedName" &&
                    node.name.namespace.name !== "on";
                if (
                    node.value?.type !== "JSXExpressionContainer" ||
                    isForeignNamespace
                ) {
                    return;
                }

                const name = jsxPropName(node);
                const tagName = node.parent?.name;
                const isDomElement =
                    tagName?.type === "JSXIdentifier" &&
                    DOM_ELEMENT_NAME.test(tagName.name);

                if (name === "ref") {
                    for (const callback of getRefCallbacks(
                        node.value.expression,
                    )) {
                        checkHandler(callback, "ref");
                    }

                    return;
                }

                if (
                    EVENT_HANDLER_NAME.test(name) ||
                    (isDomElement && DOM_EVENT_NAME.test(name))
                ) {
                    checkHandler(node.value.expression, name);
                }
            },
            CallExpression(node) {
                if (node.callee.type !== "Identifier") {
                    return;
                }

                const [callback] = node.arguments;
                if (!isFunctionNode(callback)) {
                    return;
                }

                const primitive = matchImport(
                    [...CLEANUP_PRIMITIVES, ...SETTLED_PRIMITIVES],
                    node.callee.name,
                );
                if (primitive) {
                    checkCleanup(callback, primitive);
                }
            },
        };
    },
};
