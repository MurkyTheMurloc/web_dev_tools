import { getStringIfConstant } from "@eslint-community/eslint-utils";
import isHtml from "is-html";

import { getSourceCode } from "../compat.mjs";
import { jsxPropName, messageCode } from "../utils.mjs";
export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow usage of the innerHTML attribute, which can often lead to security vulnerabilities.",
            url: "https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-innerhtml.md"
        },
        fixable: "code",
        hasSuggestions: true,
        schema: [
            {
                type: "object",
                properties: {
                    allowStatic: {
                        description:
                            "if the innerHTML value is guaranteed to be a static HTML string (i.e. no user input), allow it",
                        type: "boolean",
                        default: true
                    }
                },
                additionalProperties: false
            }
        ],
        messages: {
            dangerous:
                "`innerHTML={{{value}}}` parses the value as HTML, so input that reaches it can inject markup and run script (XSS). Fix: for text, render it as a child, `<{{element}}>{{{value}}}</{{element}}>`; for HTML, sanitize it before it reaches `innerHTML`.",
            conflict:
                "`<{{element}}>` has both `innerHTML` and children, and one replaces the other, so part of this markup never renders. Fix: keep one: drop the children, or drop `innerHTML` and write its markup as JSX.",
            notHtml:
                "`innerHTML` gets `{{value}}`, which holds no HTML, so it is parsed as HTML for nothing and a later `<` or `&` in it turns into markup. Fix: `{{fix}}`.",
            useInnerText: "Replace `innerHTML` with `innerText`.",
            dangerouslySetInnerHTML:
                "`dangerouslySetInnerHTML` is React's prop; Solid sets it as an unknown attribute and the HTML never renders. Fix: `{{fix}}`."
        }
    },
    defaultOptions: [{ allowStatic: true }],
    create(context) {
        const allowStatic = Boolean(context.options[0]?.allowStatic ?? true);
        const sourceCode = getSourceCode(context);
        const elementName = (attribute) =>
            sourceCode.getText(attribute.parent.name);
        // `<div innerHTML={html} />`: the value as an expression.
        const valueText = (attribute) =>
            messageCode(
                sourceCode.getText(
                    attribute.value?.type === "JSXExpressionContainer"
                        ? attribute.value.expression
                        : attribute.value
                ),
                "html"
            );
        const reportDangerous = (node) => {
            context.report({
                node,
                messageId: "dangerous",
                data: {
                    element: elementName(node),
                    value: node.value ? valueText(node) : "true"
                }
            });
        };
        return {
            JSXAttribute(node) {
                if (jsxPropName(node) === "dangerouslySetInnerHTML") {
                    if (
                        node.value?.type === "JSXExpressionContainer" &&
                        node.value.expression.type === "ObjectExpression" &&
                        node.value.expression.properties.length === 1
                    ) {
                        const htmlProp = node.value.expression.properties[0];
                        if (
                            htmlProp.type === "Property" &&
                            htmlProp.key.type === "Identifier" &&
                            htmlProp.key.name === "__html"
                        ) {
                            context.report({
                                node,
                                messageId: "dangerouslySetInnerHTML",
                                data: {
                                    fix: `innerHTML={${messageCode(sourceCode.getText(htmlProp.value), "html")}}`
                                },
                                fix: (fixer) => {
                                    const propRange = node.range;
                                    const valueRange = htmlProp.value.range;
                                    return [
                                        fixer.replaceTextRange(
                                            [propRange[0], valueRange[0]],
                                            "innerHTML={"
                                        ),
                                        fixer.replaceTextRange(
                                            [valueRange[1], propRange[1]],
                                            "}"
                                        )
                                    ];
                                }
                            });
                        } else {
                            context.report({
                                node,
                                messageId: "dangerouslySetInnerHTML",
                                data: { fix: "innerHTML={html}" }
                            });
                        }
                    } else {
                        context.report({
                            node,
                            messageId: "dangerouslySetInnerHTML",
                            data: { fix: "innerHTML={html}" }
                        });
                    }
                    return;
                } else if (jsxPropName(node) !== "innerHTML") {
                    return;
                }
                if (allowStatic) {
                    const innerHtmlNode =
                        node.value?.type === "JSXExpressionContainer"
                            ? node.value.expression
                            : node.value;
                    const innerHtml =
                        innerHtmlNode && getStringIfConstant(innerHtmlNode);
                    if (typeof innerHtml === "string") {
                        if (isHtml(innerHtml)) {
                            // go up to enclosing JSXElement and check if it has children
                            if (
                                node.parent?.parent?.type === "JSXElement" &&
                                node.parent.parent.children?.length
                            ) {
                                context.report({
                                    node: node.parent.parent, // report error on JSXElement instead of JSXAttribute
                                    messageId: "conflict",
                                    data: { element: elementName(node) }
                                });
                            }
                        } else {
                            context.report({
                                node,
                                messageId: "notHtml",
                                data: {
                                    value: messageCode(
                                        sourceCode.getText(node.value),
                                        '"…"'
                                    ),
                                    fix: messageCode(
                                        `innerText=${sourceCode.getText(node.value)}`,
                                        "innerText={text}"
                                    )
                                },
                                suggest: [
                                    {
                                        fix: (fixer) =>
                                            fixer.replaceText(
                                                node.name,
                                                "innerText"
                                            ),
                                        messageId: "useInnerText"
                                    }
                                ]
                            });
                        }
                    } else {
                        reportDangerous(node);
                    }
                } else {
                    reportDangerous(node);
                }
            }
        };
    }
};
