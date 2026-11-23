// A single `ref={el}` is rewritten by Solid's compiler to `el = node`, so a
// callback that only does that assignment is the long form of the shorthand.
// The rewrite is single-ref only: inside `ref={[…]}` every entry is a callback
// and a bare `el` is never assigned.
import { findVariable, getSourceCode } from "../compat.mjs";
import { jsxPropName } from "../utils.mjs";

function unwrapNonNull(node) {
    return node?.type === "TSNonNullExpression" ? node.expression : node;
}

/** `el` in `(node) => { el = node; }` or `(node) => (el = node)`. */
function getStoredIdentifier(callback) {
    if (
        (callback.type !== "ArrowFunctionExpression" &&
            callback.type !== "FunctionExpression") ||
        callback.async ||
        callback.generator ||
        callback.params.length !== 1 ||
        callback.params[0].type !== "Identifier"
    ) {
        return null;
    }
    let expression = callback.body;
    if (expression.type === "BlockStatement") {
        const [statement] = expression.body;
        if (
            expression.body.length !== 1 ||
            statement.type !== "ExpressionStatement"
        ) {
            return null;
        }
        expression = statement.expression;
    }
    const param = callback.params[0].name;
    if (
        expression.type === "AssignmentExpression" &&
        expression.operator === "=" &&
        expression.left.type === "Identifier" &&
        expression.left.name !== param &&
        expression.right.type === "Identifier" &&
        expression.right.name === param
    ) {
        return expression.left;
    }
    return null;
}

export default {
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Prefer `ref={el}` over a callback that only stores the element, and report a bare variable in a ref array, which is never assigned."
        },
        fixable: "code",
        hasSuggestions: true,
        schema: [],
        messages: {
            callbackOnlyStores:
                "The `ref` callback `{{callback}}` only stores the element in `{{name}}`, which `{{shorthand}}` does on its own: Solid's compiler rewrites a single `ref` variable to that assignment. Fix: `{{shorthand}}`.",
            bareEntryInArray:
                "`{{name}}` in the `ref` array is never assigned and stays `undefined`: Solid rewrites only a single `{{shorthand}}` to an assignment, and an array entry must be a callback. Fix: `{{callback}}` in its place. Do not: add `!` or a default to `{{name}}`; it stays unassigned either way.",
            useCallback: "Replace `{{name}}` with `{{callback}}`."
        }
    },
    defaultOptions: [],
    create(context) {
        const sourceCode = getSourceCode(context);

        /**
         * A `let el;` waiting for its element. A directive in the array
         * (`ref={[autofocus]}`) is a function or a variable with a value.
         */
        function isElementVariable(identifier) {
            const definition = findVariable(context, identifier)?.defs[0];
            return (
                definition?.type === "Variable" &&
                definition.parent.kind !== "const" &&
                !definition.parent.declare &&
                definition.node.init === null
            );
        }

        function checkArrayEntry(entry) {
            const identifier = unwrapNonNull(entry);
            if (
                identifier?.type !== "Identifier" ||
                !isElementVariable(identifier)
            ) {
                return;
            }
            const { name } = identifier;
            const param = name === "node" ? "element" : "node";
            const callback = `(${param}) => { ${name} = ${param}; }`;
            context.report({
                data: { callback, name, shorthand: `ref={${name}}` },
                messageId: "bareEntryInArray",
                node: entry,
                suggest: [
                    {
                        data: { callback, name },
                        fix: (fixer) => fixer.replaceText(entry, callback),
                        messageId: "useCallback"
                    }
                ]
            });
        }

        return {
            JSXAttribute(node) {
                if (
                    jsxPropName(node) !== "ref" ||
                    node.value?.type !== "JSXExpressionContainer"
                ) {
                    return;
                }
                const { expression } = node.value;
                if (expression.type === "ArrayExpression") {
                    for (const entry of expression.elements) {
                        checkArrayEntry(entry);
                    }
                    return;
                }
                const stored = getStoredIdentifier(expression);
                if (stored === null) {
                    return;
                }
                context.report({
                    data: {
                        callback: sourceCode.getText(expression),
                        name: stored.name,
                        shorthand: `ref={${stored.name}}`
                    },
                    fix: (fixer) => fixer.replaceText(expression, stored.name),
                    messageId: "callbackOnlyStores",
                    node: expression
                });
            }
        };
    }
};
