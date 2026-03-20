import { ESLintUtils } from "@typescript-eslint/utils";

import { markVariableAsUsed } from "../compat.mjs";

const createRule = ESLintUtils.RuleCreator.withoutDocs;

export const jsxUsesVarsRule = createRule({
    meta: {
        docs: {
            description:
                "Prevent variables used in JSX from being marked as unused.",
            url: "https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/jsx-uses-vars.md",
        },
        messages: {},
        schema: [],
        type: "problem",
    },
    defaultOptions: [],
    create(context) {
        return {
            JSXOpeningElement(node) {
                let parent = null;

                switch (node.name.type) {
                    case "JSXNamespacedName":
                        return;
                    case "JSXIdentifier":
                        markVariableAsUsed(context, node.name.name, node.name);
                        return;
                    case "JSXMemberExpression":
                        parent = node.name.object;
                        while (parent?.type === "JSXMemberExpression") {
                            parent = parent.object;
                        }

                        if (parent?.type === "JSXIdentifier") {
                            markVariableAsUsed(context, parent.name, parent);
                        }
                        return;
                    default:
                        return;
                }
            },
            "JSXAttribute > JSXNamespacedName"(node) {
                if (
                    node.namespace?.type === "JSXIdentifier" &&
                    node.namespace.name === "use" &&
                    node.name?.type === "JSXIdentifier"
                ) {
                    markVariableAsUsed(context, node.name.name, node.name);
                }
            },
        };
    },
});
