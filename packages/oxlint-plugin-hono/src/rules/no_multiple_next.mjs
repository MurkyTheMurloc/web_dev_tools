import { sourceCodeOf } from "@murky-web/oxlint-plugin/utils";

import {
    createHonoTracker,
    getParamIdentifier,
    isFunctionNode,
    refersToVariable,
    resolveVariable,
    unwrapExpression
} from "../hono_ast.mjs";

const DOCS_URL =
    "https://github.com/MurkyTheMurloc/web_dev_tools/tree/main/packages/oxlint-plugin-hono";

/**
 * Analyzes control flow inside a Hono middleware body to report when `next()`
 * can execute more than once on the same request path (or inside a loop that
 * does not exit on the same iteration).
 */
function analyzeMiddleware(fnNode, nextVar, nextName, sourceCode, context) {
    if (fnNode.body.type !== "BlockStatement") {
        return;
    }

    function isNextCall(node) {
        const target = unwrapExpression(node);
        return (
            target?.type === "CallExpression" &&
            refersToVariable(sourceCode, target.callee, nextVar, nextName)
        );
    }

    function reportMultiple(node) {
        context.report({
            data: { next: nextName },
            messageId: "multipleNext",
            node
        });
    }

    function reportLoop(node) {
        context.report({
            data: { next: nextName },
            messageId: "nextInLoop",
            node
        });
    }

    /**
     * Evaluates an expression in left-to-right order and returns whether
     * `next()` may have been called after evaluating it.
     */
    function visitExpression(node, alreadyCalled, inLoop) {
        if (!node || typeof node !== "object" || isFunctionNode(node)) {
            return alreadyCalled;
        }

        if (isNextCall(node)) {
            if (alreadyCalled) {
                reportMultiple(node);
            }
            return true;
        }

        switch (node.type) {
            case "ConditionalExpression": {
                const afterTest = visitExpression(
                    node.test,
                    alreadyCalled,
                    inLoop
                );
                const c = visitExpression(node.consequent, afterTest, inLoop);
                const a = visitExpression(node.alternate, afterTest, inLoop);
                return c || a;
            }
            case "LogicalExpression": {
                const afterLeft = visitExpression(
                    node.left,
                    alreadyCalled,
                    inLoop
                );
                return visitExpression(node.right, afterLeft, inLoop);
            }
            case "SequenceExpression": {
                let called = alreadyCalled;
                for (const expr of node.expressions) {
                    called = visitExpression(expr, called, inLoop);
                }
                return called;
            }
            default: {
                let called = alreadyCalled;
                for (const [key, value] of Object.entries(node)) {
                    if (key === "parent") {
                        continue;
                    }
                    const children = Array.isArray(value) ? value : [value];
                    for (const child of children) {
                        if (
                            child &&
                            typeof child === "object" &&
                            typeof child.type === "string" &&
                            !isFunctionNode(child)
                        ) {
                            called = visitExpression(child, called, inLoop);
                        }
                    }
                }
                return called;
            }
        }
    }

    /**
     * Evaluates a statement and returns:
     *
     * - `called`: whether `next()` may have been called on a path that falls
     *   through normally past this statement.
     * - `calledAnywhere`: whether `next()` may have been called on ANY path
     *   inside this statement (including paths that threw/returned — needed for
     *   `try`/`catch`/`finally` and loop re-entry analysis).
     * - `alwaysExits`: whether every path exits via `return` or `throw`.
     * - `alwaysBreaksLoop`: whether every path exits the enclosing loop via
     *   `return`, `throw`, or `break`.
     * - `firstLoopCall`: first `next()` call node encountered (for loop
     *   diagnostics).
     */
    function visitStatement(stmt, alreadyCalled, inLoop) {
        if (!stmt) {
            return {
                alwaysBreaksLoop: false,
                alwaysExits: false,
                called: alreadyCalled,
                calledAnywhere: alreadyCalled
            };
        }

        switch (stmt.type) {
            case "BlockStatement": {
                return visitStatementList(stmt.body, alreadyCalled, inLoop);
            }

            case "ExpressionStatement": {
                const called = visitExpression(
                    stmt.expression,
                    alreadyCalled,
                    inLoop
                );
                return {
                    alwaysBreaksLoop: false,
                    alwaysExits: false,
                    called,
                    calledAnywhere: called
                };
            }

            case "VariableDeclaration": {
                let called = alreadyCalled;
                for (const declarator of stmt.declarations) {
                    if (declarator.init) {
                        called = visitExpression(
                            declarator.init,
                            called,
                            inLoop
                        );
                    }
                }
                return {
                    alwaysBreaksLoop: false,
                    alwaysExits: false,
                    called,
                    calledAnywhere: called
                };
            }

            case "ReturnStatement": {
                const called = stmt.argument
                    ? visitExpression(stmt.argument, alreadyCalled, inLoop)
                    : alreadyCalled;
                return {
                    alwaysBreaksLoop: true,
                    alwaysExits: true,
                    called: false,
                    calledAnywhere: called
                };
            }

            case "ThrowStatement": {
                const called = visitExpression(
                    stmt.argument,
                    alreadyCalled,
                    inLoop
                );
                return {
                    alwaysBreaksLoop: true,
                    alwaysExits: true,
                    called: false,
                    calledAnywhere: called
                };
            }

            case "BreakStatement": {
                return {
                    alwaysBreaksLoop: true,
                    alwaysExits: false,
                    called: false,
                    calledAnywhere: alreadyCalled
                };
            }

            case "ContinueStatement": {
                return {
                    alwaysBreaksLoop: false,
                    alwaysExits: false,
                    called: alreadyCalled,
                    calledAnywhere: alreadyCalled
                };
            }

            case "IfStatement": {
                const afterTest = visitExpression(
                    stmt.test,
                    alreadyCalled,
                    inLoop
                );
                const consequent = visitStatement(
                    stmt.consequent,
                    afterTest,
                    inLoop
                );
                const alternate = stmt.alternate
                    ? visitStatement(stmt.alternate, afterTest, inLoop)
                    : {
                          alwaysBreaksLoop: false,
                          alwaysExits: false,
                          called: afterTest,
                          calledAnywhere: afterTest
                      };

                return {
                    alwaysBreaksLoop:
                        consequent.alwaysBreaksLoop &&
                        alternate.alwaysBreaksLoop,
                    alwaysExits:
                        consequent.alwaysExits && alternate.alwaysExits,
                    called:
                        (!consequent.alwaysExits && consequent.called) ||
                        (!alternate.alwaysExits && alternate.called),
                    calledAnywhere:
                        consequent.calledAnywhere || alternate.calledAnywhere
                };
            }

            case "SwitchStatement": {
                const afterDisc = visitExpression(
                    stmt.discriminant,
                    alreadyCalled,
                    inLoop
                );
                let anyFallsOutCalled = false;
                let anyCalledAnywhere = afterDisc;
                let hasDefault = false;
                let allCasesExit = true;
                let allCasesBreakLoop = true;
                let fallthroughCalled = afterDisc;

                for (const switchCase of stmt.cases) {
                    if (!switchCase.test) {
                        hasDefault = true;
                    } else {
                        fallthroughCalled = visitExpression(
                            switchCase.test,
                            fallthroughCalled,
                            inLoop
                        );
                    }
                    const caseResult = visitStatementList(
                        switchCase.consequent,
                        fallthroughCalled,
                        inLoop
                    );
                    anyCalledAnywhere ||= caseResult.calledAnywhere;

                    const endsWithBreak = switchCase.consequent.some(
                        (s) => s.type === "BreakStatement"
                    );
                    if (caseResult.alwaysExits) {
                        fallthroughCalled = afterDisc;
                    } else if (endsWithBreak) {
                        anyFallsOutCalled ||= caseResult.calledAnywhere;
                        allCasesExit = false;
                        allCasesBreakLoop = false;
                        fallthroughCalled = afterDisc;
                    } else {
                        allCasesExit = false;
                        allCasesBreakLoop = false;
                        fallthroughCalled = caseResult.called;
                    }
                }

                // Last case falling through out of switch.
                if (!allCasesExit) {
                    anyFallsOutCalled ||= fallthroughCalled;
                }
                if (!hasDefault) {
                    anyFallsOutCalled ||= afterDisc;
                    allCasesExit = false;
                    allCasesBreakLoop = false;
                }

                return {
                    alwaysBreaksLoop: hasDefault && allCasesBreakLoop,
                    alwaysExits: hasDefault && allCasesExit,
                    called: anyFallsOutCalled,
                    calledAnywhere: anyCalledAnywhere
                };
            }

            case "TryStatement": {
                const tryResult = visitStatement(
                    stmt.block,
                    alreadyCalled,
                    inLoop
                );
                const catchResult = stmt.handler
                    ? visitStatement(
                          stmt.handler.body,
                          alreadyCalled || tryResult.calledAnywhere,
                          inLoop
                      )
                    : null;

                const beforeFinally =
                    (!tryResult.alwaysExits && tryResult.called) ||
                    (catchResult !== null &&
                        !catchResult.alwaysExits &&
                        catchResult.called);

                const beforeFinallyAnywhere =
                    tryResult.calledAnywhere ||
                    (catchResult?.calledAnywhere ?? false);

                if (stmt.finalizer) {
                    const finallyResult = visitStatement(
                        stmt.finalizer,
                        beforeFinallyAnywhere,
                        inLoop
                    );
                    return {
                        alwaysBreaksLoop:
                            finallyResult.alwaysBreaksLoop ||
                            (tryResult.alwaysBreaksLoop &&
                                (catchResult?.alwaysBreaksLoop ?? true)),
                        alwaysExits:
                            finallyResult.alwaysExits ||
                            (tryResult.alwaysExits &&
                                (catchResult?.alwaysExits ?? true)),
                        called: finallyResult.called,
                        calledAnywhere: finallyResult.calledAnywhere
                    };
                }

                return {
                    alwaysBreaksLoop:
                        tryResult.alwaysBreaksLoop &&
                        (catchResult?.alwaysBreaksLoop ?? false),
                    alwaysExits:
                        tryResult.alwaysExits &&
                        (catchResult?.alwaysExits ?? false),
                    called: beforeFinally,
                    calledAnywhere: beforeFinallyAnywhere
                };
            }

            case "ForStatement":
            case "ForInStatement":
            case "ForOfStatement":
            case "WhileStatement":
            case "DoWhileStatement": {
                let beforeBody = alreadyCalled;
                if (stmt.init) {
                    beforeBody =
                        stmt.init.type === "VariableDeclaration"
                            ? visitStatement(stmt.init, beforeBody, inLoop)
                                  .called
                            : visitExpression(stmt.init, beforeBody, inLoop);
                }
                if (stmt.right) {
                    beforeBody = visitExpression(
                        stmt.right,
                        beforeBody,
                        inLoop
                    );
                }
                if (stmt.test && stmt.type !== "DoWhileStatement") {
                    beforeBody = visitExpression(stmt.test, beforeBody, inLoop);
                }

                // First analyze the body with current `beforeBody`.
                const bodyResult = visitStatement(stmt.body, beforeBody, true);

                // If `next()` can be called inside the loop without exiting the
                // loop on the same iteration, a subsequent iteration will call
                // `next()` a second time.
                if (
                    !beforeBody &&
                    bodyResult.called &&
                    !bodyResult.alwaysBreaksLoop
                ) {
                    const callNode = findFirstNextCall(stmt.body);
                    if (callNode) {
                        reportLoop(callNode);
                    }
                }

                if (stmt.update) {
                    visitExpression(stmt.update, bodyResult.called, true);
                }
                if (stmt.test && stmt.type === "DoWhileStatement") {
                    visitExpression(stmt.test, bodyResult.called, true);
                }

                return {
                    alwaysBreaksLoop: false,
                    alwaysExits: false,
                    called: beforeBody || bodyResult.calledAnywhere,
                    calledAnywhere: beforeBody || bodyResult.calledAnywhere
                };
            }

            case "LabeledStatement": {
                return visitStatement(stmt.body, alreadyCalled, inLoop);
            }

            default: {
                return {
                    alwaysBreaksLoop: false,
                    alwaysExits: false,
                    called: alreadyCalled,
                    calledAnywhere: alreadyCalled
                };
            }
        }
    }

    function visitStatementList(statements, alreadyCalled, inLoop) {
        let called = alreadyCalled;
        let calledAnywhere = alreadyCalled;
        for (const stmt of statements) {
            const res = visitStatement(stmt, called, inLoop);
            calledAnywhere ||= res.calledAnywhere;
            if (res.alwaysExits) {
                return {
                    alwaysBreaksLoop: true,
                    alwaysExits: true,
                    called: false,
                    calledAnywhere
                };
            }
            if (res.alwaysBreaksLoop) {
                return {
                    alwaysBreaksLoop: true,
                    alwaysExits: false,
                    called: false,
                    calledAnywhere
                };
            }
            called = res.called;
        }
        return {
            alwaysBreaksLoop: false,
            alwaysExits: false,
            called,
            calledAnywhere
        };
    }

    function findFirstNextCall(node) {
        if (!node || typeof node !== "object" || isFunctionNode(node)) {
            return null;
        }
        if (isNextCall(node)) {
            return node;
        }
        for (const [key, value] of Object.entries(node)) {
            if (key === "parent") {
                continue;
            }
            const children = Array.isArray(value) ? value : [value];
            for (const child of children) {
                if (
                    child &&
                    typeof child === "object" &&
                    typeof child.type === "string"
                ) {
                    const found = findFirstNextCall(child);
                    if (found) {
                        return found;
                    }
                }
            }
        }
        return null;
    }

    visitStatementList(fnNode.body.body, false, false);
}

