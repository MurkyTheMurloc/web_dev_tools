import {
    isConsoleObjectExpression,
    isLoggerLikeTarget,
    loggerNameHint,
    oneLine
} from "./utils.mjs";

export const noAdHocConsoleFallbackRule = {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow using console as a fallback or alias in logger-like code paths."
        },
        schema: [],
        messages: {
            noAdHocConsoleFallback:
                '`{{expression}}` logs through bare `console` whenever that branch is taken, so those lines skip the logger\'s level threshold, name and log file, and a call such as `.log(...)` has no `Logger` counterpart. Fix: `{{fix}}` with `import { Logger } from "@murky-web/simplelog/node";` (or `/bun`, `/web`), or make the logger a required parameter. Do not swap in `globalThis.console` or a `console` alias; both report too.'
        }
    },
    create(context) {
        function reportConsoleNode(node, owner) {
            const { sourceCode } = context;
            const text = sourceCode.getText(owner);
            const start = node.range[0] - owner.range[0];
            const end = node.range[1] - owner.range[0];
            const replacement = `new Logger(${JSON.stringify(loggerNameHint(context))})`;
            context.report({
                messageId: "noAdHocConsoleFallback",
                data: {
                    expression: oneLine(text),
                    fix: oneLine(
                        `${text.slice(0, start)}${replacement}${text.slice(end)}`
                    )
                },
                node
            });
        }

        return {
            LogicalExpression(node) {
                if (node.operator !== "||" && node.operator !== "??") {
                    return;
                }

                if (isConsoleObjectExpression(node.left)) {
                    reportConsoleNode(node.left, node);
                }

                if (isConsoleObjectExpression(node.right)) {
                    reportConsoleNode(node.right, node);
                }
            },
            ConditionalExpression(node) {
                if (isConsoleObjectExpression(node.consequent)) {
                    reportConsoleNode(node.consequent, node);
                }

                if (isConsoleObjectExpression(node.alternate)) {
                    reportConsoleNode(node.alternate, node);
                }
            },
            VariableDeclarator(node) {
                if (
                    isLoggerLikeTarget(node.id) &&
                    isConsoleObjectExpression(node.init)
                ) {
                    reportConsoleNode(node.init, node);
                }
            },
            AssignmentExpression(node) {
                if (
                    isLoggerLikeTarget(node.left) &&
                    isConsoleObjectExpression(node.right)
                ) {
                    reportConsoleNode(node.right, node);
                }
            }
        };
    }
};
