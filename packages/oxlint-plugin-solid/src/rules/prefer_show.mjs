import { getSourceCode } from "../compat.mjs";
import { isJSXElementOrFragment, messageCode } from "../utils.mjs";
// Only a branch that is visibly JSX is reported. A text ternary is the
// cheapest form, and an Identifier may hold text, where a `<Show>` is slower:
// the compiler does not lower it. Oxlint's tree drops parentheses, so
// `(<A/>)` is a JSXElement here too.
export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Enforce using Solid's `<Show />` component for conditionally showing content. Solid's compiler covers this case, so it's a stylistic rule only.",
            url: "https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/prefer-show.md"
        },
        fixable: "code",
        hasSuggestions: true,
        schema: [],
        messages: {
            preferShowAnd:
                '`{{test}} && …` renders an element, and when `{{test}}` is `0` or `""` it renders that value instead of nothing. Fix: `{{fix}}`; `<Show>` renders nothing for every falsy value.',
            preferShowTernary:
                "`{{test}} ? … : …` switches between elements, which is what `<Show>` is for; a ternary is the cheaper form only when both branches are text. Fix: `{{fix}}`.",
            useShow:
                "Replace with `<Show>`. A falsy value such as `0` is then no longer rendered."
        }
    },
    defaultOptions: [],
    create(context) {
        const sourceCode = getSourceCode(context);
        const putIntoJSX = (node) => {
            const text = sourceCode.getText(node);
            return isJSXElementOrFragment(node) ? text : `{${text}}`;
        };
        // `{count() && <A/>}` renders `0` when count() is 0, `<Show>` renders
        // nothing, so the rewrite is a suggestion, not a fix.
        const testText = (node) =>
            messageCode(sourceCode.getText(node), "condition");
        const logicalExpressionHandler = (node) => {
            if (node.operator === "&&" && isJSXElementOrFragment(node.right)) {
                const test = sourceCode.getText(node.left);
                context.report({
                    node,
                    messageId: "preferShowAnd",
                    data: {
                        test: testText(node.left),
                        fix: messageCode(
                            `<Show when={${test}}>${putIntoJSX(node.right)}</Show>`,
                            `<Show when={${testText(node.left)}}>…</Show>`
                        )
                    },
                    suggest: [
                        {
                            messageId: "useShow",
                            fix: (fixer) =>
                                fixer.replaceText(
                                    node.parent?.type ===
                                        "JSXExpressionContainer" &&
                                        isJSXElementOrFragment(
                                            node.parent.parent
                                        )
                                        ? node.parent
                                        : node,
                                    `<Show when={${sourceCode.getText(node.left)}}>${putIntoJSX(node.right)}</Show>`
                                )
                        }
                    ]
                });
            }
        };
        const conditionalExpressionHandler = (node) => {
            if (
                isJSXElementOrFragment(node.consequent) ||
                isJSXElementOrFragment(node.alternate)
            ) {
                const test = sourceCode.getText(node.test);
                context.report({
                    node,
                    messageId: "preferShowTernary",
                    data: {
                        test: testText(node.test),
                        fix: messageCode(
                            `<Show when={${test}} fallback={${sourceCode.getText(node.alternate)}}>${putIntoJSX(node.consequent)}</Show>`,
                            `<Show when={${testText(node.test)}} fallback={…}>…</Show>`
                        )
                    },
                    fix: (fixer) =>
                        fixer.replaceText(
                            node.parent?.type === "JSXExpressionContainer" &&
                                isJSXElementOrFragment(node.parent.parent)
                                ? node.parent
                                : node,
                            `<Show when={${sourceCode.getText(node.test)}} fallback={${sourceCode.getText(node.alternate)}}>${putIntoJSX(node.consequent)}</Show>`
                        )
                });
            }
        };
        return {
            JSXExpressionContainer(node) {
                if (!isJSXElementOrFragment(node.parent)) {
                    return;
                }
                if (node.expression.type === "LogicalExpression") {
                    logicalExpressionHandler(node.expression);
                } else if (
                    node.expression.type === "ArrowFunctionExpression" &&
                    node.expression.body.type === "LogicalExpression"
                ) {
                    logicalExpressionHandler(node.expression.body);
                } else if (node.expression.type === "ConditionalExpression") {
                    conditionalExpressionHandler(node.expression);
                } else if (
                    node.expression.type === "ArrowFunctionExpression" &&
                    node.expression.body.type === "ConditionalExpression"
                ) {
                    conditionalExpressionHandler(node.expression.body);
                }
            }
        };
    }
};
