import { jsxPropName } from "../utils.mjs";
const DEFAULT_CLASSNAMES = ["cn", "clsx", "classnames"];
export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Enforce the `class` object/array form over the removed `classList` prop or a classnames helper. Solid 2.0 accepts `{ [class: string]: boolean }` on `class` directly.",
            url: "https://docs.solidjs.com/",
        },
        fixable: "code",
        schema: [
            {
                type: "object",
                properties: {
                    classnames: {
                        type: "array",
                        description:
                            "An array of names to treat as `classnames` functions",
                        default: DEFAULT_CLASSNAMES,
                        items: {
                            type: "string",
                        },
                        minItems: 1,
                        uniqueItems: true,
                    },
                },
                additionalProperties: false,
            },
        ],
        messages: {
            classlistRemoved:
                "The `classList` prop was removed in Solid 2.0. Pass the object to `class` instead.",
            preferClassObject:
                "Pass the object to `class` directly instead of through {{ classnames }}.",
        },
    },
    defaultOptions: [],
    create(context) {
        const classnames =
            context.options[0]?.classnames ?? DEFAULT_CLASSNAMES;
        return {
            JSXAttribute(node) {
                const name = jsxPropName(node);

                // `classList={{...}}` no longer exists; the object belongs on
                // `class`. JSX prop names are case-sensitive, so matching only
                // the lowercase spelling missed every real Solid 1 call site —
                // which is the code this rule exists to migrate.
                if (name === "classList" || name === "classlist") {
                    context.report({
                        node,
                        messageId: "classlistRemoved",
                        fix: (fixer) =>
                            fixer.replaceText(node.name, "class"),
                    });
                    return;
                }

                if (name !== "class" && name !== "className") {
                    return;
                }
                if (node.value?.type !== "JSXExpressionContainer") {
                    return;
                }

                // `class={cn({ ... })}` -> `class={{ ... }}`
                const expr = node.value.expression;
                if (
                    expr.type === "CallExpression" &&
                    expr.callee.type === "Identifier" &&
                    classnames.includes(expr.callee.name) &&
                    expr.arguments.length === 1 &&
                    expr.arguments[0].type === "ObjectExpression"
                ) {
                    context.report({
                        node,
                        messageId: "preferClassObject",
                        data: { classnames: expr.callee.name },
                        fix: (fixer) => {
                            const objectRange = expr.arguments[0].range;
                            return [
                                fixer.replaceTextRange(
                                    [node.range[0], objectRange[0]],
                                    "class={",
                                ),
                                fixer.replaceTextRange(
                                    [objectRange[1], node.range[1]],
                                    "}",
                                ),
                            ];
                        },
                    });
                }
            },
        };
    },
};
