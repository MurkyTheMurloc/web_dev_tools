type AstNode = {
    type: string;
    expression?: unknown;
    typeAnnotation?: unknown;
    [key: string]: unknown;
};

type RuleContext = {
    getSourceCode(): {
        getText(node: unknown): string;
    };
    report(descriptor: {
        node: unknown;
        messageId: string;
        data: { code: string };
    }): void;
};

function isNode(value: unknown): value is AstNode {
    return typeof value === "object" && value !== null && "type" in value;
}

function unwrapParens(node: unknown): AstNode | null {
    if (!isNode(node)) {
        return null;
    }

    if (
        node.type === "ParenthesizedExpression" ||
        node.type === "ChainExpression"
    ) {
        return unwrapParens(node["expression"]);
    }

    return node;
}

function isAssertionNode(node: AstNode): boolean {
    return node.type === "TSAsExpression" || node.type === "TSTypeAssertion";
}

function isEscapeHatchType(typeNode: unknown): boolean {
    return (
        isNode(typeNode) &&
        (typeNode.type === "TSUnknownKeyword" ||
            typeNode.type === "TSAnyKeyword")
    );
}

const rule = {
    create(context: RuleContext) {
        const sourceCode = context.getSourceCode();

        function checkAssertion(node: AstNode) {
            const inner = unwrapParens(node["expression"]);
            if (!inner || !isAssertionNode(inner)) {
                return;
            }

            if (!isEscapeHatchType(inner["typeAnnotation"])) {
                return;
            }

            context.report({
                node,
                messageId: "noDoubleAssertion",
                data: { code: sourceCode.getText(node) }
            });
        }

        return {
            TSAsExpression: checkAssertion,
            TSTypeAssertion: checkAssertion
        };
    },
    defaultOptions: [],
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow double type assertions through `unknown` or `any` (`x as unknown as T`)."
        },
        schema: [],
        messages: {
            noDoubleAssertion:
                "`{{code}}` casts through `unknown` or `any` to bypass type checking. Fix: validate at the boundary with a type guard (e.g. `createBrandGuard` or `@murky-web/typebuddy/guards`) or fix the upstream type instead of double-casting."
        }
    }
};

export { rule as noDoubleTypeAssertionRule };
