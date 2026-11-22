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
            url: "https://github.com/MurkyTheMurloc/web_dev_tools/blob/main/docs/solid-2-effects.md"
        },
        schema: [],
        messages: {
            singleArgEffect:
                "`{{name}}` is called with one function, a form Solid 2.0 removed: it throws MISSING_EFFECT_FN in dev. Fix: split it into a tracked compute that reads the values and an untracked effect that does the work, `{{name}}(() => source(), (value) => doWork(value))`. For a derived value use `createMemo(() => …)` instead; for one-time work after mount use `onSettled(() => …)`.",
            singleArgRenderEffect:
                "`{{name}}` is called with one function, a form Solid 2.0 does not have: the function runs only as the tracked compute, with no effect phase. Fix: split it into a tracked compute that reads the values and an untracked effect that does the work, `{{name}}(() => source(), (value) => doWork(value))`. For a derived value use `createMemo(() => …)` instead."
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
                    context.report({
                        data: { name: node.callee.name },
                        messageId: "singleArgEffect",
                        node
                    });
                } else if (
                    matchImport("createRenderEffect", node.callee.name)
                ) {
                    context.report({
                        data: { name: node.callee.name },
                        messageId: "singleArgRenderEffect",
                        node
                    });
                }
            }
        };
    }
};
