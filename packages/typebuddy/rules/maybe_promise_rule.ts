import { throwsDeliberately } from "./deliberate_throw.js";
import { getTypeBuddyImportInsertion } from "./typebuddy_import.js";
import { walkOwnSubtree } from "./own_subtree.js";

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
        fix?(fixer: {
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
    return node["async"] === true;
}

function hasTypeParameters(value: unknown): value is { params: unknown[] } {
    return isNode(value) && Array.isArray(value["params"]);
}

function isCallArgumentCallback(node: AstNode): boolean {
    const parent = node.parent;
    if (!parent) {
        return false;
    }

    if (parent.type !== "CallExpression" && parent.type !== "NewExpression") {
        return false;
    }

    return (
        Array.isArray(parent["arguments"]) && parent["arguments"].includes(node)
    );
}

/**
 * Return-type names whose type argument is the value an async function settles
 * on. `AsyncResult` is the preferred spelling of `MaybePromise`, so a function
 * annotated with it has to be read the same way — otherwise the rule goes blind
 * on exactly the code the package tells people to write.
 */
const AWAITED_TYPE_NAMES = new Set(["AsyncResult", "MaybePromise", "Promise"]);

function isAmbient(node: AstNode): boolean {
    let current: AstNode | undefined = node;

    while (current) {
        if (current["declare"] === true) {
            return true;
        }
        current = current.parent;
    }

    return false;
}

function isIdentifierNamed(node: unknown, name: string): boolean {
    return isNode(node) && node.type === "Identifier" && node["name"] === name;
}

function isResultHelperCall(node: unknown, name: "ok" | "err"): boolean {
    return (
        isNode(node) &&
        node.type === "CallExpression" &&
        isIdentifierNamed(node["callee"], name)
    );
}

function hasIsErrorFlag(node: unknown, expected: boolean): boolean {
    if (
        !isNode(node) ||
        node.type !== "ObjectExpression" ||
        !Array.isArray(node["properties"])
    ) {
        return false;
    }

    return node["properties"].some((property) => {
        return (
            isNode(property) &&
            property.type === "Property" &&
            isIdentifierNamed(property["key"], "isError") &&
            isNode(property["value"]) &&
            property["value"].type === "Literal" &&
            property["value"]["value"] === expected
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
        !Array.isArray(node["properties"])
    ) {
        return null;
    }

    for (const property of node["properties"]) {
        if (
            isNode(property) &&
            property.type === "Property" &&
            isIdentifierNamed(property["key"], propertyName) &&
            isNode(property["value"])
        ) {
            return property["value"];
        }
    }

    return null;
}

function isBooleanLiteral(node: unknown, expected: boolean): boolean {
    return (
        isNode(node) && node.type === "Literal" && node["value"] === expected
    );
}

function isNullLiteral(node: unknown): boolean {
    return isNode(node) && node.type === "Literal" && node["value"] === null;
}

const rule = {
    create(context: RuleContext) {
        const sourceCode = context.getSourceCode();
        const scheduledHelperImports = new Set<"ok" | "err">();

        function isTypeReference(node: unknown): node is AstNode {
            return isNode(node) && node.type === "TSTypeReference";
        }

        function getTypeName(node: AstNode): string | null {
            const typeName = node["typeName"];
            if (!isNode(typeName) || typeName.type !== "Identifier")
                return null;
            return typeof typeName["name"] === "string"
                ? typeName["name"]
                : null;
        }

        function getTypeArgument(node: AstNode): AstNode | null {
            const typeArguments = node["typeArguments"];
            if (!hasTypeParameters(typeArguments)) return null;
            const [firstParam] = typeArguments.params;
            if (!isNode(firstParam)) return null;
            return firstParam;
        }

        /**
         * The awaited type behind an async function's return annotation.
         *
         * Every spelling counts. Matching only `Promise` meant the rule read the
         * return type of code it had not migrated yet and went blind the moment
         * `MaybePromise` was there — so a bare `return;` in a
         * `MaybePromise<void>` function never became `return ok();`, while the
         * identical `Promise<void>` function was fixed. It only ever worked
         * because the rename and this lookup happen in the same pass, off the
         * same AST.
         */
        function getAwaitedTypeArgument(node: AstNode): AstNode | null {
            const typeName = getTypeName(node);
            if (typeName === null || !AWAITED_TYPE_NAMES.has(typeName)) {
                return null;
            }

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

            const insertion = getTypeBuddyImportInsertion(node, helperName);
            if (!insertion) {
                return [];
            }

            scheduledHelperImports.add(helperName);

            return [
                fixer.insertTextBeforeRange(insertion.range, insertion.text),
            ];
        }

        function reportPromiseReturnType(node: AstNode) {
            if (!isNode(node["returnType"])) return;

            const typeAnnotation = node["returnType"]["typeAnnotation"];
            if (!isTypeReference(typeAnnotation)) return;
            if (getTypeName(typeAnnotation) !== "Promise") return;

            const typeName = typeAnnotation["typeName"];
            context.report({
                node: typeName,
                messageId: "replaceWithMaybePromise",
                fix(fixer) {
                    return fixer.replaceText(typeName, "MaybePromise");
                },
            });
        }

        function checkReturnType(node: AstNode) {
            if (!isAsyncFunction(node)) return;
            if (isCallArgumentCallback(node)) return;
            // Same exemption as `require-try-catch`: a deliberate throw is not a
            // result waiting to be wrapped.
            if (throwsDeliberately(node["body"])) return;

            reportPromiseReturnType(node);
        }

        /**
         * A type-level signature — an interface method, a function type, an
         * overload — can never carry `async`, so routing it through
         * `checkReturnType` meant these three visitors never fired at all.
         * `Promise<T>` in a signature is the same contract the rule rewrites
         * everywhere else, so it gets reported here without the async gate.
         *
         * Ambient declarations are the exception: `declare` describes code the
         * project does not own, and rewriting a third-party framework's
         * callback shape to `MaybePromise` would be a lie about that API.
         */
        function checkSignatureReturnType(node: AstNode) {
            if (isAmbient(node)) return;

            reportPromiseReturnType(node);
        }

        function wrapReturnValue(
            node: AstNode,
            isAsync: boolean,
            returnType: AstNode | null,
        ) {
            if (!isAsync) return;

            const argument = node["argument"];
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
                (argument["name"] === "VOID_PROMISE" ||
                    argument["name"] === "FAILED_PROMISE")
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

        function collectOwnReturns(root: unknown): AstNode[] {
            const returns: AstNode[] = [];

            walkOwnSubtree(root, (candidate) => {
                if (candidate.type === "TryStatement") {
                    return false;
                }

                if (candidate.type === "ReturnStatement") {
                    returns.push(candidate);
                }

                return true;
            });

            return returns;
        }

        function isSettledFailure(argument: unknown): boolean {
            return (
                (isNode(argument) &&
                    argument.type === "Identifier" &&
                    argument["name"] === "FAILED_PROMISE") ||
                isResultHelperCall(argument, "err")
            );
        }

        /**
         * Push a single `return` inside a catch block towards `err()`.
         *
         * Only the lossless rewrites carry a fix. Replacing
         * `return ok("defaults")` with `return err()` would silently drop the
         * author's fallback, and the old behaviour — appending `return err()`
         * after it — produced unreachable code and a report that could never be
         * satisfied. Where the fallback matters, moving it into the try block is
         * a decision the author has to make, so the rule reports and stops.
         */
        function reportCatchReturn(tryNode: AstNode, statement: AstNode) {
            const argument = statement["argument"];

            if (isSettledFailure(argument)) return;

            // `return;` — adding the result is pure addition, nothing is lost.
            if (!isNode(argument)) {
                context.report({
                    node: statement,
                    messageId: "returnFailedPromise",
                    fix(fixer) {
                        return [
                            ...ensureResultHelperImportFixes(
                                tryNode,
                                fixer,
                                "err",
                            ),
                            fixer.replaceText(statement, "return err()"),
                        ];
                    },
                });
                return;
            }

            if (hasIsErrorFlag(argument, true)) {
                // `{ isError: true, value: null }` says the right thing the
                // long way round; `err()` is the same value.
                if (isNullLiteral(getObjectPropertyValue(argument, "value"))) {
                    context.report({
                        node: argument,
                        messageId: "preferErrResult",
                        fix(fixer) {
                            return [
                                ...ensureResultHelperImportFixes(
                                    tryNode,
                                    fixer,
                                    "err",
                                ),
                                fixer.replaceText(argument, "err()"),
                            ];
                        },
                    });
                }
                return;
            }

            context.report({
                node: statement,
                messageId: "returnFailedPromise",
            });
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
                    isAsync = parent["async"] === true;
                    parentFunction = parent;
                    break;
                }
                parent = parent.parent;
            }

            if (!isAsync || !parentFunction) return;
            if (isCallArgumentCallback(parentFunction)) return;
            if (throwsDeliberately(parentFunction["body"])) return;

            let returnType: AstNode | null = null;
            if (isNode(parentFunction["returnType"])) {
                const typeAnnotation =
                    parentFunction["returnType"]["typeAnnotation"];
                if (isTypeReference(typeAnnotation)) {
                    returnType = getAwaitedTypeArgument(typeAnnotation);
                }
            }

            // Every return the try block owns, not just the ones sitting
            // directly in it. `try { if (flag) return "early"; return "late"; }`
            // used to have only `"late"` wrapped, because the walk never looked
            // inside the `if`.
            //
            // A nested `try` is left alone: the visitor fires for it separately,
            // and its own catch branch has to stay the failure path rather than
            // be read as another try-block return.
            for (const statement of collectOwnReturns(node["block"])) {
                wrapReturnValue(statement, isAsync, returnType);
            }

            const handler = node["handler"];
            if (!isNode(handler) || !isNode(handler["body"])) return;

            // The catch branch is the failure path, and it settles on `err()`
            // — nothing else. A default belongs in the try block, where the
            // absence is read as a value instead of being recovered from a
            // throw. So a catch return is never offered `ok(...)`; feeding both
            // suggestions to the same statement used to produce two reports
            // with opposite fixes.
            const catchReturns = collectOwnReturns(handler["body"]);

            for (const statement of catchReturns) {
                reportCatchReturn(node, statement);
            }

            // A nested try/catch inside this catch settles the branch on its
            // own, so its returns count here even though `collectOwnReturns`
            // hands them to the inner `processTryCatch`. Appending another
            // `return err()` after them would be unreachable.
            let settlesItself = false;
            walkOwnSubtree(handler["body"], (candidate) => {
                if (candidate.type === "ReturnStatement") {
                    settlesItself = true;
                }
            });

            if (settlesItself) return;

            context.report({
                node: handler,
                messageId: "returnFailedPromise",
                fix(fixer) {
                    const handlerBody = handler["body"];
                    if (
                        !isNode(handlerBody) ||
                        !Array.isArray(handlerBody["range"])
                    ) {
                        return null;
                    }

                    return [
                        ...ensureResultHelperImportFixes(node, fixer, "err"),
                        fixer.insertTextBeforeRange(
                            [
                                handlerBody["range"][1] - 1,
                                handlerBody["range"][1] - 1,
                            ],
                            // The newline matters: `catch { log() }` would
                            // otherwise become `catch { log() return err(); }`,
                            // which does not parse.
                            "\nreturn err();\n",
                        ),
                    ];
                },
            });
        }

        return {
            FunctionDeclaration: checkReturnType,
            FunctionExpression: checkReturnType,
            ArrowFunctionExpression: checkReturnType,
            TSDeclareFunction: checkSignatureReturnType,
            TSFunctionType: checkSignatureReturnType,
            TSMethodSignature: checkSignatureReturnType,
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
