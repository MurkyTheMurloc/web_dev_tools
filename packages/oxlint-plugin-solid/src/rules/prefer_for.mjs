import { getPropertyName } from "@eslint-community/eslint-utils";

import { getSourceCode } from "../compat.mjs";
import {
    isFunctionNode,
    isJSXElementOrFragment,
    messageCode
} from "../utils.mjs";
export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Enforce using Solid's `<For />` component for mapping an array to JSX elements.",
            url: "https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/prefer-for.md"
        },
        fixable: "code",
        schema: [],
        messages: {
            preferFor:
                "`{{array}}.map(…)` in JSX re-runs the whole map when `{{array}}` changes, so the DOM of every row is created again. Fix: `<For each={{{array}}}>{{{callback}}}</For>`.",
            preferForOrIndex:
                "`{{array}}.map(…)` in JSX re-runs the whole map when `{{array}}` changes, so the DOM of every row is created again. Fix: `<For each={{{array}}}>{({{item}}, {{index}}) => …}</For>`, where `{{index}}` is an accessor (read `{{index}}()`); with `keyed={false}`, `{{item}}` is the accessor (`{{item}}()`) and `{{index}}` a plain number."
        }
    },
    defaultOptions: [],
    create(context) {
        const sourceCode = getSourceCode(context);
        const arrayText = (node) =>
            messageCode(sourceCode.getText(node.callee.object), "items()");
        const reportPreferFor = (node) => {
            const jsxExpressionContainerNode = node.parent;
            const arrayNode = node.callee.object;
            const mapFnNode = node.arguments[0];
            context.report({
                node,
                messageId: "preferFor",
                data: {
                    array: arrayText(node),
                    callback: messageCode(
                        sourceCode.getText(mapFnNode),
                        "(item) => …"
                    )
                },
                fix: (fixer) => {
                    const beforeArray = [
                        jsxExpressionContainerNode.range[0],
                        arrayNode.range[0]
                    ];
                    const betweenArrayAndMapFn = [
                        arrayNode.range[1],
                        mapFnNode.range[0]
                    ];
                    const afterMapFn = [
                        mapFnNode.range[1],
                        jsxExpressionContainerNode.range[1]
                    ];
                    // We can insert the <For /> component
                    return [
                        fixer.replaceTextRange(beforeArray, "<For each={"),
                        fixer.replaceTextRange(betweenArrayAndMapFn, "}>{"),
                        fixer.replaceTextRange(afterMapFn, "}</For>")
                    ];
                }
            });
        };
        return {
            CallExpression(node) {
                const callOrChain =
                    node.parent?.type === "ChainExpression"
                        ? node.parent
                        : node;
                if (
                    callOrChain.parent?.type === "JSXExpressionContainer" &&
                    isJSXElementOrFragment(callOrChain.parent.parent)
                ) {
                    // check for Array.prototype.map in JSX
                    if (
                        node.callee.type === "MemberExpression" &&
                        getPropertyName(node.callee) === "map" &&
                        node.arguments.length === 1 && // passing thisArg to Array.prototype.map is rare, deopt in that case
                        isFunctionNode(node.arguments[0])
                    ) {
                        const mapFnNode = node.arguments[0];
                        if (
                            mapFnNode.params.length === 1 &&
                            mapFnNode.params[0].type !== "RestElement"
                        ) {
                            // The map fn doesn't take an index param, so it can't possibly be an index-keyed list. Use <For />.
                            // The returned JSX, if it's coming from React, will have an unnecessary `key` prop to be removed in
                            // the useless-keys rule.
                            reportPreferFor(node);
                        } else {
                            // Too many possible solutions to make a suggestion or fix
                            const [item, index] = mapFnNode.params.map(
                                (param) => {
                                    if (param.type === "RestElement") {
                                        return null;
                                    }
                                    return param.type === "Identifier"
                                        ? param.name
                                        : sourceCode.getText(param);
                                }
                            );
                            context.report({
                                node,
                                messageId: "preferForOrIndex",
                                data: {
                                    array: arrayText(node),
                                    item: item ?? "item",
                                    index: index ?? "index"
                                }
                            });
                        }
                    }
                }
            }
        };
    }
};
