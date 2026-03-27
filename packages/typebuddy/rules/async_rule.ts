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
            insertTextBeforeRange(
                range: [number, number],
                text: string,
            ): unknown;
        }): unknown;
    }): void;
};

type RuleFixer = {
    replaceText(node: unknown, text: string): unknown;
    insertTextBeforeRange(range: [number, number], text: string): unknown;
};

function isNode(value: unknown): value is AstNode {
    return typeof value === "object" && value !== null && "type" in value;
}

function getProgram(node: AstNode): AstNode | null {
    let current: AstNode | undefined = node;

    while (current?.parent) {
        current = current.parent;
    }

    return current?.type === "Program" ? current : null;
}

function isIdentifierNamed(node: unknown, name: string): boolean {
    return isNode(node) && node.type === "Identifier" && node.name === name;
}

function isImportDeclaration(node: unknown): node is AstNode {
    return isNode(node) && node.type === "ImportDeclaration";
}

function getStringLiteralValue(node: unknown): string | null {
    if (!isNode(node)) {
        return null;
    }

    if (
        (node.type === "Literal" || node.type === "StringLiteral") &&
        typeof node.value === "string"
    ) {
        return node.value;
    }

    return null;
}

function getProgramBody(node: AstNode): AstNode[] {
    if (!Array.isArray(node.body)) {
        return [];
    }

    return node.body.filter(isNode);
}

function hasTypeBuddyHelperImport(program: AstNode, helperName: "err") {
    return getProgramBody(program).some((statement) => {
        if (!isImportDeclaration(statement)) {
            return false;
        }

        if (
            getStringLiteralValue(statement.source) !== "@murky-web/typebuddy"
        ) {
            return false;
        }

        if (statement.importKind === "type") {
            return false;
        }

        const specifiers = Array.isArray(statement.specifiers)
            ? statement.specifiers
            : [];

        return specifiers.some((specifier) => {
            return (
                isNode(specifier) &&
                specifier.type === "ImportSpecifier" &&
                isIdentifierNamed(specifier.local, helperName)
            );
        });
    });
}

function getTypeBuddyImportInsertRange(
    program: AstNode,
): [number, number] | null {
    const body = getProgramBody(program);
    const imports = body.filter(isImportDeclaration);
    const anchor = imports.at(-1) ?? body[0] ?? program;

    if (!Array.isArray(anchor.range) || anchor.range.length < 2) {
        return null;
    }

    if (imports.length > 0) {
        return [anchor.range[1], anchor.range[1]];
    }

    return [anchor.range[0], anchor.range[0]];
}

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
        let scheduledErrImport = false;

        function ensureErrImportFixes(
            node: AstNode,
            fixer: RuleFixer,
        ): unknown[] {
            if (scheduledErrImport) {
                return [];
            }

            const program = getProgram(node);
            if (!program || hasTypeBuddyHelperImport(program, "err")) {
                return [];
            }

            const insertRange = getTypeBuddyImportInsertRange(program);
            if (!insertRange) {
                return [];
            }

            scheduledErrImport = true;

            const hasImports = insertRange[0] !== 0;
            const importText = hasImports
                ? '\nimport { err } from "@murky-web/typebuddy";'
                : 'import { err } from "@murky-web/typebuddy";\n';

            return [fixer.insertTextBeforeRange(insertRange, importText)];
        }

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
${indent}} catch {
${innerIndent}return err();
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
                    return [
                        ...ensureErrImportFixes(node, fixer),
                        fixer.replaceText(bodyNode, wrapInTryCatch(bodyNode)),
                    ];
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
