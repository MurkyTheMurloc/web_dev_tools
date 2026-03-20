import { isBareSimplelogSource, SIMPLELOG_PACKAGE } from "./utils.mjs";

export const preferRuntimeEntryRule = {
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Prefer explicit SimpleLog runtime entries over the package root import.",
        },
        schema: [],
        messages: {
            preferRuntimeEntry: `Prefer an explicit runtime entry over "${SIMPLELOG_PACKAGE}". Use a runtime-specific import like "@murky-web/simplelog/node", "@murky-web/simplelog/web", "@murky-web/simplelog/bun", "@murky-web/simplelog/deno", or "@murky-web/simplelog/hono".`,
        },
    },
    create(context) {
        function reportSourceNode(node) {
            if (
                node?.type === "Literal" &&
                typeof node.value === "string" &&
                isBareSimplelogSource(node.value)
            ) {
                context.report({
                    messageId: "preferRuntimeEntry",
                    node,
                });
            }
        }

        return {
            ImportDeclaration(node) {
                reportSourceNode(node.source);
            },
            ExportNamedDeclaration(node) {
                reportSourceNode(node.source);
            },
            ExportAllDeclaration(node) {
                reportSourceNode(node.source);
            },
            CallExpression(node) {
                if (
                    node.callee?.type === "Identifier" &&
                    node.callee.name === "require" &&
                    node.arguments?.[0]
                ) {
                    reportSourceNode(node.arguments[0]);
                }
            },
        };
    },
};
