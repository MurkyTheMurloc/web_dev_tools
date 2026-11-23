import { loggerNameHint, oneLine } from "./utils.mjs";

export const requireLoggerNameRule = {
    meta: {
        type: "problem",
        docs: {
            description:
                "Require SimpleLog Logger instances to have a non-empty name for useful log output."
        },
        schema: [],
        messages: {
            requireLoggerName:
                "`{{call}}` has no name, so its lines print an empty logger name and cannot be told apart from other loggers' lines. Fix: `{{fix}}`, named after the module or service it logs for."
        }
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

                const { sourceCode } = context;
                const call = oneLine(sourceCode.getText(node));
                const name = JSON.stringify(loggerNameHint(context));
                const [firstArgument] = node.arguments ?? [];
                if (!firstArgument) {
                    context.report({
                        messageId: "requireLoggerName",
                        data: {
                            call,
                            fix: `new ${sourceCode.getText(node.callee)}(${name})`
                        },
                        node: node.callee
                    });
                    return;
                }

                if (
                    firstArgument.type === "Literal" &&
                    typeof firstArgument.value === "string" &&
                    firstArgument.value.trim().length === 0
                ) {
                    const start = firstArgument.range[0] - node.range[0];
                    const end = firstArgument.range[1] - node.range[0];
                    const text = sourceCode.getText(node);
                    context.report({
                        messageId: "requireLoggerName",
                        data: {
                            call,
                            fix: oneLine(
                                `${text.slice(0, start)}${name}${text.slice(end)}`
                            )
                        },
                        node: firstArgument
                    });
                }
            }
        };
    }
};
