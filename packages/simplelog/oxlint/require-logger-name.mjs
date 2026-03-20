export const requireLoggerNameRule = {
    meta: {
        type: "problem",
        docs: {
            description:
                "Require SimpleLog Logger instances to have a non-empty name for useful log output.",
        },
        schema: [],
        messages: {
            requireLoggerName:
                "Provide a non-empty logger name when creating a SimpleLog Logger.",
        },
    },
    create(context) {
        const loggerConstructors = new Set();
        const loggerNamespaces = new Set();

        function isLoggerConstructor(node) {
            if (node?.type === "Identifier") {
                return loggerConstructors.has(node.name);
            }

            return (
                node?.type === "MemberExpression" &&
                !node.computed &&
                node.object?.type === "Identifier" &&
                loggerNamespaces.has(node.object.name) &&
                node.property?.type === "Identifier" &&
                node.property.name === "Logger"
            );
        }

        return {
            ImportDeclaration(node) {
                if (
                    node.source?.type !== "Literal" ||
                    typeof node.source.value !== "string" ||
                    !node.source.value.startsWith("@murky-web/simplelog")
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
                if (!isLoggerConstructor(node.callee)) {
                    return;
                }

                const [firstArgument] = node.arguments ?? [];
                if (!firstArgument) {
                    context.report({
                        messageId: "requireLoggerName",
                        node: node.callee,
                    });
                    return;
                }

                if (
                    firstArgument.type === "Literal" &&
                    typeof firstArgument.value === "string" &&
                    firstArgument.value.trim().length === 0
                ) {
                    context.report({
                        messageId: "requireLoggerName",
                        node: firstArgument,
                    });
                }
            },
        };
    },
};
