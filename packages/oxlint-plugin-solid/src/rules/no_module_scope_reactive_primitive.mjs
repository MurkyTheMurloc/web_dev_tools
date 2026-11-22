// Ported from eslint-plugin-solid 0.20.1 (no-module-scope-reactive-primitive).
// Reactive state created at module scope is shared across every request when
// server rendering, so one user's state leaks into another's response. Any
// enclosing function is the escape hatch, `createRoot` included.
import { findParent, isFunctionNode, trackImports } from "../utils.mjs";

// Upstream's list plus createTrackedEffect and createReaction, which Solid
// 2.0 exports and which own state the same way.
const REACTIVE_PRIMITIVES = [
    "createSignal",
    "createMemo",
    "createDeferred",
    "createStore",
    "createEffect",
    "createRenderEffect",
    "createTrackedEffect",
    "createReaction",
    "createOptimistic",
    "createOptimisticStore",
    "createProjection"
];

export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow reactive primitives at module scope, where state is shared across SSR requests.",
            url: "https://github.com/solidjs/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-module-scope-reactive-primitive.md"
        },
        schema: [],
        messages: {
            moduleScopePrimitive:
                "{{name}} at module scope creates state shared across all SSR requests. Create it inside a component or provider, or wrap it in `createRoot` if module-level state is intentional (client-only)."
        }
    },
    defaultOptions: [],
    create(context) {
        const { matchImport, handleImportDeclaration } = trackImports();
        return {
            ImportDeclaration: handleImportDeclaration,
            CallExpression(node) {
                if (node.callee.type !== "Identifier") {
                    return;
                }
                if (!matchImport(REACTIVE_PRIMITIVES, node.callee.name)) {
                    return;
                }
                if (findParent(node, isFunctionNode) === null) {
                    context.report({
                        data: { name: node.callee.name },
                        messageId: "moduleScopePrimitive",
                        node
                    });
                }
            }
        };
    }
};
