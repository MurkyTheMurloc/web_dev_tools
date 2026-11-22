import {
    isInsideFunctionScope,
    isLoggerImportSource,
    oneLine
} from "./utils.mjs";

export const preferChildLoggerRule = {
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Prefer deriving child loggers from an existing SimpleLog logger inside functions and request handlers."
        },
        schema: [],
        messages: {
            preferChildLogger:
                "`{{call}}` builds a new root logger on every call of the function around it, without a parent's name prefix or options (threshold, log file, colors). Fix: `logger.createChildLogger({{name}})` on the logger the caller passes in or the module's root logger, or `c.var.logger.createChildLogger({{name}})` inside a Hono handler."
        }
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

                const [firstArgument] = node.arguments ?? [];
                const data = {
                    call: oneLine(context.sourceCode.getText(node)),
                    name: firstArgument
                        ? oneLine(context.sourceCode.getText(firstArgument))
                        : '"child"'
                };

                if (
                    node.callee?.type === "Identifier" &&
                    loggerConstructors.has(node.callee.name)
                ) {
                    context.report({
                        messageId: "preferChildLogger",
                        data,
                        node: node.callee
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
                        data,
                        node: node.callee.property
                    });
                }
            }
        };
    }
};
