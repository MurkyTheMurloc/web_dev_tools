// Ported from eslint-plugin-solid 0.20.1 (no-module-scope-reactive-primitive).
// Reactive state created at module scope is shared across every request when
// server rendering, so one user's state leaks into another's response. Any
// enclosing function is the escape hatch, `createRoot` included.
import { getSourceCode } from "../compat.mjs";
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
                "`{{statement}}` runs once per process at module scope, so with server rendering every request shares this state and one user's data reaches another's response. Fix: move `{{statement}}` into the component that uses it, or into a provider component that hands it down with `<Context value={…}>`. Only for client-only state that is meant to be global: wrap it in `createRoot(() => …)`."
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
                    // The whole declaration when there is one, so the fix can
                    // move it as written.
                    const declaration = findParent(
                        node,
                        (candidate) => candidate.type === "VariableDeclaration"
                    );
                    const text = getSourceCode(context).getText(
                        declaration ?? node
                    );
                    context.report({
                        data: {
                            statement: text.includes("\n")
                                ? `${node.callee.name}(…)`
                                : text
                        },
                        messageId: "moduleScopePrimitive",
                        node
                    });
                }
            }
        };
    }
};
