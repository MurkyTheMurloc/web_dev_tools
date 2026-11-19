import { getStaticValue } from "@eslint-community/eslint-utils";

import { getScope } from "../compat.mjs";

// A browser strips leading C0 control characters and spaces and drops tabs and
// newlines inside the scheme before it reads the protocol, so all of
// `"\njavascript:"`, `"\u0001javascript:"` and `"java\tscript:"` run code.
// The regex literal is the one of eslint-plugin-solid 0.20: it is not an
// escaped string, where `\\u0000` would match a backslash and the text `u0000`.
const JAVASCRIPT_PROTOCOL_REGEX =
    /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;

export const jsxNoScriptUrlRule = {
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
};
