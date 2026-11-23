import { getSourceCode } from "../compat.mjs";
import { isDOMElementName, messageCode, trace } from "../utils.mjs";

export const noArrayHandlersRule = {
    meta: {
        docs: {
            description: "Disallow usage of type-unsafe event handlers.",
            url: "https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-array-handlers.md"
        },
        messages: {
            noArrayHandlers:
                "`{{name}}` gets the array `{{expression}}`. Solid calls `handler(data, event)` for `[handler, data]`, but the JSX types take `data` as `any`, so a wrong argument passes the type check. Fix: `{{name}}={{{fix}}}`."
        },
        schema: [],
        type: "problem"
    },
    defaultOptions: [],
    create(context) {
        return {
            JSXAttribute(node) {
                const openingElement = node.parent;
                if (
                    openingElement.name.type !== "JSXIdentifier" ||
                    !isDOMElementName(openingElement.name.name)
                ) {
                    return;
                }

                const isNamespacedHandler =
                    node.name.type === "JSXNamespacedName" &&
                    node.name.namespace.name === "on";
                const isNormalEventHandler =
                    node.name.type === "JSXIdentifier" &&
                    /^on[a-zA-Z]/.test(node.name.name);

                const traced =
                    node.value?.type === "JSXExpressionContainer"
                        ? trace(node.value.expression, context)
                        : null;
                if (
                    (isNamespacedHandler || isNormalEventHandler) &&
                    traced?.type === "ArrayExpression"
                ) {
                    const sourceCode = getSourceCode(context);
                    const [handler, data] = traced.elements.map(
                        (element, index) => {
                            if (!element || element.type === "SpreadElement") {
                                return null;
                            }
                            const text = sourceCode.getText(element);
                            // An inline function is called as `(fn)(...)`.
                            return index === 0 &&
                                element.type !== "Identifier" &&
                                element.type !== "MemberExpression"
                                ? `(${text})`
                                : text;
                        }
                    );
                    context.report({
                        messageId: "noArrayHandlers",
                        node,
                        data: {
                            name: sourceCode.getText(node.name),
                            expression: messageCode(
                                sourceCode.getText(node.value.expression),
                                "[handler, data]"
                            ),
                            fix: messageCode(
                                `(event) => ${handler ?? "handler"}(${data ?? "data"}, event)`,
                                "(event) => handler(data, event)"
                            )
                        }
                    });
                }
            }
        };
    }
};
