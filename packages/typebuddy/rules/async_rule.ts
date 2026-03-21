type AstNode = {
    type: string;
    body?: AstNode | AstNode[];
    async?: boolean;
    parent?: AstNode;
    range?: [number, number];
    [key: string]: unknown;
};

type RuleContext = {
    getSourceCode(): { getText(node: unknown): string };
    report(descriptor: {
        node: unknown;
        messageId: string;
        fix(fixer: {
            replaceText(node: unknown, text: string): unknown;
        }): unknown;
    }): void;
};

function hasTryCatch(nodes: AstNode[]): boolean {
    return nodes.some((node) => {
        return node.type === "TryStatement";
    });
}

function isCallArgumentCallback(node: AstNode): boolean {
    const parent = node.parent;
    if (!parent) {
        return false;
    }

    if (parent.type !== "CallExpression" && parent.type !== "NewExpression") {
        return false;
    }

    return Array.isArray(parent.arguments) && parent.arguments.includes(node);
}

const rule = {
    create(context: RuleContext) {
        const sourceCode = context.getSourceCode();

        function getIndentation(node: AstNode): string {
            const lines = sourceCode.getText(node).split("\n");
            const firstLine = lines[0];
            const match = /^\s*/.exec(firstLine);
            return match ? match[0] : "";
        }

        function wrapInTryCatch(node: AstNode): string {
            const body = Array.isArray(node.body) ? node.body : [];
            const indent = getIndentation(node);
            const innerIndent = `${indent}  `;
            const bodyText = body
                .map((statement) => {
                    const text = sourceCode.getText(statement);
                    return `${innerIndent}${text.replaceAll(/^\s*/gm, "")}`;
                })
                .join("\n");

            return `{
${indent}try {
${bodyText}
${indent}} catch (err) {
${innerIndent}return { isError: true, value: null };
${indent}}
}`;
        }

        function checkFunction(node: AstNode) {
            if (node.async !== true) return;
            if (isCallArgumentCallback(node)) return;
            const bodyNode = node.body;
            if (
                !bodyNode ||
                Array.isArray(bodyNode) ||
                bodyNode.type !== "BlockStatement"
            ) {
                return;
            }

            const body = Array.isArray(bodyNode.body) ? bodyNode.body : [];
            if (hasTryCatch(body)) return;

            context.report({
                node,
                messageId: "missingTryCatch",
                fix(fixer) {
                    return fixer.replaceText(
                        bodyNode,
                        wrapInTryCatch(bodyNode),
                    );
                },
            });
        }

        return {
            FunctionDeclaration: checkFunction,
            FunctionExpression: checkFunction,
            ArrowFunctionExpression: checkFunction,
        };
    },
    defaultOptions: [],
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Async functions should have a try-catch block returning an error result.",
        },
        fixable: "code",
        schema: [],
        messages: {
            missingTryCatch:
                "Async functions must have a try-catch block returning an error result.",
        },
    },
};

export { rule as requireTryCatchAsyncRule };
