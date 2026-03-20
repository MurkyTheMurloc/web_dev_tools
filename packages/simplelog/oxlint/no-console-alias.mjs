import {
    isConsoleBindCall,
    isConsoleMethodReference,
    isConsoleObjectExpression,
} from "./utils.mjs";

export const noConsoleAliasRule = {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow aliasing console or console methods in codebases that standardize on SimpleLog.",
        },
        schema: [],
        messages: {
            noConsoleAlias:
                "Do not alias console or console methods. Use a SimpleLog logger instead.",
        },
    },
    create(context) {
        function report(node) {
            context.report({
                messageId: "noConsoleAlias",
                node,
            });
        }

        return {
            VariableDeclarator(node) {
                if (isConsoleObjectExpression(node.init)) {
                    report(node.init);
                    return;
                }

                if (isConsoleMethodReference(node.init)) {
                    report(node.init);
                    return;
                }

                if (isConsoleBindCall(node.init)) {
                    report(node.init);
                    return;
                }

                if (
                    node.id?.type === "ObjectPattern" &&
                    isConsoleObjectExpression(node.init)
                ) {
                    report(node.init);
                }
            },
            AssignmentExpression(node) {
                if (isConsoleObjectExpression(node.right)) {
                    report(node.right);
                    return;
                }

                if (isConsoleMethodReference(node.right)) {
                    report(node.right);
                    return;
                }

                if (isConsoleBindCall(node.right)) {
                    report(node.right);
                }
            },
        };
    },
};
