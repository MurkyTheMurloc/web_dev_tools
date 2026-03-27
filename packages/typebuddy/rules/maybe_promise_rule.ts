type AstNode = {
    type: string;
    parent?: AstNode;
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

function isAsyncFunction(node: AstNode): boolean {
    return node.async === true;
}

function hasTypeParameters(value: unknown): value is { params: unknown[] } {
    return isNode(value) && Array.isArray(value.params);
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

function isIdentifierNamed(node: unknown, name: string): boolean {
    return isNode(node) && node.type === "Identifier" && node.name === name;
}

function getProgram(node: AstNode): AstNode | null {
    let current: AstNode | undefined = node;

    while (current?.parent) {
        current = current.parent;
    }

    return current?.type === "Program" ? current : null;
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

function isResultHelperCall(node: unknown, name: "ok" | "err"): boolean {
    return (
        isNode(node) &&
        node.type === "CallExpression" &&
        isIdentifierNamed(node.callee, name)
    );
}

function hasIsErrorFlag(node: unknown, expected: boolean): boolean {
    if (
        !isNode(node) ||
        node.type !== "ObjectExpression" ||
        !Array.isArray(node.properties)
    ) {
        return false;
    }

    return node.properties.some((property) => {
        return (
            isNode(property) &&
            property.type === "Property" &&
            isIdentifierNamed(property.key, "isError") &&
            isNode(property.value) &&
            property.value.type === "Literal" &&
            property.value.value === expected
        );
    });
}

function getObjectPropertyValue(
    node: unknown,
    propertyName: string,
): AstNode | null {
    if (
        !isNode(node) ||
        node.type !== "ObjectExpression" ||
        !Array.isArray(node.properties)
    ) {
        return null;
    }

    for (const property of node.properties) {
        if (
            isNode(property) &&
            property.type === "Property" &&
            isIdentifierNamed(property.key, propertyName) &&
            isNode(property.value)
        ) {
            return property.value;
        }
    }

    return null;
}

function isBooleanLiteral(node: unknown, expected: boolean): boolean {
    return isNode(node) && node.type === "Literal" && node.value === expected;
}

function isNullLiteral(node: unknown): boolean {
    return isNode(node) && node.type === "Literal" && node.value === null;
}

function hasTypeBuddyHelperImport(program: AstNode, helperName: "ok" | "err") {
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

const rule = {
    create(context: RuleContext) {
        const sourceCode = context.getSourceCode();
        const scheduledHelperImports = new Set<"ok" | "err">();

        function isTypeReference(node: unknown): node is AstNode {
            return isNode(node) && node.type === "TSTypeReference";
        }

        function getTypeName(node: AstNode): string | null {
            const typeName = node.typeName;
            if (!isNode(typeName) || typeName.type !== "Identifier")
                return null;
            return typeof typeName.name === "string" ? typeName.name : null;
        }

        function getTypeArgument(node: AstNode): AstNode | null {
            const typeArguments = node.typeArguments;
            if (!hasTypeParameters(typeArguments)) return null;
            const [firstParam] = typeArguments.params;
            if (!isNode(firstParam)) return null;
            return firstParam;
        }

        function getPromiseTypeArgument(node: AstNode): AstNode | null {
            if (getTypeName(node) !== "Promise") return null;
            return getTypeArgument(node);
        }

        function ensureResultHelperImportFixes(
            node: AstNode,
            fixer: RuleFixer,
            helperName: "ok" | "err",
        ): unknown[] {
            if (scheduledHelperImports.has(helperName)) {
                return [];
            }

            const program = getProgram(node);
            if (!program || hasTypeBuddyHelperImport(program, helperName)) {
                return [];
            }

            const insertRange = getTypeBuddyImportInsertRange(program);
            if (!insertRange) {
                return [];
            }

            scheduledHelperImports.add(helperName);

            const hasImports = insertRange[0] !== 0;
            const importText = hasImports
                ? `\nimport { ${helperName} } from "@murky-web/typebuddy";`
                : `import { ${helperName} } from "@murky-web/typebuddy";\n`;

            return [fixer.insertTextBeforeRange(insertRange, importText)];
        }

        function checkReturnType(node: AstNode) {
            if (!isAsyncFunction(node)) return;
            if (isCallArgumentCallback(node)) return;
            if (!isNode(node.returnType)) return;

            const typeAnnotation = node.returnType.typeAnnotation;
            if (!isTypeReference(typeAnnotation)) return;
            if (getTypeName(typeAnnotation) !== "Promise") return;

            const typeName = typeAnnotation.typeName;
            context.report({
                node: typeName,
                messageId: "replaceWithMaybePromise",
                fix(fixer) {
                    return fixer.replaceText(typeName, "MaybePromise");
                },
            });
        }

        function wrapReturnValue(
            node: AstNode,
            isAsync: boolean,
            returnType: AstNode | null,
        ) {
            if (!isAsync) return;

            const argument = node.argument;
            if (!isNode(argument)) {
                if (returnType?.type === "TSVoidKeyword") {
                    context.report({
                        node,
                        messageId: "returnVoidPromise",
                        fix(fixer) {
                            return [
                                ...ensureResultHelperImportFixes(
                                    node,
                                    fixer,
                                    "ok",
                                ),
                                fixer.replaceText(node, "return ok()"),
                            ];
                        },
                    });
                }
                return;
            }

            if (
                argument.type === "Identifier" &&
                (argument.name === "VOID_PROMISE" ||
                    argument.name === "FAILED_PROMISE")
            ) {
                return;
            }

            if (
                isResultHelperCall(argument, "ok") ||
                isResultHelperCall(argument, "err")
            ) {
                return;
            }

            const isErrorValue = getObjectPropertyValue(argument, "isError");
            const objectValue = getObjectPropertyValue(argument, "value");

            if (isBooleanLiteral(isErrorValue, false) && objectValue) {
                context.report({
                    node: argument,
                    messageId: "preferOkResult",
                    fix(fixer) {
                        const valueText = sourceCode.getText(objectValue);
                        return [
                            ...ensureResultHelperImportFixes(node, fixer, "ok"),
                            fixer.replaceText(argument, `ok(${valueText})`),
                        ];
                    },
                });
                return;
            }

            if (
                isBooleanLiteral(isErrorValue, true) &&
                isNullLiteral(objectValue)
            ) {
                context.report({
                    node: argument,
                    messageId: "preferErrResult",
                    fix(fixer) {
                        return [
                            ...ensureResultHelperImportFixes(
                                node,
                                fixer,
                                "err",
                            ),
                            fixer.replaceText(argument, "err()"),
                        ];
                    },
                });
                return;
            }

            if (
                !hasIsErrorFlag(argument, true) &&
                !hasIsErrorFlag(argument, false)
            ) {
                context.report({
                    node: argument,
                    messageId: "wrapReturn",
                    fix(fixer) {
                        const argumentText = sourceCode.getText(argument);
                        return [
                            ...ensureResultHelperImportFixes(node, fixer, "ok"),
                            fixer.replaceText(argument, `ok(${argumentText})`),
                        ];
                    },
                });
            }
        }

        function processTryCatch(node: AstNode) {
            let parent = node.parent;
            let isAsync = false;
            let parentFunction: AstNode | null = null;

            while (parent) {
                if (
                    parent.type === "FunctionDeclaration" ||
                    parent.type === "FunctionExpression" ||
                    parent.type === "ArrowFunctionExpression"
                ) {
                    isAsync = parent.async === true;
                    parentFunction = parent;
                    break;
                }
                parent = parent.parent;
            }

            if (!isAsync || !parentFunction) return;
            if (isCallArgumentCallback(parentFunction)) return;

            let returnType: AstNode | null = null;
            if (isNode(parentFunction.returnType)) {
                const typeAnnotation = parentFunction.returnType.typeAnnotation;
                if (isTypeReference(typeAnnotation)) {
                    returnType = getPromiseTypeArgument(typeAnnotation);
                }
            }

            const blockBody =
                isNode(node.block) && Array.isArray(node.block.body)
                    ? node.block.body
                    : [];
            for (const statement of blockBody) {
                if (isNode(statement) && statement.type === "ReturnStatement") {
                    wrapReturnValue(statement, isAsync, returnType);
                }
            }

            if (!isNode(node.handler) || !isNode(node.handler.body)) return;
            const catchBody = Array.isArray(node.handler.body.body)
                ? node.handler.body.body.filter(isNode)
                : [];

            for (const statement of catchBody) {
                if (
                    statement.type === "ReturnStatement" &&
                    isNode(statement.argument)
                ) {
                    wrapReturnValue(statement, isAsync, returnType);
                }
            }

            const hasCorrectReturn = catchBody.some(
                (statement) =>
                    statement.type === "ReturnStatement" &&
                    isNode(statement.argument) &&
                    ((statement.argument.type === "Identifier" &&
                        statement.argument.name === "FAILED_PROMISE") ||
                        isResultHelperCall(statement.argument, "err") ||
                        hasIsErrorFlag(statement.argument, true)),
            );

            if (!hasCorrectReturn) {
                context.report({
                    node: node.handler,
                    messageId: "returnFailedPromise",
                    fix(fixer) {
                        const lastStatement = catchBody.at(-1);
                        if (
                            lastStatement?.type === "ReturnStatement" &&
                            isNode(lastStatement.argument) &&
                            lastStatement.argument.type === "ObjectExpression"
                        ) {
                            return [
                                ...ensureResultHelperImportFixes(
                                    node,
                                    fixer,
                                    "err",
                                ),
                                fixer.replaceText(
                                    lastStatement,
                                    "return err()",
                                ),
                            ];
                        }

                        const handler = node.handler;
                        if (!isNode(handler)) {
                            return null;
                        }

                        const bodyRange = handler.body;
                        if (
                            !isNode(bodyRange) ||
                            !Array.isArray(bodyRange.range)
                        ) {
                            return null;
                        }

                        return [
                            ...ensureResultHelperImportFixes(
                                node,
                                fixer,
                                "err",
                            ),
                            fixer.insertTextBeforeRange(
                                [
                                    bodyRange.range[1] - 1,
                                    bodyRange.range[1] - 1,
                                ],
                                "return err(); ",
                            ),
                        ];
                    },
                });
            }
        }

        return {
            FunctionDeclaration: checkReturnType,
            FunctionExpression: checkReturnType,
            ArrowFunctionExpression: checkReturnType,
            TSDeclareFunction: checkReturnType,
            TSFunctionType: checkReturnType,
            TSMethodSignature: checkReturnType,
            TryStatement: processTryCatch,
        };
    },
    defaultOptions: [],
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Ensure async functions' return values follow the MaybePromise pattern.",
        },
        fixable: "code",
        schema: [],
        messages: {
            replaceWithMaybePromise:
                "Use 'MaybePromise' instead of 'Promise' as the return type in async functions.",
            wrapReturn: "Wrap return value with ok(value).",
            preferOkResult:
                "Use ok(value) instead of an inline success result object.",
            preferErrResult:
                "Use err() instead of an inline error result object.",
            returnVoidPromise:
                "Return ok() for async functions with Promise<void> return type.",
            returnFailedPromise:
                "Return err() in the catch block of async functions.",
        },
    },
};

export { rule as errorSafeAsyncRule };
