import { ASTUtils, ESLintUtils } from "@typescript-eslint/utils";

import { getScope } from "../compat.mjs";

const createRule = ESLintUtils.RuleCreator.withoutDocs;
const { getStaticValue } = ASTUtils;
const JAVASCRIPT_PROTOCOL_PATTERN =
    "^[\\\\u0000-\\\\u001F ]*j[\\\\r\\\\n\\\\t]*a[\\\\r\\\\n\\\\t]*v[\\\\r\\\\n\\\\t]*a[\\\\r\\\\n\\\\t]*s[\\\\r\\\\n\\\\t]*c[\\\\r\\\\n\\\\t]*r[\\\\r\\\\n\\\\t]*i[\\\\r\\\\n\\\\t]*p[\\\\r\\\\n\\\\t]*t[\\\\r\\\\n\\\\t]*:";
const JAVASCRIPT_PROTOCOL_REGEX = new RegExp(JAVASCRIPT_PROTOCOL_PATTERN, "i");

export const jsxNoScriptUrlRule = createRule({
    meta: {
        docs: {
            description: "Disallow javascript: URLs.",
            url: "https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/jsx-no-script-url.md",
        },
        messages: {
            noJSURL:
                "For security, don't use javascript: URLs. Use event handlers instead if you can.",
        },
        schema: [],
        type: "problem",
    },
    defaultOptions: [],
    create(context) {
        return {
            JSXAttribute(node) {
                if (node.name.type !== "JSXIdentifier" || !node.value) {
                    return;
                }

                const expression =
                    node.value.type === "JSXExpressionContainer"
                        ? node.value.expression
                        : node.value;
                const staticValue = getStaticValue(
                    expression,
                    getScope(context, node),
                );

                if (
                    staticValue &&
                    typeof staticValue.value === "string" &&
                    JAVASCRIPT_PROTOCOL_REGEX.test(staticValue.value)
                ) {
                    context.report({
                        messageId: "noJSURL",
                        node: node.value,
                    });
                }
            },
        };
    },
});
