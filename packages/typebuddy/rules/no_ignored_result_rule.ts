type AstNode = {
    type: string;
    body?: unknown;
    parent?: AstNode;
    [key: string]: unknown;
};

type RuleContext = {
    getSourceCode(): {
        getText(node: unknown): string;
    };
    report(descriptor: {
        node: unknown;
        messageId: string;
        data: { call: string };
    }): void;
};

const RESULT_TYPE_NAMES = new Set(["AsyncResult", "MaybePromise", "Result"]);

const PACKAGE_RESULT_SOURCES = new Set([
    "@murky-web/typebuddy",
    "@murky-web/typebuddy/async",
    "@murky-web/typebuddy/result"
]);

const RESULT_HELPER_EXPORTS = new Set([
    "allResults",
    "err",
    "fromPromise",
    "fromTry",
    "mapError",
    "mapResult",
    "ok",
    "withRetry",
    "withTimeout"
]);

function isNode(value: unknown): value is AstNode {
    return typeof value === "object" && value !== null && "type" in value;
}

function getStringLiteralValue(node: unknown): string | null {
    if (!isNode(node)) {
        return null;
    }

    if (
        (node.type === "Literal" || node.type === "StringLiteral") &&
        typeof node["value"] === "string"
    ) {
        return node["value"];
    }

    return null;
}

function getReturnTypeName(fnNode: AstNode): string | null {
    const returnType = fnNode["returnType"];
    if (!isNode(returnType)) {
        return null;
    }
    const annotation = returnType["typeAnnotation"];
    if (!isNode(annotation) || annotation.type !== "TSTypeReference") {
        return null;
    }
    const typeName = annotation["typeName"];
    if (
        !isNode(typeName) ||
        typeName.type !== "Identifier" ||
        typeof typeName["name"] !== "string"
    ) {
        return null;
    }

    return typeName["name"];
}

function collectImportedResultHelpers(program: AstNode): Set<string> {
    const names = new Set<string>();
    const body = program["body"];
    if (!Array.isArray(body)) {
        return names;
    }

    for (const statement of body) {
        if (!isNode(statement) || statement.type !== "ImportDeclaration") {
            continue;
        }
        if (statement["importKind"] === "type") {
            continue;
        }
        const source = getStringLiteralValue(statement["source"]);
        if (source === null || !PACKAGE_RESULT_SOURCES.has(source)) {
            continue;
        }
        const specifiers = statement["specifiers"];
        if (!Array.isArray(specifiers)) {
            continue;
        }
        for (const specifier of specifiers) {
            if (
                !isNode(specifier) ||
                specifier.type !== "ImportSpecifier" ||
                specifier["importKind"] === "type"
            ) {
                continue;
            }
            const imported = specifier["imported"];
            const local = specifier["local"];
            const importedName =
                isNode(imported) &&
                imported.type === "Identifier" &&
                typeof imported["name"] === "string"
                    ? imported["name"]
                    : getStringLiteralValue(imported);
            const localName =
                isNode(local) &&
                local.type === "Identifier" &&
                typeof local["name"] === "string"
                    ? local["name"]
                    : null;
            if (
                importedName !== null &&
                localName !== null &&
                RESULT_HELPER_EXPORTS.has(importedName)
            ) {
                names.add(localName);
            }
        }
    }

    return names;
}

function unwrapCallExpression(expression: unknown): AstNode | null {
    if (!isNode(expression)) {
        return null;
    }

    if (
        expression.type === "AwaitExpression" ||
        expression.type === "ParenthesizedExpression" ||
        expression.type === "ChainExpression"
    ) {
        return unwrapCallExpression(
            expression["argument"] ?? expression["expression"]
        );
    }

    if (expression.type === "CallExpression") {
        return expression;
    }

    return null;
}

const rule = {
    create(context: RuleContext) {
        const sourceCode = context.getSourceCode();
        const trackedNames = new Set<string>();
        const shadowedNonResultNames = new Set<string>();
        const pendingStatements: AstNode[] = [];

        function registerDeclaredFunction(name: string, fnNode: AstNode) {
            const ret = getReturnTypeName(fnNode);
            if (ret !== null && RESULT_TYPE_NAMES.has(ret)) {
                trackedNames.add(name);
            } else {
                shadowedNonResultNames.add(name);
            }
        }

        return {
            Program(node: AstNode) {
                for (const imported of collectImportedResultHelpers(node)) {
                    trackedNames.add(imported);
                }
            },
            FunctionDeclaration(node: AstNode) {
                if (
                    isNode(node["id"]) &&
                    typeof node["id"]["name"] === "string"
                ) {
                    registerDeclaredFunction(node["id"]["name"], node);
                }
            },
            TSDeclareFunction(node: AstNode) {
                if (
                    isNode(node["id"]) &&
                    typeof node["id"]["name"] === "string"
                ) {
                    registerDeclaredFunction(node["id"]["name"], node);
                }
            },
            VariableDeclarator(node: AstNode) {
                if (
                    !isNode(node["id"]) ||
                    node["id"].type !== "Identifier" ||
                    typeof node["id"]["name"] !== "string"
                ) {
                    return;
                }
                const init = node["init"];
                if (
                    isNode(init) &&
                    (init.type === "ArrowFunctionExpression" ||
                        init.type === "FunctionExpression")
                ) {
                    registerDeclaredFunction(node["id"]["name"], init);
                }
            },
            ExpressionStatement(node: AstNode) {
                pendingStatements.push(node);
            },
            "Program:exit"() {
                for (const statement of pendingStatements) {
                    const call = unwrapCallExpression(statement["expression"]);
                    if (!call) {
                        continue;
                    }

                    const callee = call["callee"];
                    if (
                        !isNode(callee) ||
                        callee.type !== "Identifier" ||
                        typeof callee["name"] !== "string"
                    ) {
                        continue;
                    }

                    const name = callee["name"];
                    if (
                        !trackedNames.has(name) ||
                        shadowedNonResultNames.has(name)
                    ) {
                        continue;
                    }

                    context.report({
                        node: statement,
                        messageId: "ignoredResult",
                        data: {
                            call: sourceCode.getText(statement["expression"])
                        }
                    });
                }
            }
        };
    },
    defaultOptions: [],
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow ignoring a `Result` or `AsyncResult` return value."
        },
        schema: [],
        messages: {
            ignoredResult:
                "`{{call}}` returns a `Result` / `AsyncResult` whose error state is discarded. Fix: bind it and check `if (isErr(result))` / `if (isSuccess(result))`, return it to the caller, or explicitly discard with `void` if the failure truly does not matter."
        }
    }
};

export { rule as noIgnoredResultRule };
