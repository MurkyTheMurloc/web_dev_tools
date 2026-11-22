// Fork of eslint's init-declarations ("always") for Solid code. Every `let` and
// `var` needs an initial value, except a variable a `ref` assigns: Solid sets
// it to the element before anything reads it, and a default would be a value
// nobody ever sees. Assigned by a ref means `ref={el}` or `ref={el!}` (the
// compiler rewrites the single shorthand to an assignment) or `el = node` in a
// ref callback, directly or inside a `ref={[…]}` array. A bare `el` inside a
// ref array is never assigned; solid/prefer-ref-shorthand reports that entry,
// so this rule leaves its declaration alone. As in eslint, `for-in`/`for-of`
// variables and `declare` declarations are ignored.
import { findVariable } from "../compat.mjs";
import { isFunctionNode, jsxPropName, walkOwnBody } from "../utils.mjs";

function unwrapNonNull(node) {
    return node?.type === "TSNonNullExpression" ? node.expression : node;
}

function isLoopVariable(declaration) {
    const { parent } = declaration;
    return (
        (parent.type === "ForInStatement" ||
            parent.type === "ForOfStatement") &&
        parent.left === declaration
    );
}

/** `declare let x: T;`, or any declaration in a `declare module`/`global`. */
function isAmbient(declaration) {
    for (let node = declaration; node; node = node.parent) {
        if (node.declare === true) {
            return true;
        }
    }
    return false;
}

export default {
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Require an initial value for `let` and `var`, except for a variable a `ref` assigns."
        },
        schema: [],
        messages: {
            noInitialValue:
                "`{{kind}} {{name}}` has no initial value and no `ref` assigns it, so every read before the first write gets `undefined`. Fix: give it a default, `{{kind}} {{name}} = …;`, or derive it with `const`. Only a variable a `ref` assigns may stay uninitialized (`let el!: HTMLDivElement;` with `ref={el}`). Do not: add `= undefined` (unicorn/no-useless-undefined reports it) or `!` without a ref."
        }
    },
    defaultOptions: [],
    create(context) {
        const refAssigned = new Set();
        const uninitialized = [];

        function markAssigned(identifier) {
            const variable = findVariable(context, identifier);
            if (variable) {
                refAssigned.add(variable);
            }
        }

        /** `(node) => { el = node; }`: every `x = node` in the callback. */
        function markCallback(callback) {
            const [param] = callback.params;
            if (param?.type !== "Identifier") {
                return;
            }
            walkOwnBody(callback.body, (node) => {
                if (
                    node.type === "AssignmentExpression" &&
                    node.operator === "=" &&
                    node.left.type === "Identifier" &&
                    node.right.type === "Identifier" &&
                    node.right.name === param.name
                ) {
                    markAssigned(node.left);
                }
            });
        }

        function markEntry(entry, inArray) {
            const node = unwrapNonNull(entry);
            if (node?.type === "Identifier") {
                // In an array: never assigned, but prefer-ref-shorthand
                // reports the entry, which is where the fix goes.
                markAssigned(node);
            } else if (node && isFunctionNode(node)) {
                markCallback(node);
            } else if (!inArray && node?.type === "ArrayExpression") {
                for (const element of node.elements) {
                    markEntry(element, true);
                }
            }
        }

        return {
            JSXAttribute(node) {
                if (
                    jsxPropName(node) === "ref" &&
                    node.value?.type === "JSXExpressionContainer"
                ) {
                    markEntry(node.value.expression, false);
                }
            },
            VariableDeclaration(node) {
                if (
                    (node.kind !== "let" && node.kind !== "var") ||
                    isLoopVariable(node) ||
                    isAmbient(node)
                ) {
                    return;
                }
                for (const declarator of node.declarations) {
                    if (
                        declarator.init === null &&
                        declarator.id.type === "Identifier"
                    ) {
                        uninitialized.push(declarator);
                    }
                }
            },
            "Program:exit"() {
                for (const declarator of uninitialized) {
                    const variable = findVariable(context, declarator.id);
                    if (variable && refAssigned.has(variable)) {
                        continue;
                    }
                    context.report({
                        data: {
                            kind: declarator.parent.kind,
                            name: declarator.id.name
                        },
                        messageId: "noInitialValue",
                        node: declarator
                    });
                }
            }
        };
    }
};
