import { getSourceCode } from "../compat.mjs";
import { jsxGetAllProps, messageCode } from "../utils.mjs";
export default {
    meta: {
        type: "problem",
        docs: {
            description: "Disallow passing the same prop twice in JSX.",
            url: "https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/jsx-no-duplicate-props.md"
        },
        schema: [
            {
                type: "object",
                properties: {
                    ignoreCase: {
                        type: "boolean",
                        description:
                            "Consider two prop names differing only by case to be the same.",
                        default: false
                    }
                },
                additionalProperties: false
            }
        ],
        messages: {
            noDuplicateProps:
                "`{{name}}` is passed twice. The later value overwrites the earlier one, and as two JSX attributes TypeScript rejects it (TS17001). Fix: keep the one `{{name}}` you mean and delete the other.",
            noDuplicateClass:
                "`class` is passed twice. One value overwrites the other, and as two JSX attributes TypeScript rejects it (TS17001). Fix: one `class` with both values in the array form, `{{fix}}`.",
            noDuplicateChildren:
                "{{used}} each set the element's content, so one replaces the other. Fix: keep one of them: JSX children for markup, `textContent` for plain text, `innerHTML` for trusted HTML."
        }
    },
    defaultOptions: [],
    create(context) {
        return {
            JSXOpeningElement(node) {
                const ignoreCase = context.options[0]?.ignoreCase ?? false;
                const props = new Set();
                // The first node of each name, for the merged `class` fix.
                const firstNodes = new Map();
                const sourceCode = getSourceCode(context);
                // The value of the prop whose name is `nameNode`: an
                // attribute's string or expression, or a spread property's.
                const valueText = (nameNode) => {
                    const { value } = nameNode.parent;
                    if (!value) {
                        return "true";
                    }
                    return sourceCode.getText(
                        value.type === "JSXExpressionContainer"
                            ? value.expression
                            : value
                    );
                };
                const checkPropName = (name, node) => {
                    const written = name;
                    if (ignoreCase || name.startsWith("on")) {
                        name = name
                            .toLowerCase()
                            .replace(/^on(?:capture)?:/, "on")
                            .replace(/^(?:attr|prop):/, "");
                    }
                    if (props.has(name)) {
                        context.report({
                            node,
                            messageId:
                                name === "class"
                                    ? "noDuplicateClass"
                                    : "noDuplicateProps",
                            data: {
                                name: written,
                                fix: messageCode(
                                    `class={[${valueText(firstNodes.get(name))}, ${valueText(node)}]}`,
                                    'class={["card", { active: active() }]}'
                                )
                            }
                        });
                    } else {
                        firstNodes.set(name, node);
                    }
                    props.add(name);
                };
                for (const [name, propNode] of jsxGetAllProps(
                    node.attributes
                )) {
                    checkPropName(name, propNode);
                }
                const hasChildrenProp = props.has("children");
                const hasChildren = node.parent.children.length > 0;
                const hasInnerHTML =
                    props.has("innerHTML") || props.has("innerhtml");
                const hasTextContent =
                    props.has("textContent") || props.has("textContent");
                const used = [
                    hasChildrenProp && "`children`",
                    hasChildren && "JSX children",
                    hasInnerHTML && "`innerHTML`",
                    hasTextContent && "`textContent`"
                ].filter(Boolean);
                if (used.length > 1) {
                    context.report({
                        node,
                        messageId: "noDuplicateChildren",
                        data: {
                            used: used.join(", ")
                        }
                    });
                }
            }
        };
    }
};
