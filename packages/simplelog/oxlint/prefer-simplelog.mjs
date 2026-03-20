const CONSOLE_METHOD_TO_LOGGER_METHOD = {
    debug: "debug",
    error: "error",
    info: "info",
    log: "info",
    trace: "debug",
    warn: "warn",
};

export const preferSimplelogRule = {
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Prefer @murky-web/simplelog over direct console method calls.",
        },
        schema: [],
        messages: {
            preferSimplelog:
                "Prefer a SimpleLog logger over direct console.{{consoleMethod}}(). Use logger.{{loggerMethod}}(...) instead.",
        },
    },
    create(context) {
        return {
            CallExpression(node) {
                if (node.callee?.type !== "MemberExpression") {
                    return;
                }

                if (node.callee.computed) {
                    return;
                }

                if (
                    node.callee.object?.type !== "Identifier" ||
                    node.callee.object.name !== "console"
                ) {
                    return;
                }

                if (node.callee.property?.type !== "Identifier") {
                    return;
                }

                const consoleMethod = node.callee.property.name;
                const loggerMethod =
                    CONSOLE_METHOD_TO_LOGGER_METHOD[consoleMethod];

                if (!loggerMethod) {
                    return;
                }

                context.report({
                    messageId: "preferSimplelog",
                    data: {
                        consoleMethod,
                        loggerMethod,
                    },
                    node: node.callee.property,
                });
            },
        };
    },
};
