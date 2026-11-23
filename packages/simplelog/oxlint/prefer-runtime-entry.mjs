import { isBareSimplelogSource, SIMPLELOG_PACKAGE } from "./utils.mjs";

export const preferRuntimeEntryRule = {
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Prefer explicit SimpleLog runtime entries over the package root import."
        },
        schema: [],
        messages: {
            preferRuntimeEntry: `\`"${SIMPLELOG_PACKAGE}"\` is the Node entry: it pulls \`node:fs\` into the bundle, which browsers and most edge runtimes do not have. Fix: \`"${SIMPLELOG_PACKAGE}/node"\` for the same Node logger, \`"${SIMPLELOG_PACKAGE}/bun"\` for Bun, or \`"${SIMPLELOG_PACKAGE}/web"\` for edge runtimes and browsers; \`createHonoLoggerMiddleware\` comes from \`"${SIMPLELOG_PACKAGE}/hono"\`.`
        }
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
                    node
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
            }
        };
    }
};
