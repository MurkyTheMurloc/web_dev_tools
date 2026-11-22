import { getSourceCode } from "../compat.mjs";
import {
    isDOMElementName,
    jsxGetProp,
    jsxHasProp,
    messageCode
} from "../utils.mjs";

const REACT_SPECIFIC_PROPS = [
    { from: "className", to: "class" },
    { from: "htmlFor", to: "for" }
];

export const noReactSpecificPropsRule = {
    meta: {
        docs: {
            description:
                "Disallow usage of React-specific className/htmlFor props.",
            url: "https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-react-specific-props.md"
        },
        fixable: "code",
        messages: {
            noUselessKey:
                "`key` on `<{{element}}>` is React's list key. Solid gives it no meaning and sets it as a plain `key` attribute; `<For>` keys rows by item identity. Fix: remove `{{key}}`; to key a list by a field, `<For each={items()} keyed={(item) => item.id}>`.",
            prefer: "`{{ from }}` is React's name for `{{ to }}`, and Solid 2.0 has no such alias: {{ effect }}. Fix: `{{ fix }}`{{ merge }}."
        },
        schema: [],
        type: "problem"
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

                    const hasTarget = jsxHasProp(node.attributes, to);
                    const value = attribute.value
                        ? `=${getSourceCode(context).getText(attribute.value)}`
                        : "";
                    context.report({
                        data: {
                            from,
                            to,
                            effect:
                                node.name.type === "JSXIdentifier" &&
                                isDOMElementName(node.name.name)
                                    ? `it sets an unknown \`${from}\` attribute and the element gets no \`${to}\``
                                    : `the component receives a \`${from}\` prop, not \`${to}\``,
                            fix: messageCode(`${to}${value}`, `${to}={…}`),
                            merge: hasTarget
                                ? `, merged into the \`${to}\` the element already has`
                                : ""
                        },
                        fix,
                        messageId: "prefer",
                        node: attribute
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
                        data: {
                            element: node.name.name,
                            key: messageCode(
                                getSourceCode(context).getText(keyProp),
                                "key"
                            )
                        },
                        fix(fixer) {
                            return fixer.remove(keyProp);
                        },
                        messageId: "noUselessKey",
                        node: keyProp
                    });
                }
            }
        };
    }
};
