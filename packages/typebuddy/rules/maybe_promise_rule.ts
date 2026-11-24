import { throwsDeliberately } from "./deliberate_throw.js";
import { walkOwnSubtree } from "./own_subtree.js";
import { canAddImport, createImportPlanner } from "./typebuddy_import.js";
import { createUseServerGuard } from "./use_server.js";

type AstNode = {
    type: string;
    parent?: AstNode;
    [key: string]: unknown;
};

type RuleFixer = {
    replaceText(node: unknown, text: string): unknown;
    insertTextBeforeRange(range: [number, number], text: string): unknown;
};

type RuleSuggestion = {
    messageId: string;
    fix(fixer: RuleFixer): unknown;
};

type RuleContext = {
    getSourceCode(): {
        getText(node: unknown): string;
        getScope(node: unknown): unknown;
    };
    report(descriptor: {
        node: unknown;
        messageId: string;
        data?: Record<string, string>;
        fix?(fixer: RuleFixer): unknown;
        suggest?: RuleSuggestion[];
    }): void;
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
    propertyName: string
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

const RESULT_PROPERTY_COUNT = 2;

/** An object literal with exactly `isError` and `value`: no spread, no extras. */
function hasOnlyResultProperties(node: unknown): boolean {
    if (
        !isNode(node) ||
        node.type !== "ObjectExpression" ||
        !Array.isArray(node["properties"]) ||
        node["properties"].length !== RESULT_PROPERTY_COUNT
    ) {
        return false;
    }

    return node["properties"].every((property) => {
        return (
            isNode(property) &&
            property.type === "Property" &&
            property["computed"] !== true &&
            (isIdentifierNamed(property["key"], "isError") ||
                isIdentifierNamed(property["key"], "value"))
        );
    });
}

function isBooleanLiteral(node: unknown, expected: boolean): boolean {
    return (
        isNode(node) && node.type === "Literal" && node["value"] === expected
    );
}

function isNullLiteral(node: unknown): boolean {
    return isNode(node) && node.type === "Literal" && node["value"] === null;
}

/**
 * Globals an older typebuddy defined, and the helper that replaces each. They
 * are not defined any more, so a reference to one throws a `ReferenceError`.
 */
const REMOVED_RESULT_GLOBALS: ReadonlyMap<string, "ok" | "err"> = new Map([
    ["FAILED_PROMISE", "err"],
    ["VOID_PROMISE", "ok"]
]);

function isRemovedResultGlobal(node: unknown): boolean {
    return (
        isNode(node) &&
        node.type === "Identifier" &&
        typeof node["name"] === "string" &&
        REMOVED_RESULT_GLOBALS.has(node["name"])
    );
}

/**
 * The identifiers of the references no scope of the file resolves: the global
 * scope's `through`. A name the file declares, imports or takes as a parameter
 * resolves and is not in it, nor is a property key.
 */
function getUnresolvedIdentifiers(scope: unknown): AstNode[] {
    if (
        typeof scope !== "object" ||
        scope === null ||
        !("through" in scope) ||
        !Array.isArray(scope.through)
    ) {
        return [];
    }

    const identifiers: AstNode[] = [];
    for (const reference of scope.through) {
        if (
            typeof reference === "object" &&
            reference !== null &&
            "identifier" in reference &&
            isNode(reference.identifier)
        ) {
            identifiers.push(reference.identifier);
        }
    }

    return identifiers;
}

const rule = {
    create(context: RuleContext) {
        const sourceCode = context.getSourceCode();
        const imports = createImportPlanner(sourceCode);

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
         * Every spelling counts. Matching only `Promise` meant the rule read
         * the return type of code it had not migrated yet and went blind the
         * moment `MaybePromise` was there — so a bare `return;` in a
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

        /**
         * The fixes that rewrite `at` and make `helperName` available there, or
         * `null` when the name is something else at that spot (a catch
         * parameter called `err`, a local called `ok`): the rule then reports
         * without offering a fix, because a fix would call the wrong thing.
         */
        function withHelperFixes(
            at: AstNode,
            fixer: RuleFixer,
            helperName: "ok" | "err",
            rewrite: unknown
        ): unknown[] | null {
            const importFixes = imports.fixes(at, fixer, helperName, "value");
            if (importFixes === null) return null;

            return [...importFixes, rewrite];
        }

        /**
         * Same as `withHelperFixes`, as a suggestion. A suggestion is applied
         * alone, so it carries its own import too.
         */
        function suggestWithHelper(
            at: AstNode,
            messageId: string,
            helperName: "ok" | "err",
            rewrite: (fixer: RuleFixer) => unknown
        ): RuleSuggestion[] {
            return [
                {
                    messageId,
                    fix(fixer) {
                        return withHelperFixes(
                            at,
                            fixer,
                            helperName,
                            rewrite(fixer)
                        );
                    }
                }
            ];
        }

        /**
         * `Promise<T>` to `MaybePromise<T>`.
         *
         * Only on a function this file defines (`own`) is it a fix: the author
         * is moving that function's contract to `MaybePromise`. A function
         * type, an interface method or an overload describes a shape that other
         * code, often a library's, has to match, so there it is a suggestion
         * the author decides on.
         */
        function reportPromiseReturnType(node: AstNode, own: boolean) {
            if (!isNode(node["returnType"])) return;

            const typeAnnotation = node["returnType"]["typeAnnotation"];
            if (!isTypeReference(typeAnnotation)) return;
            if (getTypeName(typeAnnotation) !== "Promise") return;

            const typeName = typeAnnotation["typeName"];
            const awaited = getTypeArgument(typeAnnotation);
            const data = {
                promise: sourceCode.getText(typeAnnotation),
                type: awaited ? sourceCode.getText(awaited) : "T"
            };
            const rewrite = (fixer: RuleFixer) => {
                const typeImport = imports.fixes(
                    typeName,
                    fixer,
                    "MaybePromise",
                    "type"
                );
                if (typeImport === null) return null;

                return [
                    ...typeImport,
                    fixer.replaceText(typeName, "MaybePromise")
                ];
            };

            // The rename is the first half of a migration: the returns of the
            // function then have to become `ok(...)` and `err()`, and those
            // fixes need an import. In a file that cannot take one (a script)
            // they are not offered, so a rename by `--fix` would leave code
            // that does not compile and never heals. There it is a suggestion.
            if (own && canAddImport(node)) {
                context.report({
                    node: typeName,
                    messageId: "replaceWithMaybePromise",
                    data,
                    fix(fixer) {
                        return rewrite(fixer);
                    }
                });
                return;
            }

            context.report({
                node: typeName,
                messageId: "replaceWithMaybePromise",
                data,
                suggest: [
                    {
                        messageId: "suggestMaybePromise",
                        fix(fixer) {
                            return rewrite(fixer);
                        }
                    }
                ]
            });
        }

        function checkReturnType(node: AstNode) {
            if (!isAsyncFunction(node)) return;
            if (node["generator"] === true) return;
            if (isCallArgumentCallback(node)) return;
            // Same exemption as `require-try-catch`: a deliberate throw is not a
            // result waiting to be wrapped.
            if (throwsDeliberately(node["body"])) return;

            reportPromiseReturnType(node, true);
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
         *
         * Every other signature is a suggestion, never a fix: a function type
         * or an interface method is often the shape a library hands in or
         * expects back, and only the author knows which.
         */
        function checkSignatureReturnType(node: AstNode) {
            if (isAmbient(node)) return;

            reportPromiseReturnType(node, false);
        }

        function wrapReturnValue(
            node: AstNode,
            isAsync: boolean,
            returnType: AstNode | null
        ) {
            if (!isAsync) return;

            const argument = node["argument"];
            if (!isNode(argument)) {
                if (returnType?.type === "TSVoidKeyword") {
                    context.report({
                        node,
                        messageId: "returnVoidPromise",
                        data: { code: sourceCode.getText(node) },
                        fix(fixer) {
                            return withHelperFixes(
                                node,
                                fixer,
                                "ok",
                                fixer.replaceText(node, "return ok();")
                            );
                        }
                    });
                }
                return;
            }

            // `removedResultGlobal` reports the global itself; one the file
            // defines is the author's own value.
            if (isRemovedResultGlobal(argument)) {
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

            // The inline object is only the same thing as `ok(value)` when it
            // holds exactly these two properties. `{ isError: false, value,
            // extra }` would lose `extra`.
            if (
                isBooleanLiteral(isErrorValue, false) &&
                objectValue &&
                hasOnlyResultProperties(argument)
            ) {
                context.report({
                    node: argument,
                    messageId: "preferOkResult",
                    data: {
                        object: sourceCode.getText(argument),
                        value: sourceCode.getText(objectValue)
                    },
                    fix(fixer) {
                        const valueText = sourceCode.getText(objectValue);
                        return withHelperFixes(
                            node,
                            fixer,
                            "ok",
                            fixer.replaceText(argument, `ok(${valueText})`)
                        );
                    }
                });
                return;
            }

            if (
                isBooleanLiteral(isErrorValue, true) &&
                isNullLiteral(objectValue) &&
                hasOnlyResultProperties(argument)
            ) {
                context.report({
                    node: argument,
                    messageId: "preferErrResult",
                    data: { object: sourceCode.getText(argument) },
                    fix(fixer) {
                        return withHelperFixes(
                            node,
                            fixer,
                            "err",
                            fixer.replaceText(argument, "err()")
                        );
                    }
                });
                return;
            }

            // Anything else is a suggestion, never a fix. `return session`
            // may already be a failed Result, `return await load()` may
            // already be a `MaybePromise`: wrapping either in `ok(...)` turns
            // a failure into a success holding a failure. Only the author
            // knows what the expression is.
            if (
                !hasIsErrorFlag(argument, true) &&
                !hasIsErrorFlag(argument, false)
            ) {
                context.report({
                    node: argument,
                    messageId: "wrapReturn",
                    data: { argument: sourceCode.getText(argument) },
                    suggest: suggestWithHelper(
                        node,
                        "suggestWrapReturn",
                        "ok",
                        (fixer) => {
                            const argumentText = sourceCode.getText(argument);
                            return fixer.replaceText(
                                argument,
                                `ok(${argumentText})`
                            );
                        }
                    )
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
            // A `FAILED_PROMISE` global is reported by `removedResultGlobal`,
            // whose fix makes it `err()`; reporting it here as well would be
            // two reports for one line.
            return (
                isIdentifierNamed(argument, "FAILED_PROMISE") ||
                isResultHelperCall(argument, "err")
            );
        }

        /**
         * Push a single `return` inside a catch block towards `err()`.
         *
         * Only the lossless rewrites carry a fix. Replacing `return
         * ok("defaults")` with `return err()` would silently drop the author's
         * fallback, and the old behaviour — appending `return err()` after it —
         * produced unreachable code and a report that could never be satisfied.
         * Where the fallback matters, moving it into the try block is a
         * decision the author has to make, so the rule reports and stops.
         */
        function reportCatchReturn(statement: AstNode) {
            const argument = statement["argument"];

            if (isSettledFailure(argument)) return;

            // `return;` — adding the result is pure addition, nothing is lost.
            // `statement` is where the scope is read: the catch parameter is in
            // scope there, and `catch (err)` makes `err()` the caught value.
            if (!isNode(argument)) {
                context.report({
                    node: statement,
                    messageId: "returnFailedPromise",
                    data: { found: `\`${sourceCode.getText(statement)}\`` },
                    fix(fixer) {
                        return withHelperFixes(
                            statement,
                            fixer,
                            "err",
                            fixer.replaceText(statement, "return err();")
                        );
                    }
                });
                return;
            }

            if (hasIsErrorFlag(argument, true)) {
                // `{ isError: true, value: null }` says the right thing the
                // long way round; `err()` is the same value.
                if (
                    isNullLiteral(getObjectPropertyValue(argument, "value")) &&
                    hasOnlyResultProperties(argument)
                ) {
                    context.report({
                        node: argument,
                        messageId: "preferErrResult",
                        data: { object: sourceCode.getText(argument) },
                        fix(fixer) {
                            return withHelperFixes(
                                statement,
                                fixer,
                                "err",
                                fixer.replaceText(argument, "err()")
                            );
                        }
                    });
                }
                return;
            }

            context.report({
                node: statement,
                messageId: "returnFailedPromise",
                data: { found: `\`${sourceCode.getText(statement)}\`` }
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
            // An async generator yields; what it returns is the end of the
            // iteration, not a result for a caller to read.
            if (parentFunction["generator"] === true) return;
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
                reportCatchReturn(statement);
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
                data: { found: "nothing (it has no `return`)" },
                fix(fixer) {
                    const handlerBody = handler["body"];
                    if (
                        !isNode(handlerBody) ||
                        !Array.isArray(handlerBody["range"])
                    ) {
                        return null;
                    }

                    // The scope is the catch body's: `catch (err)` puts the
                    // caught value under the name `err`, and `return err()`
                    // would call it.
                    return withHelperFixes(
                        handlerBody,
                        fixer,
                        "err",
                        fixer.insertTextBeforeRange(
                            [
                                handlerBody["range"][1] - 1,
                                handlerBody["range"][1] - 1
                            ],
                            // The newline matters: `catch { log() }` would
                            // otherwise become `catch { log() return err(); }`,
                            // which does not parse.
                            "\nreturn err();\n"
                        )
                    );
                }
            });
        }

        /**
         * `FAILED_PROMISE` and `VOID_PROMISE` were globals of an older
         * typebuddy. Nothing defines them now, so `return FAILED_PROMISE`
         * throws instead of settling on a result. That holds wherever the name
         * sits — a framework callback the other checks skip included — so every
         * unresolved reference is reported, and fixed to the helper that builds
         * the same value. A binding of that name the file declares itself
         * resolves and is left alone.
         */
        function reportRemovedResultGlobal(identifier: AstNode) {
            const name = identifier["name"];
            if (typeof name !== "string") return;
            const helperName = REMOVED_RESULT_GLOBALS.get(name);
            if (helperName === undefined) return;
            // `typeof FAILED_PROMISE` in a type and `export { FAILED_PROMISE }`
            // have no expression to put `err()` in.
            const parentType = identifier.parent?.type;
            if (
                parentType === "TSTypeQuery" ||
                parentType === "ExportSpecifier"
            )
                return;

            context.report({
                node: identifier,
                messageId: "removedResultGlobal",
                data: { name, helper: helperName },
                fix(fixer) {
                    return withHelperFixes(
                        identifier,
                        fixer,
                        helperName,
                        fixer.replaceText(identifier, `${helperName}()`)
                    );
                }
            });
        }

        const { Program, guard } = createUseServerGuard();
        const reportRemovedGlobal = guard(reportRemovedResultGlobal);

        return {
            Program,
            "Program:exit"(node: AstNode) {
                for (const identifier of getUnresolvedIdentifiers(
                    sourceCode.getScope(node)
                )) {
                    reportRemovedGlobal(identifier);
                }
            },
            FunctionDeclaration: guard(checkReturnType),
            FunctionExpression: guard(checkReturnType),
            ArrowFunctionExpression: guard(checkReturnType),
            TSDeclareFunction: guard(checkSignatureReturnType),
            TSFunctionType: guard(checkSignatureReturnType),
            TSMethodSignature: guard(checkSignatureReturnType),
            TryStatement: guard(processTryCatch)
        };
    },
    defaultOptions: [],
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Ensure async functions' return values follow the MaybePromise pattern."
        },
        fixable: "code",
        hasSuggestions: true,
        schema: [],
        messages: {
            replaceWithMaybePromise:
                '`{{promise}}` makes a failure a rejection the caller has to catch; typebuddy\'s async functions resolve to a result instead, which the caller checks with `isError`. Fix: `MaybePromise<{{type}}>` with `import type { MaybePromise } from "@murky-web/typebuddy";`, then `return ok(value)` from the `try` and `return err()` from the `catch`. Do not cast the returns with `as` to make them fit.',
            suggestMaybePromise: "Replace 'Promise' with 'MaybePromise'.",
            wrapReturn:
                "`return {{argument}}` in the `try` of an async function resolves to a bare value, and a caller reading `.isError` gets `undefined`. Fix: `return ok({{argument}})`; if `{{argument}}` already is a `Result`, unwrap it: `const settled = {{argument}}; if (settled.isError) return err(); return ok(settled.value);`. Do not cast it with `as`.",
            suggestWrapReturn: "Wrap the return value in ok(...).",
            preferOkResult:
                '`{{object}}` builds the success result by hand; without a return type its `isError` widens to `boolean` and `isSuccess` stops narrowing it. Fix: `ok({{value}})` with `import { ok } from "@murky-web/typebuddy";` (`--fix` applies it).',
            preferErrResult:
                '`{{object}}` builds the failed result by hand; without a return type its `isError` widens to `boolean` and `isSuccess` stops narrowing it. Fix: `err()` with `import { err } from "@murky-web/typebuddy";` (`--fix` applies it).',
            returnVoidPromise:
                '`{{code}}` in the `try` of an async `void` function resolves to `undefined` instead of a result, so a caller reading `.isError` throws a `TypeError`. Fix: `return ok();` with `import { ok } from "@murky-web/typebuddy";` (`--fix` applies it).',
            removedResultGlobal:
                '`{{name}}` does not exist at runtime: typebuddy no longer defines the `FAILED_PROMISE` and `VOID_PROMISE` globals, so this line throws a `ReferenceError` instead of settling on a result. Fix: `{{helper}}()` with `import { {{helper}} } from "@murky-web/typebuddy";` (`--fix` applies it). Do not declare `{{name}}` yourself to keep the old name.',
            returnFailedPromise:
                'The `catch` of this async function settles on {{found}} instead of `err()`, so the caller gets no `Failed` result and `isError` misses the failure. Fix: end the `catch` with `return err();` and `import { err } from "@murky-web/typebuddy";`, renaming a `catch (err)` parameter first; a fallback value belongs in the `try` as `return ok(fallback)`. Do not return `ok(...)` from the `catch`.'
        }
    }
};

export { rule as errorSafeAsyncRule };
