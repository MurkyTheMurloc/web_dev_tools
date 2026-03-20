import { ESLintUtils } from "@typescript-eslint/utils";

import { isDOMElementName, jsxGetProp, jsxHasProp } from "../utils.mjs";

const createRule = ESLintUtils.RuleCreator.withoutDocs;
const REACT_SPECIFIC_PROPS = [
    { from: "className", to: "class" },
    { from: "htmlFor", to: "for" },
];

export const noReactSpecificPropsRule = createRule({
    meta: {
        docs: {
            description:
                "Disallow usage of React-specific className/htmlFor props.",
            url: "https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-react-specific-props.md",
        },
        fixable: "code",
        messages: {
            noUselessKey:
                "Elements in a <For> or <Index> list do not need a key prop.",
            prefer: "Prefer the `{{ to }}` prop over the deprecated `{{ from }}` prop.",
        },
        schema: [],
        type: "problem",
    },
    defaultOptions: [],
    create(context) {
        return {
            JSXOpeningElement(node) {
                for (const { from, to } of REACT_SPECIFIC_PROPS) {
                    const attribute = jsxGetProp(node.attributes, from);
                    if (!attribute) {
                        continue;
                    }

                    const fix = !jsxHasProp(node.attributes, to)
                        ? (fixer) => {
                              return fixer.replaceText(attribute.name, to);
                          }
                        : undefined;

                    context.report({
                        data: { from, to },
                        fix,
                        messageId: "prefer",
                        node: attribute,
                    });
                }

                if (
                    node.name.type === "JSXIdentifier" &&
                    isDOMElementName(node.name.name)
                ) {
                    const keyProp = jsxGetProp(node.attributes, "key");
                    if (!keyProp) {
                        return;
                    }

                    context.report({
                        fix(fixer) {
                            return fixer.remove(keyProp);
                        },
                        messageId: "noUselessKey",
                        node: keyProp,
                    });
                }
            },
        };
    },
});
