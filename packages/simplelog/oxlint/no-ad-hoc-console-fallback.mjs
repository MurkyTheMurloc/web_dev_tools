import { isConsoleObjectExpression, isLoggerLikeTarget } from "./utils.mjs";

export const noAdHocConsoleFallbackRule = {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow using console as a fallback or alias in logger-like code paths.",
        },
        schema: [],
        messages: {
            noAdHocConsoleFallback:
                "Do not use console as an ad-hoc logger fallback or alias. Pass a SimpleLog logger or create one intentionally.",
        },
    },
    create(context) {
        function reportConsoleNode(node) {
            context.report({
                messageId: "noAdHocConsoleFallback",
                node,
            });
        }

        return {
            LogicalExpression(node) {
                if (node.operator !== "||" && node.operator !== "??") {
                    return;
                }

                if (isConsoleObjectExpression(node.left)) {
                    reportConsoleNode(node.left);
                }

                if (isConsoleObjectExpression(node.right)) {
                    reportConsoleNode(node.right);
                }
            },
            ConditionalExpression(node) {
                if (isConsoleObjectExpression(node.consequent)) {
                    reportConsoleNode(node.consequent);
                }

                if (isConsoleObjectExpression(node.alternate)) {
                    reportConsoleNode(node.alternate);
                }
            },
            VariableDeclarator(node) {
                if (
                    isLoggerLikeTarget(node.id) &&
                    isConsoleObjectExpression(node.init)
                ) {
                    reportConsoleNode(node.init);
                }
            },
            AssignmentExpression(node) {
                if (
                    isLoggerLikeTarget(node.left) &&
                    isConsoleObjectExpression(node.right)
                ) {
                    reportConsoleNode(node.right);
                }
            },
        };
    },
};
