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

const rule = {
    create(context: RuleContext) {
        const sourceCode = context.getSourceCode();

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
                            return fixer.replaceText(
                                node,
                                "return VOID_PROMISE",
                            );
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

            const hasIsErrorProperty =
                argument.type === "ObjectExpression" &&
                Array.isArray(argument.properties) &&
                argument.properties.some(
                    (property) =>
                        isNode(property) &&
                        property.type === "Property" &&
                        isNode(property.key) &&
                        property.key.type === "Identifier" &&
                        property.key.name === "isError",
                );

            if (!hasIsErrorProperty) {
                context.report({
                    node: argument,
                    messageId: "wrapReturn",
                    fix(fixer) {
                        const argumentText = sourceCode.getText(argument);
                        return fixer.replaceText(
                            argument,
                            `{ value: ${argumentText}, isError: false }`,
                        );
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

            const hasCorrectReturn = catchBody.some(
                (statement) =>
                    statement.type === "ReturnStatement" &&
                    isNode(statement.argument) &&
                    statement.argument.type === "Identifier" &&
                    statement.argument.name === "FAILED_PROMISE",
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
                            return fixer.replaceText(
                                lastStatement,
                                "return FAILED_PROMISE",
                            );
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

                        return fixer.insertTextBeforeRange(
                            [bodyRange.range[1] - 1, bodyRange.range[1] - 1],
                            "return FAILED_PROMISE; ",
                        );
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
            wrapReturn:
                "Wrap return value with { value: value, isError: false }.",
            returnVoidPromise:
                "Return VOID_PROMISE for async functions with Promise<void> return type.",
            returnFailedPromise:
                "Return FAILED_PROMISE in catch block of async functions.",
        },
    },
};

export { rule as errorSafeAsyncRule };
