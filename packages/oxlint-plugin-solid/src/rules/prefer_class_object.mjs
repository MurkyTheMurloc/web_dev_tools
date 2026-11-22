import { getSourceCode } from "../compat.mjs";
import { jsxPropName, messageCode } from "../utils.mjs";
const DEFAULT_CLASSNAMES = ["cn", "clsx", "classnames"];
export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Enforce the `class` object/array form over the removed `classList` prop or a classnames helper. Solid 2.0 accepts `{ [class: string]: boolean }` on `class` directly.",
            url: "https://docs.solidjs.com/"
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
                            type: "string"
                        },
                        minItems: 1,
                        uniqueItems: true
                    }
                },
                additionalProperties: false
            }
        ],
        messages: {
            classlistRemoved:
                "`{{ name }}` was removed in Solid 2.0; on a native element it is a compile error. `class` takes the object itself. Fix: `{{ fix }}`.",
            preferClassObject:
                "`{{ classnames }}(…)` turns the object into a string, which replaces the whole `class` attribute on every change. Solid 2.0's `class` takes the object and toggles single classes. Fix: `{{ fix }}`."
        }
    },
    defaultOptions: [],
    create(context) {
        const classnames = context.options[0]?.classnames ?? DEFAULT_CLASSNAMES;
        const sourceCode = getSourceCode(context);
        // An attribute's value as an expression: `"a"` or the braced code.
        const valueText = (attribute) => {
            if (!attribute.value) {
                return "true";
            }
            return sourceCode.getText(
                attribute.value.type === "JSXExpressionContainer"
                    ? attribute.value.expression
                    : attribute.value
            );
        };
        return {
            JSXAttribute(node) {
                const name = jsxPropName(node);

                // `classList={{...}}` no longer exists; the object belongs on
                // `class`. JSX prop names are case-sensitive, so matching only
                // the lowercase spelling missed every real Solid 1 call site —
                // which is the code this rule exists to migrate.
                if (name === "classList" || name === "classlist") {
                    // With a `class` attribute next to it, renaming would
                    // write the attribute twice (a parse error in TSX); the
                    // two have to be merged by hand.
                    const classAttribute = node.parent.attributes.find(
                        (attribute) =>
                            attribute.type === "JSXAttribute" &&
                            jsxPropName(attribute) === "class"
                    );
                    const hasClassAttribute = classAttribute !== undefined;
                    context.report({
                        node,
                        messageId: "classlistRemoved",
                        data: {
                            name,
                            // Next to a `class`, both go into the array form.
                            fix: messageCode(
                                hasClassAttribute
                                    ? `class={[${valueText(classAttribute)}, ${valueText(node)}]}`
                                    : `class={${valueText(node)}}`,
                                hasClassAttribute
                                    ? 'class={["card", { active: active() }]}'
                                    : "class={{ active: active() }}"
                            )
                        },
                        fix: hasClassAttribute
                            ? null
                            : (fixer) => fixer.replaceText(node.name, "class")
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
                        data: {
                            classnames: expr.callee.name,
                            fix: messageCode(
                                `class={${sourceCode.getText(expr.arguments[0])}}`,
                                "class={{ active: active() }}"
                            )
                        },
                        fix: (fixer) => {
                            const objectRange = expr.arguments[0].range;
                            return [
                                fixer.replaceTextRange(
                                    [node.range[0], objectRange[0]],
                                    "class={"
                                ),
                                fixer.replaceTextRange(
                                    [objectRange[1], node.range[1]],
                                    "}"
                                )
                            ];
                        }
                    });
                }
            }
        };
    }
};