export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow calling `next()` more than once along the same execution path in a Hono middleware.",
            url: DOCS_URL
        },
        schema: [],
        messages: {
            multipleNext:
                "`{{next}}()` can run more than once on the same request path in this Hono middleware, which throws `next() called multiple times` or runs downstream handlers twice. Fix: return after the first `await {{next}}()` (`return await {{next}}()` or `await {{next}}(); return;`) or keep each `{{next}}()` call in mutually exclusive branches. Do not: guard `{{next}}()` with a boolean flag to swallow the second call or disable the rule.",
            nextInLoop:
                "`{{next}}()` is called inside a loop without exiting on the same iteration, so a second iteration calls `{{next}}()` again and throws `next() called multiple times` in Hono. Fix: move `await {{next}}()` outside the loop, or `return` / `break` immediately after calling `{{next}}()`. Do not: catch and ignore the error or disable the rule."
        }
    },
    defaultOptions: [],
    create(context) {
        const sourceCode = sourceCodeOf(context);
        const tracker = createHonoTracker(sourceCode);
        const checkedFunctions = new WeakSet();

        function checkMiddleware(fnNode, nextParamIndex) {
            if (
                !isFunctionNode(fnNode) ||
                checkedFunctions.has(fnNode) ||
                fnNode.body.type !== "BlockStatement"
            ) {
                return;
            }
            const nextParam = getParamIdentifier(fnNode, nextParamIndex);
            if (!nextParam) {
                return;
            }
            checkedFunctions.add(fnNode);
            const nextVar = resolveVariable(sourceCode, nextParam);
            analyzeMiddleware(
                fnNode,
                nextVar,
                nextParam.name,
                sourceCode,
                context
            );
        }

        function onFunction(node) {
            tracker.handleFunction(node);
            const standalone = tracker.inspectStandaloneHandler(node);
            if (
                standalone &&
                standalone.isMiddleware &&
                standalone.nextParamIndex !== -1
            ) {
                checkMiddleware(node, standalone.nextParamIndex);
            }
        }

        return {
            ArrowFunctionExpression: onFunction,
            CallExpression(node) {
                const info = tracker.inspectAppCall(node);
                if (!info) {
                    return;
                }
                // `app.use(...)` and route middleware chains `(c, next) => ...`.
                if (info.kind === "use" || info.kind === "route") {
                    for (const handler of info.handlers) {
                        if (handler.params.length >= 2) {
                            checkMiddleware(handler, 1);
                        }
                    }
                }
            },
            FunctionDeclaration: onFunction,
            FunctionExpression: onFunction,
            ImportDeclaration: tracker.handleImportDeclaration,
            VariableDeclarator: tracker.handleVariableDeclarator
        };
    }
};
