import { getSourceCode } from "../compat.mjs";
import { isDOMElementName, messageCode } from "../utils.mjs";
// Solid 2.0 removed every Solid-specific JSX namespace. What is left are the
// XML namespaces the DOM itself defines.
const xmlNamespaces = ["xmlns", "xlink"];
const REMOVED = "which Solid 2.0 removed.";
const LOWERCASE_EVENT = /^[a-z]+$/;
// Removed namespace -> why, and the replacement written with the prop's own
// name (`name`), its `=value` (`assign`) and its value as an expression
// (`value`).
const replacements = {
    attr: {
        why: `${REMOVED} Attributes are the default.`,
        fix: ({ name, assign }) => `${name}${assign}`
    },
    bool: {
        why: `${REMOVED} A boolean value adds or removes the attribute.`,
        fix: ({ name, assign }) => `${name}${assign}`
    },
    class: {
        why: `${REMOVED} \`class\` takes an object.`,
        fix: ({ name, value }) => `class={{ "${name}": ${value} }}`
    },
    on: {
        why: `${REMOVED} Event props are camelCase.`,
        // `onClick` listens to `click`; any other event name needs a ref.
        fix: ({ name, value }) =>
            LOWERCASE_EVENT.test(name)
                ? `on${name[0].toUpperCase()}${name.slice(1)}={${value}}`
                : `ref={(el) => el.addEventListener("${name}", ${value})}`
    },
    oncapture: {
        why: `${REMOVED} Listener options go through a ref callback.`,
        fix: ({ name, value }) =>
            `ref={(el) => el.addEventListener("${name}", ${value}, { capture: true })}`
    },
    prop: {
        why: "which Solid 2.0's types reject on built-in elements: Solid sets `value`, `checked` and the like as properties from the plain name. (On a custom element such as `<my-chart prop:data={…}>`, `prop:` is right and not reported.)",
        fix: ({ name, assign }) => `${name}${assign}`
    },
    style: {
        why: `${REMOVED} \`style\` takes an object.`,
        fix: ({ name, value }) => `style={{ "${name}": ${value} }}`
    },
    use: {
        why: `${REMOVED} A directive is now a factory that returns the ref callback \`(el) => { … }\`.`,
        fix: ({ name, assign, value }) =>
            assign === "" ? `ref={${name}}` : `ref={${name}(${value})}`
    }
};
export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow Solid's removed JSX attribute namespaces. Solid 2.0 dropped `on:`, `oncapture:`, `use:`, `prop:`, `attr:`, `bool:`, `class:` and `style:`.",
            url: "https://docs.solidjs.com/"
        },
        schema: [
            {
                type: "object",
                properties: {
                    allowedNamespaces: {
                        description:
                            "an array of additional namespace names to allow",
                        type: "array",
                        items: {
                            type: "string"
                        },
                        minItems: 1,
                        uniqueItems: true
                    },
                    allowedNamespacedProps: {
                        description:
                            "an array of exact namespaced prop names to allow, such as `client:visible`",
                        type: "array",
                        items: {
                            type: "string",
                            pattern: "^[^:]+:[^:]+$"
                        },
                        minItems: 1,
                        uniqueItems: true
                    }
                },
                additionalProperties: false
            }
        ],
        messages: {
            removed:
                "`{{attribute}}` uses the `{{namespace}}:` namespace, {{why}} Fix: `{{fix}}`.",
            unknown:
                '`{{attribute}}` uses the `{{namespace}}:` namespace, which neither Solid 2.0 nor the DOM knows, so it is set as a literal `{{attribute}}` attribute. Fix: the plain name `{{name}}`, or, when a framework gives `{{namespace}}:` a meaning, allow it with this rule\'s `allowedNamespacedProps` option (`"{{attribute}}"`).',
            component:
                '`{{attribute}}` on `<{{element}}>` is a namespaced prop, and Solid gives a namespace no meaning on a component. Fix: a plain prop name, or, when a framework handles it (an island directive), allow it with this rule\'s `allowedNamespacedProps` option (`"{{attribute}}"`).'
        }
    },
    defaultOptions: [],
    create(context) {
        const explicitlyAllowedNamespaces =
            context.options?.[0]?.allowedNamespaces;
        const explicitlyAllowedProps =
            context.options?.[0]?.allowedNamespacedProps;
        const sourceCode = getSourceCode(context);
        return {
            "JSXAttribute > JSXNamespacedName": (node) => {
                const namespace = node.namespace?.name;
                // Both allow lists cover every element: a framework can give a
                // namespace meaning on components (`<Island client:visible>`).
                // `allowedNamespacedProps` names single props, so a typo or an
                // unsupported prop of the same namespace is still reported.
                if (
                    explicitlyAllowedNamespaces?.includes(namespace) ||
                    explicitlyAllowedProps?.includes(
                        `${namespace}:${node.name?.name}`
                    )
                ) {
                    return;
                }
                const openingElement = node.parent.parent;
                const attribute = `${namespace}:${node.name?.name}`;
                if (
                    openingElement.name.type === "JSXIdentifier" &&
                    !isDOMElementName(openingElement.name.name)
                ) {
                    // Solid itself gives a namespaced prop on a component no
                    // meaning. No suggestion: deleting the prefix changes the
                    // prop's name, and the rule cannot know which one is meant.
                    context.report({
                        node,
                        messageId: "component",
                        data: {
                            attribute,
                            element: sourceCode.getText(openingElement.name)
                        }
                    });
                    return;
                }
                if (xmlNamespaces.includes(namespace)) {
                    return;
                }
                // `prop:` is how Solid 2.0 sets a property on a custom element
                // (`<my-chart prop:data={points()}>` is `el.data = points()`),
                // typed through JSX.ExplicitProperties. Only built-in elements,
                // whose properties Solid sets from the plain name, are reported.
                if (
                    namespace === "prop" &&
                    openingElement.name.type === "JSXIdentifier" &&
                    openingElement.name.name.includes("-")
                ) {
                    return;
                }
                const replacement = replacements[namespace];
                if (replacement) {
                    const { value } = node.parent;
                    const parts = {
                        name: node.name.name,
                        assign: value ? `=${sourceCode.getText(value)}` : "",
                        value: value
                            ? sourceCode.getText(
                                  value.type === "JSXExpressionContainer"
                                      ? value.expression
                                      : value
                              )
                            : "true"
                    };
                    context.report({
                        node,
                        messageId: "removed",
                        data: {
                            attribute,
                            namespace,
                            why: replacement.why,
                            fix: messageCode(
                                replacement.fix(parts),
                                replacement.fix({
                                    name: parts.name,
                                    assign: value ? "={…}" : "",
                                    value: "…"
                                })
                            )
                        }
                    });
                    return;
                }
                context.report({
                    node,
                    messageId: "unknown",
                    data: { attribute, namespace, name: node.name.name }
                });
            }
        };
    }
};
