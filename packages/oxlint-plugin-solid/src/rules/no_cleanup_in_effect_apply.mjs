// `onCleanup` registers on the current owner. An effect function runs
// imperatively with no owner (NO_OWNER_CLEANUP: the cleanup never runs), and
// `onSettled` and `createTrackedEffect` callbacks forbid it
// (CLEANUP_IN_FORBIDDEN_SCOPE). All of them take a returned cleanup instead.
// Ref callbacks also throw CLEANUP_IN_FORBIDDEN_SCOPE; no-owned-primitives-in-ref
// reports those.
import { getSourceCode } from "../compat.mjs";
import { isFunctionNode, trackImports, walkOwnBody } from "../utils.mjs";

const EFFECTS = ["createEffect", "createRenderEffect"];
const FORBIDDEN = ["onSettled", "createTrackedEffect"];
const BUNDLE_KEYS = new Set(["effect", "error"]);

/** The call `fn` is passed to, and whether `fn` arrives as a bundle member. */
function callOf(fn) {
    const { parent } = fn;
    if (parent?.type === "CallExpression") {
        return { call: parent, index: parent.arguments.indexOf(fn) };
    }

    // `createEffect(compute, { effect: (v) => …, error: (e) => … })`
    if (
        parent?.type === "Property" &&
        parent.value === fn &&
        !parent.computed &&
        BUNDLE_KEYS.has(parent.key.name ?? parent.key.value) &&
        parent.parent.parent?.type === "CallExpression"
    ) {
        const call = parent.parent.parent;

        return {
            bundle: true,
            call,
            index: call.arguments.indexOf(parent.parent)
        };
    }

    return null;
}

/** True when `fn` itself returns something (nested functions aside). */
function hasReturn(fn) {
    if (fn.body.type !== "BlockStatement") {
        return true;
    }
    let found = false;
    walkOwnBody(fn.body, (node) => {
        found ||= node.type === "ReturnStatement";
    });

    return found;
}

export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow `onCleanup` in an effect function, an `onSettled` callback or a `createTrackedEffect` callback; return the cleanup instead.",
            url: "https://github.com/MurkyTheMurloc/web_dev_tools/blob/main/docs/solid-2-effects.md"
        },
        hasSuggestions: true,
        schema: [],
        messages: {
            cleanupInEffectFn:
                "`{{name}}` is called in the effect function of `{{api}}`, which runs without an owner, so the cleanup never runs and whatever it releases leaks (Solid warns NO_OWNER_CLEANUP in dev). Fix: return the cleanup from the effect function, `return {{cleanup}};`; it runs before the next run and on disposal. Do not: move `{{name}}` into the compute function (a compute function only reads), wrap it in `runWithOwner`, or disable the rule.",
            cleanupInForbiddenScope:
                "`{{name}}` is called in the `{{api}}` callback, where Solid 2.0 forbids it and throws CLEANUP_IN_FORBIDDEN_SCOPE in dev. Fix: return the cleanup from the callback, `return {{cleanup}};`; it runs when the owner is disposed. Do not: wrap `{{name}}` in `runWithOwner` or a nested function, or disable the rule.",
            returnCleanup: "Return the cleanup instead."
        }
    },
    defaultOptions: [],
    create(context) {
        const { matchImport, handleImportDeclaration } = trackImports();
        const sourceCode = getSourceCode(context);

        return {
            ImportDeclaration: handleImportDeclaration,
            CallExpression(node) {
                if (
                    node.callee.type !== "Identifier" ||
                    !matchImport("onCleanup", node.callee.name)
                ) {
                    return;
                }

                let fn = node.parent;
                while (fn && !isFunctionNode(fn)) {
                    fn = fn.parent;
                }
                const target = fn && callOf(fn);
                if (
                    target?.call.callee.type !== "Identifier" ||
                    target.call.arguments.some(
                        (arg) => arg.type === "SpreadElement"
                    )
                ) {
                    return;
                }

                const api = target.call.callee.name;
                const isEffectFn =
                    matchImport(EFFECTS, api) && target.index === 1;
                const isForbidden =
                    matchImport(FORBIDDEN, api) &&
                    target.index === 0 &&
                    !target.bundle;
                if (!isEffectFn && !isForbidden) {
                    return;
                }

                const [argument] = node.arguments;
                const cleanup = argument
                    ? sourceCode.getText(argument)
                    : "() => …";
                const statement = node.parent;
                // `onCleanup(fn)` as the last statement of a callback that
                // returns nothing else becomes `return fn`.
                const canFix =
                    argument &&
                    statement.type === "ExpressionStatement" &&
                    statement.parent === fn.body &&
                    fn.body.body.at(-1) === statement &&
                    !hasReturn(fn);

                context.report({
                    data: {
                        api,
                        cleanup: cleanup.includes("\n")
                            ? "() => { … }"
                            : cleanup,
                        name: node.callee.name
                    },
                    messageId: isEffectFn
                        ? "cleanupInEffectFn"
                        : "cleanupInForbiddenScope",
                    node,
                    suggest: canFix
                        ? [
                              {
                                  messageId: "returnCleanup",
                                  fix: (fixer) =>
                                      fixer.replaceText(
                                          statement,
                                          `return ${cleanup};`
                                      )
                              }
                          ]
                        : []
                });
            }
        };
    }
};
