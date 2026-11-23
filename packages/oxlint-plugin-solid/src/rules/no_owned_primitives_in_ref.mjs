import { isFunctionNode, jsxPropName, trackImports } from "../utils.mjs";

/**
 * Primitives that attach to the current owner.
 *
 * An effect or memo created without an owner is never disposed, and a cleanup
 * registered without one never runs.
 */
const OWNED_PRIMITIVES = [
    "createEffect",
    "createMemo",
    "createProjection",
    "createReaction",
    "createRenderEffect",
    "onCleanup",
    "onSettled"
];

/**
 * What Solid 2.0 does in dev when a ref callback creates the primitive. A ref
 * callback owns nothing, like an effect callback.
 */
function diagnosticFor(primitive) {
    if (primitive === "onCleanup") {
        return " and Solid throws CLEANUP_IN_FORBIDDEN_SCOPE in dev";
    }

    return ["onSettled", "createReaction"].includes(primitive)
        ? ""
        : " and Solid throws PRIMITIVE_IN_EFFECT_CALLBACK in dev";
}

/** The callbacks a `ref` prop applies, including the ones in a ref array. */
function getRefCallbacks(expression) {
    if (isFunctionNode(expression)) {
        return [expression];
    }

    // `ref={[storeElement, autofocus, listen(...)]}` — Solid flattens the array
    // and calls each entry, so an inline callback anywhere in it is a ref
    // callback like any other.
    if (expression?.type === "ArrayExpression") {
        return expression.elements.flatMap((element) =>
            element !== null && isFunctionNode(element) ? [element] : []
        );
    }

    return [];
}

/**
 * Walk a callback body, stopping at nested functions.
 *
 * Only calls the ref callback makes itself are reported. A nested function may
 * be handed to something that supplies an owner, and guessing wrong would flag
 * working code.
 */
function walkOwnBody(node, visit) {
    if (node === null || typeof node !== "object") {
        return;
    }

    visit(node);

    for (const [key, value] of Object.entries(node)) {
        if (key === "parent") {
            continue;
        }

        const candidates = Array.isArray(value) ? value : [value];
        for (const candidate of candidates) {
            if (
                candidate !== null &&
                typeof candidate === "object" &&
                typeof candidate.type === "string" &&
                !isFunctionNode(candidate)
            ) {
                walkOwnBody(candidate, visit);
            }
        }
    }
}

export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow creating owner-bound primitives inside a ref callback.",
            url: "https://docs.solidjs.com/"
        },
        schema: [],
        messages: {
            ownedPrimitiveInRef:
                "`{{name}}` is called inside a ref callback, which runs without an owner, so nothing disposes it{{diagnostic}}. Fix: call `{{name}}` in the component body, or in a directive factory that returns the ref callback, `const directive = () => { {{name}}(…); return (el) => { /* store or update el */ }; }` used as `ref={directive()}`; the ref callback itself only touches the element."
        }
    },
    defaultOptions: [],
    create(context) {
        const { matchImport, handleImportDeclaration } = trackImports();

        return {
            ImportDeclaration: handleImportDeclaration,
            JSXAttribute(node) {
                if (jsxPropName(node) !== "ref") {
                    return;
                }

                if (node.value?.type !== "JSXExpressionContainer") {
                    return;
                }

                for (const callback of getRefCallbacks(node.value.expression)) {
                    walkOwnBody(callback.body, (candidate) => {
                        if (
                            candidate.type !== "CallExpression" ||
                            candidate.callee.type !== "Identifier" ||
                            !matchImport(
                                OWNED_PRIMITIVES,
                                candidate.callee.name
                            )
                        ) {
                            return;
                        }

                        const primitive = matchImport(
                            OWNED_PRIMITIVES,
                            candidate.callee.name
                        );
                        context.report({
                            node: candidate,
                            messageId: "ownedPrimitiveInRef",
                            data: {
                                diagnostic: diagnosticFor(primitive),
                                name: candidate.callee.name
                            }
                        });
                    });
                }
            }
        };
    }
};
