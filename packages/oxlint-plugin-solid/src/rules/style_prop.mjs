import {
    getPropertyName,
    getStaticValue
} from "@eslint-community/eslint-utils";
import kebabCase from "kebab-case";
import { all as allCssProperties } from "known-css-properties";
import parse from "style-to-object";

import { getScope, getSourceCode } from "../compat.mjs";
import { jsxPropName, messageCode } from "../utils.mjs";
const lengthPercentageRegex =
    /\b(?:width|height|margin|padding|border-width|font-size)\b/i;
export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Require CSS properties in the `style` prop to be valid and kebab-cased (ex. 'font-size'), not camel-cased (ex. 'fontSize') like in React, " +
                "and that property values with dimensions are strings, not numbers with implicit 'px' units.",
            url: "https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/style-prop.md"
        },
        fixable: "code",
        schema: [
            {
                type: "object",
                properties: {
                    styleProps: {
                        description:
                            "an array of prop names to treat as a CSS style object",
                        default: ["style"],
                        type: "array",
                        items: {
                            type: "string"
                        },
                        minItems: 1,
                        uniqueItems: true
                    },
                    allowString: {
                        description:
                            "if allowString is set to true, this rule will not convert a style string literal into a style object (not recommended for performance)",
                        type: "boolean",
                        default: false
                    }
                },
                additionalProperties: false
            }
        ],
        messages: {
            kebabStyleProp:
                "`{{ name }}` is React's camelCase. Solid passes each key to `style.setProperty`, which only takes CSS names, so this style is dropped. Fix: `{{ fix }}`.",
            invalidStyleProp:
                "`{{ name }}` is not a CSS property, so `style.setProperty` drops it. Fix: correct the spelling, or start a custom property with `--` (`--{{ name }}`).",
            numericStyleValue:
                "`{{ name }}: {{ value }}` is a number without a unit. Solid passes it to `style.setProperty` as is, without adding `px`, and the browser drops a unitless length. Fix: `{{ fix }}`.",
            stringStyle:
                "`style` gets a string, which Solid sets as the whole `cssText`, so a change rewrites every property; an object lets Solid update the single property that changed. Fix: `{{ fix }}`."
        }
    },
    defaultOptions: [],
    create(context) {
        const allCssPropertiesSet = new Set(allCssProperties);
        const allowString = Boolean(context.options[0]?.allowString);
        const styleProps = context.options[0]?.styleProps || ["style"];
        const sourceCode = getSourceCode(context);
        return {
            JSXAttribute(node) {
                if (styleProps.indexOf(jsxPropName(node)) === -1) {
                    return;
                }
                const style =
                    node.value?.type === "JSXExpressionContainer"
                        ? node.value.expression
                        : node.value;
                if (!style) {
                    return;
                } else if (
                    style.type === "Literal" &&
                    typeof style.value === "string" &&
                    !allowString
                ) {
                    // Convert style="font-size: 10px" to style={{ "font-size": "10px" }}
                    let objectStyles;
                    try {
                        objectStyles = parse(style.value) ?? undefined;
                    } catch {
                        // no-op
                    }
                    context.report({
                        node: style,
                        messageId: "stringStyle",
                        data: {
                            fix: messageCode(
                                objectStyles
                                    ? `style={${JSON.stringify(objectStyles)}}`
                                    : "",
                                'style={{ "font-size": "10px" }}'
                            )
                        },
                        // replace full prop value, wrap in JSXExpressionContainer, more fixes may be applied below
                        fix:
                            objectStyles &&
                            ((fixer) =>
                                fixer.replaceText(
                                    node.value,
                                    `{${JSON.stringify(objectStyles)}}`
                                ))
                    });
                } else if (style.type === "TemplateLiteral" && !allowString) {
                    context.report({
                        node: style,
                        messageId: "stringStyle",
                        data: {
                            fix: 'style={{ "font-size": `${size()}px` }}'
                        }
                    });
                } else if (style.type === "ObjectExpression") {
                    const properties = style.properties.filter(
                        (prop) => prop.type === "Property"
                    );
                    properties.forEach((prop) => {
                        const name = getPropertyName(
                            prop,
                            getScope(context, prop)
                        );
                        if (
                            name &&
                            !name.startsWith("--") &&
                            !allCssPropertiesSet.has(name)
                        ) {
                            const kebabName = kebabCase(name);
                            if (allCssPropertiesSet.has(kebabName)) {
                                // if it's not valid simply because it's camelCased instead of kebab-cased, provide a fix
                                context.report({
                                    node: prop.key,
                                    messageId: "kebabStyleProp",
                                    data: {
                                        name,
                                        fix: messageCode(
                                            `"${kebabName}": ${sourceCode.getText(prop.value)}`,
                                            `"${kebabName}": …`
                                        )
                                    },
                                    fix: (fixer) =>
                                        fixer.replaceText(
                                            prop.key,
                                            `"${kebabName}"`
                                        ) // wrap kebab name in quotes to be a valid object key
                                });
                            } else {
                                context.report({
                                    node: prop.key,
                                    messageId: "invalidStyleProp",
                                    data: { name }
                                });
                            }
                        } else if (
                            !name ||
                            (!name.startsWith("--") &&
                                lengthPercentageRegex.test(name))
                        ) {
                            // catches numeric values (ex. { "font-size": 12 }) for common <length-percentage> peroperties
                            // and suggests quoting or appending 'px'
                            const value = getStaticValue(prop.value)?.value;
                            if (typeof value === "number" && value !== 0) {
                                const key = name
                                    ? `"${name}"`
                                    : `[${sourceCode.getText(prop.key)}]`;
                                context.report({
                                    node: prop.value,
                                    messageId: "numericStyleValue",
                                    data: {
                                        name: key,
                                        value: sourceCode.getText(prop.value),
                                        fix: `${key}: "${value}px"`
                                    }
                                });
                            }
                        }
                    });
                }
            }
        };
    }
};
