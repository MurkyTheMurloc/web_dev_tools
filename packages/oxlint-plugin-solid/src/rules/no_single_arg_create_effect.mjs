// Ported from eslint-plugin-solid 0.20.1 (no-single-arg-create-effect).
// Solid 2.0 splits effects into a tracked compute function and an untracked
// effect function: `createEffect(compute, effect)`. The single-argument 1.x
// form types as `never` through a deprecated overload, which gives no compile
// error on a bare statement, and throws MISSING_EFFECT_FN only at runtime in
// dev. Async or not makes no difference.
import { trackImports } from "../utils.mjs";

export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Require the two-argument `createEffect(compute, effect)` form used by Solid 2.0.",
            url: "https://github.com/solidjs/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-single-arg-create-effect.md"
        },
        schema: [],
        messages: {
            singleArgEffect:
                "In Solid 2.0, createEffect takes separate compute and effect functions: `createEffect(() => signal(), (value) => doWork(value))`. For a derived value use `createMemo`; for a one-shot side effect, just call the function directly.",
            singleArgRenderEffect:
                "In Solid 2.0, createRenderEffect takes separate compute and effect functions: `createRenderEffect(() => signal(), (value) => doWork(value))`."
        }
    },
    defaultOptions: [],
    create(context) {
        const { matchImport, handleImportDeclaration } = trackImports();
        return {
            ImportDeclaration: handleImportDeclaration,
            CallExpression(node) {
                if (
                    node.callee.type !== "Identifier" ||
                    node.arguments.length !== 1
                ) {
                    return;
                }
                if (matchImport("createEffect", node.callee.name)) {
                    context.report({ messageId: "singleArgEffect", node });
                } else if (
                    matchImport("createRenderEffect", node.callee.name)
                ) {
                    context.report({
                        messageId: "singleArgRenderEffect",
                        node
                    });
                }
            }
        };
    }
};
