// Port of eslint-plugin-solid's no-unassigned-vars (MIT, d3e946c): eslint's
// no-unassigned-vars, except that `ref={el}` or `ref={el!}` counts as an
// assignment. Solid's compiler rewrites the single shorthand to `el = node`,
// but scope analysis only sees a read. A bare `el` inside `ref={[…]}` is never
// assigned, but solid/prefer-ref-shorthand reports that entry (its fix, a
// callback, assigns the variable), so this rule leaves the variable alone.
import { getSourceCode } from "../compat.mjs";
import { jsxPropName } from "../utils.mjs";

/** Whether `value` is the whole expression of a `ref` attribute. */
function isRefExpression(value) {
    const container = value.parent;
    return (
        container?.type === "JSXExpressionContainer" &&
        container.parent?.type === "JSXAttribute" &&
        jsxPropName(container.parent) === "ref"
    );
}

/** `el` or `el!` as the whole value of a `ref`, or as an entry of a ref array. */
function isRefValue(identifier) {
    const value =
        identifier.parent?.type === "TSNonNullExpression"
            ? identifier.parent
            : identifier;
    return (
        isRefExpression(value) ||
        (value.parent?.type === "ArrayExpression" &&
            isRefExpression(value.parent))
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
        type: "problem",
        docs: {
            description:
                "Disallow `let` and `var` variables that are read but never assigned, counting `ref={el}` as an assignment. Replaces eslint's `no-unassigned-vars`."
        },
        schema: [],
        messages: {
            unassigned:
                "`{{name}}` is read but never assigned, so it is always `undefined`. Fix: assign it before it is read, or, if it should hold an element, pass it as `ref={{{name}}}`. Do not: add `= undefined` or `!` to silence it; the value stays missing."
        }
    },
    defaultOptions: [],
    create(context) {
        const sourceCode = getSourceCode(context);

        return {
            VariableDeclarator(node) {
                const declaration = node.parent;
                if (
                    node.init ||
                    node.id.type !== "Identifier" ||
                    declaration.kind === "const" ||
                    isAmbient(declaration)
                ) {
                    return;
                }
                const [variable] = sourceCode.getDeclaredVariables(node);
                if (!variable) {
                    return;
                }
                let hasRead = false;
                for (const reference of variable.references) {
                    if (
                        reference.isWrite() ||
                        isRefValue(reference.identifier)
                    ) {
                        return;
                    }
                    if (reference.isRead()) {
                        hasRead = true;
                    }
                }
                // A variable that is never read is no-unused-vars' to report.
                if (!hasRead) {
                    return;
                }
                context.report({
                    data: { name: node.id.name },
                    messageId: "unassigned",
                    node
                });
            }
        };
    }
};
