import { getSourceCode } from "../compat.mjs";
import {
    isFunctionNode,
    trackImports,
    isPropsByName,
    messageCode,
    trace
} from "../utils.mjs";
// Store APIs that hand back a Proxy. Solid 2.0 exports these from `solid-js`.
const PROXY_BACKED_STORE_APIS = new Set([
    "createStore",
    "createProjection",
    "createOptimisticStore"
]);
export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow usage of APIs that use ES6 Proxies, only to target environments that don't support them.",
            url: "https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-proxy-apis.md"
        },
        schema: [],
        messages: {
            noStore:
                "`{{name}}` returns a store, which is a Proxy, and this rule is on because the target environment has no Proxy. Fix: keep the state in signals, `createSignal(initial)`, and replace the value on update; if every target has Proxy, turn `solid/no-proxy-apis` off in the lint config.",
            spreadCall:
                "`{...{{expression}}}` spreads a call, so Solid wraps it in a Proxy to keep it reactive, and the target environment has no Proxy. Fix: pass the props one by one, `name={{{expression}}.name}`, or spread a plain object.",
            spreadMember:
                "`{...{{expression}}}` spreads a property access, so Solid wraps it in a Proxy to keep it reactive, and the target environment has no Proxy. Fix: pass the props one by one, `name={{{expression}}.name}`, or spread a plain object.",
            proxyLiteral:
                "`{{expression}}` creates a Proxy, and the target environment has no Proxy, which cannot be polyfilled. Fix: use a plain object, with getters (`get value() { … }`) where a read must compute.",
            mergeProps:
                "`{{name}}` gets `{{argument}}`, which may be a function or a store, and reading such a source live needs a Proxy, which the target environment does not have. Fix: pass plain objects, with a getter for a value that must stay live, `{{name}}({ get size() { return size(); } }, props)`."
        }
    },
    defaultOptions: [],
    create(context) {
        const { matchImport, handleImportDeclaration } = trackImports();
        const sourceCode = getSourceCode(context);
        const code = (node, fallback) =>
            messageCode(sourceCode.getText(node), fallback);
        return {
            ImportDeclaration(node) {
                handleImportDeclaration(node); // track import aliases
                const source = node.source.value;
                // Solid 1.x isolated the Proxy-backed store APIs behind
                // `solid-js/store`, so the import path alone was the signal.
                // Solid 2.0 moved them into `solid-js`, which every file
                // imports, so match the specifier names instead.
                if (source === "solid-js/store") {
                    context.report({
                        node,
                        messageId: "noStore",
                        data: { name: "solid-js/store" }
                    });
                    return;
                }
                if (source !== "solid-js") {
                    return;
                }
                for (const specifier of node.specifiers) {
                    if (
                        specifier.type === "ImportSpecifier" &&
                        PROXY_BACKED_STORE_APIS.has(specifier.imported.name)
                    ) {
                        context.report({
                            node: specifier,
                            messageId: "noStore",
                            data: { name: specifier.imported.name }
                        });
                    }
                }
            },
            "JSXSpreadAttribute MemberExpression"(node) {
                context.report({
                    node,
                    messageId: "spreadMember",
                    data: { expression: code(node, "props.rest") }
                });
            },
            "JSXSpreadAttribute CallExpression"(node) {
                context.report({
                    node,
                    messageId: "spreadCall",
                    data: { expression: code(node, "getProps()") }
                });
            },
            CallExpression(node) {
                if (node.callee.type === "Identifier") {
                    if (
                        matchImport(["merge", "mergeProps"], node.callee.name)
                    ) {
                        node.arguments
                            .filter((arg) => {
                                if (arg.type === "SpreadElement") return true;
                                const traced = trace(arg, context);
                                return (
                                    (traced.type === "Identifier" &&
                                        !isPropsByName(traced.name)) ||
                                    isFunctionNode(traced)
                                );
                            })
                            .forEach((badArg) => {
                                context.report({
                                    node: badArg,
                                    messageId: "mergeProps",
                                    data: {
                                        argument: code(badArg, "…"),
                                        name: node.callee.name
                                    }
                                });
                            });
                    }
                } else if (node.callee.type === "MemberExpression") {
                    if (
                        node.callee.object.type === "Identifier" &&
                        node.callee.object.name === "Proxy" &&
                        node.callee.property.type === "Identifier" &&
                        node.callee.property.name === "revocable"
                    ) {
                        context.report({
                            node,
                            messageId: "proxyLiteral",
                            data: {
                                expression: code(node, "Proxy.revocable(…)")
                            }
                        });
                    }
                }
            },
            NewExpression(node) {
                if (
                    node.callee.type === "Identifier" &&
                    node.callee.name === "Proxy"
                ) {
                    context.report({
                        node,
                        messageId: "proxyLiteral",
                        data: { expression: code(node, "new Proxy(…)") }
                    });
                }
            }
        };
    }
};
