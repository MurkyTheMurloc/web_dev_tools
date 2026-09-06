import {
    isFunctionNode,
    trackImports,
    isPropsByName,
    trace,
} from "../utils.mjs";
// Store APIs that hand back a Proxy. Solid 2.0 exports these from `solid-js`.
const PROXY_BACKED_STORE_APIS = new Set([
    "createStore",
    "createProjection",
    "createOptimisticStore",
]);
export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow usage of APIs that use ES6 Proxies, only to target environments that don't support them.",
            url: "https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-proxy-apis.md",
        },
        schema: [],
        messages: {
            noStore:
                "Solid Store APIs use Proxies, which are incompatible with your target environment.",
            spreadCall:
                "Using a function call in JSX spread makes Solid use Proxies, which are incompatible with your target environment.",
            spreadMember:
                "Using a property access in JSX spread makes Solid use Proxies, which are incompatible with your target environment.",
            proxyLiteral:
                "Proxies are incompatible with your target environment.",
            mergeProps:
                "If you pass a function to `mergeProps`, it will create a Proxy, which are incompatible with your target environment.",
        },
    },
    defaultOptions: [],
    create(context) {
        const { matchImport, handleImportDeclaration } = trackImports();
        return {
            ImportDeclaration(node) {
                handleImportDeclaration(node); // track import aliases
                const source = node.source.value;
                // Solid 1.x isolated the Proxy-backed store APIs behind
                // `solid-js/store`, so the import path alone was the signal.
                // Solid 2.0 moved them into `solid-js`, which every file
                // imports, so match the specifier names instead.
                if (source === "solid-js/store") {
                    context.report({ node, messageId: "noStore" });
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
                        });
                    }
                }
            },
            "JSXSpreadAttribute MemberExpression"(node) {
                context.report({ node, messageId: "spreadMember" });
            },
            "JSXSpreadAttribute CallExpression"(node) {
                context.report({ node, messageId: "spreadCall" });
            },
            CallExpression(node) {
                if (node.callee.type === "Identifier") {
                    if (matchImport(["merge", "mergeProps"], node.callee.name)) {
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
                        });
                    }
                }
            },
            NewExpression(node) {
                if (
                    node.callee.type === "Identifier" &&
                    node.callee.name === "Proxy"
                ) {
                    context.report({ node, messageId: "proxyLiteral" });
                }
            },
        };
    },
};
