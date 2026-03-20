import {
    SIMPLELOG_LOG_METHODS,
    functionHasContextParam,
    getEnclosingFunction,
} from "./utils.mjs";

export const preferHonoContextLoggerRule = {
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Prefer c.var.logger over a root logger inside Hono request handlers.",
        },
        schema: [],
        messages: {
            preferHonoContextLogger:
                "Prefer c.var.logger inside Hono handlers instead of calling a root logger directly.",
        },
    },
    create(context) {
        let honoImported = false;
        const rootLoggerBindings = new Set();
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
                    node.source?.type === "Literal" &&
                    typeof node.source.value === "string" &&
                    node.source.value.startsWith("hono")
                ) {
                    honoImported = true;
                }

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
            VariableDeclarator(node) {
                if (
                    node.parent?.type === "VariableDeclaration" &&
                    node.parent.parent?.type === "Program" &&
                    node.id?.type === "Identifier" &&
                    node.init?.type === "NewExpression" &&
                    isLoggerConstructor(node.init.callee)
                ) {
                    rootLoggerBindings.add(node.id.name);
                }
            },
            CallExpression(node) {
                if (!honoImported) {
                    return;
                }

                if (
                    node.callee?.type !== "MemberExpression" ||
                    node.callee.computed ||
                    node.callee.object?.type !== "Identifier" ||
                    !rootLoggerBindings.has(node.callee.object.name) ||
                    node.callee.property?.type !== "Identifier" ||
                    !SIMPLELOG_LOG_METHODS.has(node.callee.property.name)
                ) {
                    return;
                }

                const enclosingFunction = getEnclosingFunction(node);
                if (!functionHasContextParam(enclosingFunction)) {
                    return;
                }

                context.report({
                    messageId: "preferHonoContextLogger",
                    node: node.callee.object,
                });
            },
        };
    },
};
