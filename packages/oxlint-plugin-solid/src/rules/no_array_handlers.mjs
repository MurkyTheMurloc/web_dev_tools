import { ESLintUtils } from "@typescript-eslint/utils";

import { isDOMElementName, trace } from "../utils.mjs";

const createRule = ESLintUtils.RuleCreator.withoutDocs;

export const noArrayHandlersRule = createRule({
    meta: {
        docs: {
            description: "Disallow usage of type-unsafe event handlers.",
            url: "https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-array-handlers.md",
        },
        messages: {
            noArrayHandlers:
                "Passing an array as an event handler is potentially type-unsafe.",
        },
        schema: [],
        type: "problem",
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

                if (
                    (isNamespacedHandler || isNormalEventHandler) &&
                    node.value?.type === "JSXExpressionContainer" &&
                    trace(node.value.expression, context).type ===
                        "ArrayExpression"
                ) {
                    context.report({
                        messageId: "noArrayHandlers",
                        node,
                    });
                }
            },
        };
    },
});
