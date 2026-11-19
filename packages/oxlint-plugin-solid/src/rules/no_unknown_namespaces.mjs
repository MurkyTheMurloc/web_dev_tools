import { isDOMElementName } from "../utils.mjs";
// Solid 2.0 removed every Solid-specific JSX namespace. What is left are the
// XML namespaces the DOM itself defines.
const xmlNamespaces = ["xmlns", "xlink"];
// Removed namespace -> what to write instead.
const replacements = {
    attr: "the standard attribute",
    bool: "the standard attribute (booleans are presence/absence)",
    class: "the `class` prop with an object or array value",
    on: "a camel-case event prop such as `onClick`, or a ref callback with `addEventListener` when listener options are needed",
    oncapture:
        "a camel-case event prop, or a ref callback with `addEventListener` when capture is needed",
    prop: "the standard property",
    style: "the `style` prop with an object value",
    use: "a ref callback or directive factory, composing with a ref array",
};
export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow Solid's removed JSX attribute namespaces. Solid 2.0 dropped `on:`, `oncapture:`, `use:`, `prop:`, `attr:`, `bool:`, `class:` and `style:`.",
            url: "https://docs.solidjs.com/",
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
                            type: "string",
                        },
                        default: [],
                        minItems: 1,
                        uniqueItems: true,
                    },
                },
                additionalProperties: false,
            },
        ],
        messages: {
            removed:
                "'{{namespace}}:' was removed in Solid 2.0. Use {{replacement}} instead.",
            unknown:
                "'{{namespace}}:' is not a namespace Solid understands. Solid 2.0 has no special JSX prefixes.",
            component: "Namespaced props have no effect on components.",
        },
    },
    defaultOptions: [],
    create(context) {
        const explicitlyAllowedNamespaces =
            context.options?.[0]?.allowedNamespaces;
        return {
            "JSXAttribute > JSXNamespacedName": (node) => {
                const namespace = node.namespace?.name;
                // The allow list covers every element: a framework can give a
                // namespace meaning on components (`<Island client:visible>`).
                if (explicitlyAllowedNamespaces?.includes(namespace)) {
                    return;
                }
                const openingElement = node.parent.parent;
                if (
                    openingElement.name.type === "JSXIdentifier" &&
                    !isDOMElementName(openingElement.name.name)
                ) {
                    // Solid itself gives a namespaced prop on a component no
                    // meaning. No suggestion: deleting the prefix changes the
                    // prop's name, and the rule cannot know which one is meant.
                    context.report({ node, messageId: "component" });
                    return;
                }
                if (xmlNamespaces.includes(namespace)) {
                    return;
                }
                const replacement = replacements[namespace];
                if (replacement) {
                    context.report({
                        node,
                        messageId: "removed",
                        data: { namespace, replacement },
                    });
                    return;
                }
                context.report({
                    node,
                    messageId: "unknown",
                    data: { namespace },
                });
            },
        };
    },
};
