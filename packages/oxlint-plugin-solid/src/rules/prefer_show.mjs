import { getSourceCode } from "../compat.mjs";
import { isJSXElementOrFragment } from "../utils.mjs";
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
                "Use Solid's `<Show />` component for conditionally showing content.",
            preferShowTernary:
                "Use Solid's `<Show />` component for conditionally showing content with a fallback.",
            useShow:
                "Replace with `<Show />`. A falsy value such as `0` is no longer rendered."
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
        const logicalExpressionHandler = (node) => {
            if (node.operator === "&&" && isJSXElementOrFragment(node.right)) {
                context.report({
                    node,
                    messageId: "preferShowAnd",
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
                context.report({
                    node,
                    messageId: "preferShowTernary",
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
