import { isInsideFunctionScope, isLoggerImportSource } from "./utils.mjs";

export const preferChildLoggerRule = {
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Prefer deriving child loggers from an existing SimpleLog logger inside functions and request handlers.",
        },
        schema: [],
        messages: {
            preferChildLogger:
                "Prefer logger.createChildLogger(...) over creating a new root Logger inside a nested function scope.",
        },
    },
    create(context) {
        const loggerConstructors = new Set();
        const loggerNamespaces = new Set();

        return {
            ImportDeclaration(node) {
                if (
                    node.source?.type !== "Literal" ||
                    typeof node.source.value !== "string" ||
                    !isLoggerImportSource(node.source.value)
                ) {
                    return;
                }

                for (const specifier of node.specifiers ?? []) {
                    if (specifier.type === "ImportSpecifier") {
                        if (
                            specifier.imported?.type === "Identifier" &&
                            specifier.imported.name === "Logger"
                        ) {
                            loggerConstructors.add(specifier.local.name);
                        }
                    }

                    if (specifier.type === "ImportNamespaceSpecifier") {
                        loggerNamespaces.add(specifier.local.name);
                    }
                }
            },
            NewExpression(node) {
                if (!isInsideFunctionScope(node)) {
                    return;
                }

                if (
                    node.callee?.type === "Identifier" &&
                    loggerConstructors.has(node.callee.name)
                ) {
                    context.report({
                        messageId: "preferChildLogger",
                        node: node.callee,
                    });
                    return;
                }

                if (
                    node.callee?.type === "MemberExpression" &&
                    !node.callee.computed &&
                    node.callee.object?.type === "Identifier" &&
                    loggerNamespaces.has(node.callee.object.name) &&
                    node.callee.property?.type === "Identifier" &&
                    node.callee.property.name === "Logger"
                ) {
                    context.report({
                        messageId: "preferChildLogger",
                        node: node.callee.property,
                    });
                }
            },
        };
    },
};
