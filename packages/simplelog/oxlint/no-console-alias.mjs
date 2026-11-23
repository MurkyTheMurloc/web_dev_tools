import {
    CONSOLE_METHOD_TO_LOGGER_METHOD,
    isConsoleBindCall,
    isConsoleMethodReference,
    isConsoleObjectExpression,
    oneLine
} from "./utils.mjs";

function loggerMethodFor(consoleMethod) {
    return CONSOLE_METHOD_TO_LOGGER_METHOD[consoleMethod] ?? "info";
}

/**
 * The calls to write instead of the alias, from the alias' own names: `const {
 * error } = console` becomes `logger.error(...)` in place of `error(...)`.
 */
function describeReplacement(sourceCode, expression, target) {
    if (isConsoleMethodReference(expression) || isConsoleBindCall(expression)) {
        const reference = isConsoleBindCall(expression)
            ? expression.callee.object
            : expression;
        const method = loggerMethodFor(reference.property.name);
        return `\`logger.${method}(...)\` in place of \`${oneLine(sourceCode.getText(target))}(...)\``;
    }

    if (target?.type === "ObjectPattern") {
        const calls = (target.properties ?? []).flatMap((property) => {
            if (
                property?.type !== "Property" ||
                property.key?.type !== "Identifier" ||
                property.value?.type !== "Identifier"
            ) {
                return [];
            }

            return [
                `\`logger.${loggerMethodFor(property.key.name)}(...)\` in place of \`${property.value.name}(...)\``
            ];
        });
        if (calls.length > 0) {
            return calls.join(", ");
        }
    }

    return `\`logger.<method>(...)\` in place of \`${oneLine(sourceCode.getText(target))}.<method>(...)\`, with \`log\` becoming \`info\` and \`trace\` becoming \`debug\``;
}

export const noConsoleAliasRule = {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow aliasing console or console methods in codebases that standardize on SimpleLog."
        },
        schema: [],
        messages: {
            noConsoleAlias:
                "`{{alias}}` routes logging through `console` under another name, so `prefer-simplelog` no longer sees the calls and they skip the logger's level threshold, name and log file. Fix: delete it and call a SimpleLog logger: {{fix}}. Do not wrap `console` in an object or function of your own; that hides the same calls."
        }
    },
    create(context) {
        function report(node, owner, target) {
            const { sourceCode } = context;
            context.report({
                messageId: "noConsoleAlias",
                data: {
                    alias: oneLine(sourceCode.getText(owner)),
                    fix: describeReplacement(sourceCode, node, target)
                },
                node
            });
        }

        return {
            VariableDeclarator(node) {
                if (isConsoleObjectExpression(node.init)) {
                    report(node.init, node, node.id);
                    return;
                }

                if (isConsoleMethodReference(node.init)) {
                    report(node.init, node, node.id);
                    return;
                }

                if (isConsoleBindCall(node.init)) {
                    report(node.init, node, node.id);
                    return;
                }

                if (
                    node.id?.type === "ObjectPattern" &&
                    isConsoleObjectExpression(node.init)
                ) {
                    report(node.init, node, node.id);
                }
            },
            AssignmentExpression(node) {
                if (isConsoleObjectExpression(node.right)) {
                    report(node.right, node, node.left);
                    return;
                }

                if (isConsoleMethodReference(node.right)) {
                    report(node.right, node, node.left);
                    return;
                }

                if (isConsoleBindCall(node.right)) {
                    report(node.right, node, node.left);
                }
            }
        };
    }
};
