import { getSourceCode } from "../compat.mjs";
import { getFunctionName, messageCode } from "../utils.mjs";
const isNothing = (node) => {
    if (!node) {
        return true;
    }
    switch (node.type) {
        case "Literal":
            return [null, undefined, false, ""].includes(node.value);
        case "JSXFragment":
            return !node.children || node.children.every(isNothing);
        default:
            return false;
    }
};
const getLineLength = (loc) => loc.end.line - loc.start.line + 1;
const EARLY_RETURN_PATTERN = "return <Show when={…} fallback={…}>…</Show>;";
// `if (test) return A; ... return B;` as one `<Show>`, when the `if` holds
// nothing but that return and both returns have a value.
const earlyReturnFix = (earlyReturn, lastReturn, sourceCode) => {
    const block = earlyReturn.parent;
    const ifStatement =
        block.type === "BlockStatement" && block.body.length === 1
            ? block.parent
            : block;
    if (
        ifStatement.type !== "IfStatement" ||
        ifStatement.alternate ||
        !earlyReturn.argument ||
        !lastReturn?.argument
    ) {
        return EARLY_RETURN_PATTERN;
    }
    const jsx = (node) => {
        const text = sourceCode.getText(node);
        return node.type === "JSXElement" || node.type === "JSXFragment"
            ? text
            : `{${text}}`;
    };
    return messageCode(
        `return <Show when={${sourceCode.getText(ifStatement.test)}} fallback={${sourceCode.getText(lastReturn.argument)}}>${jsx(earlyReturn.argument)}</Show>;`,
        EARLY_RETURN_PATTERN
    );
};
export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow early returns in components. Solid components only run once, and so conditionals should be inside JSX.",
            url: "https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/components-return-once.md"
        },
        fixable: "code",
        schema: [],
        messages: {
            noEarlyReturn:
                "{{component}} returns early. A component body runs once, so it never switches branches when the condition changes (dev: `STRICT_READ_UNTRACKED`). Fix: one return with the condition in JSX, `{{fix}}` (`<Switch>`/`<Match>` for more branches). Do not: `untrack()` the condition.",
            noConditionalReturn:
                "{{component}} picks its return with `{{test}}`. A component body runs once, so it never switches when `{{test}}` changes. Fix: `{{fix}}`. Do not: `untrack()` the condition."
        }
    },
    defaultOptions: [],
    create(context) {
        const functionStack = [];
        const putIntoJSX = (node) => {
            const text = getSourceCode(context).getText(node);
            return node.type === "JSXElement" || node.type === "JSXFragment"
                ? text
                : `{${text}}`;
        };
        // The autofix's replacement for `return test ? a : b`.
        const conditionalReplacement = (argument) => {
            const sourceCode = getSourceCode(context);
            const { test, consequent, alternate } = argument;
            const conditions = [{ test, consequent }];
            let fallback = alternate;
            while (fallback.type === "ConditionalExpression") {
                conditions.push({
                    test: fallback.test,
                    consequent: fallback.consequent
                });
                fallback = fallback.alternate;
            }
            if (conditions.length >= 2) {
                // we have a nested ternary, use <Switch><Match /></Switch>
                const fallbackStr = !isNothing(fallback)
                    ? ` fallback={${sourceCode.getText(fallback)}}`
                    : "";
                return `<Switch${fallbackStr}>\n${conditions
                    .map(
                        ({ test, consequent }) =>
                            `<Match when={${sourceCode.getText(test)}}>${putIntoJSX(consequent)}</Match>`
                    )
                    .join("\n")}\n</Switch>`;
            }
            if (isNothing(consequent)) {
                // we have a single ternary and the consequent is nothing. Negate the condition and use a <Show>.
                return `<Show when={!(${sourceCode.getText(test)})}>${putIntoJSX(alternate)}</Show>`;
            }
            if (
                isNothing(fallback) ||
                getLineLength(consequent.loc) >=
                    getLineLength(alternate.loc) * 1.5
            ) {
                // we have a standard ternary, and the alternate is a bit shorter in LOC than the consequent, which
                // should be enough to tell that it's logically a fallback instead of an equal branch.
                const fallbackStr = !isNothing(fallback)
                    ? ` fallback={${sourceCode.getText(fallback)}}`
                    : "";
                return `<Show when={${sourceCode.getText(test)}}${fallbackStr}>${putIntoJSX(consequent)}</Show>`;
            }
            // we have a standard ternary, but no signal from the user as to which branch is the "fallback" and
            // which is the children. Move the whole conditional inside a JSX fragment.
            return `<>${putIntoJSX(argument)}</>`;
        };
        const currentFunction = () => functionStack[functionStack.length - 1];
        const onFunctionEnter = (node) => {
            let lastReturn;
            if (node.body.type === "BlockStatement") {
                // find last statement, ignoring function/class/variable declarations (hoisting)
                const last = node.body.body.findLast(
                    (node) => !node.type.endsWith("Declaration")
                );
                // if it's a return, store it
                if (last && last.type === "ReturnStatement") {
                    lastReturn = last;
                }
            }
            functionStack.push({
                isComponent: false,
                lastReturn,
                earlyReturns: []
            });
        };
        const onFunctionExit = (node) => {
            if (
                // "render props" aren't components
                getFunctionName(node)?.match(/^[a-z]/) ||
                node.parent?.type === "JSXExpressionContainer" ||
                // ignore createMemo(() => conditional JSX), report HOC(() => conditional JSX)
                (node.parent?.type === "CallExpression" &&
                    node.parent.arguments.some((n) => n === node) &&
                    !node.parent.callee.name?.match(/^[A-Z]/))
            ) {
                currentFunction().isComponent = false;
            }
            if (currentFunction().isComponent) {
                const sourceCode = getSourceCode(context);
                const name = getFunctionName(node);
                const component = name ? `\`${name}\`` : "This component";
                const { lastReturn } = currentFunction();
                // Warn on each early return; with more than one, the branches
                // go into a <Switch>, which no single `if` shows.
                const { earlyReturns } = currentFunction();
                earlyReturns.forEach((earlyReturn) => {
                    context.report({
                        node: earlyReturn,
                        messageId: "noEarlyReturn",
                        data: {
                            component,
                            fix:
                                earlyReturns.length > 1
                                    ? "return <Switch fallback={…}><Match when={…}>…</Match></Switch>;"
                                    : earlyReturnFix(
                                          earlyReturn,
                                          lastReturn,
                                          sourceCode
                                      )
                        }
                    });
                });
                const argument = lastReturn?.argument;
                // What the conditional return becomes: the autofix's
                // replacement where there is one, else the whole expression
                // in a fragment, which keeps it reactive.
                const conditionalData = (test, replacement) => ({
                    component,
                    test: messageCode(sourceCode.getText(test), "condition"),
                    fix: messageCode(
                        `return ${replacement};`,
                        "return <Show when={condition} fallback={…}>…</Show>;"
                    )
                });
                if (argument?.type === "ConditionalExpression") {
                    context.report({
                        node: argument.parent,
                        messageId: "noConditionalReturn",
                        data: conditionalData(
                            argument.test,
                            conditionalReplacement(argument)
                        ),
                        fix: (fixer) =>
                            fixer.replaceText(
                                argument,
                                conditionalReplacement(argument)
                            )
                    });
                } else if (argument?.type === "LogicalExpression") {
                    // `return condition && expression` goes into a <Show />;
                    // any other operator into a fragment, without a fix.
                    const isAnd = argument.operator === "&&";
                    const replacement = isAnd
                        ? `<Show when={${sourceCode.getText(argument.left)}}>${putIntoJSX(argument.right)}</Show>`
                        : `<>${putIntoJSX(argument)}</>`;
                    context.report({
                        node: argument,
                        messageId: "noConditionalReturn",
                        data: conditionalData(argument.left, replacement),
                        fix: isAnd
                            ? (fixer) =>
                                  fixer.replaceText(argument, replacement)
                            : undefined
                    });
                }
            }
            // Pop on exit
            functionStack.pop();
        };
        return {
            FunctionDeclaration: onFunctionEnter,
            FunctionExpression: onFunctionEnter,
            ArrowFunctionExpression: onFunctionEnter,
            "FunctionDeclaration:exit": onFunctionExit,
            "FunctionExpression:exit": onFunctionExit,
            "ArrowFunctionExpression:exit": onFunctionExit,
            JSXElement() {
                if (functionStack.length) {
                    currentFunction().isComponent = true;
                }
            },
            JSXFragment() {
                if (functionStack.length) {
                    currentFunction().isComponent = true;
                }
            },
            ReturnStatement(node) {
                if (
                    functionStack.length &&
                    node !== currentFunction().lastReturn
                ) {
                    currentFunction().earlyReturns.push(node);
                }
            }
        };
    }
};
